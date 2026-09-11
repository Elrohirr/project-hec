const express = require('express')
const router = express.Router()
const { simulateBankCompensation, confirmBankCompensation, getAllBankCompensation, cancelBankCompesation } = require('../controllers/bank')

router.get('/', getAllBankCompensation)
router.post('/preview', simulateBankCompensation)
router.post('/confirm', confirmBankCompensation)
router.patch('/cancel/:id', cancelBankCompesation)

module.exports = router