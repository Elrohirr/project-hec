const mongoose = require('mongoose')
const NightShift = require('../models/NightShift')
const { getWageAt, extractPayDate, defineNightValue } = require('../utils/rules')
const { timeToMinutes, minutesToTime, validateFormat, validateDate, convertToReducedNightMinutes } = require('../utils/timeConversion')
const { createMealVoucherService, deleteMealVoucherService } = require('./mealVoucherService')
const { BadRequestError, NotFoundError } = require('../errors')

// ------------------------------------ Service para criar um registro de turno noturno - usado pelo controller e pelo pdf import ----------------------------------------------------------
async function createNightShiftService({ date, nightHoursClock, userId }) {
    const session = await mongoose.startSession()
    try {
        return await session.withTransaction(async () => {
            if (!date) throw new BadRequestError('Por favor, insira a data do turno noturno')

            // validar formato
            validateFormat(nightHoursClock, true)
            const formatedDate = validateDate(date)
            const reducedMinutes = convertToReducedNightMinutes(nightHoursClock)

            const wage = await getWageAt(userId, date, session)

            // criar whitelist
            const createFields = {
                createdBy: userId,
                date: formatedDate,
                nightHoursClock,
                nightMinutesClock: timeToMinutes(nightHoursClock),
                nightHoursReduced: minutesToTime(reducedMinutes),
                nightMinutesReduced: reducedMinutes,
                nightShiftValue: defineNightValue(reducedMinutes, wage.wage),
                wageId: wage._id,
                wageAtCalculation: wage.wage,
                payDate: extractPayDate(formatedDate, true) // segundo parametro como true pois o pagamento de todo AD Noturno é no mês seguinte
            }

            const [nightShift] = await NightShift.create([createFields], { session })
            const mealVoucher = await createMealVoucherService(nightShift, session)
            return { nightShift, mealVoucher }
        })
    }
    finally {
        await session.endSession()
    }
}

async function deleteNightShiftService(userId, nightShiftId) {
    const session = await mongoose.startSession()
    try {
        return await session.withTransaction(async () => {
            // validação se existe
            const nightShift = await NightShift.findOne({ createdBy: userId, _id: nightShiftId }).session(session)
            if (!nightShift) throw new NotFoundError('Turno noturno não encontrada')

            await NightShift.findByIdAndDelete(nightShift._id).session(session)
            const mealVoucher = await deleteMealVoucherService(nightShift._id, session)
            return { nightShift, mealVoucher }
        })
    } finally {
        await session.endSession()
    }
}

module.exports = { createNightShiftService, deleteNightShiftService }