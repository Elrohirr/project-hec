const BadRequestError = require('../errors/bad-request')

function timeToMinutes (hhmm){
    const [hours,minutes] = hhmm.split(':')
    return Number(hours) * 60 + Number(minutes)
}

function minutesToTime (totalMinutes){
    const hour = String(Math.floor(totalMinutes/60)).padStart(2,"0")
    const minutes = String((totalMinutes % 60)).padStart(2,"0")
    return hour + ":" + minutes
}

function convertToReducedNightMinutes (nightHoursClock){
    return Math.round(timeToMinutes(nightHoursClock) * 8/7)
}

function validateFormat(format, isNIghtShift){
     // validar formato HH:MM
    const formatRegex = /^\d{1,2}:\d{2}$/
    if (!formatRegex.test(format)) throw new BadRequestError('Informe as horas no formato HH:MM')

    // validar minutos e horas dentro de faixa numérica válida
    const [hoursStr, minutesStr] = format.split(':')
    const hours = Number(hoursStr)
    const minutes = Number(minutesStr)
    if (hours < 0 || minutes < 0 || minutes >= 60) throw new BadRequestError('Informe as horas no formato HH:MM')

    // validar se o intervalo inserido está dentro do range de horas para o turno noturno
    if(isNIghtShift){
        const clockMinutesTotal = timeToMinutes(format)
        if (clockMinutesTotal < 0 || clockMinutesTotal > 420) throw new BadRequestError('Intervalo fora de range permitido (00:00 até 07:00)')
    }
}

module.exports = {timeToMinutes, minutesToTime, convertToReducedNightMinutes, validateFormat}