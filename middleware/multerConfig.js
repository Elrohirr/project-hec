const multer = require('multer')
const path = require('path')
const storage = multer.memoryStorage()
const { BadRequestError } = require('../errors')

function fileFilterPDF(req, file, cb) {
    const mimetypeOk = file.mimetype === 'application/pdf'
    const extnameOk = path.extname(file.originalname).toLowerCase() === '.pdf'

    if (mimetypeOk && extnameOk) {
        cb(null, true)
    } else {
        cb(new BadRequestError('Apenas arquivos PDF são aceitos'), false)
    }
}

const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 },
    fileFilter: fileFilterPDF
})

module.exports = { upload }