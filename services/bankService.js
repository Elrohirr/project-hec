const mongoose = require('mongoose')
const Overtime = require('../models/Overtime')
const BankCompensation = require('../models/BankCompensation')
const DebtBank = require('../models/DebtBank')
const { getClosedMonthCutoff, tierLoop } = require('../utils/rules')
const { timeToMinutes, validateDate, validateFormat } = require('../utils/timeConversion')
const { BadRequestError } = require('../errors')
const { aggregate } = require('../models/Wage')

async function checkForDebts(userId, date, session) {
    const formattedDate = validateDate(date)
    const aggregate = await DebtBank.aggregate([
        {
            $match: {
                createdBy: new mongoose.Types.ObjectId(userId),
                date: { $lte: formattedDate },
                minutesLeft: { $gt: 0 }
            }
        },
        { $group: { _id: null, minutesLeft: { $sum: "$minutesLeft" } } }
    ])
    if (session) aggregate.session(session)
    const result = await aggregate
    return result[0]?.minutesLeft ?? 0
}

// --------------------------- Encontra as horas extras elegíveis para compensar - usado na simulação e confirmação do banco de horas ---------------------------
async function findEligibleOvertimes(userId, hoursNeeded, date, session) {
    // validações
    const formattedDate = validateDate(date)
    validateFormat(hoursNeeded, false)

    const cutOffDate = getClosedMonthCutoff(formattedDate)
    const minutesNeeded = timeToMinutes(hoursNeeded)
    if (!minutesNeeded || minutesNeeded <= 0) throw new BadRequestError('As horas a compensar devem ser maiores que 0')
    const eligibles = await Overtime.find({
        createdBy: userId,
        isHoliday: false,
        date: { $gte: cutOffDate, $lte: formattedDate },
        $expr: { $lt: ['$compensatedMinutes', '$bankedMinutes'] },
    }).sort('date').session(session)

    const { entries, remaining } = tierLoop(minutesNeeded, eligibles)

    // caso não haja hora disponível para criar a compensação, os minutos restantes viram débito
    if (remaining > 0) {
        return {
            msg: `Não há horas suficientes no banco de horas. Caso confirme a compensação, ${remaining} minutos virarão débito.`,
            entries,
            remaining
        }
    }

    return { entries, remaining: 0 }
}

// --------------------------- Cria o arquivo de compensação - usado pelo controller e pelo registro automáatico ---------------------------
async function confirmCompensationService(userId, hoursNeeded, date) {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { entries, remaining } = await findEligibleOvertimes(userId, hoursNeeded, date, session)

            // se o banco estiver zerado, é apenas criado o débito e retornado, sem criação de compensação
            if (entries.length === 0) {
                const [debt] = await DebtBank.create([{
                    createdBy: userId,
                    date: date,
                    debtMinutes: remaining,
                    minutesLeft: remaining
                }], { session })
                return { debt }
            }

            const minutesNeeded = timeToMinutes(hoursNeeded) - (remaining ?? 0)

            for (const overtime of entries) {
                await Overtime.findByIdAndUpdate(
                    overtime.overtimeId,
                    {
                        $inc: {
                            compensatedMinutes: overtime.minutesUsed,
                            "compensatedMinutesByTier.he50minutes": overtime.minutesUsedByTier.he50,
                            "compensatedMinutesByTier.he75minutes": overtime.minutesUsedByTier.he75,
                            "compensatedMinutesByTier.he100minutes": overtime.minutesUsedByTier.he100,
                            compensatedValue: overtime.valueLost
                        }
                    }, { runValidators: true, session })
            }

            const createObject = {
                createdBy: userId,
                date,
                totalMinutes: minutesNeeded,
                entries,
                status: 'active'
            }

            const [bankCompensation] = await BankCompensation.create([createObject], { session })

            // se houver compensação com débito, o sistema registra as compensações e, 
            // se tiver remaining, cria o documento de DebtBank, 
            // anexando o documento de BankCompensation
            if (remaining > 0) {
                const [debt] = await DebtBank.create([{
                    createdBy: userId,
                    date: date,
                    debtMinutes: remaining,
                    minutesLeft: remaining,
                    originCompensation: bankCompensation._id
                }], { session })

                return { bankCompensation, debt }
            }
            return { bankCompensation }
        })
        return result
    } finally {
        await session.endSession()
    }
}

