const BadRequestError = require('../errors/bad-request')
const { roundCurrency } = require('./tools')

function timeToMinutes(hhmm) {
    const [hours, minutes] = hhmm.split(':')
    return Number(hours) * 60 + Number(minutes)
}

function minutesToTime(totalMinutes) {
    const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0")
    const minutes = String((totalMinutes % 60)).padStart(2, "0")
    return hour + ":" + minutes
}

function convertToReducedNightMinutes(nightHoursClock) {
    return Math.round(timeToMinutes(nightHoursClock) * 8 / 7)
}

function validateFormat(format, isNIghtShift) {
    // validar formato HH:MM
    const formatRegex = /^\d{1,2}:\d{2}$/
    if (!formatRegex.test(format)) throw new BadRequestError('Informe as horas no formato HH:MM')

    // validar minutos e horas dentro de faixa numérica válida
    const [hoursStr, minutesStr] = format.split(':')
    const hours = Number(hoursStr)
    const minutes = Number(minutesStr)
    if (hours < 0 || minutes < 0 || minutes >= 60) throw new BadRequestError('Informe as horas no formato HH:MM')

    // validar se o intervalo inserido está dentro do range de horas para o turno noturno
    if (isNIghtShift) {
        const clockMinutesTotal = timeToMinutes(format)
        if (clockMinutesTotal < 0 || clockMinutesTotal > 420) throw new BadRequestError('Intervalo fora de range permitido (00:00 até 07:00)')
    }
}

function validateDate(date) {
    // validar formato YYYY-MM-DD
    const formatRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!formatRegex.test(date.trim())) throw new BadRequestError('Informe a data em formato YYYY-MM-DD')

    // validação de mês e dia estão no range correto, considerando os dias máximos dos meses e anos bissextos
    const [year, month, day] = date.split('-')
    const yearN = Number(year)
    const monthN = Number(month)
    const dayN = Number(day)

    // validar mês
    if (monthN < 1 || monthN > 12) throw new BadRequestError('Mês inválido. Por favor, digite uma data válida')

    // checagem de ano bissexto para o mês de fevereito
    const isLeapYear = monthN === 2 && yearN % 4 === 0

    const monthsLastDays = [
        31,                   // janeiro
        isLeapYear ? 29 : 28, // fevereiro
        31,                   // março
        30,                   // abril
        31,                   // maio
        30,                   // junho
        31,                   // julho
        31,                   // agosto
        30,                   // setembro
        31,                   // outubro
        30,                   // novembro
        31,                   // dezembro
    ]

    if (dayN < 1 || dayN > monthsLastDays[monthN - 1]) throw new BadRequestError('Dia inválido. Por favor, digite uma data válida')
    return new Date(Date.UTC(yearN, monthN - 1, dayN))
}

function timetoNumber(hhmm) {
    const [hour, minute] = hhmm.split(':')
    return roundCurrency(Number(hour) + (Number(minute) / 60), 2)
}

module.exports = {
    timeToMinutes, minutesToTime,
    convertToReducedNightMinutes,
    validateFormat, timetoNumber,
    validateDate
}