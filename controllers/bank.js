const mongoose = require('mongoose')
const { StatusCodes } = require('http-status-codes')
const Overtime = require('../models/Overtime')
const BankCompensation = require('../models/BankCompensation')
const { findEligibleOvetimes, confirmCompensation, cancelCompensation } = require('../services/bankService')
const { getBankClosingCutOff } = require('../utils/rules')
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
    const actualDate = getBankClosingCutOff(Date.now())

    const bankedMinutesPerMonth = (await Overtime.aggregate([
        {
            $match: {
                createdBy: new mongoose.Types.ObjectId(userId),
                date: { $gt: actualDate },
            }
        },
        {
            $group: {
                _id: null,
                bankedMinutes: { $sum: "$bankedMinutes" },
            }
        }
    ]))[0]

    const compensatedMinutesBC = (await BankCompensation.aggregate([
        {
            $match: {
                createdBy: new mongoose.Types.ObjectId(userId),
                status: 'active'
            }
        }, {
            $group: {
                _id: null,
                totalMinutes: { $sum: "$totalMinutes" }
            }
        }
    ]))[0]

    const bankedMinutesTotal = bankedMinutesPerMonth.bankedMinutes - compensatedMinutesBC.totalMinutes

    const bankCompensation = await BankCompensation.find({ createdBy: userId })
    res.status(StatusCodes.OK).json([{ totalBankedMinutes: bankedMinutesTotal }, bankCompensation])
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