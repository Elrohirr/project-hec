const { BadRequestError } = require('./errors')


function calcDistribution(quantity, isDayOff, isHoliday) {

    // regra de negócio
    if (isDayOff || isHoliday) {
        return {
            he50: 0,
            he75: 0,
            he100: quantity
        }

    }
    if (quantity <= 2) {
        return {
            he50: quantity,
            he75: 0,
            he100: 0
        }

    }
    if (quantity > 2 && quantity <= 4) {
        return {
            he50: 2,
            he75: quantity - 2,
            he100: 0
        }

    }
    throw new BadRequestError("Só é possivel executar mais de 4 horas extras se for feriado ou dia de folga. Por favor, marque a opção correta")
}

function extractPayDate(isHoliday, date) {
    if (!date) return
    const newDate = new Date(date)
    if (isHoliday) {
        return newDate.setMonth(newDate.getMonth() + 1)
    }
    return newDate.setMonth(newDate.getMonth() + 3)
}

// ------------------------------------------------ funções obsoletas - usar apenas se necessário -----------------------------------------------------------
/*function extractDate(date) {
    const newDate = new Date(date)
    const newDay = newDate.getDate() + 1
    const newMonth = newDate.getMonth() + 1
    const newYear = newDate.getFullYear()
    return {
        day: newDay,
        month: newMonth,
        year: newYear
    }
}*/

/*function extractPayDate(isHoliday, date) {
    const newDate = new Date(date)
    const newMonth = newDate.getMonth() + 1
    const newYear = newDate.getFullYear()
    if (isHoliday) {
        if (newMonth === 12) {
            return {
                month: 1,
                year: newYear + 1
            }
        }
        return {
            month: newMonth + 1,
            year: newYear
        }
    }
    switch (newMonth) {
        case 10:
            return {
                month: 1,
                year: newYear + 1
            }
        case 11:
            return {
                month: 2,
                year: newYear + 1
            }
        case 12:
            return {
                month: 3,
                year: newYear + 1
            }
        default:
            return {
                month: newMonth + 3,
                year: newYear
            }
    }
}*/

module.exports = { calcDistribution, extractPayDate }


