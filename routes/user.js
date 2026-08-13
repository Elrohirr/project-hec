const express = require('express')
const router = express.Router()
const {getProfile, updateProfile, updatePassword, deleteAccount} = require('../controllers/user')

router.get('/profile',getProfile)
router.patch('/profile',updateProfile)
router.patch('/password',updatePassword)
router.delete('/',deleteAccount)

module.exports = router