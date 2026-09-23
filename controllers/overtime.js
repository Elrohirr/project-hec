const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')
const User = require('../models/User')
const { calcDistribution, extractPayDate, defineValue, bankMinutes } = require('../utils/rules')
const { timeToMinutes, minutesToTime, validateFormat } = require('../utils/timeConversion')
const { createMealVoucherService, updateMealVoucherService, deleteMealVoucherService } = require('../services/mealVoucherService')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, NotFoundError } = require('../errors')

// --------------------------- GET todos os registros de hora extra do usuário -----------------------------------------------------
const getAllOvertime = async (req, res) => {
    const { user: { userId }, query: { isHoliday, isDayOff, startDate, endDate, startPayDate, endPayDate, sort } } = req

    const queryObject = { createdBy: new mongoose.Types.ObjectId(userId) }
    if (isHoliday) queryObject.isHoliday = isHoliday === 'true' ? true : false
    if (isDayOff) queryObject.isDayOff = isDayOff === 'true' ? true : false
    if (startDate || endDate) {
        queryObject.date = {}
        if (startDate) queryObject.date.$gte = new Date(startDate)
        if (endDate) queryObject.date.$lte = new Date(endDate)
    }
    if (startPayDate || endPayDate) {
        queryObject.payDate = {}
        if (startPayDate) queryObject.payDate.$gte = new Date(startPayDate)
        if (endPayDate) queryObject.payDate.$lte = new Date(endPayDate)
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

    const distribution = (await Overtime.aggregate([
        { $match: queryObject },
        {
            $group: {
                _id: null,
                he50: { $sum: "$distributionMinutes.he50minutes" },
                he75: { $sum: "$distributionMinutes.he75minutes" },
                he100: { $sum: "$distributionMinutes.he100minutes" },
                heHoliday: { $sum: { $cond: [{ $eq: ["$isHoliday", true] }, "$workedMinutes", 0] } }
            }
        }
    ])
    )[0]

    const values = (await Overtime.aggregate([
        { $match: queryObject },
        {
            $group: {
                _id: null,
                valueHe50: { $sum: "$values.valueHe50" },
                valueHe75: { $sum: "$values.valueHe75" },
                valueHe100: { $sum: "$values.valueHe100" },
                valueHeHoliday: { $sum: { $cond: [{ $eq: ["$isHoliday", true] }, "$values.valueHe100", 0] } },
                total: { $sum: "$values.total" }
            }
        },
        {
            $project: {
                valueHe50: { $round: ["$valueHe50", 2] },
                valueHe75: { $round: ["$valueHe75", 2] },
                valueHe100: { $round: ["$valueHe100", 2] },
                valueHeHoliday: { $round: ["$valueHeHoliday", 2] },
                total: { $round: ["$total", 2] },
            }
        }
    ])
    )[0] || { valueHe50: 0, valueHe75: 0, valueHe100: 0, valueHeHoliday: 0, total: 0 }

    const overtime = await result
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
            const { body: { workedHours, date, isDayOff, isHoliday }, user: { userId } } = req
            if (!workedHours || !date) throw new BadRequestError('Por favor, informe quantas horas extras foram feitas e a data')
            const wage = await User.findById(userId).select('wage').session(session)

            //validar formato
            validateFormat(workedHours, false)

            //criar whitelist
            const workedMinutes = timeToMinutes(workedHours)
            const bankedMinutes = bankMinutes(workedMinutes, isHoliday)
            const distributionMinutes = calcDistribution(workedMinutes, isDayOff, isHoliday)

            const createFields = {
                createdBy: userId,
                workedHours,
                workedMinutes,
                date,
                distributionMinutes,
                distributionHours: {
                    he50hours: minutesToTime(distributionMinutes.he50minutes),
                    he75hours: minutesToTime(distributionMinutes.he75minutes),
                    he100hours: minutesToTime(distributionMinutes.he100minutes)
                },
                values: defineValue(distributionMinutes, wage.wage),
                wageAtCalculation: wage.wage,
                payDate: extractPayDate(date, isHoliday),
                isDayOff: isDayOff ?? false,
                isHoliday: isHoliday ?? false,
                bankedMinutes
            }

            const [overtime] = await Overtime.create([createFields], { session })
            const mealVoucher = await createMealVoucherService(overtime, session)
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
            const { body: { workedHours, date, isHoliday, isDayOff }, user: { userId }, params: { id: overtimeId } } = req
            if (workedHours === '' || date === '') throw new BadRequestError('Campos de quantidade e data não podem ser vazios')

            const oldOvertime = await Overtime.findOne({ createdBy: userId, _id: overtimeId }).session(session)
            if (!oldOvertime) throw new NotFoundError('Hora extra não encontrada')
            if (oldOvertime.compensatedMinutes > 0) throw new BadRequestError('Não é possível editar horas extras que foram compensadas parcialmente ou totalmente. Primeiro, verifique a qual compensação ela está atrelada e cancele a mesma.')

            // update parcial
            const finalWorkedHours = (workedHours ?? oldOvertime.workedHours).trim()
            const finalDate = date ?? oldOvertime.date
            const finalIsDayOff = isDayOff ?? oldOvertime.isDayOff
            const finalIsHoliday = isHoliday ?? oldOvertime.isHoliday
            const wage = oldOvertime.wageAtCalculation

            //validar formato, whitelist e recaulcular regras de negócio
            validateFormat(finalWorkedHours, false)
            const finalWorkedMinutes = timeToMinutes(finalWorkedHours)
            const distributionMinutes = calcDistribution(finalWorkedMinutes, finalIsDayOff, finalIsHoliday)

            const updateFields = {
                workedHours: finalWorkedHours,
                workedMinutes: finalWorkedMinutes,
                date: finalDate,
                distributionMinutes,
                distributionHours: {
                    he50hours: minutesToTime(distributionMinutes.he50minutes),
                    he75hours: minutesToTime(distributionMinutes.he75minutes),
                    he100hours: minutesToTime(distributionMinutes.he100minutes)
                },
                values: defineValue(distributionMinutes, wage),
                wageAtCalculation: wage,
                payDate: extractPayDate(finalDate, finalIsHoliday),
                isDayOff: finalIsDayOff,
                isHoliday: finalIsHoliday,
                bankedMinutes: bankMinutes(finalWorkedMinutes, finalIsHoliday)
            }

            const newOvertime = await Overtime.findOneAndUpdate({ createdBy: userId, _id: overtimeId },
                updateFields, {
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