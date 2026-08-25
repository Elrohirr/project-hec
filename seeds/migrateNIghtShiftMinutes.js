require('dotenv').config()
const mongoose = require('mongoose')
const NightShift = require('../models/NightShift') // ajuste o path conforme seu projeto

const DRY_RUN = process.env.DRY_RUN === 'true'

function hhmmToMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) {
        return null
    }
    const [hoursStr, minutesStr] = hhmm.split(':')
    const hours = Number(hoursStr)
    const minutes = Number(minutesStr)

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return null
    }

    return hours * 60 + minutes
}

async function migrate() {
    await mongoose.connect(process.env.MONGO_URL)
    console.log(`Conectado ao MongoDB. Modo: ${DRY_RUN ? 'DRY RUN (sem gravação)' : 'EXECUÇÃO REAL'}`)

    const documents = await NightShift.find({})
    console.log(`${documents.length} documentos encontrados.`)

    let updated = 0
    let skipped = 0
    const errors = []

    for (const doc of documents) {
        const clockMinutes = hhmmToMinutes(doc.nightHoursClock)
        const reducedMinutes = hhmmToMinutes(doc.nightHoursReduced)

        if (clockMinutes === null || reducedMinutes === null) {
            errors.push({ id: doc._id, nightHoursClock: doc.nightHoursClock, nightHoursReduced: doc.nightHoursReduced })
            continue
        }

        if (DRY_RUN) {
            console.log(`[DRY RUN] ${doc._id}: nightMinutesClock=${clockMinutes}, nightMinutesReduced=${reducedMinutes}`)
            updated++
            continue
        }

        await NightShift.updateOne(
            { _id: doc._id },
            { $set: { nightMinutesClock: clockMinutes, nightMinutesReduced: reducedMinutes } }
        )
        updated++
    }

    skipped = documents.length - updated - errors.length

    console.log('--- Resumo ---')
    console.log(`Atualizados: ${updated}`)
    console.log(`Ignorados: ${skipped}`)
    console.log(`Erros de parsing: ${errors.length}`)
    if (errors.length > 0) {
        console.log('Documentos com erro:', errors)
    }

    await mongoose.disconnect()
}

migrate().catch(err => {
    console.error('Erro na migration:', err)
    process.exit(1)
})