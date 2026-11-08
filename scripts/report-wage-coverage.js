/**
 * Relatório SOMENTE LEITURA: ajuda a escolher o effectiveFrom do registro inicial
 * da collection Wage e mostra a cobertura atual do wageId nos registros.
 *
 * Uso:
 *   node scripts/report-wage-coverage.js
 *
 * Opcional:
 *   CANDIDATE_EFFECTIVE_FROM=2026-01-01   data candidata (padrão: 2026-01-01)
 *
 * Nada é gravado. Ajuste os requires, o nome da variável de conexão e
 * os nomes dos campos de data (DATE_FIELD) conforme o seu projeto.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose')
const User = require('../models/User')
const Wage = require('../models/Wage')
const Overtime = require('../models/Overtime')
const NightShift = require('../models/NightShift')

// Campo de data de TRABALHO em cada model (a mesma data usada pelo getWageAt)
const DATE_FIELD = { overtime: 'date', nightShift: 'date' }

const CANDIDATE = new Date(process.env.CANDIDATE_EFFECTIVE_FROM || '2026-01-01T00:00:00.000Z')
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '-')
const isValidWage = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0

const statsByUser = async (Model, dateField) => {
    const rows = await Model.aggregate([
        {
            $group: {
                _id: '$createdBy',
                total: { $sum: 1 },
                minDate: { $min: `$${dateField}` },
                maxDate: { $max: `$${dateField}` },
                withWageId: {
                    $sum: { $cond: [{ $eq: [{ $ifNull: ['$wageId', null] }, null] }, 0, 1] }
                },
                beforeCandidate: {
                    $sum: { $cond: [{ $lt: [`$${dateField}`, CANDIDATE] }, 1, 0] }
                }
            }
        }
    ])
    return new Map(rows.map((r) => [r._id.toString(), r]))
}

const run = async () => {
    if (Number.isNaN(CANDIDATE.getTime())) throw new Error('CANDIDATE_EFFECTIVE_FROM inválida')

    await mongoose.connect(process.env.MONGO_URL)
    console.log('\n=== Relatório de cobertura de salário (SOMENTE LEITURA) ===')
    console.log(`Data candidata para o effectiveFrom inicial: ${iso(CANDIDATE)}\n`)

    // Só o necessário; nunca traz o hash da senha
    const users = await User.find({}).select('_id name wage').lean()
    const wageCounts = await Wage.aggregate([{ $group: { _id: '$createdBy', n: { $sum: 1 } } }])
    const wageCountMap = new Map(wageCounts.map((w) => [w._id.toString(), w.n]))

    const ot = await statsByUser(Overtime, DATE_FIELD.overtime)
    const ns = await statsByUser(NightShift, DATE_FIELD.nightShift)

    const table = []
    const problems = []
    let globalMin = null

    for (const u of users) {
        const id = u._id.toString()
        const o = ot.get(id)
        const n = ns.get(id)
        const mins = [o?.minDate, n?.minDate].filter(Boolean)
        const earliest = mins.length ? new Date(Math.min(...mins.map((d) => d.getTime()))) : null
        if (earliest && (!globalMin || earliest < globalMin)) globalMin = earliest

        const before = (o?.beforeCandidate || 0) + (n?.beforeCandidate || 0)
        const hasRecords = (o?.total || 0) + (n?.total || 0) > 0
        const wageOk = isValidWage(u.wage)

        if (!wageOk && hasRecords) problems.push(`${u.name} [${id}]: tem registros mas User.wage é inválido (${u.wage})`)
        if (before > 0) problems.push(`${u.name} [${id}]: ${before} registro(s) anteriores a ${iso(CANDIDATE)} (ficariam sem salário)`)

        table.push({
            usuario: u.name,
            'User.wage': u.wage ?? '-',
            wageValido: wageOk ? 'sim' : 'NÃO',
            docsWage: wageCountMap.get(id) || 0,
            HEs: o?.total || 0,
            HE_maisAntiga: iso(o?.minDate),
            HE_comWageId: o?.withWageId || 0,
            turnos: n?.total || 0,
            turno_maisAntigo: iso(n?.minDate),
            turno_comWageId: n?.withWageId || 0,
            antesDaCandidata: before
        })
    }

    console.table(table)

    console.log(`Registro de trabalho mais antigo de todos os usuários: ${iso(globalMin)}`)
    if (globalMin && globalMin < CANDIDATE) {
        console.log(`ATENÇÃO: a data candidata (${iso(CANDIDATE)}) é POSTERIOR ao registro mais antigo.`)
        console.log('Use um effectiveFrom igual ou anterior a essa data, senão esses registros ficam sem salário.')
    } else {
        console.log(`A data candidata (${iso(CANDIDATE)}) cobre todos os registros existentes.`)
    }

    if (problems.length) {
        console.log('\nPontos de atenção:')
        problems.forEach((p) => console.log(` - ${p}`))
    }
    console.log('\nNenhuma alteração foi feita no banco.')
}

run()
    .catch((err) => {
        console.error('Falha no relatório:', err)
        process.exitCode = 1
    })
    .finally(() => mongoose.disconnect())