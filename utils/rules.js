const { timeToMinutes } = require('./timeConversion')
const { BadRequestError } = require('../errors')

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
    if (minutes > 120 && minutes <= 300) {
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

    const valueHe50 = he50 * 1.5 * wage
    const valueHe75 = he75 * 1.75 * wage
    const valueHe100 = he100 * 2 * wage
    return {
        valueHe50,
        valueHe75,
        valueHe100,
        total: valueHe50 + valueHe75 + valueHe100
    }
}

function defineNightValue(reducedMinutes, wage) {
    return Math.round((reducedMinutes / 60) * wage * 0.3828 * 100) / 100
}

function extractPayDate(date, isHoliday) {
    if (!date) return
    const newDate = new Date(date)
    if (isHoliday) {
        return newDate.setMonth(newDate.getMonth() + 1)
    }
    return newDate.setMonth(newDate.getMonth() + 3)
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
    // pagamento do mês atual
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    if (scope === 'previous') {
        const prevDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
        return { $gte: prevDate, $lt: startDate }
    }

    if (scope === 'next') {
        const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
        return { $gte: startDate, $lt: endDate }
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

function getBankClosingCutOff(date) {
    // retorna a data de corte do banco, que é sempre o penúltimo dia de dois meses pra trás
    const now = new Date(date)
    return currentMonthClosing = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, -1))
}

module.exports = {
    calcDistribution, defineValue, defineNightValue,
    extractPayDate, calcMealVoucher, getLabel,
    getReceivableDateRange, bankMinutes, getClosedMonthCutoff,
    getBankClosingCutOff
}


