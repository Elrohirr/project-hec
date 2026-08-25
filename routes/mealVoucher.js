const express = require('express')
const router = express.Router()
const { getAllMealVouchers, getMealVoucher, getMealVoucherReceivable } = require('../controllers/mealVoucher')

router.route('/').get(getAllMealVouchers)
router.route('/receivable').get(getMealVoucherReceivable)
router.route('/:id').get(getMealVoucher)

module.exports = router