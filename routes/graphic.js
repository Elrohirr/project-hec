const express = require('express')
const router = express.Router()
const { getMonthlyTotalsGraph } = require('../controllers/graphic')

router.get('/', getMonthlyTotalsGraph)

module.exports = router

