const Overtime = require('../models/Overtime')
const User = require('../models/User')
const { calcDistribution, extractPayDate } = require('../utils')
const mongoose = require('mongoose')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError } = require('../errors')

const getAllOvertime = async (req, res) => {
    const overtime = await Overtime.find({ createdBy: req.user.userId })
    const user = await User.findById(req.user.userId)
    const wage = user.wage

    const distribution = await Overtime.aggregate([
        { $match: { createdBy: new mongoose.Types.ObjectId(req.user.userId) } },
        {
            $group: {
                _id: null,
                he50: { $sum: "$distribution.he50" },
                he75: { $sum: "$distribution.he75" },
                he100: { $sum: "$distribution.he100" }
            }
        }
    ])

    const [total] = distribution
    const he50 = total?.he50 || 0
    const he75 = total?.he75 || 0
    const he100 = total?.he100 || 0

    res.status(StatusCodes.OK)
        .json({
            horas: { he50, he75, he100 },
            values: {
                'Horas extras 50%': he50 * wage * 1.5,
                'Horas extras 75%': he75 * wage * 1.75,
                'Horas extras 100%': he100 * wage * 2,
                'total': (he50 * wage * 1.5) + (he75 * wage * 1.75) + (he100 * wage * 2)
            }, overtime
        })
}

const getOvertime = async (req, res) => {
    const { user: { userId }, params: { id: overtimeId } } = req
    const overtime = await Overtime.findOne({ createdBy: userId, _id: overtimeId })
    if (!overtime) throw new BadRequestError('Hora extra não encontrada')

    const user = await User.findById(userId)
    const wage = user.wage

    const he50 = overtime.distribution.he50
    const he75 = overtime.distribution.he75
    const he100 = overtime.distribution.he100

    res.status(StatusCodes.OK)
        .json({
            values: {
                'Horas extras 50%': he50 * wage * 1.5,
                'Horas extras 75%': he75 * wage * 1.75,
                'Horas extras 100%': he100 * wage * 2,
                'total': (he50 * wage * 1.5) + (he75 * wage * 1.75) + (he100 * wage * 2)
            }, overtime
        })
}

const createOvertime = async (req, res) => {
    req.body.createdBy = req.user.userId
    const { quantity, date, isDayOff, isHoliday } = req.body
    if (!quantity || !date) throw new BadRequestError('Por favor, insira a quantidade de hora extra e o dia')

    const existingOvertime = await Overtime.findOne({ createdBy: req.body.createdBy, date: date })
    if (existingOvertime) throw new BadRequestError('Já existe um registro de hora extra para esta data. Por favor, insira outra data.')

    const payDate = extractPayDate(isHoliday, date)
    req.body.payDate = payDate

    const distribution = calcDistribution(quantity, isDayOff, isHoliday)
    req.body.distribution = distribution

    const overtime = await Overtime.create({ ...req.body })
    res.status(StatusCodes.CREATED).json({ overtime })
}

const updateOvertime = async (req, res) => {
    const { body: { quantity, date, isHoliday, isDayOff }, user: { userId }, params: { id: overtimeId } } = req

    if (quantity === '' || date === '') throw new BadRequestError('Campos de quantidade e data não podem ser vazios')

    const oldOvertime = await Overtime.findOne({ createdBy: userId, _id: overtimeId })
    const existingOvertime = await Overtime.findOne({ createdBy: userId, date: date })
    if (existingOvertime && !existingOvertime._id.equals(oldOvertime._id)) {
        throw new BadRequestError('Já existe um registro de hora extra para esta data. Por favor, insira outra data.')
    }

    // update parcial
    const finalQuantity = req.body.quantity ?? oldOvertime.quantity
    const finalDate = req.body.date ?? oldOvertime.date
    const finalIsHoliday = req.body.isHoliday ?? oldOvertime.isHoliday
    const finalIsDayOff = req.body.isDayOff ?? oldOvertime.isDayOff

    //recalcular regras de negócio
    const distribution = calcDistribution(finalQuantity, finalIsHoliday, finalIsDayOff)
    req.body.distribution = distribution

    const payDate = extractPayDate(finalIsHoliday, finalDate)
    req.body.payDate = payDate

    const newOvertime = await Overtime.findOneAndUpdate({ createdBy: userId, _id: overtimeId },
        req.body, {
        returnDocument: 'after',
        runValidators: true
    })
    res.status(StatusCodes.OK).json({ newOvertime })
}

const deleteOvertime = async (req, res) => {
    const { user: { userId }, params: { id: heId } } = req
    const overtime = await Overtime.findOneAndDelete({ createdBy: userId, _id: heId })
    if (!overtime) {
        throw new BadRequestError('Hora extra não encontrada')
    }
    res.status(StatusCodes.OK).json({ overtime })
}

module.exports = { getAllOvertime, getOvertime, createOvertime, updateOvertime, deleteOvertime }