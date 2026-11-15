const {
    overtimeReceivableService, overtimeNetReceivableService,
    nightShiftReceivableService, mealVoucherReceivableService,
    dsrReceivableService } = require('../services/receivablesService')
const { getReceivableDateRange } = require('../utils/rules')
const { StatusCodes } = require('http-status-codes')

// agregações para os cards de recebíceis do dashboard
const getReceivables = async (req, res) => {
    const { user: { userId }, query: { scope } } = req
    const scoped = getReceivableDateRange(scope, new Date())

    const [overtimeReceivables, overtimeNetReceivables, nightShiftReceivables, mealVoucherReceivables, dsrReceivables] = await Promise.all([
        overtimeReceivableService(userId, scoped),
        overtimeNetReceivableService(userId, scoped),
        nightShiftReceivableService(userId, scoped),
        mealVoucherReceivableService(userId, scoped),
        dsrReceivableService(userId, scoped)
    ])

    res.status(StatusCodes.OK).json({
        overtimeReceivables,
        overtimeNetReceivables,
        nightShiftReceivables,
        mealVoucherReceivables,
        dsrReceivables
    })
}

module.exports = { getReceivables }