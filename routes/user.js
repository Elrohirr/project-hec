const express = require('express')
const router = express.Router()
const { updateProfile, updatePassword, deleteAccount, createHourlyWage, getAllHourlyWages, updateHourlyWage, deleteHourlyWage } = require('../controllers/user')

router.route('/wage').get(getAllHourlyWages).post(createHourlyWage)
router.route('/wage/:id').patch(updateHourlyWage).delete(deleteHourlyWage)
router.patch('/profile', updateProfile)
router.patch('/password', updatePassword)
router.delete('/', deleteAccount)

module.exports = router