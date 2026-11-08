/**
 * Limpeza: remove o campo legado `wage` dos documentos da collection users.
 *
 * Regras de segurança:
 *  - só remove de usuários que JÁ têm ao menos um documento na collection Wage
 *    (senão o valor antigo seria a única cópia do salário);
 *  - usuários sem Wage são apenas listados e NÃO são alterados;
 *  - não toca em nenhum outro campo nem no updatedAt;
 *  - idempotente: depois de rodar, uma nova execução encontra 0 documentos.
 *
 * Usa o driver nativo (User.collection) de propósito: o campo já não existe
 * no schema, e o Mongoose em modo strict poderia descartar o $unset.
 *
 * Uso:
 *   DRY_RUN=true  node scripts/unset-user-wage.js   (padrão: só simula e relata)
 *   DRY_RUN=false node scripts/unset-user-wage.js   (grava de verdade)
 *
 * FAÇA UM DUMP ANTES de rodar com DRY_RUN=false.
 * Ajuste os requires e a variável de conexão conforme o projeto.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose')
const User = require('../models/User')
const Wage = require('../models/Wage')

const DRY_RUN = process.env.DRY_RUN !== 'false'

const run = async () => {
    await mongoose.connect(process.env.MONGO_URL)
    console.log('\n=== Remoção do campo legado users.wage ===')
    console.log(`Modo: ${DRY_RUN ? 'DRY_RUN (nada será gravado)' : 'GRAVAÇÃO REAL'}\n`)

    // Só _id e name: nunca traz o hash da senha para o script
    const withField = await User.collection
        .find({ wage: { $exists: true } }, { projection: { _id: 1, name: 1 } })
        .toArray()

    const usersWithWageDoc = new Set((await Wage.distinct('createdBy')).map((id) => id.toString()))

    const safe = []
    const skipped = []
    for (const u of withField) {
        if (usersWithWageDoc.has(u._id.toString())) safe.push(u)
        else skipped.push(u)
    }

    const summary = {
        totalUsers: await User.collection.countDocuments({}),
        comCampoWage: withField.length,
        removeriaDe: safe.length,
        ignoradosSemWageDoc: skipped.length,
        modificados: 0
    }

    if (skipped.length) {
        console.log('Usuários SEM documento Wage (campo mantido, nada será alterado):')
        skipped.forEach((u) => console.log(`  - ${u.name ?? '(sem nome)'} [${u._id}]`))
        console.log('')
    }

    if (!DRY_RUN && safe.length) {
        const res = await User.collection.updateMany(
            { _id: { $in: safe.map((u) => u._id) }, wage: { $exists: true } },
            { $unset: { wage: '' } }
        )
        summary.modificados = res.modifiedCount
    }

    console.table(summary)
    if (DRY_RUN) {
        console.log('DRY_RUN: nenhuma alteração foi feita. Rode com DRY_RUN=false para gravar.')
    } else {
        console.log('Confira: rode de novo em DRY_RUN; deve mostrar comCampoWage = 0.')
    }
}

run()
    .catch((err) => {
        console.error('Falha na limpeza:', err)
        process.exitCode = 1
    })
    .finally(() => mongoose.disconnect())