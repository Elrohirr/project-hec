const mongoose = require('mongoose')
const MealVoucher = require('../models/MealVoucher')
const MealVoucherConfig = require('../models/MealVoucherConfig')
const { calcMealVoucher } = require('./rules')
const { NotFoundError } = require('../errors')

// ------------------------------------ Service para criar ticket originado de uma hora extra ----------------------------------------------------------
async function createMealVoucherService(overtime, session) {
    const rule = calcMealVoucher(overtime.quantity)
    const config = await MealVoucherConfig.findOne({ code: rule }).session(session)
    if (!config) throw new NotFoundError('Regra não encontrada')

    const mealVoucherObject = {
        createdBy: overtime.createdBy,
        overtimeId: overtime._id,
        source: 'overtime',
        ruleCode: rule,
        date: overtime.date,
        quantity: config.quantity,
        unitValue: config.unitValue,
        totalValue: config.unitValue * config.quantity
    }
    return await MealVoucher.create([{ ...mealVoucherObject }], { session })
}

// ------------------------------------ Service para atualizar ticket originado de uma hora extra ----------------------------------------------------------
async function updateMealVoucherService(overtime, session) {
    const rule = calcMealVoucher(overtime.quantity)
    const config = await MealVoucherConfig.findOne({ code: rule }).session(session)
    if (!config) throw new NotFoundError('Regra não encontrada')

    const mealVoucherObject = {
        ruleCode: rule,
        date: overtime.date,
        quantity: config.quantity,
        unitValue: config.unitValue,
        totalValue: config.unitValue * config.quantity
    }
    const mealVoucher = await MealVoucher.findOneAndUpdate({ overtimeId: overtime._id },
        mealVoucherObject,
        {
            returnDocument: 'after',
            runValidators: true,
            session
        })
    if (!mealVoucher) throw new NotFoundError('Ticket não encontrado')
    return mealVoucher
}

// ----------------------------- Service para excluir ticket originado por hora extra ---------------------------------------------------------------     
async function deleteMealVoucherService(overtimeId, session) {
    const mealVoucher = await MealVoucher.findOneAndDelete({ overtimeId }, { session })
    if (!mealVoucher) throw new NotFoundError('Ticket não encontrado')
    return mealVoucher
}
module.exports = { createMealVoucherService, updateMealVoucherService, deleteMealVoucherService }