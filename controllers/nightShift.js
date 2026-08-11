const mongoose = require('mongoose')
const User = require('../models/User')
const NightShift = require('../models/NightShift')
const { createMealVoucherService, updateMealVoucherService, deleteMealVoucherService } = require('../utils/services')
const {timeToMinutes, minutesToTime, convertToReducedNightMinutes, validateFormat} = require('../utils/timeConversion')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, NotFoundError } = require('../errors')
const { extractPayDate } = require('../utils/rules')

// --------------------------- GET todos os registros de turno noturno do usuário -----------------------------------------------------
const getAllNightShift = async (req,res) => {
    const {user:{userId}, query:{startDate, endDate, startPayDate, endPayDate, sort}} = req
    const queryObject = {createdBy: new mongoose.Types.ObjectId(userId)}
    if (startDate || endDate) {
        queryObject.date = {}
        queryObject.date.$gte = new Date(startDate || '2000-01-01')
        queryObject.date.$lte = new Date(endDate || new Date())
    }
    if (startPayDate || endPayDate){
        queryObject.payDate = {}
        queryObject.payDate.$gte = new Date(startPayDate || '2000-01-01')
        queryObject.payDate.$lte = new Date(endPayDate || new Date())
    }
    let result = NightShift.find(queryObject)
    if (sort){
        const sortedList = sort.split(',').join(' ')
        result = result.sort(sortedList)
    }
    else{
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
        numberOfPages: Math.ceil(totalRecords/limit),
        currentPage:page, 
        nightShift
    })
}

// --------------------------- GET apenas um registro de turno noturno do usuário -----------------------------------------------------
const getNightShift = async (req,res) => {
    const {user:{userId}, params:{id:nightShiftId}} = req
    const nightShift = await NightShift.findOne({createdBy:userId, _id:nightShiftId})
    if (!nightShift) throw new NotFoundError('Registro de turno noturno não encontrado')
    res.status(StatusCodes.OK).json(nightShift)
}

// --------------------------- CREATE apenas um registro de turno noturno do usuário -----------------------------------------------------
const createNightShift = async (req,res) => {
    const session = await mongoose.startSession()
    try{
        const result = await session.withTransaction(async () =>{
            req.body.createdBy = req.user.userId
            const { body: { date }, user:{wage} } = req
            const nightHoursClock = req.body.nightHoursClock || '07:00'
            if (!date) throw new BadRequestError('Por favor, insira a data do turno noturno')

            validateFormat(nightHoursClock, true)
            const clockMinutesTotal = timeToMinutes(nightHoursClock)
            const reducedMinutes = convertToReducedNightMinutes(nightHoursClock)
            req.body.nightHoursClock = minutesToTime(clockMinutesTotal)
            req.body.nightHoursReduced = minutesToTime(reducedMinutes)
            req.body.nightShiftValue = Math.round((reducedMinutes / 60) * wage * 0.38* 100)/100
            req.body.wageAtCalculation = wage
            req.body.payDate = extractPayDate(date,true) // segundo parametro como true pois o pagamento de todo AD Noturno é no mês seguinte

            const [nightShift] = await NightShift.create([{ ...req.body }], { session })
            const mealVoucher = await createMealVoucherService(nightShift, session)
            return { nightShift, mealVoucher }
        })
        res.status(StatusCodes.CREATED).json(result)
    }
    finally{
        await session.endSession()
    }
}

// --------------------------- PATCH apenas um registro de turno noturno do usuário -----------------------------------------------------
const updateNightShift = async (req,res) => {
    const session = await mongoose.startSession()
    try{
        const result = await session.withTransaction(async () =>{
            const { body: {nightHoursClock, date}, user:{userId, wage}, params:{id: nightShiftId}} = req
            if(nightHoursClock === "" || date === "") throw new BadRequestError('Horas noturnas e data não podem ser vazias')

            const oldNightShift = await NightShift.findOne({createdBy:userId, _id:nightShiftId}).session(session)
            if(!oldNightShift) throw new NotFoundError("Registro de turno noturno não encontrado")

            // update parcial
            const finalNightHoursClock = req.body.nightHoursClock ?? oldNightShift.nightHoursClock
            const finalDate = req.body.date ?? oldNightShift.date

            // recaulcular regras de negócio
            validateFormat(finalNightHoursClock, true)
            const clockMinutesTotal = timeToMinutes(finalNightHoursClock)
            const reducedMinutes = convertToReducedNightMinutes(finalNightHoursClock)
            req.body.nightHoursClock = minutesToTime(clockMinutesTotal)
            req.body.nightHoursReduced = minutesToTime(reducedMinutes)
            req.body.nightShiftValue = Math.round((reducedMinutes / 60) * wage * 0.38* 100)/100
            req.body.wageAtCalculation = wage
            req.body.payDate = extractPayDate(finalDate,true) // segundo parametro como true pois o pagamento de todo AD Noturno é no mês seguinte

            const newNightShift = await NightShift.findOneAndUpdate({createdBy:userId, _id:nightShiftId},
                req.body, {
                returnDocument: 'after',
                runValidators: true,
                session
                })
            const newMealVoucher = await updateMealVoucherService(newNightShift, session)
            return {newNightShift, newMealVoucher}
        })
        res.status(StatusCodes.OK).json(result)
    }
    finally{
        await session.endSession()
    }
}

// --------------------------- DELETE apenas um registro de turno noturno do usuário -----------------------------------------------------
const deleteNightShift = async (req,res) => {
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

module.exports = {getAllNightShift, getNightShift, createNightShift, updateNightShift, deleteNightShift}
