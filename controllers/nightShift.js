const mongoose = require('mongoose')
const User = require('../models/User')
const NightShift = require('../models/NightShift')
const { createMealVoucherService, updateMealVoucherService, deleteMealVoucherService } = require('../utils/services')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, NotFoundError } = require('../errors')
const { extractPayDate } = require('../utils/rules')

const getAllNightShift = async (req,res) => {
    const {user:{userId}} = req
    const nightShift = await NightShift.find({createdBy:userId})
    res.status(StatusCodes.OK).json(nightShift)
}
const getNightShift = async (req,res) => {
    res.send('get single night shift')
}

const createNightShift = async (req,res) => {
    const session = await mongoose.startSession()
    try{
        const result = await session.withTransaction(async () =>{
            req.body.createdBy = req.user.userId
            const { body: {totalNightHours, date } } = req
            if (!date) throw new BadRequestError('Por favor, insira a data do turno noturno')

            req.body.payDate = extractPayDate(date,false)
            req.body.wageAtCalculation = req.user.wage
            req.body.nightShiftValue = ((totalNightHours || 7) * 8/7 * req.user.wage * 0.38)

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

const updateNightShift = async (req,res) => {
    res.send('update night shift')
}

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
