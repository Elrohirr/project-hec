const express = require('express')
const router = express.Router()
const { getAllOvertime, getOvertime, createOvertime, updateOvertime, deleteOvertime, getOvertimeReceivable } = require('../controllers/overtime')

router.route('/').post(createOvertime).get(getAllOvertime)
router.route('/receivable').get(getOvertimeReceivable)
router.route('/:id').get(getOvertime).patch(updateOvertime).delete(deleteOvertime)

module.exports = router