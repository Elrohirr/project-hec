const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')
const User = require('../models/User')
const { calcDistribution, extractPayDate, defineValue, bankMinutes } = require('../utils/rules')
const { timeToMinutes, minutesToTime, validateFormat, validateDate } = require('../utils/timeConversion')
const { createMealVoucherService, updateMealVoucherService, deleteMealVoucherService } = require('./mealVoucherService')
const { BadRequestError, NotFoundError } = require('../errors')

// ------------------------------------ Service para criar um registro de hora extra - usado pelo controller e pelo pdf import ----------------------------------------------------------
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
            console.log(overtime._id)
            const mealVoucher = await createMealVoucherService(overtime, session)
            return { overtime, mealVoucher }
        })
    } finally {
        await session.endSession()
    }
}

// ------------------------------------ Service para apagar um registro de hora extra - usado pelo controller e multidelete ----------------------------------------------------------
async function deleteOvertimeService(userId, overtimeId) {
    const session = await mongoose.startSession()
    try {
        return await session.withTransaction(async () => {
            // validação da hora extra, após isso, a hora extra é apagada, junto com o ticket
            const overtime = await Overtime.findOne({ createdBy: userId, _id: overtimeId }).session(session)
            if (!overtime) throw new NotFoundError('Hora extra não encontrada')
            if (overtime.compensatedMinutes > 0) throw new BadRequestError('Não é possível apagar horas extras que foram compensadas parcialmente ou totalmente. Primeiro, verifique a qual compensação ela está atrelada e cancele a mesma.')

            await Overtime.findByIdAndDelete(overtime._id).session(session)
            const mealVoucher = await deleteMealVoucherService(overtime._id, session)
            return { overtime, mealVoucher }
        })
    } finally {
        await session.endSession()
    }
}

module.exports = { createOvertimeService, deleteOvertimeService }