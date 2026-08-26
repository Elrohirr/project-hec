const express = require('express')
const router = express.Router()
const { createMealVoucherConfig, activeMealVoucherConfig, getAllMealVoucherConfig, getAllUsers, deleteUser } = require('../controllers/admin')

router.route('/').get(getAllMealVoucherConfig).post(createMealVoucherConfig)
router.patch('/:id', activeMealVoucherConfig)
router.route('/users').get(getAllUsers)
router.delete('/:id', deleteUser)

module.exports = router