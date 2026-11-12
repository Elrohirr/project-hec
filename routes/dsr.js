const express = require('express')
const router = express.Router()
const {getDSR} = require('../controllers/dsr')

router.route('/').get(getDSR) 

module.exports = router