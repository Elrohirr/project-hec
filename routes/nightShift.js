const express = require('express')
const router = express.Router()
const { getAllNightShift, getNightShift, createNightShift, updateNightShift, deleteNightShift, getNightShiftReceivable } = require('../controllers/nightShift')

router.route('/').post(createNightShift).get(getAllNightShift)
router.route('/receivable').get(getNightShiftReceivable)
router.route('/:id').get(getNightShift).patch(updateNightShift).delete(deleteNightShift)

module.exports = router