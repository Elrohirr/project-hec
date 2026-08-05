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

module.exports = {timeToMinutes, minutesToTime, convertToReducedNightMinutes}