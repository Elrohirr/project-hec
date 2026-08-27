require('dotenv').config()
const mongoose = require('mongoose')
const MealVoucher = require('../models/MealVoucher') // ajuste o path conforme seu projeto

const DRY_RUN = process.env.DRY_RUN === 'false' // true por padrão; rode com DRY_RUN=false para executar de verdade

async function migrate() {
    await mongoose.connect(process.env.MONGO_URL)
    console.log(`Conectado ao MongoDB. Modo: ${DRY_RUN ? 'DRY RUN (sem gravação)' : 'EXECUÇÃO REAL'}`)

    // Agrupa por createdBy + date, pegando os tickets que existem por source nesse dia
    const groups = await MealVoucher.aggregate([
        {
            $group: {
                _id: { createdBy: '$createdBy', date: '$date' },
                docs: { $push: { _id: '$_id', source: '$source', ruleCode: '$ruleCode', totalValue: '$totalValue' } },
                sources: { $addToSet: '$source' }
            }
        },
        {
            $match: {
                sources: { $all: ['overtime', 'nightShift'] } // só os dias com os dois tipos coexistindo
            }
        }
    ])

    console.log(`${groups.length} dias com conflito (overtime + nightShift no mesmo dia) encontrados.`)

    let removed = 0
    let skipped = 0
    const errors = []
    const report = []

    for (const group of groups) {
        const { createdBy, date } = group._id
        const nightShiftDoc = group.docs.find(d => d.source === 'nightShift')
        const overtimeDoc = group.docs.find(d => d.source === 'overtime')

        if (!nightShiftDoc || !overtimeDoc) {
            errors.push({ createdBy, date, docs: group.docs })
            continue
        }

        report.push({
            createdBy: String(createdBy),
            date,
            removendo: { _id: nightShiftDoc._id, ruleCode: nightShiftDoc.ruleCode, totalValue: nightShiftDoc.totalValue },
            mantendo: { _id: overtimeDoc._id, ruleCode: overtimeDoc.ruleCode, totalValue: overtimeDoc.totalValue }
        })

        if (DRY_RUN) {
            console.log(`[DRY RUN] user ${createdBy} | ${new Date(date).toISOString().slice(0, 10)}: removeria nightShift ${nightShiftDoc._id} (ficaria overtime ${overtimeDoc._id})`)
            removed++
            continue
        }

        try {
            await MealVoucher.deleteOne({ _id: nightShiftDoc._id })
            removed++
        } catch (err) {
            errors.push({ createdBy, date, error: err.message })
            skipped++
        }
    }

    console.log('--- Resumo ---')
    console.log(`Dias com conflito: ${groups.length}`)
    console.log(`Removidos (ou que seriam removidos): ${removed}`)
    console.log(`Ignorados por erro: ${skipped}`)
    console.log(`Erros de dados (grupo incompleto/inesperado): ${errors.length}`)
    if (errors.length > 0) {
        console.log('Detalhes dos erros:', JSON.stringify(errors, null, 2))
    }

    if (DRY_RUN) {
        console.log('\nNenhuma gravação foi feita. Revise o relatório acima e rode novamente com DRY_RUN=false para aplicar de verdade.')
    }

    await mongoose.disconnect()
}

migrate().catch(err => {
    console.error('Erro na migration:', err)
    process.exit(1)
})