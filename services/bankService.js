const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')
const BankCompensation = require('../models/BankCompensation')
const { getClosedMonthCutoff } = require('../utils/rules')
const { capitalize } = require('../utils/tools')
const { BadRequestError, NotFoundError } = require('../errors')

// --------------------------- Encontra as horas extras elegíveis para compensar -----------------------------------------------------
async function findEligibleOvetimes(userId, minutesNeeded, date, session) {
    const actualDate = getClosedMonthCutoff(date)
    const eligibles = await Overtime.find({
        createdBy: userId,
        isHoliday: false,
        date: { $gte: actualDate },
        $expr: { $lt: ['$compensatedMinutes', '$bankedMinutes'] },
    }).sort('date').session(session)

    // loop 1 - iteração sobre as horas extras elegíveis até bater a meta de compensação (minutesNeeded)
    let remaining = minutesNeeded
    let entries = []

    for (const overtime of eligibles) {
        let available = overtime.bankedMinutes - overtime.compensatedMinutes

        if (available <= 0) continue

        const used = Math.min(available, remaining)     // total que será usado dessa HE
        const usedWorked = used / 2                     // convertido para espaço trabalhado

        // loop 2 - distribuir usedWorked entre os tiers dessa HE
        let usedByTier = { he50: 0, he75: 0, he100: 0 }
        let valueLostByTier = { he50: 0, he75: 0, he100: 0 }
        let remainingTier = usedWorked

        for (const tier of ['he50', 'he75', 'he100']) {
            if (remainingTier <= 0) break

            // definindo o consumo por tier
            const availableTier = overtime.distributionMinutes[tier + 'minutes'] - overtime.compensatedMinutesByTier[tier + 'minutes']
            if (availableTier <= 0) continue

            const usedTier = Math.min(availableTier, remainingTier)
            usedByTier[tier] = usedTier

            // definindo o valor usado por tier
            const valueByMinute = overtime.values['value' + capitalize(tier)] / overtime.distributionMinutes[tier + 'minutes']
            valueLostByTier[tier] = Math.round(usedByTier[tier] * valueByMinute * 100) / 100

            remainingTier = remainingTier - usedTier
        }

        if (remainingTier > 0) throw new BadRequestError(`Inconsistência de dados da HE ${overtime.overtimeId}: 
        bankedMinutes não corresponde à distribuição de tiers`)

        const valueLostTotal = valueLostByTier.he50 + valueLostByTier.he75 + valueLostByTier.he100

        entries.push({
            overtimeId: overtime._id,
            overtimeDate: overtime.date,
            bankedMinutes: overtime.bankedMinutes,
            minutesUsed: used,
            minutesUsedByTier: usedByTier,
            valueLost: valueLostTotal,
            valueLostByTier: valueLostByTier
        })
        remaining = remaining - used

        if (remaining <= 0) break
    }
    if (remaining > 0) throw new BadRequestError('Não há hora extra suficente no banco')

    return entries
}

// --------------------------- Criar o documento banco de horas e alterar as horas extras -----------------------------------------------------
async function confirmCompensation(userId, minutesNeeded, date) {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const eligibles = await findEligibleOvetimes(userId, minutesNeeded, date, session)

            for (const overtime of eligibles) {
                await Overtime.findByIdAndUpdate(
                    overtime.overtimeId,
                    {
                        $inc: {
                            compensatedMinutes: overtime.minutesUsed,
                            "compensatedMinutesByTier.he50minutes": overtime.minutesUsedByTier.he50,
                            "compensatedMinutesByTier.he75minutes": overtime.minutesUsedByTier.he75,
                            "compensatedMinutesByTier.he100minutes": overtime.minutesUsedByTier.he100,
                            compensatedValue: overtime.valueLost
                        }
                    }, { runValidators: true, session })
            }

            const createObject = {
                createdBy: userId,
                date,
                totalMinutes: minutesNeeded,
                entries: eligibles,
                source: 'manual', // refatorar quando entrar o pdf import
                status: 'active'
            }

            const bankCompensation = await BankCompensation.create(createObject)
            return bankCompensation
        })
        return result
    } finally {
        await session.endSession()
    }
}

// --------------------------- Cancela o banco de horas, restaurando as horas extras afetadas -----------------------------------------------------
async function cancelCompensation(bankCompId) {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const bankCompensation = await BankCompensation.findById(bankCompId).session(session)

            // validações para se o banco de horas está valido para cancelamento
            if (!bankCompensation) throw new NotFoundError('Banco de horas não encontrado')
            if (bankCompensation.status === 'cancelled') throw new BadRequestError('Banco de hora selecionado já se encontra cancelado')
            if (!canCancelCompesation(bankCompensation)) throw new BadRequestError('Esse banco de horas não pode ser mais cancelado')
            if (bankCompensation.source === 'pdf_import') throw new BadRequestError('Compensações vindas de PDF import não podem ser canceladas. Verfiique com o administrador')

            // iteração sobre cada documento de overtime dentro de entries para restaurar ao valor original
            for (const overtime of bankCompensation.entries) {
                await Overtime.findByIdAndUpdate(
                    overtime.overtimeId,
                    {
                        $inc: {
                            compensatedMinutes: -overtime.minutesUsed,
                            "compensatedMinutesByTier.he50minutes": -overtime.minutesUsedByTier.he50,
                            "compensatedMinutesByTier.he75minutes": -overtime.minutesUsedByTier.he75,
                            "compensatedMinutesByTier.he100minutes": -overtime.minutesUsedByTier.he100,
                            compensatedValue: -overtime.valueLost
                        }
                    }, { runValidators: true, session }
                )
            }
            await bankCompensation.updateOne({ status: 'cancelled' }, { session })
            return bankCompensation
        })
        return result
    } finally {
        await session.endSession()
    }
}

async function canCancelCompesation(bankCompesation) {
    return true // função da definir
}

module.exports = { findEligibleOvetimes, confirmCompensation, cancelCompensation }