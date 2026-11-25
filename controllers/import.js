const { StatusCodes } = require('http-status-codes')
const { createOvertimeService } = require('../services/overtimeService')
const { createNightShiftService } = require('../services/nightShiftService')
const { confirmCompensationService, checkForDebts } = require('../services/bankService')
const { extractTableFromPdf, extractionPDFPipeline, filterEmptyDays, getRegistersByDay, clearEmptyStr, getRefs, getRubrics } = require('../services/importService')
const { BadRequestError } = require('../errors')
const { timeToMinutes, minutesToTime, intDateFormatToBR } = require('../utils/timeConversion')

// converte o crédito do ponto em minutos realmente trabalhados, considerando a dívida aberta:
// a parte do crédito que paga dívida vale 1 a 1; o que passar disso vale em dobro
function creditToWorkedMinutes(creditMinutes, debtMinutes) {
    if (creditMinutes <= debtMinutes) return { workedMinutes: creditMinutes }
    const excess = creditMinutes - debtMinutes
    if (excess % 2 !== 0) return { error: true }
    return { workedMinutes: debtMinutes + excess / 2 }
}

function buildRejection(register, error) {
    return {
        type: register.type,
        date: register.date,
        msg: error.code === 11000
            ? `${register.type} do dia ${intDateFormatToBR(register.date)} já cadastrada no sistema.`
            : error.message
    }
}

// --------------------------- extrai dados do pdf do ponto e monta a preview --------------------------------
const importPDFPreview = async (req, res) => {
    if (!req.file?.buffer) throw new BadRequestError('Arquivo não enviado.')
    const buffer = req.file.buffer
    const data = await extractTableFromPdf(buffer)
    const finalDoc = extractionPDFPipeline(data)
    const finalDocFiltred = filterEmptyDays(finalDoc)
    const preview = getRegistersByDay(finalDocFiltred)

    res.status(StatusCodes.OK).json({ array: preview })
}

// usa vários serviços de criação de hora extra, adicional noturno e banco de horas a partir do resultado do import do pdf do ponto --------------------------------
const confirmPDFImport = async (req, res) => {
    const { body: { registers }, user: { userId } } = req
    if (!registers) throw new BadRequestError('Por favor, envie a lista de dias.')

    let created = []
    let rejected = []
    for (let i = 0; i <= registers.length - 1; i++) {
        // ------------------------------------------------ cria o registro de compensação - tem precedencia à hora extra ------------------------------------------------------
        if (registers[i].type === 'Compensação') {
            try {
                const result = await confirmCompensationService(userId, registers[i].hoursNeeded, registers[i].date)
                // confirmCompensationService devolve { bankCompensation } ou { bankCompensation, debt } quando há compensação, ou { debt }
                // quando não há HE elegível (nenhum documento de compensação criado).
                if (result && result.bankCompensation) {
                    created.push(result.bankCompensation)
                }
            } catch (error) {
                rejected.push(buildRejection(registers[i], error))
            }
            // --------------------- cria os registros de horas extra em dias de trabalho normal (prorrogações/antecipações) -----------------------------------------
        } else if (registers[i].type === 'Hora extra' && Object.hasOwn(registers[i], 'creditForm')) {
            try {
                const debtMinutes = await checkForDebts(userId, registers[i].date)
                const { workedMinutes, error } = creditToWorkedMinutes(timeToMinutes(registers[i].workedHours), debtMinutes)
                if (error) {
                    rejected.push({
                        type: registers[i].type,
                        date: registers[i].date,
                        msg: `Crédito do dia ${registers[i].date} inconsistente com as dívidas abertas. Verifique o ponto com o administrador.`
                    })
                } else {
                    const overtime = await createOvertimeService({
                        date: registers[i].date,
                        workedHours: minutesToTime(workedMinutes),
                        userId
                    })
                    created.push(overtime)
                }
            } catch (error) {
                rejected.push(buildRejection(registers[i], error))
            }
            // ------------------------------------ cria os registros de horas extra de feriado ou férias ------------------------------------------------------
        } else if (registers[i].type === 'Hora extra') {
            const createFields = {
                date: registers[i].date,
                workedHours: registers[i].workedHours,
                isDayOff: registers[i].isDayOff,
                isHoliday: registers[i].isHoliday,
                userId: userId
            }
            try {
                const overtime = await createOvertimeService(createFields)
                created.push(overtime)
            } catch (error) {
                rejected.push(buildRejection(registers[i], error))
            }
            // ------------------------------------------------ cria o registro do turno noturno ------------------------------------------------------
        } else if (registers[i].type === 'Turno noturno') {
            const createFields = {
                date: registers[i].date,
                nightHoursClock: registers[i].nightHours,
                userId
            }
            try {
                const nightShift = await createNightShiftService(createFields)
                created.push(nightShift)
            } catch (error) {
                rejected.push(buildRejection(registers[i], error))
            }
            // ------------------------------------------------ para types desconhecidos e que não são type === compensação -> envia ao rejected ------------------------------------------------------
        } else {
            const unknowFields = {
                type: 'Desconhecido',
                docType: registers[i].type,
                date: registers[i].date,
                msg: 'Registro desconhecido. Necessário verificação manual'
            }
            rejected.push(unknowFields)
        }
    }
    res.status(StatusCodes.OK).json({ created, rejected })
}

const importPaycheck = async (req, res) => {
    if (!req.file?.buffer) throw new BadRequestError('Arquivo não enviado.')
    const buffer = req.file.buffer
    const data = await extractTableFromPdf(buffer)
    const items = clearEmptyStr(data.pages[0].content)
    var itemSorted = items.sort(({ y: a }, { y: b }) => a - b)
    const refs = getRefs(itemSorted)
    const rubricsData = getRubrics(itemSorted)

    res.status(StatusCodes.OK).json(rubricsData)
}
module.exports = {
    importPDFPreview, confirmPDFImport,
    importPaycheck
}