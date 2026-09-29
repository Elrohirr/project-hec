const { StatusCodes } = require('http-status-codes')
const { extractTableFromPdf, extractionPDFPipeline, filterEmptyDays, getRegistersByDay } = require('../services/importService')
const { BadRequestError, NotFoundError } = require('../errors')

const importPDFPreview = async (req, res) => {
    const buffer = req.file.buffer
    const data = await extractTableFromPdf(buffer)
    const finalDoc = extractionPDFPipeline(data)
    const finalDocFiltred = filterEmptyDays(finalDoc)
    const preview = getRegistersByDay(finalDocFiltred)

    res.status(StatusCodes.OK).json({ array: preview, length: preview.length })
}

const confirmPDFImport = async (req, res) => {
    res.send('confirm pdf import')
}

module.exports = { importPDFPreview, confirmPDFImport }