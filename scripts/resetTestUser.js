require('dotenv').config()
const mongoose = require('mongoose')
const readline = require('readline')
const User = require('../models/User')
const Overtime = require('../models/Overtime')
const NightShift = require('../models/NightShift')
const MealVoucher = require('../models/MealVoucher')
const BankCompensation = require('../models/BankCompensation')

const DRY_RUN = process.env.DRY_RUN !== 'false'
const TEST_USER_ID = process.env.TEST_USER_ID

function confirm(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close()
            resolve(answer.trim().toLowerCase() === 'sim')
        })
    })
}

async function run() {
    if (!TEST_USER_ID) {
        console.error('TEST_USER_ID não definido no .env. Abortando.')
        process.exit(1)
    }

    await mongoose.connect(process.env.MONGO_URL)
    console.log(`Modo: ${DRY_RUN ? 'DRY_RUN' : 'EXECUÇÃO REAL'}`)

    const user = await User.findById(TEST_USER_ID)
    if (!user) {
        console.error(`Usuário ${TEST_USER_ID} não encontrado. Abortando.`)
        await mongoose.disconnect()
        process.exit(1)
    }

    console.log(`\nUsuário alvo: ${user.name || ''} <${user.email}> (_id: ${user._id})`)

    const bankCompCount = await BankCompensation.countDocuments({ createdBy: TEST_USER_ID })
    const mealVoucherCount = await MealVoucher.countDocuments({ createdBy: TEST_USER_ID })
    const overtimeCount = await Overtime.countDocuments({ createdBy: TEST_USER_ID })
    const nightShiftCount = await NightShift.countDocuments({ createdBy: TEST_USER_ID })

    console.log(`\nBankCompensation a deletar: ${bankCompCount}`)
    console.log(`MealVoucher a deletar: ${mealVoucherCount}`)
    console.log(`Overtime a deletar: ${overtimeCount}`)
    console.log(`NightShift a deletar: ${nightShiftCount}`)

    if (DRY_RUN) {
        console.log('\nDRY_RUN ativo — nada foi deletado. Rode com DRY_RUN=false para executar.')
        await mongoose.disconnect()
        return
    }

    // trava de segurança: exige confirmação explícita digitada, não só Enter
    const ok = await confirm(
        `\nISSO VAI DELETAR PERMANENTEMENTE os dados acima de ${user.email}. Digite "sim" para confirmar: `
    )

    if (!ok) {
        console.log('Cancelado pelo usuário.')
        await mongoose.disconnect()
        return
    }

    // ordem: primeiro quem referencia outros documentos por id (BankCompensation -> Overtime,
    // MealVoucher -> Overtime/NightShift), só depois os documentos "base"
    const bankCompResult = await BankCompensation.deleteMany({ createdBy: TEST_USER_ID })
    const mealVoucherResult = await MealVoucher.deleteMany({ createdBy: TEST_USER_ID })
    const overtimeResult = await Overtime.deleteMany({ createdBy: TEST_USER_ID })
    const nightShiftResult = await NightShift.deleteMany({ createdBy: TEST_USER_ID })

    console.log(`\nBankCompensation deletados: ${bankCompResult.deletedCount}`)
    console.log(`MealVoucher deletados: ${mealVoucherResult.deletedCount}`)
    console.log(`Overtime deletados: ${overtimeResult.deletedCount}`)
    console.log(`NightShift deletados: ${nightShiftResult.deletedCount}`)
    console.log('\nReset concluído. Usuário mantido intacto.')

    await mongoose.disconnect()
}

run().catch(err => {
    console.error('Erro no reset:', err)
    process.exit(1)
})