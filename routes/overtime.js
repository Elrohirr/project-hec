const express = require('express')
const router = express.Router()
const { getAllOvertime, getOvertime, createOvertime, updateOvertime, deleteOvertime, multiDeleteOvertime } = require('../controllers/overtime')

router.route('/').post(createOvertime).get(getAllOvertime).delete(multiDeleteOvertime)
router.route('/:id').get(getOvertime).patch(updateOvertime).delete(deleteOvertime)

module.exports = router