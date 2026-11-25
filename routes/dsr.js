const express = require('express')
const router = express.Router()
const { getDSR, getHolidays } = require('../controllers/dsr')

router.route('/').get(getDSR)
router.route('/holidays').get(getHolidays)

module.exports = router