const Overtime = require('../models/Overtime')
const NightShift = require('../models/NightShift')
const {countSundays, isSunday} = require('../utils/calendar')
const {StatusCodes} = require('http-status-codes')
const { BadRequestError } = require('../errors')

const getDSR = async (req,res) => {
    const {user:{userId}} = req
    res.status(StatusCodes.OK).json({message: "DSR route is working"})
}

module.exports = {getDSR}