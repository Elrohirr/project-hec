const mongoose = require('mongoose')
const { StatusCodes } = require('http-status-codes')
const Overtime = require('../models/Overtime')
const { BadRequestError } = require('../errors')

// -------------------- aggregate único para retornar quantidade de hora extra e valor pago aos meses -------------------------------- 
const getMonthlyTotalsGraph = async (req, res) => {
    const { query: { year }, user: { userId } } = req

    const yearNumber = year ? Number(year) : new Date().getFullYear()
    if (!Number.isInteger(yearNumber)) {
        throw new BadRequestError('Ano inválido')
    }

    const userObjectId = new mongoose.Types.ObjectId(userId)

    // ------------------ cobre os dois casos do aggregate: hora extra feita e recebidos no ano ao longo dos meses -------------------
    const yearRange = {
        $gte: new Date(Date.UTC(yearNumber, 0, 1)),
        $lt: new Date(Date.UTC(yearNumber + 1, 0, 1))
    }

    const [minutesAgg, valuesAgg] = await Promise.all([
        // soma de hora extra feitas por tier agrupadas por mês
        Overtime.aggregate([
            { $match: { createdBy: userObjectId, date: yearRange } },
            {
                $group: {
                    _id: { $month: "$date" },
                    total50minutes: { $sum: "$distributionMinutes.he50minutes" },
                    total75minutes: { $sum: "$distributionMinutes.he75minutes" },
                    total100minutes: { $sum: { $cond: ["$isHoliday", 0, "$distributionMinutes.he100minutes"] } },
                    holidayMinutes: { $sum: { $cond: ["$isHoliday", "$distributionMinutes.he100minutes", 0] } }
                }
            },
            { $project: { _id: 0, month: '$_id', total50minutes: 1, total75minutes: 1, total100minutes: 1, holidayMinutes: 1 } },
            { $sort: { month: 1 } }
        ]),

        // soma de pagamentos de hora extra já com o compensado
        Overtime.aggregate([
            { $match: { createdBy: userObjectId, payDate: yearRange } },
            {
                $addFields: {
                    lost50: {
                        $cond: [
                            { $gt: ["$distributionMinutes.he50minutes", 0] },
                            {
                                $multiply: [
                                    { $divide: ["$values.valueHe50", "$distributionMinutes.he50minutes"] },
                                    { $ifNull: ["$compensatedMinutesByTier.he50minutes", 0] }
                                ]
                            },
                            0
                        ]
                    },
                    lost75: {
                        $cond: [
                            { $gt: ["$distributionMinutes.he75minutes", 0] },
                            {
                                $multiply: [
                                    { $divide: ["$values.valueHe75", "$distributionMinutes.he75minutes"] },
                                    { $ifNull: ["$compensatedMinutesByTier.he75minutes", 0] }
                                ]
                            },
                            0
                        ]
                    },
                    lost100: {
                        $cond: [
                            { $gt: ["$distributionMinutes.he100minutes", 0] },
                            {
                                $multiply: [
                                    { $divide: ["$values.valueHe100", "$distributionMinutes.he100minutes"] },
                                    { $ifNull: ["$compensatedMinutesByTier.he100minutes", 0] }
                                ]
                            },
                            0
                        ]
                    }
                }
            },
            {
                $addFields: {
                    net50: { $subtract: [{ $ifNull: ["$values.valueHe50", 0] }, "$lost50"] },
                    net75: { $subtract: [{ $ifNull: ["$values.valueHe75", 0] }, "$lost75"] },
                    net100: { $subtract: [{ $ifNull: ["$values.valueHe100", 0] }, "$lost100"] }
                }
            },
            {
                $group: {
                    _id: { $month: "$payDate" },
                    val50: { $sum: "$net50" },
                    val75: { $sum: "$net75" },
                    val100: { $sum: { $cond: ["$isHoliday", 0, "$net100"] } },
                    valHoliday: { $sum: { $cond: ["$isHoliday", "$net100", 0] } }
                }
            },
            {
                $project: {
                    _id: 0,
                    month: "$_id",
                    val50: { $round: ["$val50", 2] },
                    val75: { $round: ["$val75", 2] },
                    val100: { $round: ["$val100", 2] },
                    valHoliday: { $round: ["$valHoliday", 2] }
                }
            },
            { $sort: { month: 1 } }
        ])
    ])

    const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        minutes: { he50: 0, he75: 0, he100: 0, holiday: 0 },
        values: { he50: 0, he75: 0, he100: 0, holiday: 0 }
    }))

    minutesAgg.forEach(m => {
        months[m.month - 1].minutes = { he50: m.total50minutes, he75: m.total75minutes, he100: m.total100minutes, holiday: m.holidayMinutes }
    })

    valuesAgg.forEach(v => {
        months[v.month - 1].values = { he50: v.val50, he75: v.val75, he100: v.val100, holiday: v.valHoliday }
    })


    res.status(StatusCodes.OK).json(months)
}

module.exports = { getMonthlyTotalsGraph }