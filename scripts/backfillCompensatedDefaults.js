require('dotenv').config()
const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')

const DRY_RUN = process.env.DRY_RUN !== 'false' // default true, precisa DRY_RUN=false explícito pra gravar

async function run() {
    await mongoose.connect(process.env.MONGO_URL)
    console.log(`Conectado ao banco. Modo: ${DRY_RUN ? 'DRY_RUN (nada será gravado)' : 'EXECUÇÃO REAL'}`)

    // pega documentos que estejam faltando QUALQUER um dos dois campos
    const cursor = Overtime.find({
        $or: [
            { compensatedValue: { $exists: false } },
            { compensatedMinutesByTier: { $exists: false } }
        ]
    }).lean().cursor()

    let scanned = 0
    let toUpdate = 0
    const bulkOps = []

    for await (const doc of cursor) {
        scanned++

        const missingValue = doc.compensatedValue === undefined || doc.compensatedValue === null
        const tier = doc.compensatedMinutesByTier
        const missingTier = tier === undefined || tier === null ||
            tier.he50minutes === undefined || tier.he75minutes === undefined || tier.he100minutes === undefined

        const setFields = {}
        if (missingValue) setFields.compensatedValue = 0
        if (missingTier) {
            setFields.compensatedMinutesByTier = {
                he50minutes: tier?.he50minutes ?? 0,
                he75minutes: tier?.he75minutes ?? 0,
                he100minutes: tier?.he100minutes ?? 0
            }
        }

        // se por algum motivo não há nada a corrigir nesse documento, pula
        if (Object.keys(setFields).length === 0) continue

        console.log(
            `[${doc._id}] date=${doc.date?.toISOString().slice(0, 10)} ` +
            `-> será setado: ${JSON.stringify(setFields)}`
        )

        toUpdate++
        bulkOps.push({
            updateOne: {
                filter: { _id: doc._id },
                update: { $set: setFields }
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