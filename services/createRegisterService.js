const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')
const NightShift = require('../models/NightShift')
const User = require('../models/User')
const { calcDistribution, extractPayDate, defineValue, bankMinutes, defineNightValue } = require('../utils/rules')
const { timeToMinutes, minutesToTime, validateFormat, validateDate, convertToReducedNightMinutes } = require('../utils/timeConversion')
const { createMealVoucherService } = require('../services/mealVoucherService')
const { BadRequestError } = require('../errors')

async function createOvertimeService({ date, workedHours, isHoliday = false, isDayOff = false, userId }) {
    const session = await mongoose.startSession()
    try {
        return await session.withTransaction(async () => {
            if (!workedHours || !date) throw new BadRequestError('Por favor, informe quantas horas extras foram feitas e a data')
            // validar formatos
            validateFormat(workedHours, false)
            const formatedDate = validateDate(date)

            const wage = await User.findById(userId).select('wage').session(session)
            if (!wage) throw new BadRequestError('Usuário não encontrado')

            // criar whitelist
            const workedMinutes = timeToMinutes(workedHours)
            const bankedMinutes = bankMinutes(workedMinutes, isHoliday)
            const distributionMinutes = calcDistribution(workedMinutes, isDayOff, isHoliday)

            const createFields = {
                createdBy: userId,
                workedHours,
                workedMinutes,
                date: formatedDate,
                distributionMinutes,
                distributionHours: {
                    he50hours: minutesToTime(distributionMinutes.he50minutes),
                    he75hours: minutesToTime(distributionMinutes.he75minutes),
                    he100hours: minutesToTime(distributionMinutes.he100minutes)
                },
                values: defineValue(distributionMinutes, wage.wage),
                wageAtCalculation: wage.wage,
                payDate: extractPayDate(formatedDate, isHoliday),
                isDayOff,
                isHoliday,
                bankedMinutes
            }

            const [overtime] = await Overtime.create([createFields], { session })
            const mealVoucher = await createMealVoucherService(overtime, session)
            return { overtime, mealVoucher }
        })
    } finally {
        await session.endSession()
    }
}

async function createNightShiftService({ date, nightHoursClock, userId }) {
    const session = await mongoose.startSession()
    try {
        return await session.withTransaction(async () => {
            if (!date) throw new BadRequestError('Por favor, insira a data do turno noturno')

            // validar formato
            validateFormat(nightHoursClock, true)
            const formatedDate = validateDate(date)
            const reducedMinutes = convertToReducedNightMinutes(nightHoursClock)

            const wage = await User.findById(userId).select('wage').session(session)
            if (!wage) throw new BadRequestError('Usuário não encontrado')

            // criar whitelist
            const createFields = {
                createdBy: userId,
                date: formatedDate,
                nightHoursClock,
                nightMinutesClock: timeToMinutes(nightHoursClock),
                nightHoursReduced: minutesToTime(reducedMinutes),
                nightMinutesReduced: reducedMinutes,
                nightShiftValue: defineNightValue(reducedMinutes, wage.wage),
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


module.exports = { createOvertimeService, createNightShiftService }