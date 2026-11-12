const mongoose = require('mongoose')
const { StatusCodes } = require('http-status-codes')
const Overtime = require('../models/Overtime')
const BankCompensation = require('../models/BankCompensation')
const { findEligibleOvetimes, confirmCompensationService } = require('../services/bankService')
const { getClosedMonthCutoff } = require('../utils/rules')
const { validateFormat, validateDate } = require('../utils/timeConversion')
const { BadRequestError, NotFoundError } = require('../errors')

// --------------------------- Realiza a simulação de um banco de hroas, sem gravar no banco -----------------------------------------------------
const simulateBankCompensation = async (req, res) => {
    const { user: { userId }, body: { date } } = req
    const hoursNeeded = (req.body.hoursNeeded || '08:00').trim()

    //validações
    if (!date) throw new BadRequestError('Por favor, informe a data da compensação.')
    const formattedDate = validateDate(date)
    validateFormat(hoursNeeded, false)

    const entries = await findEligibleOvetimes(userId, hoursNeeded, formattedDate)
    res.status(StatusCodes.OK).json(entries)
}

// --------------------------- Cria um documento de banco de horas, alterando as horas extras que forem selecionadas -----------------------------------------------------
const confirmBankCompensation = async (req, res) => {
    const { user: { userId }, body: { date } } = req
    const hoursNeeded = (req.body.hoursNeeded || '08:00').trim()

    // validações
    if (!date) throw new BadRequestError('Por favor, informe a data da compensação.')
    validateFormat(hoursNeeded, false)

    const bankCompensation = await confirmCompensationService(userId, hoursNeeded, date)
    res.status(StatusCodes.CREATED).json(bankCompensation)
}

// --------------------------- GET todos os registros de banco de horas -----------------------------------------------------
const getAllBankCompensation = async (req, res) => {
    const { user: { userId } } = req
    const actualDate = getClosedMonthCutoff(Date.now())

    const bankedMinutesTotal = (await Overtime.aggregate([
        { $match: { createdBy: new mongoose.Types.ObjectId(userId), date: { $gte: actualDate } } },
        { $group: { _id: null, balance: { $sum: { $subtract: ["$bankedMinutes", "$compensatedMinutes"] } } } }
    ]))[0] || { balance: 0 }

    const totalValueCompensated = (await Overtime.aggregate([
        { $match: { createdBy: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: null, compensatedValue: { $sum: "$compensatedValue" } } }
    ]))[0] || { compensatedValue: 0 }

    const totalValueCompensatedByTier = (await Overtime.aggregate([
        { $match: { createdBy: new mongoose.Types.ObjectId(userId), compensatedValue: { $gt: 0 } } },
        {
            $group: {
                _id: null,
                he50minutes: { $sum: "$distributionMinutes.he50minutes" },
                he75minutes: { $sum: "$distributionMinutes.he75minutes" },
                he100minutes: { $sum: "$distributionMinutes.he100minutes" },
                value50: { $sum: "$values.valueHe50" },
                value75: { $sum: "$values.valueHe75" },
                value100: { $sum: "$values.valueHe100" },
                compensatedMinutesHe50: { $sum: "$compensatedMinutesByTier.he50minutes" },
                compensatedMinutesHe75: { $sum: "$compensatedMinutesByTier.he75minutes" },
                compensatedMinutesHe100: { $sum: "$compensatedMinutesByTier.he100minutes" }
            }
        },
        {
            // stage 1: calculo dos ratios
            $addFields: {
                valueByMinute50: {
                    $cond: { if: { $eq: ["$he50minutes", 0] }, then: 0, else: { $divide: ["$value50", "$he50minutes"] } }
                },
                valueByMinute75: {
                    $cond: { if: { $eq: ["$he75minutes", 0] }, then: 0, else: { $divide: ["$value75", "$he75minutes"] } }
                },
                valueByMinute100: {
                    $cond: { if: { $eq: ["$he100minutes", 0] }, then: 0, else: { $divide: ["$value100", "$he100minutes"] } }
                },
            }
        },
        {
            // stage 2: calculo de valores por tier
            $addFields: {
                valueLost50: { $multiply: ["$valueByMinute50", "$compensatedMinutesHe50"] },
                valueLost75: { $multiply: ["$valueByMinute75", "$compensatedMinutesHe75"] },
                valueLost100: { $multiply: ["$valueByMinute100", "$compensatedMinutesHe100"] }
            }
        },
        {
            // stage 3: shape final, enviado ao response
            $project: {
                _id: 0,
                valueLost50: 1,
                valueLost75: 1,
                valueLost100: 1
            }
        }
    ]))[0]

    const bankCompensation = await BankCompensation.find({ createdBy: userId })
    res.status(StatusCodes.OK).json({
        bankedMinutesTotal,
        totalValueCompensatedByTier,
        totalValueCompensated,
        bankCompensation
    })
}

// --------------------------- Cancela um registro de banco de horas, restaurando as horas extras relacionadas -----------------------------------------------------
const cancelBankCompensation = async (req, res) => {
    const { user: { userId }, params: { id: bankCompId } } = req
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const bankCompensation = await BankCompensation.findOne({ createdBy: userId, _id: bankCompId }).session(session)

            // validações para se o banco de horas está valido para cancelamento
            if (!bankCompensation) throw new NotFoundError('Banco de horas não encontrado')
            if (bankCompensation.status === 'cancelled') throw new BadRequestError('Banco de hora selecionado já se encontra cancelado')
            if (bankCompensation.source === 'pdf_import') throw new BadRequestError('Compensações vindas de PDF import não podem ser canceladas. Verifique com o administrador')

            // iteração sobre cada documento de overtime dentro de entries para restaurar ao valor original
            for (const overtime of bankCompensation.entries) {
                await Overtime.findByIdAndUpdate(
                    overtime.overtimeId,
                    {
                        $inc: {
                            compensatedMinutes: -overtime.minutesUsed,
                            "compensatedMinutesByTier.he50minutes": -overtime.minutesUsedByTier.he50,
                            "compensatedMinutesByTier.he75minutes": -overtime.minutesUsedByTier.he75,
                            "compensatedMinutesByTier.he100minutes": -overtime.minutesUsedByTier.he100,
                            compensatedValue: -overtime.valueLost
                        }
                    }, { runValidators: true, session }
                )
            }
            await bankCompensation.updateOne({ status: 'cancelled' }, { session })
        })
        res.status(StatusCodes.OK).json({ msg: 'Banco de horas cancelado com sucesso' })
    } finally {
        await session.endSession()
    }
}

module.exports = {
    simulateBankCompensation, confirmBankCompensation,
    getAllBankCompensation, cancelBankCompensation
}