const { StatusCodes } = require('http-status-codes')
const { createOvertimeService, createNightShiftService } = require('../services/createRegisterService')
const { extractTableFromPdf, extractionPDFPipeline, filterEmptyDays, getRegistersByDay } = require('../services/importService')
const { BadRequestError } = require('../errors')

const importPDFPreview = async (req, res) => {
    const buffer = req.file.buffer
    const data = await extractTableFromPdf(buffer)
    const finalDoc = extractionPDFPipeline(data)
    const finalDocFiltred = filterEmptyDays(finalDoc)
    const preview = getRegistersByDay(finalDocFiltred)

    res.status(StatusCodes.OK).json({ array: preview })
}

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
            // ------------------------------------------------ para types desconhecidos e que não são type === débito -> envia ao rejected ------------------------------------------------------
        } else if (registers[i].type !== 'Débito') {
            const unknowFields = {
                type: 'Desconhecido',
                date: registers[i].date,
                msg: 'Registro desconhecido. Necessário verificação manual'
            }
            rejected.push(unknowFields)
        }
    }

    // pseudocódigo aqui:
    // filtrar somente os type ===  débito
    // criar loop for para criar os registros de banco de horas, adicionando ao created os com sucesso e adiconando ao rejected os rejeitados

    res.status(StatusCodes.CREATED).json({ created, rejected })
}

module.exports = { importPDFPreview, confirmPDFImport }