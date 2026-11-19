const express = require('express')
const router = express.Router()
const { simulateBankCompensation, confirmBankCompensation, getAllBankCompensation,
    cancelBankCompensation, getAllDebtBank, cancelDebt } = require('../controllers/bank')

router.get('/', getAllBankCompensation)
router.get('/debt', getAllDebtBank)
router.delete('/debt/:id', cancelDebt)
router.post('/preview', simulateBankCompensation)
router.post('/confirm', confirmBankCompensation)
router.patch('/cancel/:id', cancelBankCompensation)

module.exports = router