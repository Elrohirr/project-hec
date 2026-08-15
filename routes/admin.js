const express = require('express')
const router = express.Router()
const { createMealVoucherConfig, activeMealVoucherConfig, getAllMealVoucherConfig } = require('../controllers/admin')

router.get('/', getAllMealVoucherConfig)
router.post('/', createMealVoucherConfig)
router.patch('/:id', activeMealVoucherConfig)

module.exports = router