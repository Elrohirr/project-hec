const mongoose = require('mongoose')
const Overtime = require("../models/Overtime");
const NightShift = require("../models/NightShift");
const { createHolidaysTable, dsrDays } = require("../utils/calendar");
const { roundCurrency } = require('../utils/tools')
const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");

const getDSR = async (req, res) => {
    const { query: { year }, user: { userId } } = req;

    const yearNumber = year ? Number(year) : new Date().getFullYear();
    if (!Number.isInteger(yearNumber)) {
        throw new BadRequestError("Ano inválido");
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const yearRange = {
        $gte: new Date(Date.UTC(yearNumber, 0, 1)),
        $lt: new Date(Date.UTC(yearNumber + 1, 0, 1)),
    };

    const [overtimeAgg, nightShiftAgg] = await Promise.all([
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
                                    {
                                        $divide: [
                                            "$values.valueHe50",
                                            "$distributionMinutes.he50minutes",
                                        ],
                                    },
                                    { $ifNull: ["$compensatedMinutesByTier.he50minutes", 0] },
                                ],
                            },
                            0,
                        ],
                    },
                    lost75: {
                        $cond: [
                            { $gt: ["$distributionMinutes.he75minutes", 0] },
                            {
                                $multiply: [
                                    {
                                        $divide: [
                                            "$values.valueHe75",
                                            "$distributionMinutes.he75minutes",
                                        ],
                                    },
                                    { $ifNull: ["$compensatedMinutesByTier.he75minutes", 0] },
                                ],
                            },
                            0,
                        ],
                    },
                    lost100: {
                        $cond: [
                            { $gt: ["$distributionMinutes.he100minutes", 0] },
                            {
                                $multiply: [
                                    {
                                        $divide: [
                                            "$values.valueHe100",
                                            "$distributionMinutes.he100minutes",
                                        ],
                                    },
                                    { $ifNull: ["$compensatedMinutesByTier.he100minutes", 0] },
                                ],
                            },
                            0,
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: { $month: "$payDate" },
                    total: {
                        $sum: {
                            $subtract: [
                                {
                                    $add: [
                                        { $ifNull: ["$values.valueHe50", 0] },
                                        { $ifNull: ["$values.valueHe75", 0] },
                                        { $ifNull: ["$values.valueHe100", 0] },
                                    ],
                                },
                                {
                                    $add: ["$lost50", "$lost75", "$lost100"],
                                },
                            ],
                        },
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    month: "$_id",
                    total: { $round: ["$total", 2] },
                },
            },
            { $sort: { month: 1 } },
        ]),

        // soma de pagamentos de turnos noturnos
        NightShift.aggregate([
            { $match: { createdBy: userObjectId, payDate: yearRange } },
            {
                $group: {
                    _id: { $month: "$payDate" },
                    totalNightShiftValue: { $sum: "$nightShiftValue" }
                }
            },
            { $project: { _id: 0, month: '$_id', totalNightShiftValue: 1 } },
            { $sort: { month: 1 } }
        ])
    ]);

    const holidayTable = createHolidaysTable(yearNumber);
    const previousYearHolidayTable = createHolidaysTable(yearNumber - 1);

    // calendários de REFERÊNCIA, um por linha de pagamento:
    // linha 0 (janeiro) usa dezembro do ano anterior; linha i usa o mês i-1 deste ano
    const referenceCalendars = [dsrDays(yearNumber - 1, 11, previousYearHolidayTable)];
    for (let i = 0; i < 11; i++) {
        referenceCalendars.push(dsrDays(yearNumber, i, holidayTable));
    }

    const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        overtimeValue: 0,
        nightShiftValue: 0,
        referenceDaysInMonth: referenceCalendars[i].daysInMonth,
        referenceDsrDays: referenceCalendars[i].dsr,
        referenceWorkingDays: referenceCalendars[i].workingDays,
        dsrValue: 0
    }));

    overtimeAgg.forEach(o => {
        months[o.month - 1].overtimeValue = o.total;
    });

    nightShiftAgg.forEach(n => {
        months[n.month - 1].nightShiftValue = n.totalNightShiftValue;
    });

    for (const month of months) {
        if (month.referenceWorkingDays > 0) {
            month.dsrValue = roundCurrency(
                (month.overtimeValue + month.nightShiftValue) / month.referenceWorkingDays * month.referenceDsrDays
            );
        }
    }

    res.status(StatusCodes.OK).json(months);
};

module.exports = { getDSR }