// --------------------------- Abate dívidas ativas (DebtBank) com os minutos de uma HE recém-criada ---------------------------
async function absorvOvertime(userId, overtime, session) {
    // HE que não entra no banco (feriado) não abate dívida
    if (overtime.isHoliday || !(overtime.bankedMinutes > 0)) return []

    const activeDebts = await DebtBank.find({
        createdBy: userId,
        date: { $lte: overtime.date },
        minutesLeft: { $gt: 0 }
    }).sort('date').session(session)

    if (activeDebts.length === 0) return []

    // cópia simples da HE: o tierLoop lê estes campos e o $inc não atualiza o objeto do Mongoose.
    // A cópia é atualizada a cada dívida para a próxima iteração enxergar o que já foi consumido
    const state = {
        _id: overtime._id,
        date: overtime.date,
        bankedMinutes: overtime.bankedMinutes,
        compensatedMinutes: overtime.compensatedMinutes || 0,
        distributionMinutes: overtime.distributionMinutes,
        compensatedMinutesByTier: {
            he50minutes: overtime.compensatedMinutesByTier?.he50minutes || 0,
            he75minutes: overtime.compensatedMinutesByTier?.he75minutes || 0,
            he100minutes: overtime.compensatedMinutesByTier?.he100minutes || 0
        },
        values: overtime.values
    }

    const absorptions = []

    for (const debt of activeDebts) {
        // minutos reais ainda disponíveis na HE (o banco é em dobro, por isso /2)
        const availableWorked = (state.bankedMinutes - state.compensatedMinutes) / 2
        if (availableWorked <= 0) break

        // 1 minuto real paga 1 minuto de dívida (sem conversão)
        const absorbed = Math.min(debt.minutesLeft, availableWorked)

        // reaproveita o helper: abater A minutos reais equivale a consumir 2A do banco
        const { entries } = tierLoop(absorbed * 2, [state])
        const entry = entries[0]

        // HE: registra a absorção como compensação (mesmos campos de uma compensação)
        await Overtime.findByIdAndUpdate(
            overtime._id,
            {
                $inc: {
                    compensatedMinutes: entry.minutesUsed,
                    'compensatedMinutesByTier.he50minutes': entry.minutesUsedByTier.he50,
                    'compensatedMinutesByTier.he75minutes': entry.minutesUsedByTier.he75,
                    'compensatedMinutesByTier.he100minutes': entry.minutesUsedByTier.he100,
                    compensatedValue: entry.valueLost
                }
            },
            { runValidators: true, session }
        )

        // Dívida: abate e guarda o snapshot. O filtro minutesLeft >= absorbed protege contra escrita concorrente
        const updatedDebt = await DebtBank.findOneAndUpdate(
            { _id: debt._id, minutesLeft: { $gte: absorbed } },
            {
                $inc: { minutesLeft: -absorbed },
                $push: {
                    entriesOvertime: {
                        overtimeId: overtime._id,
                        overtimeDate: overtime.date,
                        minutesUsed: absorbed,                       // minutos reais (= minutos de dívida)
                        minutesUsedByTier: entry.minutesUsedByTier,
                        valueLost: entry.valueLost,
                        valueLostByTier: entry.valueLostByTier
                    }
                }
            },
            { returnDocument: 'after', runValidators: true, session }
        )
        if (!updatedDebt) throw new BadRequestError('Conflito ao abater a dívida. Tente novamente.')

        // se o status da dívida for um campo gravado (e não virtual), atualize aqui:
        // if (updatedDebt.minutesLeft === 0) { updatedDebt.status = 'paid off'; await updatedDebt.save({ session }) }

        // atualiza a cópia para a próxima dívida
        state.compensatedMinutes += entry.minutesUsed
        state.compensatedMinutesByTier.he50minutes += entry.minutesUsedByTier.he50
        state.compensatedMinutesByTier.he75minutes += entry.minutesUsedByTier.he75
        state.compensatedMinutesByTier.he100minutes += entry.minutesUsedByTier.he100

        absorptions.push({ debtId: debt._id, debtDate: debt.date, minutesUsed: absorbed, usedByTier: entry.minutesUsedByTier, valueLost: entry.valueLost })
    }

    return absorptions
}

// --------------------------- Desfaz as absorções de uma dívida: devolve os minutos às HE que a abateram ---------------------------
async function revertDebtEntries(debt, session) {
    for (const entry of debt.entriesOvertime) {
        // a dívida guarda minutos REAIS; a HE registrou a absorção em minutos de BANCO (2 x real)
        const bankUnits = entry.minutesUsed * 2

        const restored = await Overtime.findOneAndUpdate(
            // o filtro garante que o contador não fica negativo e que a HE ainda é do usuário
            { _id: entry.overtimeId, createdBy: debt.createdBy, compensatedMinutes: { $gte: bankUnits } },
            {
                $inc: {
                    compensatedMinutes: -bankUnits,
                    'compensatedMinutesByTier.he50minutes': -(entry.minutesUsedByTier?.he50 || 0),
                    'compensatedMinutesByTier.he75minutes': -(entry.minutesUsedByTier?.he75 || 0),
                    'compensatedMinutesByTier.he100minutes': -(entry.minutesUsedByTier?.he100 || 0),
                    compensatedValue: -(entry.valueLost || 0)
                }
            },
            { returnDocument: 'after', runValidators: true, session }
        )

        if (!restored) throw new BadRequestError(`Não foi possível restaurar a HE ${entry.overtimeId}: ela não existe ou foi alterada depois da absorção.`)
    }
}

// --------------------------- Desfaz todas as absorções que uma HE fez, devolvendo os minutos às dívidas -----------------------------------------------------
async function undoOvertimeAbsorptions(userId, overtimeId, session) {
    const debts = await DebtBank.find({ createdBy: userId, 'entriesOvertime.overtimeId': overtimeId }).session(session)

    for (const debt of debts) {
        const entries = debt.entriesOvertime.filter((entry) => entry.overtimeId.equals(overtimeId))
        const minutesBack = entries.reduce((sum, entry) => sum + entry.minutesUsed, 0)

        // restaura a HE
        await revertDebtEntries({ createdBy: debt.createdBy, entriesOvertime: entries }, session)

        // devolve os minutos à dívida e remove as entradas dessa HE
        await DebtBank.updateOne(
            { _id: debt._id },
            { $inc: { minutesLeft: minutesBack }, $pull: { entriesOvertime: { overtimeId } } },
            { session }
        )
        // se o status da dívida for um campo gravado, volte para 'active' aqui
    }
}

module.exports = {
    findEligibleOvertimes, confirmCompensationService, absorvOvertime,
    revertDebtEntries, undoOvertimeAbsorptions, checkForDebts
}