/**
 * Verificação SOMENTE LEITURA das invariantes de compensação do banco de horas.
 *
 * Para cada hora extra, compara o que ela acumulou (compensatedMinutes,
 * compensatedMinutesByTier, compensatedValue) com a soma das entries das
 * compensações ATIVAS que apontam para ela.
 *
 *   I1  Overtime.compensatedMinutes          == Σ entries.minutesUsed
 *   I2  Overtime.compensatedMinutesByTier.*  == Σ entries.minutesUsedByTier.*
 *   I3  Overtime.compensatedValue            == Σ entries.valueLost   (tolerância de centavos)
 *   I4  toda entry aponta para uma Overtime existente do MESMO usuário
 *   I5  entry.valueLostByTier[tier] == minutesUsedByTier[tier] x (values[tier] / distributionMinutes[tier])
 *       (mesma conta do findEligibleOvertimes, com os values ATUAIS da HE)
 *   I6  entry.valueLost == Σ entry.valueLostByTier
 *
 * Uso:
 *   node scripts/check-compensation-invariants.js
 *
 * Rode ANTES e DEPOIS de qualquer recálculo de salário. Nada é gravado.
 *
 * Suposições (ajuste no topo se os nomes forem outros): models em ../models,
 * BankCompensation com status 'active' e entries[] com os campos
 * overtimeId, minutesUsed, minutesUsedByTier{he50,he75,he100}, valueLost.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')
const BankCompensation = require('../models/BankCompensation')

const ACTIVE_STATUS = 'active'
const MAX_LISTED = 100
const CENT = 0.01

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

const run = async () => {
    await mongoose.connect(process.env.MONGO_URL)
    console.log('\n=== Invariantes de compensação (SOMENTE LEITURA) ===\n')

    const compensations = await BankCompensation.find({ status: ACTIVE_STATUS }).lean()

    // overtimeId -> soma do que as compensações ativas retiraram dela
    const expected = new Map()
    const issues = []
    const bySource = {}

    for (const comp of compensations) {
        bySource[comp.source ?? '(sem source)'] = (bySource[comp.source ?? '(sem source)'] || 0) + 1
        for (const e of comp.entries || []) {
            if (!e.overtimeId) {
                issues.push(`compensação ${comp._id}: entry sem overtimeId`)
                continue
            }
            const key = e.overtimeId.toString()
            if (!expected.has(key)) {
                expected.set(key, { minutes: 0, he50: 0, he75: 0, he100: 0, value: 0, entries: 0, owner: comp.createdBy.toString() })
            }
            const acc = expected.get(key)
            acc.minutes += n(e.minutesUsed)
            acc.he50 += n(e.minutesUsedByTier?.he50)
            acc.he75 += n(e.minutesUsedByTier?.he75)
            acc.he100 += n(e.minutesUsedByTier?.he100)
            acc.value += n(e.valueLost)
            acc.entries += 1
        }
    }

    // HEs que têm entries ativas OU que acusam algo compensado
    const ids = [...expected.keys()].map((id) => new mongoose.Types.ObjectId(id))
    const overtimes = await Overtime.find({
        $or: [
            { _id: { $in: ids } },
            { compensatedMinutes: { $gt: 0 } },
            { compensatedValue: { $gt: 0 } }
        ]
    })
        .select('_id createdBy date compensatedMinutes compensatedMinutesByTier compensatedValue values distributionMinutes')
        .lean()

    const seen = new Set()
    let checked = 0
    for (const o of overtimes) {
        const key = o._id.toString()
        seen.add(key)
        checked++
        const exp = expected.get(key) || { minutes: 0, he50: 0, he75: 0, he100: 0, value: 0, entries: 0, owner: o.createdBy.toString() }
        const date = o.date ? new Date(o.date).toISOString().slice(0, 10) : '-'
        const tag = `HE ${key} (${date})`

        if (n(o.compensatedMinutes) !== exp.minutes) {
            issues.push(`${tag}: I1 minutos acumulados ${n(o.compensatedMinutes)} x entries ${exp.minutes}`)
        }
        const t = o.compensatedMinutesByTier || {}
        if (n(t.he50minutes) !== exp.he50 || n(t.he75minutes) !== exp.he75 || n(t.he100minutes) !== exp.he100) {
            issues.push(`${tag}: I2 minutos por faixa (${n(t.he50minutes)}/${n(t.he75minutes)}/${n(t.he100minutes)}) x entries (${exp.he50}/${exp.he75}/${exp.he100})`)
        }
        const tol = CENT * Math.max(1, exp.entries)
        if (Math.abs(n(o.compensatedValue) - exp.value) > tol) {
            issues.push(`${tag}: I3 valor acumulado ${n(o.compensatedValue).toFixed(2)} x entries ${exp.value.toFixed(2)}`)
        }
        if (o.createdBy.toString() !== exp.owner) {
            issues.push(`${tag}: I4 dono da HE difere do dono da compensação`)
        }
    }

    for (const key of expected.keys()) {
        if (!seen.has(key)) issues.push(`HE ${key}: I4 entry aponta para HE inexistente`)
    }

    // I5/I6: o valueLost gravado em cada entry é reproduzível a partir dos minutos usados
    // e dos values/distribuição ATUAIS da HE (mesma conta do findEligibleOvertimes)
    const byId = new Map(overtimes.map((o) => [o._id.toString(), o]))
    const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100
    for (const comp of compensations) {
        for (const e of comp.entries || []) {
            const o = byId.get(e.overtimeId?.toString())
            if (!o) continue
            const tag = `compensação ${comp._id} / HE ${o._id}`
            let tierSum = 0
            for (const tier of ['he50', 'he75', 'he100']) {
                const mins = n(e.minutesUsedByTier?.[tier])
                const dist = n(o.distributionMinutes?.[tier + 'minutes'])
                const gross = n(o.values?.['value' + tier[0].toUpperCase() + tier.slice(1)])
                const expectedTier = mins > 0 && dist > 0 ? r2(mins * (gross / dist)) : 0
                const stored = n(e.valueLostByTier?.[tier])
                tierSum += stored
                if (Math.abs(stored - expectedTier) > CENT + 1e-9) {
                    issues.push(`${tag}: I5 ${tier} gravado ${stored.toFixed(2)} x recalculado ${expectedTier.toFixed(2)}`)
                }
            }
            if (Math.abs(n(e.valueLost) - tierSum) > CENT + 1e-9) {
                issues.push(`${tag}: I6 valueLost ${n(e.valueLost).toFixed(2)} x soma das faixas ${tierSum.toFixed(2)}`)
            }
        }
    }

    console.table({
        compensacoesAtivas: compensations.length,
        hesVerificadas: checked,
        hesComEntries: expected.size,
        violacoes: issues.length
    })
    console.log('Compensações ativas por source:', bySource)

    if (issues.length) {
        console.log(`\nViolações [até ${MAX_LISTED}]:`)
        issues.slice(0, MAX_LISTED).forEach((i) => console.log(` - ${i}`))
    } else {
        console.log('\nTodas as invariantes estão satisfeitas.')
    }
    console.log('\nNenhuma alteração foi feita no banco.')
}

run()
    .catch((err) => {
        console.error('Falha na verificação:', err)
        process.exitCode = 1
    })
    .finally(() => mongoose.disconnect())