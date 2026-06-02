const express = require('express')
const router = express.Router()
const { getAllMealVouchers, getMealVoucher, createMealVoucher, updateMealVoucher, deleteMealVoucher } = require('../controllers/mealVoucher')

router.route('/').post(createMealVoucher).get(getAllMealVouchers)
router.route('/:id').get(getMealVoucher).patch(updateMealVoucher).delete(deleteMealVoucher)

module.exports = router