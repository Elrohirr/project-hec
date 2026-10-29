const mongoose = require('mongoose')
const NightShift = require('../models/NightShift')
const { createNightShiftService, deleteNightShiftService } = require('../services/nightShiftService')
const { updateMealVoucherService } = require('../services/mealVoucherService')
const { getWageAt, defineNightValue, extractPayDate } = require('../utils/rules')
const { validadeIdArray } = require('../utils/helper')
const { timeToMinutes, minutesToTime, convertToReducedNightMinutes, validateFormat, validateDate } = require('../utils/timeConversion')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, NotFoundError } = require('../errors')

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

    const totals = (await NightShift.aggregate([
        { $match: queryObject },
        {
            $group: {
                _id: null,
                nightMinutesClock: { $sum: "$nightMinutesClock" },
                nightMinutesReduced: { $sum: "$nightMinutesReduced" },
                nightShiftValue: { $sum: "$nightShiftValue" },
            }
        }
    ]))[0] || { nightMinutesClock: 0, nightMinutesReduced: 0, nightShiftValue: 0 }

    const nightShift = await result.lean()
    const totalRecords = await NightShift.countDocuments(queryObject)
    res.status(StatusCodes.OK).json({
        totalRecords,
        numberOfPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        totals,
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
    const { body: { date }, user: { userId } } = req
    const nightHoursClock = (req.body.nightHoursClock || '07:00').trim()
    const result = await createNightShiftService({ date, nightHoursClock, userId })
    res.status(StatusCodes.CREATED).json(result)
}

// --------------------------- PATCH apenas um registro de turno noturno do usuário -----------------------------------------------------
const updateNightShift = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { body: { date }, user: { userId }, params: { id: nightShiftId } } = req
            if (date === "") throw new BadRequestError('A data não pode ser vazia')

            const oldNightShift = await NightShift.findOne({ createdBy: userId, _id: nightShiftId }).session(session)
            if (!oldNightShift) throw new NotFoundError("Registro de turno noturno não encontrado")

            // update parcial: se `nightHoursClock` vier vazio, aplica o mesmo fallback '07:00' do CREATE
            const finalNightHoursClock = ((req.body.nightHoursClock ?? oldNightShift.nightHoursClock) || '07:00').trim()
            const finalDate = req.body.date ?? oldNightShift.date

            //validar formato e recaulcular regras de negócio
            let wageId = null
            let wageAtCalculation = null
            const formatedDate = validateDate(finalDate)
            if (formatedDate.getTime() !== oldNightShift.date.getTime() || oldNightShift.wageId == null) {
                const wage = await getWageAt(userId, formatedDate, session)
                wageId = wage._id
                wageAtCalculation = wage.wage
            } else {
                wageId = oldNightShift.wageId
                wageAtCalculation = oldNightShift.wageAtCalculation
            }

            validateFormat(finalNightHoursClock, true)
            const reducedMinutes = convertToReducedNightMinutes(finalNightHoursClock)

            // whitelist
            const updateFields = {
                nightHoursClock: finalNightHoursClock,
                nightMinutesClock: timeToMinutes(finalNightHoursClock),
                nightHoursReduced: minutesToTime(reducedMinutes),
                nightMinutesReduced: reducedMinutes,
                date: formatedDate,
                nightShiftValue: defineNightValue(reducedMinutes, wageAtCalculation),
                wageId,
                wageAtCalculation,
                payDate: extractPayDate(formatedDate, true) // segundo argumento como true, pois o pagamento de AD Noturno é sempre no mês seguinte
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
    const { user: { userId }, params: { id: nightShiftId } } = req
    const result = await deleteNightShiftService(userId, nightShiftId)
    res.status(StatusCodes.OK).json(result)
}

const multiDeleteNightShift = async (req, res) => {
    const { body: { nightShifts }, user: { userId } } = req

    // validações
    const validadedNightShifts = validadeIdArray(nightShifts, 'noturnas')

    let deleted = []
    let rejected = []

    for (const nightShiftId of validadedNightShifts) {
        try {
            if (!mongoose.isValidObjectId(nightShiftId)) throw new BadRequestError('Objeto inválido.')
            const nightShift = await deleteNightShiftService(userId, nightShiftId)
            deleted.push(nightShift)
        } catch (error) {
            rejected.push({ id: nightShiftId, msg: error.message })
        }
    }

    res.status(StatusCodes.OK).json({ deleted, rejected })

}

module.exports = { getAllNightShift, getNightShift, createNightShift, updateNightShift, deleteNightShift, multiDeleteNightShift }
