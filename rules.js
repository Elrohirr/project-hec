const User = require('./models/User')
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

function defineValue(distribution, wage) {

    const he50 = distribution.he50
    const he75 = distribution.he75
    const he100 = distribution.he100

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

module.exports = { calcDistribution, extractPayDate, defineValue }


