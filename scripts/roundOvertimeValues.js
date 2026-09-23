/**
 * Migração: arredonda os campos de `values` (valueHe50, valueHe75, valueHe100, total)
 * de registros antigos de Overtime para 2 casas decimais, deixando-os consistentes
 * com `compensatedValue`, que já é persistido arredondado.
 *
 * Uso:
 *   DRY_RUN=true node round-overtime-values.js    # apenas loga o que mudaria
 *   DRY_RUN=false node round-overtime-values.js   # aplica de fato
 *
 * Ajuste MONGODB_URI e o path do model conforme o seu projeto.
 */

require('dotenv').config()
const mongoose = require('mongoose')
const Overtime = require('../models/Overtime') // ajuste o path real do model

const DRY_RUN = process.env.DRY_RUN !== 'false' // default: true (seguro)

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

async function run() {
    await mongoose.connect(process.env.MONGO_URL)
    console.log(`Conectado ao Mongo. DRY_RUN=${DRY_RUN}`)

    const records = await Overtime.find({}).lean()
    console.log(`${records.length} registros encontrados.`)

    const bulkOps = []
    let changedCount = 0

    for (const record of records) {
        const { valueHe50, valueHe75, valueHe100, total } = record.values || {}

        const rounded = {
            valueHe50: round2(valueHe50 ?? 0),
            valueHe75: round2(valueHe75 ?? 0),
            valueHe100: round2(valueHe100 ?? 0),
            total: round2(total ?? 0),
        }

        const isDifferent =
            rounded.valueHe50 !== valueHe50 ||
            rounded.valueHe75 !== valueHe75 ||
            rounded.valueHe100 !== valueHe100 ||
            rounded.total !== total

        if (!isDifferent) continue

        changedCount++

        console.log(`[${record._id}] values.total: ${total} -> ${rounded.total}`)

        if (!DRY_RUN) {
            bulkOps.push({
                updateOne: {
                    filter: { _id: record._id },
                    update: {
                        $set: {
                            'values.valueHe50': rounded.valueHe50,
                            'values.valueHe75': rounded.valueHe75,
                            'values.valueHe100': rounded.valueHe100,
                            'values.total': rounded.total,
                        },
                    },
                },
            })
        }
    }

    console.log(`Registros que precisam de ajuste: ${changedCount}`)

    if (DRY_RUN) {
        console.log('DRY_RUN ativo — nenhuma escrita foi feita. Rode com DRY_RUN=false para aplicar.')
    } else if (bulkOps.length > 0) {
        const result = await Overtime.bulkWrite(bulkOps)
        console.log(`Atualizados: ${result.modifiedCount} registros.`)
    }

    await mongoose.disconnect()
}

run().catch((err) => {
    console.error('Erro na migração:', err)
    process.exit(1)
})