
/**
 * Migração: cria 1 registro inicial na collection Wage por usuário,
 * a partir do campo User.wage.
 *
 * Uso:
 *   DRY_RUN=true  node scripts/migrate-user-wage-to-wage-collection.js   (padrão: só simula)
 *   DRY_RUN=false node scripts/migrate-user-wage-to-wage-collection.js   (grava de verdade)
 *
 * Opcional:
 *   WAGE_EFFECTIVE_FROM=2000-01-01   data de vigência do registro inicial
 *
 * Ajuste os caminhos dos requires e o nome da variável de conexão
 * conforme o padrão dos seus outros scripts.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose')
const User = require('../models/User')
const Wage = require('../models/Wage')

const DRY_RUN = process.env.DRY_RUN === 'false'
const EFFECTIVE_FROM = new Date(
    process.env.WAGE_EFFECTIVE_FROM || '2026-01-01T00:00:00.000Z'
)

const isValidWage = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0

const run = async () => {
    if (Number.isNaN(EFFECTIVE_FROM.getTime())) {
        throw new Error('WAGE_EFFECTIVE_FROM inválida')
    }

    await mongoose.connect(process.env.MONGO_URL)
    console.log(`\n=== Migração User.wage -> Wage ===`)
    console.log(`Modo: ${DRY_RUN ? 'DRY_RUN (nada será gravado)' : 'GRAVAÇÃO REAL'}`)
    console.log(`effectiveFrom do registro inicial: ${EFFECTIVE_FROM.toISOString()}\n`)

    // Só o necessário: nunca traz o hash da senha para o script
    const users = await User.find({}).select('_id name wage').lean()

    // Usuários que já têm algum salário cadastrado (idempotência)
    const existingIds = new Set(
        (await Wage.distinct('createdBy')).map((id) => id.toString())
    )

    const summary = {
        total: users.length,
        toCreate: 0,
        created: 0,
        skippedExisting: 0,
        skippedInvalid: 0,
        errors: 0
    }

    for (const user of users) {
        const id = user._id.toString()
        const label = `${user.name ?? '(sem nome)'} [${id}]`

        if (existingIds.has(id)) {
            summary.skippedExisting++
            console.log(`SKIP (já possui Wage)      ${label}`)
            continue
        }

        if (!isValidWage(user.wage)) {
            summary.skippedInvalid++
            console.log(`SKIP (wage inválido: ${user.wage})  ${label}`)
            continue
        }

        try {
            // Passa pelos setters/validators do schema, tanto no dry-run quanto na gravação
            const doc = new Wage({
                createdBy: user._id,
                wage: user.wage,
                effectiveFrom: EFFECTIVE_FROM
            })
            await doc.validate()
            summary.toCreate++

            if (DRY_RUN) {
                console.log(
                    `CRIARIA                    ${label} -> ${doc.wage}/h desde ${doc.effectiveFrom.toISOString()}`
                )
            } else {
                await doc.save()
                summary.created++
                console.log(
                    `CRIADO                     ${label} -> ${doc.wage}/h desde ${doc.effectiveFrom.toISOString()}`
                )
            }
        } catch (err) {
            summary.errors++
            console.error(`ERRO                       ${label}: ${err.message}`)
        }
    }

    console.log('\n=== Resumo ===')
    console.table(summary)
    if (DRY_RUN) {
        console.log('DRY_RUN: nenhuma alteração foi feita. Rode com DRY_RUN=false para gravar.')
    }
}

run()
    .catch((err) => {
        console.error('Falha na migração:', err)
        process.exitCode = 1
    })
    .finally(() => mongoose.disconnect())