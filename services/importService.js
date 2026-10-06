const PDFExtractPromise = require('pdf.js-extract')
const { timeToMinutes, minutesToTime } = require('../utils/timeConversion')
const { findColumn } = require('../utils/tools')

// extrai os dados brutos do pdf
async function extractTableFromPdf(buffer) {
    const PDFExtract = await PDFExtractPromise
    const pdfExtract = new PDFExtract()
    const options = {}
    return new Promise((resolve, reject) => {
        pdfExtract.extractBuffer(buffer, options, (err, data) => {
            if (err) return reject(err)
            resolve(data)
        })
    })
}

// pipeline para extração de dados de forma "burra" de várias tabelas do ponto
function extractionPDFPipeline(data) {

    // iteração para cada página que contém a table com os dados
    let finalDoc = []
    for (let p = 0; p <= data.pages.length - 1; p += 2) {
        // stage 1 - remove ruídos do pdf e pega
        const items = data.pages[p].content

        const totaisLine = items.filter(item => item.str.includes('Totais'))
        const firstDate = items.filter(item => item.str.startsWith('01/') && item.x <= 15.7 + 1 && item.x >= 15.7 - 1)
        let yRef = firstDate[0].y  // referencia inicial y do primeiro dia de dados

        for (let i = items.length - 1; i >= 0; i--) {
            if (items[i].str === ' ' || items[i].str === '') {
                items.splice(i, 1)
            }
        }

        // stage 2 - filtra somente os valores em que y já representa linhas de dados utilizáveis dos dias e depois ordena em ordem crescente os y
        var itemFiltred = items.filter((object) => object.y > yRef - 1)
        var itemSorted = itemFiltred.sort(({ y: a }, { y: b }) => a - b)

        // stage 3 - agrupamento de y's próximos em uma lista de dias e ordenação dos x's para cada item dia do array
        let itemArray = []
        var tempArray = []

        for (let i = 0; i <= itemSorted.length - 1; i++) {
            if (itemSorted[i].y > totaisLine[0].y - 1) {
                tempArray.sort(({ x: a }, { x: b }) => a - b)
                itemArray.push(tempArray)
                break
            }
            if (itemSorted[i].y >= yRef - 1 && itemSorted[i].y <= yRef + 1) {
                tempArray.push(itemSorted[i])
            }
            else {
                tempArray.sort(({ x: a }, { x: b }) => a - b)
                itemArray.push(tempArray)
                yRef = itemSorted[i].y
                tempArray = []
                tempArray.push(itemSorted[i])
            }
        }

        // stage 4 - mapeamento dos grupos "dias" e montagem do mês, jogando pra dentro do documento final ao sair do loop de páginas
        const map = [
            { column: 'Data', x: 15.7 },
            { column: 'Horário', x: 78 },
            { column: 'Marcações', x: 168.8 },
            { column: 'H.Trab', x: 303 },
            { column: 'H.E.', x: 345.5 },
            { column: 'Ad.N.', x: 388 },
            { column: 'Ad.N HE.N', x: 430.6 },
            { column: 'Vl.Lanche', x: 479 },
            { column: 'Descontos', x: 521 },
            { column: 'Débito', x: 558 },
            { column: 'Crédito', x: 600.7 },
            { column: 'Justificativa', x: 630.85 },
        ]

        let monthDoc = []
        for (let i = 0; i <= itemArray.length - 1; i++) {
            let day = {}
            let cell = itemArray[i]
            for (let j = 0; j <= cell.length - 1; j++) {
                const column = findColumn(cell[j].x, map)
                const content = cell[j].str
                day[column] = content
            }
            monthDoc.push(day)
        }
        finalDoc.push(...monthDoc)
    }

    return finalDoc
}

// remove dias trabalhados que não geram registros de hora extra, adicional noturno e nem banco de horas
function filterEmptyDays(data) {
    for (let i = data.length - 1; i >= 0; i--) {
        if ((!Object.hasOwn(data[i], 'H.E.') &&
            !Object.hasOwn(data[i], 'Ad.N.') &&
            !Object.hasOwn(data[i], 'Ad.N HE.N') &&
            !Object.hasOwn(data[i], 'Débito') &&
            !Object.hasOwn(data[i], 'Crédito'))) {
            data.splice(i, 1)
        }
    }
    return data
}

function extractDateFromDay(str) {
    const slicedStr = str.slice(0, 10)
    const [day, month, year] = slicedStr.split('/')
    return [year, month, day].join('-')
}

function getRegistersByDay(data) {
    let previewArray = []
    let needsReviewArray = []
    for (let i = 0; i <= data.length - 1; i++) {

        // registros em datas de feriado
        if (data[i].Horário === 'Feriado' && Object.hasOwn(data[i], 'H.E.')) {
            const date = extractDateFromDay(data[i].Data)
            previewArray.push({
                type: 'Hora extra',
                date,
                workedHours: data[i]['H.E.'],
                isHoliday: true
            })
        }

        // registros de datas que tenham crédito em dias de folga ou prorrogações/antecipações
        if (Object.hasOwn(data[i], 'Crédito') && (data[i].Horário === 'FOLG' || data[i].Horário === 'FOL2')) {
            const date = extractDateFromDay(data[i].Data)
            previewArray.push({
                type: 'Hora extra',
                date,
                workedHours: data[i]['H.Trab'],
                isDayOff: true
            })

            // registros de hora extra em dias de trabalho normal (prorrogações/antecipações)
        } else if (Object.hasOwn(data[i], 'Crédito')) {
            // alguns minutos podem vir como ìmpar. Nesses casos, pegar o valor de H.Trab
            const date = extractDateFromDay(data[i].Data)
            const credit = timeToMinutes(data[i].Crédito)
            if (credit % 2 !== 0) {
                needsReviewArray.push({
                    date,
                    msg: `Erro ao tentar registrar a hora extra do dia ${date}. Favor verificar com o administrador.`
                })
            } else {
                previewArray.push({
                    type: 'Hora extra',
                    date,
                    workedHours: minutesToTime(credit / 2),
                    isDayOff: false
                })
            }
        }

        // registros de turno noturno, tanto em dias de escala quanto com hora extra
        if (Object.hasOwn(data[i], 'Ad.N.') || Object.hasOwn(data[i], 'Ad.N HE.N')) {
            const date = extractDateFromDay(data[i].Data)
            previewArray.push({
                type: 'Turno noturno',
                date,
                nightHours: data[i]['Ad.N.'] || data[i]['Ad.N HE.N']
            })
        }

        if (Object.hasOwn(data[i], 'Débito')) {
            const date = extractDateFromDay(data[i].Data)
            previewArray.push({
                type: 'Compensação',
                date,
                hoursNeeded: data[i].Débito
            })
        }
    }
    return { previewArray, needsReviewArray }
}

module.exports = { extractTableFromPdf, extractionPDFPipeline, filterEmptyDays, getRegistersByDay }