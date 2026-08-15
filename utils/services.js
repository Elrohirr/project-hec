const MealVoucher = require('../models/MealVoucher')
const MealVoucherConfig = require('../models/MealVoucherConfig')
const { calcMealVoucher, extractPayDate } = require('./rules')
const { NotFoundError } = require('../errors')

// ------------------------------------ Service para criar ticket originado de uma hora extra ou turno noturno ----------------------------------------------------------
async function createMealVoucherService(ref, session) {
    const rule = calcMealVoucher(ref.workedMinutes, ref.nightHoursClock)
    if (!rule) return null
    const config = await MealVoucherConfig.findOne({ code: rule.rule, active: true }).session(session)
    if (!config) throw new NotFoundError('Regra não encontrada')

    const mealVoucherObject = {
        createdBy: ref.createdBy,
        ref_Id: ref._id,
        source: rule.source,
        ruleCode: rule.rule,
        date: ref.date,
        payDate: extractPayDate(ref.date, true), // segundo argumento como true para cair na regra de pagamento do mês seguinte
        quantity: config.quantity,
        unitValue: config.unitValue,
        totalValue: config.unitValue * config.quantity
    }
    return await MealVoucher.create([{ ...mealVoucherObject }], { session })
}

// ------------------------------------ Service para atualizar ticket originado de uma hora extra ou turno noturno ----------------------------------------------------------
async function updateMealVoucherService(ref, session) {
    const rule = calcMealVoucher(ref.workedMinutes, ref.nightHoursClock)
    const existing = await MealVoucher.findOne({ ref_Id: ref._id }).session(session)

    // caso de atualização: turno completo -> parcial: remove ticket antigo
    if (!rule) {
        if (existing) await MealVoucher.deleteOne({ _id: existing._id }, { session })
        return null
    }

    const config = await MealVoucherConfig.findOne({ code: rule.rule, active: true }).session(session)
    if (!config) throw new NotFoundError('Regra não encontrada')

    const mealVoucherObject = {
        createdBy: ref.createdBy,
        ref_Id: ref._id,
        source: rule.source,
        ruleCode: rule.rule,
        date: ref.date,
        payDate: extractPayDate(ref.date, true), // segundo argumento como true para cair na regra de pagamento do mês seguinte
        quantity: config.quantity,
        unitValue: config.unitValue,
        totalValue: config.unitValue * config.quantity
    }

    if (existing) {
        return await MealVoucher.findOneAndUpdate({ _id: existing._id }, mealVoucherObject, {
            returnDocument: 'after',
            runValidators: true,
            session
        })
    }

    // caso de atualização: turno parcial -> completo: cria ticket novo
    const [mealVoucher] = await MealVoucher.create([{ ...mealVoucherObject }], { session })
    return mealVoucher
}

// ----------------------------- Service para excluir ticket originado por hora extra ou turno noturno ---------------------------------------------------------------     
async function deleteMealVoucherService(ref_Id, session) {
    const mealVoucher = await MealVoucher.findOneAndDelete({ ref_Id }, { session })
    if (!mealVoucher) return null
    return mealVoucher
}
module.exports = { createMealVoucherService, updateMealVoucherService, deleteMealVoucherService }