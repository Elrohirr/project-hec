const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')
const User = require('../models/User')
const { calcDistribution, extractPayDate, defineValue } = require('../utils/rules')
const { timeToMinutes, minutesToTime, validateFormat } = require('../utils/timeConversion')
const { createMealVoucherService, updateMealVoucherService, deleteMealVoucherService } = require('../utils/services')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, NotFoundError } = require('../errors')

// --------------------------- GET todos os registros de hora extra do usuário -----------------------------------------------------
const getAllOvertime = async (req, res) => {
    const { user: { userId, wage }, query: { isHoliday, isDayOff, startDate, endDate, sort } } = req

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
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const skip = (page - 1) * limit
    result = result.skip(skip).limit(limit)

    const distribution = (
        await Overtime.aggregate([
            { $match: queryObject },
            {
                $group: {
                    _id: null,
                    he50: { $sum: "$distributionMinutes.he50minutes" },
                    he75: { $sum: "$distributionMinutes.he75minutes" },
                    he100: { $sum: "$distributionMinutes.he100minutes" }
                }
            }
        ])
    )[0]

    const values = (
        await Overtime.aggregate([
            { $match: queryObject },
            {
                $group: {
                    _id: null,
                    valueHe50: { $sum: "$values.valueHe50" },
                    valueHe75: { $sum: "$values.valueHe75" },
                    valueHe100: { $sum: "$values.valueHe100" },
                    total: { $sum: "$values.total" }
                }
            }
        ])
    )[0] || { valueHe50: 0, valueHe75: 0, valueHe100: 0, total: 0 }

    const overtime = await result.lean()
    const totalRecords = await Overtime.countDocuments(queryObject)
    res.status(StatusCodes.OK).json({
        totalRecords,
        numberOfPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        distribution,
        values,
        overtime
    })
}

// --------------------------- GET apenas um registro de hora extra específico do usuário ------------------------------------------
const getOvertime = async (req, res) => {
    const { user: { userId }, params: { id: overtimeId } } = req
    const overtime = await Overtime.findOne({ createdBy: userId, _id: overtimeId }).lean()
    if (!overtime) throw new NotFoundError('Hora extra não encontrada')

    const values = overtime.values || { valueHe50: 0, valueHe75: 0, valueHe100: 0, total: 0 }

    res.status(StatusCodes.OK).json({ values, overtime })
}

// --------------------------- POST um registro de hora extra do usuário -------------------------------------------------------------
const createOvertime = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            req.body.createdBy = req.user.userId
            const { body: { workedHours, date, isDayOff, isHoliday }, user:{wage} } = req
            if (!workedHours || !date) throw new BadRequestError('Por favor, insira a quantidade de hora extra e o dia')
            
            // validar formato
            validateFormat(workedHours, false)

            const workedMinutes = timeToMinutes(workedHours)
            req.body.workedHours = workedHours
            req.body.workedMinutes = workedMinutes
            req.body.distributionMinutes = calcDistribution(workedMinutes, isDayOff, isHoliday)
            req.body.distributionHours = {
                he50hours: minutesToTime(req.body.distributionMinutes.he50minutes),
                he75hours: minutesToTime(req.body.distributionMinutes.he75minutes),
                he100hours: minutesToTime(req.body.distributionMinutes.he100minutes),
            }
            req.body.values = defineValue(req.body.distributionMinutes, wage)
            req.body.wageAtCalculation = wage
            req.body.payDate = extractPayDate(date, isHoliday)

            const [overtime] = await Overtime.create([{ ...req.body }], { session })
            const [mealVoucher] = await createMealVoucherService(overtime, session)
            return { overtime, mealVoucher }
        })
        res.status(StatusCodes.CREATED).json(result)
    } finally {
        await session.endSession()
    }
}

// --------------------------- UPDATE apenas um registro de hora extra específico do usuário ------------------------------------------
const updateOvertime = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { body: { workedHours, date, isHoliday, isDayOff }, user: { userId, wage }, params: { id: overtimeId } } = req
            if (workedHours === '' || date === '') throw new BadRequestError('Campos de quantidade e data não podem ser vazios')

            const oldOvertime = await Overtime.findOne({ createdBy: userId, _id: overtimeId }).session(session)
            if (!oldOvertime) throw new NotFoundError('Hora extra não encontrada')

            // update parcial
            const finalWorkedHours = req.body.workedHours ?? oldOvertime.workedHours
            const finalDate = req.body.date ?? oldOvertime.date
            const finalIsDayOff = req.body.isDayOff ?? oldOvertime.isDayOff
            const finalIsHoliday = req.body.isHoliday ?? oldOvertime.isHoliday

            // recalcular regras de negócio (sempre, usando os valores finais)
            validateFormat(finalWorkedHours, false)
            const finalWorkedMinutes = timeToMinutes(finalWorkedHours)
            req.body.workedHours = finalWorkedHours
            req.body.workedMinutes = finalWorkedMinutes
            req.body.distributionMinutes = calcDistribution(finalWorkedMinutes, finalIsDayOff, finalIsHoliday)
            req.body.distributionHours = {
                he50hours: minutesToTime(req.body.distributionMinutes.he50minutes),
                he75hours: minutesToTime(req.body.distributionMinutes.he75minutes),
                he100hours: minutesToTime(req.body.distributionMinutes.he100minutes),
            }
            req.body.values = defineValue(req.body.distributionMinutes, wage)
            req.body.wageAtCalculation = wage
            req.body.payDate = extractPayDate(finalDate, finalIsHoliday)

            const newOvertime = await Overtime.findOneAndUpdate({ createdBy: userId, _id: overtimeId },
                req.body, {
                returnDocument: 'after',
                runValidators: true,
                session
            })
            const newMealVoucher = await updateMealVoucherService(newOvertime, session)
            return { newOvertime, newMealVoucher }
        })
        res.status(StatusCodes.OK).json(result)
    } finally {
        await session.endSession()
    }
}

// --------------------------- DELETE apenas um registro de hora extra específico do usuário ------------------------------------------
const deleteOvertime = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { user: { userId }, params: { id: overtimeId } } = req
            const overtime = await Overtime.findOneAndDelete({ createdBy: userId, _id: overtimeId }, { session })
            if (!overtime) throw new NotFoundError('Hora extra não encontrada')
            const mealVoucher = await deleteMealVoucherService(overtime._id, session)
            return { overtime, mealVoucher }
        })
        res.status(StatusCodes.OK).json(result)
    } finally {
        await session.endSession()
    }
}

module.exports = { getAllOvertime, getOvertime, createOvertime, updateOvertime, deleteOvertime }