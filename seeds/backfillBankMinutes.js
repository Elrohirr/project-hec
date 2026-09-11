// scripts/backfillBankMinutes.js
require('dotenv').config()
const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')

const DRY_RUN = process.env.DRY_RUN !== 'false' // default true, precisa setar DRY_RUN=false explicitamente pra gravar

function bankMinutes(workedMinutes, isHoliday) {
    if (!isHoliday) return workedMinutes * 2
    return 0
}

async function run() {
    await mongoose.connect(process.env.MONGO_URL)
    console.log(`Conectado ao banco. Modo: ${DRY_RUN ? 'DRY_RUN (nada será gravado)' : 'EXECUÇÃO REAL'}`)

    // pega só documentos que ainda não têm os campos (evita reprocessar em reruns)
    const cursor = Overtime.find({
        $or: [
            { bankedMinutes: { $exists: false } },
            { compensatedMinutes: { $exists: false } }
        ]
    }).cursor()

    let scanned = 0
    let toUpdate = 0
    const bulkOps = []

    for await (const doc of cursor) {
        scanned++

        const computedBankedMinutes = bankMinutes(doc.workedMinutes, doc.isHoliday ?? false)
        const computedCompensatedMinutes = 0 // todos os registros pré-existentes são não-compensados por definição

        console.log(
            `[${doc._id}] date=${doc.date?.toISOString().slice(0, 10)} ` +
            `workedMinutes=${doc.workedMinutes} isHoliday=${doc.isHoliday} ` +
            `-> bankedMinutes=${computedBankedMinutes}, compensatedMinutes=${computedCompensatedMinutes}`
        )

        toUpdate++
        bulkOps.push({
            updateOne: {
                filter: { _id: doc._id },
                update: {
                    $set: {
                        bankedMinutes: computedBankedMinutes,
                        compensatedMinutes: computedCompensatedMinutes
                    }
                }
            }
        })
    }

    console.log(`\nTotal escaneado: ${scanned}`)
    console.log(`Total a atualizar: ${toUpdate}`)

    if (DRY_RUN) {
        console.log('\nDRY_RUN ativo — nenhuma alteração foi gravada. Rode com DRY_RUN=false para aplicar.')
    } else if (bulkOps.length > 0) {
        const result = await Overtime.bulkWrite(bulkOps, { ordered: false })
        console.log(`\nAtualizados: ${result.modifiedCount}`)
    }

    await mongoose.disconnect()
}

run().catch(err => {
    console.error('Erro na migração:', err)
    process.exit(1)
})