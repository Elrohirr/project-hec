const express = require('express')
const router = express.Router()
const { getReceivables } = require('../controllers/receivables')

router.route('/').get(getReceivables)

module.exports = router