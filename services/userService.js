const { validateDate } = require('../utils/timeConversion')
const { roundCurrency } = require('../utils/tools')
const { BadRequestError } = require('../errors')

// ------------------------------- service para criar o objeto de salário-hora - usado em controller user.js e auth.js -----------------------
function createWageService(userId, wage, date) {
    // validações
    if (!date) throw new BadRequestError('Por favor, forneça a data de vigência do salário-hora.')
    if (typeof wage !== 'number' || Number.isNaN(wage) || wage <= 0) throw new BadRequestError('O valor do salário-hora precisa ser um número maior que 0.')
    const formattedDate = validateDate(date)
    if (formattedDate > new Date()) throw new BadRequestError('Não é permitido criar valores de salários horas futuros.')

    const createFields = {
        createdBy: userId,
        wage: roundCurrency(wage),
        effectiveFrom: formattedDate
    }

    return createFields
}

module.exports = { createWageService }