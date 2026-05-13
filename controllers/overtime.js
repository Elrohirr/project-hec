const Overtime = require('../models/Overtime')
const User = require('../models/User')
const { calcDistribution, extractPayDate, defineValue } = require('../rules')
const mongoose = require('mongoose')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, NotFoundError } = require('../errors')

// --------------------------- GET todos os registros de hora extra do usuário -----------------------------------------------------
const getAllOvertime = async (req, res) => {
    const { user: { userId }, query: { isHoliday, isDayOff, startDate, endDate, sort } } = req
    const { wage } = await User.findById(userId)

    const queryObject = { createdBy: new mongoose.Types.ObjectId(userId) }
    if (isHoliday) queryObject.isHoliday = isHoliday === 'true' ? true : false
    if (isDayOff) queryObject.isDayOff = isDayOff === 'true' ? true : false
    if (startDate || endDate) {
        queryObject.date = {}
        queryObject.date.$gte = new Date(startDate || '2000-01-01')
        queryObject.date.$lte = new Date(endDate || new Date())
    }
    let result = Overtime.find(queryObject)
    if (sort) {
        const sortedList = sort.split(',').join(' ')
        result = result.sort(sortedList)
    }
    else {
        result = result.sort('-date')
    }

    const distribution = (
        await Overtime.aggregate([
            { $match: queryObject },
            {
                $group: {
                    _id: null,
                    he50: { $sum: "$distribution.he50" },
                    he75: { $sum: "$distribution.he75" },
                    he100: { $sum: "$distribution.he100" }
                }
            }
        ])
    )[0]

    const values = defineValue(distribution || { he50: 0, he75: 0, he100: 0 }, wage)
    const overtime = await result
    res.status(StatusCodes.OK).json({ distribution, values, overtime })
}

// --------------------------- GET apenas um registro de hora extra específico do usuário ------------------------------------------
const getOvertime = async (req, res) => {
    const { user: { userId }, params: { id: overtimeId } } = req
    const overtime = await Overtime.findOne({ createdBy: userId, _id: overtimeId })
    if (!overtime) throw new NotFoundError('Hora extra não encontrada')
    const { wage } = await User.findById(userId)

    const values = defineValue(overtime.distribution, wage)

    res.status(StatusCodes.OK).json({ values, overtime })
}

// --------------------------- POST um registro de hora extra do usuário -------------------------------------------------------------
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

// --------------------------- UPDATE apenas um registro de hora extra específico do usuário ------------------------------------------
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

// --------------------------- DELETE apenas um registro de hora extra específico do usuário ------------------------------------------
const deleteOvertime = async (req, res) => {
    const { user: { userId }, params: { id: overtimeId } } = req
    const overtime = await Overtime.findOneAndDelete({ createdBy: userId, _id: overtimeId })
    if (!overtime) {
        throw new NotFoundError('Hora extra não encontrada')
    }
    res.status(StatusCodes.OK).json({ overtime })
}

module.exports = { getAllOvertime, getOvertime, createOvertime, updateOvertime, deleteOvertime }