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
    const {user:{userId}} = req
    const nightShift = await NightShift.find({createdBy:userId})
    res.status(StatusCodes.OK).json(nightShift)
}

// --------------------------- GET apenas um registro de turno noturno do usuário -----------------------------------------------------
const getNightShift = async (req,res) => {
    res.send('get single night shift')
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

            validateFormat(nightHoursClock)

            // validar range de negócio (00:00 até 07:00)
            const clockMinutesTotal = timeToMinutes(nightHoursClock)
            if (clockMinutesTotal < 0 || clockMinutesTotal > 420) throw new BadRequestError('Intervalo fora de range permitido (00:00 até 07:00)')
            
            const reducedMinutes = convertToReducedNightMinutes(nightHoursClock)
            req.body.nightHoursClock = minutesToTime(clockMinutesTotal)
            req.body.nightHoursReduced = minutesToTime(reducedMinutes)
            req.body.nightShiftValue = Math.round((reducedMinutes / 60) * wage * 0.38* 100)/100
            req.body.wageAtCalculation = wage
            req.body.payDate = extractPayDate(date,true)

            const [nightShift] = await NightShift.create([{ ...req.body }], { session })
            const [mealVoucher] = await createMealVoucherService(nightShift, session)
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
    res.send('update night shift')
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
