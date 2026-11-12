const holidaysRelation = require('../public/data/holidays.json')
const {dateToString} = require('./timeConversion')

// Retorna o mês (1-12) e o dia da Páscoa do ano informado
function getEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month-1, day);
}

// retorna um array com as datas e nomes dos feriados, incluindo os dependentes da páscoa
function createHolidaysTable(year){
    const holidays = []
    for (const fixedHoliday of holidaysRelation.fixos) {
        const fixedHolidayDate = new Date(year, fixedHoliday.mes-1, fixedHoliday.dia)
        const formattedDate = dateToString(fixedHolidayDate)
        holidays.push({date:formattedDate,name:fixedHoliday.nome})
    }
    const easterDate = getEaster(year)
    for (const movelHoliday of holidaysRelation.moveis) {
        const movelHolidayDate = new Date(easterDate)
        movelHolidayDate.setDate(movelHolidayDate.getDate() + (movelHoliday.offsetPascoa))
        const formattedDate = dateToString(movelHolidayDate)
        holidays.push({date:formattedDate, name:movelHoliday.nome})
    }
    return holidays
}

// retorna quantos domingos tem no mês especificado
function countSundays(month, year){
    let count = 0
    let date = new Date(year,month,1)
    
    while (date.getMonth() === month) {
        if (date.getDay() === 0) {
            count++
        }
        date.setDate(date.getDate() + 1)
    }
    return count
}

// retorna quantos dias tem o mês, quantidade de DSR e dias trabalhados
function dsrDays(year, month){
    const holidayTable = createHolidaysTable(year)
    let daysInMonth = 0
    let sundays = 0
    let date = new Date(year, month, 1)
    while (date.getMonth() === month) {
        // checa se o dia é domingo
        if (date.getDay() === 0){
            sundays++
        }
        // checa se o dia é feriado
        if (dateToString(date))
        date.setDate(date.getDate() + 1)
        daysInMonth++
        
    }
    const workedDays = daysInMonth - sundays
    return {daysInMonth, sundays, workedDays}
}

console.log(dsrDays(2026,0))

module.exports = {countSundays, dsrDays}