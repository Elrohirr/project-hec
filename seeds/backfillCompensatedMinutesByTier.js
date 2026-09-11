// scripts/backfillCompensatedMinutesByTier.js
require('dotenv').config()
const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')

const DRY_RUN = process.env.DRY_RUN === 'false' // default true, precisa DRY_RUN=false explícito pra gravar

// mesma ordem de precedência usada no findEligibleOvetimes: 50 -> 75 -> 100
const TIERS = ['he50', 'he75', 'he100']

function distributeByTier(compensatedWorkedMinutes, distributionMinutes) {
    const result = { he50: 0, he75: 0, he100: 0 }
    let remaining = compensatedWorkedMinutes

    for (const tier of TIERS) {
        if (remaining <= 0) break

        const tierAvailable = distributionMinutes[`${tier}minutes`] || 0
        const consumed = Math.min(tierAvailable, remaining)

        result[tier] = consumed
        remaining -= consumed
    }

    return { result, remaining } // remaining > 0 no final indica inconsistência de dados
}

async function run() {
    await mongoose.connect(process.env.MONGO_URL)
    console.log(`Conectado ao banco. Modo: ${DRY_RUN ? 'DRY_RUN (nada será gravado)' : 'EXECUÇÃO REAL'}`)

    // só documentos com compensação existente e que ainda não têm o campo novo
    const cursor = Overtime.find({
        compensatedMinutes: { $gt: 0 },
        compensatedMinutesByTier: { $exists: false }
    }).cursor()

    let scanned = 0
    let toUpdate = 0
    let inconsistent = 0
    const bulkOps = []

    for await (const doc of cursor) {
        scanned++

        // compensatedMinutes está em espaço "banked" (dobrado); os tiers em distributionMinutes
        // estão em espaço "worked" -> precisa converter antes de distribuir
        const compensatedWorkedMinutes = doc.compensatedMinutes / 2

        const { result, remaining } = distributeByTier(compensatedWorkedMinutes, doc.distributionMinutes)

        if (remaining > 0) {
            inconsistent++
            console.warn(
                `[INCONSISTENTE] [${doc._id}] date=${doc.date?.toISOString().slice(0, 10)} ` +
                `compensatedMinutes=${doc.compensatedMinutes} (worked=${compensatedWorkedMinutes}) ` +
                `distributionMinutes=${JSON.stringify(doc.distributionMinutes)} ` +
                `-> sobrou ${remaining}min sem tier pra alocar. Revisar manualmente, não migrado automaticamente.`
            )
            continue // não inclui no bulkOps, precisa de revisão manual
        }

        console.log(
            `[${doc._id}] date=${doc.date?.toISOString().slice(0, 10)} ` +
            `compensatedMinutes=${doc.compensatedMinutes} -> compensatedMinutesByTier=${JSON.stringify(result)}`
        )

        toUpdate++
        bulkOps.push({
            updateOne: {
                filter: { _id: doc._id },
                update: { $set: { compensatedMinutesByTier: result } }
            }
        })
    }

    console.log(`\nTotal escaneado: ${scanned}`)
    console.log(`Total a atualizar: ${toUpdate}`)
    console.log(`Total inconsistente (não migrado, requer revisão manual): ${inconsistent}`)

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