const express = require('express')
const router = express.Router()
const { importPDFPreview, confirmPDFImport, importPaycheck } = require('../controllers/import')
const { upload } = require('../middleware/multerConfig')

router.post('/', upload.single('file'), importPDFPreview)
router.post('/compare', upload.single('file'), importPaycheck)
router.post('/confirm', confirmPDFImport)

module.exports = router