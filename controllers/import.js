const { StatusCodes } = require('http-status-codes')
const { createOvertimeService } = require('../services/overtimeService')
const { createNightShiftService } = require('../services/nightShiftService')
const { confirmCompensation } = require('../services/bankService')
const { extractTableFromPdf, extractionPDFPipeline, filterEmptyDays, getRegistersByDay, clearEmptyStr } = require('../services/importService')
const { BadRequestError } = require('../errors')

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
        // ------------------------------------------------ cria o registro de hora extra ------------------------------------------------------
        if (registers[i].type === 'Hora extra') {
            const createFields = {
                date: registers[i].date,
                workedHours: registers[i].workedHours,
                isDayOff: registers[i].isDayOff,
                isHoliday: registers[i].isHoliday,
                userId
            }
            try {
                const overtime = await createOvertimeService(createFields)
                created.push(overtime)
            } catch (error) {
                if (error.code === 11000) {
                    const errorFields = {
                        type: registers[i].type,
                        date: registers[i].date,
                        msg: `Hora extra do dia ${registers[i].date} já cadastrada no sistema.`
                    }
                    rejected.push(errorFields)
                } else {
                    const errorFields = {
                        type: registers[i].type,
                        date: registers[i].date,
                        msg: error.message
                    }
                    rejected.push(errorFields)
                }
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
                if (error.code === 11000) {
                    const errorFields = {
                        type: registers[i].type,
                        date: registers[i].date,
                        msg: `Turno noturno do dia ${registers[i].date} já cadastrado no sistema.`
                    }
                    rejected.push(errorFields)
                } else {
                    const errorFields = {
                        type: registers[i].type,
                        date: registers[i].date,
                        msg: error.message
                    }
                    rejected.push(errorFields)
                }
            }
            // ------------------------------------------------ para types desconhecidos e que não são type === compensação -> envia ao rejected ------------------------------------------------------
        } else if (registers[i].type !== 'Compensação') {
            const unknowFields = {
                type: 'Desconhecido',
                docType: registers[i].type,
                date: registers[i].date,
                msg: 'Registro desconhecido. Necessário verificação manual'
            }
            rejected.push(unknowFields)
        }
    }

    // após criar todos os registros de hora extra e turno noturno, serão criados os registros de banco de horas, se houver
    const onlyCompensations = registers.filter(day => day.type === 'Compensação')
    for (let i = 0; i <= onlyCompensations.length - 1; i++) {
        try {
            const bankCompensation = await confirmCompensation(userId, onlyCompensations[i].hoursNeeded, onlyCompensations[i].date)
            created.push(bankCompensation)
        } catch (error) {
            if (error.code === 11000) {
                const errorFields = {
                    type: onlyCompensations[i].type,
                    date: onlyCompensations[i].date,
                    msg: `Compensação do dia ${onlyCompensations[i].date} já cadastrada no sistema.`
                }
                rejected.push(errorFields)
            } else {
                const errorFields = {
                    type: 'Compensação',
                    date: onlyCompensations[i].date,
                    msg: error.message
                }
                rejected.push(errorFields)
            }
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

    res.status(StatusCodes.OK).json(itemSorted)
}

module.exports = {
    importPDFPreview, confirmPDFImport,
    importPaycheck
}