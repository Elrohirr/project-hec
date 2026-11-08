const express = require('express')
const router = express.Router()
const { getAllMealVouchers, getMealVoucher } = require('../controllers/mealVoucher')

router.route('/').get(getAllMealVouchers)
router.route('/:id').get(getMealVoucher)

module.exports = router