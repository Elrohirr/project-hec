const express = require('express')
const router = express.Router()
const { simulateBankCompensation, confirmBankCompensation, getAllBankCompensation, cancelBankCompensation } = require('../controllers/bank')

router.get('/', getAllBankCompensation)
router.post('/preview', simulateBankCompensation)
router.post('/confirm', confirmBankCompensation)
router.patch('/cancel/:id', cancelBankCompensation)

module.exports = router