const MealVoucher = require('../models/MealVoucher')
const NightShift = require('../models/NightShift')
const MealVoucherConfig = require('../models/MealVoucherConfig')
const PDFExtractPromise = require('pdf.js-extract')
const { calcMealVoucher, extractPayDate } = require('./rules')
const { NotFoundError } = require('../errors')

// ------------------------------------ Monta o objeto de ticket a partir da regra já calculada ----------------------------------------------------------
async function buildMealVoucherObject(ref, rule, session) {
    const config = await MealVoucherConfig.findOne({ code: rule.rule, active: true }).session(session)
    if (!config) throw new NotFoundError('Regra não encontrada')

    return {
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
}

// ------------------------------------ Regra de negócio: HE com adicional noturno completo sempre prevalece sobre o ticket de turno noturno ----------------------------------------------------------
// Chamada sempre que um ticket 'overtime' é criado/atualizado num dia: qualquer ticket 'nightShift' do mesmo dia deixa de fazer sentido
async function suppressConflictingNightShift(createdBy, date, session) {
    await MealVoucher.deleteOne({ createdBy, date, source: 'nightShift' }, { session })
}

// Se o ticket 'overtime' de um dia deixar de existir (excluído ou editado pra não qualificar mais),
// e não sobrar nenhum outro ticket 'overtime' nesse dia, o ticket 'nightShift' original volta a ser gerado, se ainda for elegível
async function restoreNightShiftIfEligible(createdBy, date, session) {
    if (!date) return null

    const stillHasOvertimeTicket = await MealVoucher.exists({ createdBy, date, source: 'overtime' }).session(session)
    if (stillHasOvertimeTicket) return null // ainda suprimido por outro ticket de overtime no mesmo dia

    const alreadyHasNightShiftTicket = await MealVoucher.exists({ createdBy, date, source: 'nightShift' }).session(session)
    if (alreadyHasNightShiftTicket) return null // nunca chegou a ser suprimido, ou já foi restaurado

    const nightShift = await NightShift.findOne({ createdBy, date }).session(session)
    if (!nightShift) return null // não existe turno noturno original nesse dia

    const rule = calcMealVoucher(nightShift.workedMinutes, nightShift.nightHoursClock)
    if (!rule) return null // turno noturno não é mais elegível (ex: editado pra parcial nesse meio tempo)

    const mealVoucherObject = await buildMealVoucherObject(nightShift, rule, session)
    const [mealVoucher] = await MealVoucher.create([mealVoucherObject], { session })
    return mealVoucher
}

// ------------------------------------ Service para criar ticket originado de uma hora extra ou turno noturno ----------------------------------------------------------
async function createMealVoucherService(ref, session) {
    const rule = calcMealVoucher(ref.workedMinutes, ref.nightHoursClock)
    if (!rule) return null

    // HE com adicional noturno completo sempre prevalece: se já existe ticket de overtime nesse dia, o noturno nem chega a ser criado
    if (rule.source === 'nightShift') {
        const hasOvertimeTicket = await MealVoucher.exists({ createdBy: ref.createdBy, date: ref.date, source: 'overtime' }).session(session)
        if (hasOvertimeTicket) return null
    }

    const mealVoucherObject = await buildMealVoucherObject(ref, rule, session)
    const [mealVoucher] = await MealVoucher.create([mealVoucherObject], { session })

    if (rule.source === 'overtime') {
        await suppressConflictingNightShift(ref.createdBy, ref.date, session)
    }

    return mealVoucher
}

// ------------------------------------ Service para atualizar ticket originado de uma hora extra ou turno noturno ----------------------------------------------------------
async function updateMealVoucherService(ref, session) {
    const rule = calcMealVoucher(ref.workedMinutes, ref.nightHoursClock)
    const existing = await MealVoucher.findOne({ ref_Id: ref._id }).session(session)
    const oldDate = existing?.date
    const oldSource = existing?.source

    // caso de atualização: turno completo -> parcial: remove ticket antigo
    if (!rule) {
        if (existing) await MealVoucher.deleteOne({ _id: existing._id }, { session })
        if (oldSource === 'overtime') await restoreNightShiftIfEligible(ref.createdBy, oldDate, session)
        return null
    }

    // HE com adicional noturno completo: se já existe overtime no dia de destino, o noturno não deve existir/permanecer
    if (rule.source === 'nightShift') {
        const hasOvertimeTicket = await MealVoucher.exists({ createdBy: ref.createdBy, date: ref.date, source: 'overtime' }).session(session)
        if (hasOvertimeTicket) {
            if (existing) await MealVoucher.deleteOne({ _id: existing._id }, { session })
            return null
        }
    }

    const mealVoucherObject = await buildMealVoucherObject(ref, rule, session)

    let mealVoucher
    if (existing) {
        mealVoucher = await MealVoucher.findOneAndUpdate({ _id: existing._id }, mealVoucherObject, {
            returnDocument: 'after',
            runValidators: true,
            session
        })
    } else {
        // caso de atualização: turno parcial -> completo: cria ticket novo
        const [created] = await MealVoucher.create([mealVoucherObject], { session })
        mealVoucher = created
    }

    if (rule.source === 'overtime') {
        await suppressConflictingNightShift(ref.createdBy, ref.date, session)
        // se a data do overtime mudou, o dia antigo pode ter ficado sem overtime -> tenta restaurar o noturno de lá
        if (oldDate && String(oldDate) !== String(ref.date)) {
            await restoreNightShiftIfEligible(ref.createdBy, oldDate, session)
        }
    }

    return mealVoucher
}

// ----------------------------- Service para excluir ticket originado por hora extra ou turno noturno ---------------------------------------------------------------     
async function deleteMealVoucherService(ref_Id, session) {
    const mealVoucher = await MealVoucher.findOneAndDelete({ ref_Id }, { session })
    if (!mealVoucher) return null

    if (mealVoucher.source === 'overtime') {
        await restoreNightShiftIfEligible(mealVoucher.createdBy, mealVoucher.date, session)
    }

    return mealVoucher
}

async function extractTableFromPdf(buffer) {
    const PDFExtract = await PDFExtractPromise
    const pdfExtract = new PDFExtract()
    const options = {}
    return new Promise((resolve, reject) => {
        pdfExtract.extractBuffer(buffer, options, (err, data) => {
            if (err) return reject(err)
            resolve(data)
        })
    })
}

module.exports = { createMealVoucherService, updateMealVoucherService, deleteMealVoucherService, extractTableFromPdf }