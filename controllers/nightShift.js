const mongoose = require('mongoose')
const User = require('../models/User')
const NightShift = require('../models/NightShift')
const { createMealVoucherService, updateMealVoucherService, deleteMealVoucherService } = require('../utils/services')
const { timeToMinutes, minutesToTime, convertToReducedNightMinutes, validateFormat } = require('../utils/timeConversion')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, NotFoundError } = require('../errors')
const { defineNightValue, extractPayDate } = require('../utils/rules')

// --------------------------- GET todos os registros de turno noturno do usuário -----------------------------------------------------
const getAllNightShift = async (req, res) => {
    const { user: { userId }, query: { startDate, endDate, startPayDate, endPayDate, sort } } = req
    const queryObject = { createdBy: new mongoose.Types.ObjectId(userId) }
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
    let result = NightShift.find(queryObject)
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

    const nightShift = await result.lean()
    const totalRecords = await NightShift.countDocuments(queryObject)
    res.status(StatusCodes.OK).json({
        totalRecords,
        numberOfPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        nightShift
    })
}

// --------------------------- GET apenas um registro de turno noturno do usuário -----------------------------------------------------
const getNightShift = async (req, res) => {
    const { user: { userId }, params: { id: nightShiftId } } = req
    const nightShift = await NightShift.findOne({ createdBy: userId, _id: nightShiftId })
    if (!nightShift) throw new NotFoundError('Registro de turno noturno não encontrado')
    res.status(StatusCodes.OK).json(nightShift)
}

// --------------------------- CREATE apenas um registro de turno noturno do usuário -----------------------------------------------------
const createNightShift = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { body: { date }, user: { userId } } = req
            const nightHoursClock = (req.body.nightHoursClock || '07:00').trim()
            if (!date) throw new BadRequestError('Por favor, insira a data do turno noturno')
            const wage = await User.findById(userId).select('wage')

            //validar formato
            validateFormat(nightHoursClock, true)
            const reducedMinutes = convertToReducedNightMinutes(nightHoursClock)

            //whitelist
            const createFields = {
                createdBy: userId,
                nightHoursClock,
                date,
                nightHoursReduced: minutesToTime(reducedMinutes),
                nightShiftValue: defineNightValue(reducedMinutes, wage.wage),
                wageAtCalculation: wage.wage,
                payDate: extractPayDate(date, true) // segundo parametro como true pois o pagamento de todo AD Noturno é no mês seguinte
            }

            const [nightShift] = await NightShift.create([createFields], { session })
            const mealVoucher = await createMealVoucherService(nightShift, session)
            return { nightShift, mealVoucher }
        })
        res.status(StatusCodes.CREATED).json(result)
    }
    finally {
        await session.endSession()
    }
}

// --------------------------- PATCH apenas um registro de turno noturno do usuário -----------------------------------------------------
const updateNightShift = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { body: { date }, user: { userId }, params: { id: nightShiftId } } = req
            if (date === "") throw new BadRequestError('A data não pode ser vazia')

            const wage = await User.findById(userId).select('wage')

            const oldNightShift = await NightShift.findOne({ createdBy: userId, _id: nightShiftId }).session(session)
            if (!oldNightShift) throw new NotFoundError("Registro de turno noturno não encontrado")

            // update parcial: se `nightHoursClock` vier vazio, aplica o mesmo fallback '07:00' do CREATE
            const finalNightHoursClock = ((req.body.nightHoursClock ?? oldNightShift.nightHoursClock) || '07:00').trim()
            const finalDate = req.body.date ?? oldNightShift.date

            //validar formato, whitelist e recaulcular regras de negócio
            validateFormat(finalNightHoursClock, true)
            const reducedMinutes = convertToReducedNightMinutes(finalNightHoursClock)

            const updateFields = {
                nightHoursClock: finalNightHoursClock,
                nightHoursReduced: minutesToTime(reducedMinutes),
                date: finalDate,
                nightShiftValue: defineNightValue(reducedMinutes, wage.wage),
                wageAtCalculation: wage.wage,
                payDate: extractPayDate(finalDate, true) // segundo parametro como true pois o pagamento de todo AD Noturno é no mês seguinte
            }

            const newNightShift = await NightShift.findOneAndUpdate({ createdBy: userId, _id: nightShiftId },
                updateFields, {
                returnDocument: 'after',
                runValidators: true,
                session
            })
            const newMealVoucher = await updateMealVoucherService(newNightShift, session)
            return { newNightShift, newMealVoucher }
        })
        res.status(StatusCodes.OK).json(result)
    }
    finally {
        await session.endSession()
    }
}

// --------------------------- DELETE apenas um registro de turno noturno do usuário -----------------------------------------------------
const deleteNightShift = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { user: { userId }, params: { id: nightShiftId } } = req
            const nightShift = await NightShift.findOneAndDelete({ createdBy: userId, _id: nightShiftId }, { session })
            if (!nightShift) throw new NotFoundError('Turno noturno não encontrada')
            const mealVoucher = await deleteMealVoucherService(nightShift._id, session)
            return { nightShift, mealVoucher }
        })
        res.status(StatusCodes.OK).json(result)
    } finally {
        await session.endSession()
    }
}

module.exports = { getAllNightShift, getNightShift, createNightShift, updateNightShift, deleteNightShift }
