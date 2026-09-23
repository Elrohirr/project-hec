const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')
const NightShift = require('../models/NightShift')
const MealVoucher = require('../models/MealVoucher')

async function overtimeReceivableService(userId, scope) {

    const aggregateObject = {
        createdBy: new mongoose.Types.ObjectId(userId),
        payDate: scope
    }

    const distribution = (
        await Overtime.aggregate([
            { $match: aggregateObject },
            {
                $group: {
                    _id: null,
                    he50: { $sum: "$distributionMinutes.he50minutes" },
                    he75: { $sum: "$distributionMinutes.he75minutes" },
                    he100: { $sum: "$distributionMinutes.he100minutes" },
                    heHoliday: { $sum: { $cond: [{ $eq: ["$isHoliday", true] }, "$workedMinutes", 0] } }
                }
            }
        ])
    )[0] || { he50: 0, he75: 0, he100: 0, heHoliday: 0, total: 0 }

    const values = (
        await Overtime.aggregate([
            { $match: aggregateObject },
            {
                $group: {
                    _id: null,
                    valueHe50: { $sum: "$values.valueHe50" },
                    valueHe75: { $sum: "$values.valueHe75" },
                    valueHe100: { $sum: "$values.valueHe100" },
                    valueHeHoliday: { $sum: { $cond: [{ $eq: ["$isHoliday", true] }, "$values.valueHe100", 0] } },
                    total: { $sum: "$values.total" }
                }
            },
            {
                $project: {
                    valueHe50: { $round: ["$valueHe50", 2] },
                    valueHe75: { $round: ["$valueHe75", 2] },
                    valueHe100: { $round: ["$valueHe100", 2] },
                    valueHeHoliday: { $round: ["$valueHeHoliday", 2] },
                    total: { $round: ["$total", 2] },
                }
            }
        ])
    )[0] || { valueHe50: 0, valueHe75: 0, valueHe100: 0, valueHeHoliday: 0, total: 0 }

    return { distribution, values }
}

async function overtimeNetReceivableService(userId, scope) {

    const aggregateObject = {
        createdBy: new mongoose.Types.ObjectId(userId),
        payDate: scope
    }

    const totals = (await Overtime.aggregate([
        { $match: aggregateObject },
        {
            $group: {
                _id: null,
                he50minutes: { $sum: "$distributionMinutes.he50minutes" },
                he75minutes: { $sum: "$distributionMinutes.he75minutes" },
                he100minutes: { $sum: "$distributionMinutes.he100minutes" },
                value50: { $sum: "$values.valueHe50" },
                value75: { $sum: "$values.valueHe75" },
                value100: { $sum: "$values.valueHe100" },
                compensatedMinutesHe50: { $sum: "$compensatedMinutesByTier.he50minutes" },
                compensatedMinutesHe75: { $sum: "$compensatedMinutesByTier.he75minutes" },
                compensatedMinutesHe100: { $sum: "$compensatedMinutesByTier.he100minutes" },
                overtimeNetReceivable: { $sum: { $subtract: ["$values.total", "$compensatedValue"] } }
            }
        },
        {
            // stage 1: calculo dos ratios
            $addFields: {
                valueByMinute50: {
                    $cond: { if: { $eq: ["$he50minutes", 0] }, then: 0, else: { $divide: ["$value50", "$he50minutes"] } }
                },
                valueByMinute75: {
                    $cond: { if: { $eq: ["$he75minutes", 0] }, then: 0, else: { $divide: ["$value75", "$he75minutes"] } }
                },
                valueByMinute100: {
                    $cond: { if: { $eq: ["$he100minutes", 0] }, then: 0, else: { $divide: ["$value100", "$he100minutes"] } }
                },
            }
        },
        {
            // stage 2: calculo de valores por tier
            $addFields: {
                valueLost50: { $multiply: ["$valueByMinute50", "$compensatedMinutesHe50"] },
                valueLost75: { $multiply: ["$valueByMinute75", "$compensatedMinutesHe75"] },
                valueLost100: { $multiply: ["$valueByMinute100", "$compensatedMinutesHe100"] }
            }
        },
        {
            // stage 3: shape final
            $project: {
                valueLost50: { $round: ["$valueLost50", 2] },
                valueLost75: { $round: ["$valueLost75", 2] },
                valueLost100: { $round: ["$valueLost100", 2] },
                overtimeNetReceivable: { $round: ["$overtimeNetReceivable", 2] }
            }
        }
    ]))[0] || { overtimeNetReceivable: 0 }

    return totals
}

async function nightShiftReceivableService(userId, scope) {

    const aggregationObject = {
        createdBy: new mongoose.Types.ObjectId(userId),
        payDate: scope
    }

    const totals = (
        await NightShift.aggregate([
            { $match: aggregationObject },
            {
                $group: {
                    _id: null,
                    nightMinutesClock: { $sum: "$nightMinutesClock" },
                    nightMinutesReduced: { $sum: "$nightMinutesReduced" },
                    nightShiftValue: { $sum: "$nightShiftValue" }
                }
            },
            {
                $project: {
                    nightMinutesClock: 1,
                    nightMinutesReduced: 1,
                    nightShiftValue: { $round: ["$nightShiftValue", 2] }
                }
            }
        ]))[0] || { nightMinutesClock: 0, nightMinutesReduced: 0, nightShiftValue: 0 }

    return totals
}

async function mealVoucherReceivableService(userId, scope) {

    const aggregateObject = {
        createdBy: new mongoose.Types.ObjectId(userId),
        payDate: scope
    }

    const totals = (await MealVoucher.aggregate([
        { $match: aggregateObject },
        {
            $group: {
                _id: null,
                mealVoucherOvertime: { $sum: { $cond: [{ $eq: ["$source", "overtime"] }, "$totalValue", 0] } },
                mealVoucherNightShift: { $sum: { $cond: [{ $eq: ["$source", "nightShift"] }, "$totalValue", 0] } },
                total: { $sum: '$totalValue' }
            }
        },
        {
            $project: {
                mealVoucherOvertime: { $round: ["$mealVoucherOvertime", 2] },
                mealVoucherNightShift: { $round: ["$mealVoucherNightShift", 2] },
                total: { $round: ["$total", 2] }
            }
        }
    ]))[0] || { mealVoucherOvertime: 0, mealVoucherNightShift: 0, total: 0 }

    return totals
}

module.exports = {
    overtimeReceivableService,
    overtimeNetReceivableService,
    nightShiftReceivableService,
    mealVoucherReceivableService
}

