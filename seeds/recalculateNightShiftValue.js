require('dotenv').config()
const mongoose = require('mongoose')
const NightShift = require('../models/NightShift') // ajuste o path conforme seu projeto
const { defineNightValue } = require('../utils/rules')

const DRY_RUN = process.env.DRY_RUN === 'true'

async function migrate() {
    await mongoose.connect(process.env.MONGO_URL)
    console.log(`Conectado ao MongoDB. Modo: ${DRY_RUN ? 'DRY RUN (sem gravação)' : 'EXECUÇÃO REAL'}`)

    const documents = await NightShift.find({})
    console.log(`${documents.length} documentos encontrados.`)

    let updated = 0
    let skipped = 0
    const errors = []

    for (const doc of documents) {
        if (typeof doc.nightMinutesReduced !== 'number' || typeof doc.wageAtCalculation !== 'number') {
            errors.push({ id: doc._id, nightMinutesReduced: doc.nightMinutesReduced, wageAtCalculation: doc.wageAtCalculation })
            continue
        }

        const newValue = defineNightValue(doc.nightMinutesReduced, doc.wageAtCalculation)

        if (newValue === doc.nightShiftValue) {
            skipped++
            continue
        }

        if (DRY_RUN) {
            console.log(`[DRY RUN] ${doc._id}: nightShiftValue ${doc.nightShiftValue} -> ${newValue}`)
            updated++
            continue
        }

        await NightShift.updateOne(
            { _id: doc._id },
            { $set: { nightShiftValue: newValue } }
        )
        updated++
    }

    console.log('--- Resumo ---')
    console.log(`Atualizados: ${updated}`)
    console.log(`Ignorados (já corretos): ${skipped}`)
    console.log(`Erros de dados: ${errors.length}`)
    if (errors.length > 0) {
        console.log('Documentos com erro:', errors)
    }

    await mongoose.disconnect()
}

migrate().catch(err => {
    console.error('Erro na migration:', err)
    process.exit(1)
})