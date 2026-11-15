const express = require('express')
const router = express.Router()
const { getOvertimeMonthlyTotals, getMonthlyNightShiftGraph } = require('../controllers/graphic')

router.get('/overtime', getOvertimeMonthlyTotals)
router.get('/nightshift', getMonthlyNightShiftGraph)

module.exports = router

