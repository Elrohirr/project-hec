const { extractTableFromPdf } = require('../utils/services')

const importPDFPreview = async (req, res) => {
    const buffer = req.file.buffer
    const data = await extractTableFromPdf(buffer)
    const items = data.pages[0].content
    const célula = items.filter(item => item.str.includes('24/01/2026'))
    const linha = items.filter(item => Math.abs(item.y - 467.171) < 1)
    console.log(linha)
    res.send('import pdf')
}

const confirmPDFImport = async (req, res) => {
    res.send('confirm pdf import')
}

module.exports = { importPDFPreview, confirmPDFImport }