const mongoose = require('mongoose')
const { StatusCodes } = require('http-status-codes')
const Overtime = require('../models/Overtime')
const BankCompensation = require('../models/BankCompensation')
const { findEligibleOvetimes, confirmCompensation, cancelCompensation } = require('../services/bankService')
const { getClosedMonthCutoff } = require('../utils/rules')
const { timeToMinutes, validateFormat } = require('../utils/timeConversion')
const { BadRequestError } = require('../errors')

// --------------------------- Realiza a simulação de um banco de hroas, sem gravar no banco -----------------------------------------------------
const simulateBankCompensation = async (req, res) => {
    const { user: { userId }, body: { date } } = req
    const hoursNeeded = (req.body.hoursNeeded || '08:00').trim()

    //validações
    if (!date) throw new BadRequestError('Por favor, informe a data da compensação.')
    validateFormat(hoursNeeded, false)

    const minutesNeeded = timeToMinutes(hoursNeeded)
    const entries = await findEligibleOvetimes(userId, minutesNeeded, date)
    res.status(StatusCodes.OK).json(entries)
}

// --------------------------- Cria um documento de banco de horas, alterando as horas extras que forem selecionadas -----------------------------------------------------
const confirmBankCompensation = async (req, res) => {
    const { user: { userId }, body: { date, hoursNeeded } } = req
    // validações
    if (!hoursNeeded || !date) throw new BadRequestError('Por favor, informe quantas horas para compensar e a data')
    validateFormat(hoursNeeded, false)

    const minutesNeeded = timeToMinutes(hoursNeeded)
    const bankCompensation = await confirmCompensation(userId, minutesNeeded, date)
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

// --------------------------- Cancela um registro de banco de horas, restorando as horas extras relacionadas -----------------------------------------------------
const cancelBankCompesation = async (req, res) => {
    const { user: { userId }, params: { id: bankCompId } } = req
    await cancelCompensation(bankCompId)
    res.status(StatusCodes.OK).json({ msg: 'Banco de horas cancelado com sucesso' })
}

module.exports = {
    simulateBankCompensation, confirmBankCompensation,
    getAllBankCompensation, cancelBankCompesation
}