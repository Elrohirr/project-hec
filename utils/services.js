const mongoose = require('mongoose')
const MealVoucher = require('../models/MealVoucher')
const MealVoucherConfig = require('../models/MealVoucherConfig')
const { calcMealVoucher } = require('./rules')
const { NotFoundError } = require('../errors')

// ------------------------------------ Service para criar ticket originado de uma hora extra ou turno noturno ----------------------------------------------------------
async function createMealVoucherService(ref, session) {
    const rule = calcMealVoucher(ref.quantity, ref.totalNightHours)
    const config = await MealVoucherConfig.findOne({ code: rule.rule }).session(session)
    if (!config) throw new NotFoundError('Regra não encontrada')

    const mealVoucherObject = {
        createdBy: ref.createdBy,
        ref_Id: ref._id,
        source: rule.source,
        ruleCode: rule.rule,
        date: ref.date,
        quantity: config.quantity,
        unitValue: config.unitValue,
        totalValue: config.unitValue * config.quantity
    }
    return await MealVoucher.create([{ ...mealVoucherObject }], { session })
}

// ------------------------------------ Service para atualizar ticket originado de uma hora extra ----------------------------------------------------------
async function updateMealVoucherService(ref, session) {
    const rule = calcMealVoucher(ref.quantity, ref.totalNightHours)
    const config = await MealVoucherConfig.findOne({ code: rule.rule }).session(session)
    if (!config) throw new NotFoundError('Regra não encontrada')

    const mealVoucherObject = {
        ruleCode: rule.rule,
        date: ref.date,
        quantity: config.quantity,
        unitValue: config.unitValue,
        totalValue: config.unitValue * config.quantity
    }
    const mealVoucher = await MealVoucher.findOneAndUpdate({ ref_Id: ref._id },
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
async function deleteMealVoucherService(ref_Id, session) {
    const mealVoucher = await MealVoucher.findOneAndDelete({ ref_Id }, { session })
    if (!mealVoucher) throw new NotFoundError('Ticket não encontrado')
    return mealVoucher
}
module.exports = { createMealVoucherService, updateMealVoucherService, deleteMealVoucherService }