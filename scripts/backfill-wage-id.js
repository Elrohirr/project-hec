/**
 * Backfill: preenche o wageId nos registros de Overtime e NightShift que ainda
 * não têm vínculo, usando o mesmo critério do getWageAt:
 *   salário do usuário com maior effectiveFrom <= data de trabalho do registro.
 *
 * O que ele FAZ:    grava somente wageId (e só onde estiver vazio).
 * O que ele NÃO faz: não altera wageAtCalculation, valores, datas nem updatedAt.
 *
 * Uso:
 *   DRY_RUN=true  node scripts/backfill-wage-id.js   (padrão: só simula e relata)
 *   DRY_RUN=false node scripts/backfill-wage-id.js   (grava de verdade)
 *
 * Idempotente: pode rodar várias vezes, só toca registros sem wageId.
 * Pré-requisito: a collection Wage já deve estar populada (migration dos usuários).
 *
 * Ajuste os requires, a variável de conexão e DATE_FIELD conforme o projeto.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose')
const Wage = require('../models/Wage')
const Overtime = require('../models/Overtime')
const NightShift = require('../models/NightShift')

const DRY_RUN = process.env.DRY_RUN !== 'false'
const BATCH_SIZE = 500
const MAX_LISTED = 100 // limite de linhas impressas por lista

// Campo de data de TRABALHO em cada model (a mesma data usada pelo getWageAt)
const TARGETS = [
    { name: 'Overtime', Model: Overtime, dateField: 'date' },
    { name: 'NightShift', Model: NightShift, dateField: 'date' }
]

// wagesByUser: Map<userId, [{ _id, wage, effectiveFrom(ms) }] ordenado por effectiveFrom ASC>
const loadWages = async () => {
    const wages = await Wage.find({}).select('_id createdBy wage effectiveFrom').sort({ effectiveFrom: 1 }).lean()
    const map = new Map()
    for (const w of wages) {
        const key = w.createdBy.toString()
        if (!map.has(key)) map.set(key, [])
        map.get(key).push({ _id: w._id, wage: w.wage, effectiveFrom: new Date(w.effectiveFrom).getTime() })
    }
    return map
}

// último salário com effectiveFrom <= data (mesma regra do getWageAt)
const resolveWage = (list, dateMs) => {
    if (!list) return null
    for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].effectiveFrom <= dateMs) return list[i]
    }
    return null
}

const processTarget = async ({ name, Model, dateField }, wagesByUser) => {
    const summary = { scanned: 0, toLink: 0, linked: 0, noWageForDate: 0, noWageAtAll: 0, divergent: 0, errors: 0 }
    const notFound = []
    const divergent = []
    let ops = []

    const flush = async () => {
        if (!ops.length) return
        const batch = ops
        ops = []
        if (DRY_RUN) return
        try {
            // timestamps:false => não mexe no updatedAt; bulkWrite não dispara hooks
            const res = await Model.bulkWrite(batch, { ordered: false, timestamps: false })
            summary.linked += res.modifiedCount
        } catch (err) {
            summary.errors += batch.length
            console.error(`ERRO no lote de ${name}: ${err.message}`)
        }
    }

    // wageId: null casa com campo ausente e com valor null
    const cursor = Model.find({ wageId: null }).select(`_id createdBy ${dateField} wageAtCalculation`).lean().cursor()

    for await (const rec of cursor) {
        summary.scanned++
        const list = wagesByUser.get(rec.createdBy.toString())
        if (!list) {
            summary.noWageAtAll++
            if (notFound.length < MAX_LISTED) notFound.push(`${rec._id} (usuário sem nenhum Wage)`)
            continue
        }

        const dateMs = new Date(rec[dateField]).getTime()
        const wage = resolveWage(list, dateMs)
        if (!wage) {
            summary.noWageForDate++
            if (notFound.length < MAX_LISTED) {
                notFound.push(`${rec._id} (data ${new Date(rec[dateField]).toISOString().slice(0, 10)} anterior ao primeiro effectiveFrom)`)
            }
            continue
        }

        // Só relata: o snapshot wageAtCalculation NUNCA é alterado por este script
        if (typeof rec.wageAtCalculation === 'number' && rec.wageAtCalculation !== wage.wage) {
            summary.divergent++
            if (divergent.length < MAX_LISTED) {
                divergent.push(`${rec._id}: snapshot ${rec.wageAtCalculation} x Wage vigente ${wage.wage}`)
            }
        }

        summary.toLink++
        ops.push({
            updateOne: {
                filter: { _id: rec._id, wageId: null }, // não sobrescreve se alguém já preencheu
                update: { $set: { wageId: wage._id } }
            }
        })
        if (ops.length >= BATCH_SIZE) await flush()
    }
    await flush()

    return { summary, notFound, divergent }
}

const run = async () => {
    await mongoose.connect(process.env.MONGO_URL)
    console.log('\n=== Backfill do wageId ===')
    console.log(`Modo: ${DRY_RUN ? 'DRY_RUN (nada será gravado)' : 'GRAVAÇÃO REAL'}\n`)

    const wagesByUser = await loadWages()
    console.log(`Usuários com ao menos um Wage: ${wagesByUser.size}\n`)

    for (const target of TARGETS) {
        console.log(`--- ${target.name} ---`)
        const { summary, notFound, divergent } = await processTarget(target, wagesByUser)
        console.table(summary)

        if (notFound.length) {
            console.log(`Registros SEM salário para a data (não serão alterados) [até ${MAX_LISTED}]:`)
            notFound.forEach((l) => console.log(`  - ${l}`))
        }
        if (divergent.length) {
            console.log(`Registros em que o snapshot difere do Wage vigente (vínculo criado, snapshot mantido) [até ${MAX_LISTED}]:`)
            divergent.forEach((l) => console.log(`  - ${l}`))
        }
        console.log('')
    }

    if (DRY_RUN) console.log('DRY_RUN: nenhuma alteração foi feita. Rode com DRY_RUN=false para gravar.')
}

run()
    .catch((err) => {
        console.error('Falha no backfill:', err)
        process.exitCode = 1
    })
    .finally(() => mongoose.disconnect())