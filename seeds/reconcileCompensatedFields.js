// scripts/reconcileCompensatedFields.js
require('dotenv').config()
const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')
const BankCompensation = require('../models/BankCompensation')

const DRY_RUN = process.env.DRY_RUN !== 'false'

async function run() {
    await mongoose.connect(process.env.MONGO_URL)
    console.log(`Modo: ${DRY_RUN ? 'DRY_RUN' : 'EXECUÇÃO REAL'}`)

    // 1. calcula o valor "correto" de cada overtime, somando só compensações ATIVAS
    const activeEntries = await BankCompensation.aggregate([
        { $match: { status: 'active' } },
        { $unwind: '$entries' },
        {
            $group: {
                _id: '$entries.overtimeId',
                compensatedMinutes: { $sum: '$entries.minutesUsed' },
                compensatedValue: { $sum: '$entries.valueLost' },
                he50: { $sum: '$entries.minutesUsedByTier.he50' },
                he75: { $sum: '$entries.minutesUsedByTier.he75' },
                he100: { $sum: '$entries.minutesUsedByTier.he100' }
            }
        }
    ])

    const correctByOvertimeId = new Map(
        activeEntries.map(e => [e._id.toString(), e])
    )

    // 2. percorre todos os overtimes com algum valor de compensação gravado
    const overtimes = await Overtime.find({
        $or: [
            { compensatedMinutes: { $ne: 0 } },
            { compensatedValue: { $ne: 0 } }
        ]
    })

    let drifted = 0

    for (const ot of overtimes) {
        const correct = correctByOvertimeId.get(ot._id.toString()) || {
            compensatedMinutes: 0, compensatedValue: 0, he50: 0, he75: 0, he100: 0
        }

        const isDrifted =
            ot.compensatedMinutes !== correct.compensatedMinutes ||
            Math.abs(ot.compensatedValue - correct.compensatedValue) > 0.01

        if (!isDrifted) continue

        drifted++
        console.log(
            `[DRIFT] [${ot._id}] date=${ot.date?.toISOString().slice(0, 10)} ` +
            `atual: compensatedMinutes=${ot.compensatedMinutes}, compensatedValue=${ot.compensatedValue} ` +
            `-> correto: compensatedMinutes=${correct.compensatedMinutes}, compensatedValue=${correct.compensatedValue}`
        )

        if (!DRY_RUN) {
            await Overtime.findByIdAndUpdate(ot._id, {
                $set: {
                    compensatedMinutes: correct.compensatedMinutes,
                    compensatedValue: correct.compensatedValue,
                    compensatedMinutesByTier: {
                        he50minutes: correct.he50 || 0,
                        he75minutes: correct.he75 || 0,
                        he100minutes: correct.he100 || 0
                    }
                }
            })
        }
    }

    console.log(`\nTotal com drift: ${drifted}`)
    if (DRY_RUN) console.log('DRY_RUN ativo — nada foi gravado. Rode com DRY_RUN=false para aplicar.')

    await mongoose.disconnect()
}

run().catch(err => { console.error(err); process.exit(1) })