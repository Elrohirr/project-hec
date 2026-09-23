const { overtimeReceivableService, overtimeNetReceivableService, nightShiftReceivableService, mealVoucherReceivableService } = require('../services/receivablesService')
const { getReceivableDateRange } = require('../utils/rules')
const { StatusCodes } = require('http-status-codes')

const getReceivables = async (req, res) => {
    const { user: { userId }, query: { scope } } = req
    const scoped = getReceivableDateRange(scope, new Date())

    const [overtimeReceivables, overtimeNetReceivables, nightShiftReceivables, mealVoucherReceivables] = await Promise.all([
        overtimeReceivableService(userId, scoped),
        overtimeNetReceivableService(userId, scoped),
        nightShiftReceivableService(userId, scoped),
        mealVoucherReceivableService(userId, scoped)
    ])

    res.status(StatusCodes.OK).json({
        overtimeReceivables,
        overtimeNetReceivables,
        nightShiftReceivables,
        mealVoucherReceivables
    })
}

module.exports = { getReceivables }