const Wage = require('../models/Wage')
const { timeToMinutes } = require('./timeConversion')
const { capitalize, roundCurrency } = require('./tools')
const { BadRequestError, NotFoundError } = require('../errors')

async function getWageAt(userId, date, session = null) {
    const wage = await Wage.findOne({
        createdBy: userId,
        effectiveFrom: { $lte: date }
    })
        .sort({ effectiveFrom: -1 })
        .session(session)

    if (!wage) throw new NotFoundError('Valor de salário-hora não encontrado para a data do registro.')
    return wage
}

function calcDistribution(minutes, isDayOff, isHoliday) {
    if (minutes <= 0 || minutes > 810) throw new BadRequestError('A quantidade de horas extras não pode ser menor ou igual a 0 ou maior que 13 horas')
    if (isDayOff || isHoliday) {
        return {
            he50minutes: 0,
            he75minutes: 0,
            he100minutes: minutes
        }
    }
    if (minutes <= 120) {
        return {
            he50minutes: minutes,
            he75minutes: 0,
            he100minutes: 0
        }
    }
    if (minutes > 120 && minutes < 480) {
        return {
            he50minutes: 120,
            he75minutes: minutes - 120,
            he100minutes: 0
        }
    }
    throw new BadRequestError("Só é possível executar mais de 5 horas extras se for feriado ou dia de folga.")
}

function defineValue(distribution, wage) {

    const he50 = distribution.he50minutes / 60
    const he75 = distribution.he75minutes / 60
    const he100 = distribution.he100minutes / 60

    const valueHe50 = roundCurrency(he50 * 1.5 * wage, 2)
    const valueHe75 = roundCurrency(he75 * 1.75 * wage, 2)
    const valueHe100 = roundCurrency(he100 * 2 * wage, 2)
    return {
        valueHe50,
        valueHe75,
        valueHe100,
        total: valueHe50 + valueHe75 + valueHe100
    }
}

function defineNightValue(reducedMinutes, wage) {
    return roundCurrency((reducedMinutes / 60) * wage * 0.3828, 2)
}

function extractPayDate(date, isHoliday) {
    if (!date) return undefined
    const monthsToAdd = isHoliday ? 1 : 3
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth()
    const day = date.getUTCDate()
    const targetMonthIndex = month + monthsToAdd

    // último dia do mês alvo (dia 0 do mês seguinte, em UTC)
    const lastDayOfTargetMonth = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate()
    const clampedDay = Math.min(day, lastDayOfTargetMonth)

    return new Date(Date.UTC(year, targetMonthIndex, clampedDay))
}

function calcMealVoucher(minutes, nightHoursClock) {
    if (nightHoursClock) {
        if (timeToMinutes(nightHoursClock) === 420) return { rule: 'NIGHTSHIFT', source: 'nightShift' }
        return null
    }
    if (minutes <= 0 || minutes > 840) throw new BadRequestError('A quantidade de horas extras não pode ser menor ou igual a 0 ou maior que 14 horas')
    if (minutes >= 60 && minutes < 120) {
        return { rule: 'OVERTIME_HALF', source: 'overtime' }
    }
    if (minutes >= 120 && minutes < 300) {
        return { rule: 'OVERTIME_FULL', source: 'overtime' }
    }
    if (minutes >= 360) {
        return { rule: 'OVERTIME_DOUBLE', source: 'overtime' }
    }
    return null
}

function getLabel(code) {
    if (code === 'OVERTIME_HALF') return { label: 'Meio VL Hora Extra', quantity: 0.5 }
    if (code === 'OVERTIME_FULL') return { label: 'VL Completo Hora Extra', quantity: 1 }
    if (code === 'OVERTIME_DOUBLE') return { label: '2 VL Hora Extra', quantity: 2 }
    if (code === 'NIGHTSHIFT') return { label: 'VL Turno Noturno', quantity: 1 }
    throw new BadRequestError('Código de ticket inválido')
}

function getReceivableDateRange(scope, now) {
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    // pagamento do mês passado
    if (scope === 'previous') {
        const prevDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
        return { $gte: prevDate, $lt: startDate }
    }

    // pagamento do mês atual
    if (scope === 'current') {
        const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
        return { $gte: startDate, $lt: endDate }
    }

    // pagamento do mês seguinte
    if (scope === 'next') {
        const nextDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
        const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1))
        return { $gte: nextDate, $lt: endDate }
    }

    // tudo que ainda for receber a partir do mês atual
    return { $gte: startDate }
}

function bankMinutes(workedMinutes, isHoliday) {
    if (!isHoliday) return workedMinutes * 2
    return 0
}

function getClosedMonthCutoff(date) {
    const now = new Date(date)
    // se hoje é agosto, cutoff = 1º de junho (maio pra trás = paid)
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
}

function tierLoop(minutesNeeded, eligibles) {
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

        const valueLostTotal = roundCurrency(valueLostByTier.he50 + valueLostByTier.he75 + valueLostByTier.he100, 2)

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

    return { entries, remaining }
}

module.exports = {
    getWageAt, calcDistribution, defineValue, defineNightValue,
    extractPayDate, calcMealVoucher, getLabel,
    getReceivableDateRange, bankMinutes, getClosedMonthCutoff, tierLoop
}


