const express = require('express')
const router = express.Router()
const {getAllNightShift, getNightShift, createNightShift, updateNightShift, deleteNightShift} = require('../controllers/nightShift')

router.route('/').post(createNightShift).get(getAllNightShift)
router.route('/:id').get(getNightShift).patch(updateNightShift).delete(deleteNightShift)

module.exports = router