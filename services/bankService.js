const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')
const BankCompensation = require('../models/BankCompensation')
const DebtBank = require('../models/DebtBank')
const { getClosedMonthCutoff } = require('../utils/rules')
const { timeToMinutes } = require('../utils/timeConversion')
const { capitalize, roundCurrency } = require('../utils/tools')
const { BadRequestError } = require('../errors')

// --------------------------- Encontra as horas extras elegíveis para compensar - usado na simulação e confirmação do banco de horas ---------------------------
async function findEligibleOvertimes(userId, hoursNeeded, date, session) {
    const cutOffDate = getClosedMonthCutoff(date)
    const minutesNeeded = timeToMinutes(hoursNeeded)
    if (!minutesNeeded || minutesNeeded <= 0) throw new BadRequestError('As horas a compensar devem ser maiores que 0')
    const eligibles = await Overtime.find({
        createdBy: userId,
        isHoliday: false,
        date: { $gte: cutOffDate, $lte: date },
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
            valueLostByTier[tier] = roundCurrency(usedByTier[tier] * valueByMinute, 2)

            remainingTier = remainingTier - usedTier
        }

        if (remainingTier > 0) throw new BadRequestError(`Inconsistência de dados da HE ${overtime._id}: 
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
    // caso não haja hora disponível para criar a compensação, os minutos restantes viram débito
    if (remaining > 0) {
        return {
            msg: `Não há horas suficientes no banco de horas. Caso confirme a compensação, ${remaining} minutos virarão débito.`,
            entries,
            remaining
        }
    }

    return entries
}

// --------------------------- Cria o arquivo de compensação - usado pelo controller e pelo registro automáatico ---------------------------
async function confirmCompensationService(userId, hoursNeeded, date) {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { entries, remaining } = await findEligibleOvertimes(userId, hoursNeeded, date, session)

            // se o banco estiver zerado, é apenas criado o débito e retornado, sem criação de compensação
            if (entries.length === 0) {
                const [debt] = await DebtBank.create([{
                    createdBy: userId,
                    date: date,
                    debtMinutes: remaining,
                    minutesLeft: remaining
                }], { session })
                return { debt }
            }

            const minutesNeeded = timeToMinutes(hoursNeeded) - remaining

            for (const overtime of entries) {
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
                entries,
                status: 'active'
            }

            const [bankCompensation] = await BankCompensation.create([createObject], { session })

            // se houver compensação com débito, o sistema registra as compensações e, 
            // se tiver remaining, cria o documento de DebtBank, 
            // anexando o documento de BankCompensation
            if (remaining > 0) {
                const [debt] = await DebtBank.create([{
                    createdBy: userId,
                    date: date,
                    debtMinutes: remaining,
                    minutesLeft: remaining,
                    originCompensation: bankCompensation._id
                }], { session })

                return { bankCompensation, debt }
            }
            return { bankCompensation }
        })
        return result
    } finally {
        await session.endSession()
    }
}

module.exports = { findEligibleOvertimes, confirmCompensationService }