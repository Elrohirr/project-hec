const Overtime = require('../models/Overtime')
const { getClosedMonthCutoff } = require('../utils/rules')
const { timeToMinutes } = require('../utils/timeConversion')
const { capitalize, roundCurrency } = require('../utils/tools')
const { BadRequestError } = require('../errors')

// --------------------------- Encontra as horas extras elegíveis para compensar - usado na simulação e confirmação do banco de horas ---------------------------
async function findEligibleOvetimes(userId, hoursNeeded, date, session) {
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
    if (remaining > 0) throw new BadRequestError('Não há hora extra suficente no banco para a data específicada.')

    return entries
}

module.exports = { findEligibleOvetimes }