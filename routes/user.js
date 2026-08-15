const express = require('express')
const router = express.Router()
const { updateProfile, updatePassword, deleteAccount } = require('../controllers/user')

router.patch('/profile', updateProfile)
router.patch('/password', updatePassword)
router.delete('/', deleteAccount)

module.exports = router