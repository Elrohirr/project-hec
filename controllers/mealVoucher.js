const MealVoucher = require('../models/MealVoucher')
const MealVoucherConfig = require('../models/MealVoucherConfig')
const mongoose = require('mongoose')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, NotFoundError } = require('../errors')

// --------------------------- GET todos os registros de ticket do usuário -----------------------------------------------------
const getAllMealVouchers = async (req, res) => {
    const { user: { userId } } = req
    const mealVoucher = await MealVoucher.find({ createdBy: userId })
    res.status(StatusCodes.OK).json({ mealVoucher })
}

// --------------------------- GET apenas um registro de ticket específico do usuário ------------------------------------------
const getMealVoucher = async (req, res) => {
    const { user: { userId }, params: { id: mealVoucherId } } = req
    const mealVoucher = await MealVoucher.findOne({ createdBy: userId, _id: mealVoucherId }).lean()
    if (!mealVoucher) throw new NotFoundError('Ticket não encontrado')
    res.status(StatusCodes.OK).json({ mealVoucher })
}

// --------------------------- CREATE apenas um registro de ticket exclusivamente noturno  ------------------------------------------
const createMealVoucher = async (req, res) => {
    const { body: { date } } = req
    const config = await MealVoucherConfig.findOne({ code: 'NIGHT_SHIFT' })
    if (!config) throw new NotFoundError('Regra não encontrada')

    const mealVoucher = await MealVoucher.create({
        createdBy: req.user.userId,
        overtimeId: null,
        source: 'night_shift',
        ruleCode: 'NIGHT_SHIFT',
        date,
        quantity: config.quantity,
        unitValue: config.unitValue,
        totalValue: config.quantity * config.unitValue
    })
    res.status(StatusCodes.CREATED).json(mealVoucher)
}

// --------------------------- UPDATE apenas um registro de ticket exclusivamente noturno  ------------------------------------------
const updateMealVoucher = async (req, res) => {
    const { user: { userId }, body: { date }, params: { id: mealVoucherId } } = req
    if (date === '') throw new BadRequestError('Data não pode ser vazia')

    const mealVoucher = await MealVoucher.findOneAndUpdate({ createdBy: userId, _id: mealVoucherId },
        { date },
        {
            returnDocument: 'after',
            runValidators: true,
        })
    if (!mealVoucher) throw new NotFoundError('Vale Refeição não encontrado')

    res.status(StatusCodes.OK).json(mealVoucher)
}

// --------------------------- DELETE apenas um registro de ticket exclusivamente noturno  ------------------------------------------
const deleteMealVoucher = async (req, res) => {
    const { user: { userId }, params: { id: mealVoucherId } } = req
    const mealVoucher = await MealVoucher.findOneAndDelete({ createdBy: userId, _id: mealVoucherId })
    if (!mealVoucher) throw new NotFoundError('Vale Refeição não encontrado')
    res.status(StatusCodes.OK).json(mealVoucher)
}

module.exports = { getAllMealVouchers, getMealVoucher, createMealVoucher, updateMealVoucher, deleteMealVoucher }