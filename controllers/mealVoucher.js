const mongoose = require('mongoose')
const MealVoucher = require('../models/MealVoucher')
const MealVoucherConfig = require('../models/MealVoucherConfig')
const { getReceivableDateRange } = require('../utils/rules')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, NotFoundError } = require('../errors')

// --------------------------- GET todos os registros de vale-refeição do usuário -----------------------------------------------------
const getAllMealVouchers = async (req, res) => {
    const { user: { userId }, query: { source, startDate, endDate, startPayDate, endPayDate, sort } } = req

    const queryObject = { createdBy: new mongoose.Types.ObjectId(userId) }
    if (source) queryObject.source = source
    if (startDate || endDate) {
        queryObject.date = {}
        if (startDate) queryObject.date.$gte = new Date(startDate)
        if (endDate) queryObject.date.$lte = new Date(endDate)
    }
    if (startPayDate || endPayDate) {
        queryObject.payDate = {}
        if (startPayDate) queryObject.payDate.$gte = new Date(startPayDate)
        if (endPayDate) queryObject.payDate.$lte = new Date(endPayDate)
    }
    let result = MealVoucher.find(queryObject)
    if (sort) {
        const sortedList = sort.split(',').join(' ')
        result = result.sort(sortedList)
    }
    else {
        result = result.sort('-date')
    }
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const skip = (page - 1) * limit
    result = result.skip(skip).limit(limit)

    const totals = (await MealVoucher.aggregate([
        { $match: queryObject },
        {
            $group: {
                _id: null,
                totalCount: { $sum: "$quantity" },
                totalValue: { $sum: "$totalValue" }
            }
        }
    ]))[0] || { quantity: 0, totalValue: 0 }
    const totalRecords = await MealVoucher.countDocuments(queryObject)

    const mealVoucher = await result.lean()
    res.status(StatusCodes.OK).json({
        totalRecords,
        numberOfPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        totals,
        mealVoucher
    })
}

// --------------------------- GET apenas um registro de vale-refeição específico do usuário ------------------------------------------
const getMealVoucher = async (req, res) => {
    const { user: { userId }, params: { id: mealVoucherId } } = req
    const mealVoucher = await MealVoucher.findOne({ createdBy: userId, _id: mealVoucherId }).lean()
    if (!mealVoucher) throw new NotFoundError('Ticket não encontrado')
    res.status(StatusCodes.OK).json({ mealVoucher })
}

const getMealVoucherReceivable = async (req, res) => {
    const { user: { userId }, query: { scope } } = req

    const aggregateObject = {
        createdBy: new mongoose.Types.ObjectId(userId),
        payDate: getReceivableDateRange(scope, new Date())
    }

    const totals = (await MealVoucher.aggregate([
        { $match: aggregateObject },
        {
            $group: {
                _id: null,
                mealVoucherOvertime: {
                    $sum: {
                        $cond: [{ $eq: ["$source", "overtime"] }, "$totalValue", 0]
                    }
                },
                mealVoucherNightShift: {
                    $sum: {
                        $cond: [{ $eq: ["$source", "nightShift"] }, "$totalValue", 0]
                    }
                },
                total: { $sum: '$totalValue' }
            }
        }
    ]))[0] || { mealVoucherOvertime: 0, mealVoucherNightShift: 0, total: 0 }
    res.status(StatusCodes.OK).json(totals)
}

module.exports = { getAllMealVouchers, getMealVoucher, getMealVoucherReceivable }