const mongoose = require('mongoose')
const User = require("../models/User")
const Overtime = require('../models/Overtime')
const NightShift = require('../models/NightShift')
const MealVoucher = require('../models/MealVoucher');
const BankCompensation = require('../models/BankCompensation')
const Wage = require('../models/Wage')
const { createWageService } = require('../services/userService')
const { validateDate } = require('../utils/timeConversion');
const { defineValue, defineNightValue } = require('../utils/rules');
const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");

// -------------------------------------------- atualização do perfil de um usuário ------------------------------------------
const updateProfile = async (req, res) => {
    const { body: { name, surname, email }, user: { userId } } = req;

    // update parcial
    const updateFields = {};
    if (name !== undefined) {
        const trimmedName = name.trim();
        if (trimmedName === "")
            throw new BadRequestError("Nome não pode ser vazio");
        updateFields.name = trimmedName;
    }
    if (surname !== undefined) {
        const trimmedSurname = surname.trim();
        if (trimmedSurname === "")
            throw new BadRequestError("Sobrenome não pode ser vazio");
        updateFields.surname = trimmedSurname;
    }
    if (email !== undefined) {
        const trimmedEmail = email.trim();
        if (trimmedEmail === "")
            throw new BadRequestError("E-mail não pode ser vazio");
        updateFields.email = trimmedEmail;
    }

    if (Object.keys(updateFields).length === 0)
        throw new BadRequestError("Nenhum campo enviado para atualização");

    const user = await User.findByIdAndUpdate(userId, updateFields, {
        returnDocument: "after",
        runValidators: true,
    }).select("-password");
    res.status(StatusCodes.OK).json(user);
};

// -------------------------------------------- atualização da senha de um usuário ------------------------------------------
const updatePassword = async (req, res) => {
    const { body: { currentPassword, newPassword }, user: { userId } } = req;
    if (newPassword === "") throw new BadRequestError("Digite uma senha de no mínimo 4 caracteres.")
    const userPassword = await User.findById(userId).select('password')

    const isPasswordCorrect = await userPassword.comparePassword(currentPassword)
    if (!isPasswordCorrect) throw new BadRequestError("Senha atual e senha digitada não conferem.")

    userPassword.password = newPassword; await userPassword.save()
    res.status(StatusCodes.OK).json({ msg: "Senha alterada com sucesso" });
};

// -------------------------------------------- deleta a conta de um usuário ------------------------------------------
const deleteAccount = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { body: { password }, user: { userId } } = req
            const userPassword = await User.findById(userId).select('password').session(session)

            const isPasswordCorret = await userPassword.comparePassword(password)
            if (!isPasswordCorret) throw new BadRequestError("Senha inválida.")

            await Overtime.deleteMany({ createdBy: userId }, { session })
            await NightShift.deleteMany({ createdBy: userId }, { session })
            await MealVoucher.deleteMany({ createdBy: userId }, { session })
            await BankCompensation.deleteMany({ createdBy: userId }, { session })
            await Wage.deleteMany({ createdBy: userId }, { session })
            await User.findByIdAndDelete(userId, { session })
        })
        res.status(StatusCodes.OK).json({ msg: "Conta deletada com sucesso. Redirecionando para tela de login." })
    }
    finally {
        await session.endSession()
    }
};

// -------------------------------------------- pega todos os valores de salários horas de um usuário ------------------------------------------
const getAllHourlyWages = async (req, res) => {
    const userId = req.user.userId
    const wage = await Wage.find({ createdBy: userId })
    res.status(StatusCodes.OK).json(wage)
}

// -------------------------------------------- cria um valor de salário-hora de um usuário ------------------------------------------
const createHourlyWage = async (req, res) => {
    const { body: { wage, date }, user: { userId } } = req

    // busca os vizinhos, caso exista, fará comparações com os valores e datas vigências
    const prevWage = await Wage.findOne({ createdBy: userId, effectiveFrom: { $lt: date } }).sort({ effectiveFrom: -1 })
    const nextWage = await Wage.findOne({ createdBy: userId, effectiveFrom: { $gt: date } }).sort({ effectiveFrom: 1 })
    if (prevWage && prevWage.wage > wage) throw new BadRequestError('O novo salário-hora não pode ser menor que o último valor vigente pela data inserida.')
    if (nextWage && nextWage.wage < wage) throw new BadRequestError('O novo salário-hora não pode ser maior do que o próximo valor vigente pela data inserida.')

    // definição do novo salário e criação di registro
    const createFields = createWageService(userId, wage, date)
    const newWage = await Wage.create(createFields)
    res.status(StatusCodes.CREATED).json({ msg: 'Novo valor de saláio hora criado. Lembre-se que os registros de hora estra e turno noturno não são editados com essa mudança.', newWage })
}


// -------------------------------------------- atualiza um valor de salário-hora de um usuário (apenas data de vigência) ------------------------------------------
const updateHourlyWage = async (req, res) => {
    const { body: { effectiveFrom }, params: { id: wageId }, user: { userId } } = req
    const formattedDate = validateDate(effectiveFrom)
    if (formattedDate.getTime() > new Date().getTime()) throw new BadRequestError('Não é permitido atualizar valores para uma data futura.')

    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const wage = await Wage.findOne({ createdBy: userId, _id: wageId }).session(session)
            if (!wage) throw new NotFoundError('Valor de salário-hora não encontrado.')
            if (formattedDate.getTime() === wage.effectiveFrom.getTime()) throw new BadRequestError('Mesma data do salário-hora, nada a alterar.')

            // resgate dos registros vizinhos e bloqueadores de limite de data
            const prevWage = await Wage.findOne({ createdBy: userId, effectiveFrom: { $lt: wage.effectiveFrom } }).sort({ effectiveFrom: -1 }).limit(1).session(session)
            const nextWage = await Wage.findOne({ createdBy: userId, effectiveFrom: { $gt: wage.effectiveFrom } }).sort({ effectiveFrom: 1 }).limit(1).session(session)
            if (prevWage && formattedDate.getTime() <= prevWage.effectiveFrom.getTime()) throw new BadRequestError('Nova data não pode ser antes ou igual a data vigente do salário-hora anterior.')
            if (nextWage && formattedDate.getTime() >= nextWage.effectiveFrom.getTime()) throw new BadRequestError('Nova data não pode ser depois ou igual a data vigente do próximo salário-hora.')

            let flowDirection = {}
            let wageObject = {}
            if (wage.effectiveFrom.getTime() < formattedDate.getTime()) {
                // ramo "para frente"
                if (
                    !prevWage &&
                    (await Overtime.exists({ createdBy: userId, date: { $gte: wage.effectiveFrom, $lt: formattedDate } }).session(session) ||
                        await NightShift.exists({ createdBy: userId, date: { $gte: wage.effectiveFrom, $lt: formattedDate } }).session(session))) {
                    throw new BadRequestError('Não é possível mover o salário para frente pois há registros hora extra ou turno noturno que ficariam sem salário.')
                }
                flowDirection.$gte = wage.effectiveFrom
                flowDirection.$lt = formattedDate
                wageObject.wage = prevWage?.wage ?? null
                wageObject.wageId = prevWage?._id ?? null
            } else {
                // ramo "para trás"
                flowDirection.$gte = formattedDate
                flowDirection.$lt = wage.effectiveFrom
                wageObject.wage = wage.wage
                wageObject.wageId = wage._id
            }

            // pega os registros que precisam ser recalculados
            const overtimeRegisters = await Overtime.find({ createdBy: userId, date: { $gte: flowDirection.$gte, $lt: flowDirection.$lt } })
                .select(['_id', 'wageId', 'wageAtCalculation', 'distributionMinutes', 'compensatedMinutes'])
                .session(session).lean()
            const nightShiftRegisters = await NightShift.find({ createdBy: userId, date: { $gte: flowDirection.$gte, $lt: flowDirection.$lt } })
                .select(['_id', 'wageId', 'wageAtCalculation', 'nightMinutesReduced', 'nightShiftValue'])
                .session(session).lean()

            // atualiza a data do salário-hora
            const newWage = await Wage.findOneAndUpdate({ createdBy: userId, _id: wageId },
                { effectiveFrom: formattedDate }, {
                returnDocument: 'after',
                runValidators: true,
                session
            })

            // recálculo das overtimes
            for (const overtime of overtimeRegisters) {
                if (overtime.compensatedMinutes > 0) throw new BadRequestError('Não é possível editar horas extras que foram compensadas parcialmente ou totalmente. Primeiro, verifique a qual compensação ela está atrelada e cancele a mesma.')
                const updateFields = {
                    wageId: wageObject.wageId,
                    wageAtCalculation: wageObject.wage,
                    values: defineValue(overtime.distributionMinutes, wageObject.wage)
                }

                await Overtime.findOneAndUpdate({ createdBy: userId, _id: overtime._id },
                    updateFields, {
                    returnDocument: 'after',
                    runValidators: true,
                    session
                })
            }

            // recálculo dos turnos noturnos
            for (const nightShift of nightShiftRegisters) {
                const updateFields = {
                    wageId: wageObject.wageId,
                    wageAtCalculation: wageObject.wage,
                    nightShiftValue: defineNightValue(nightShift.nightMinutesReduced, wageObject.wage)
                }

                await NightShift.findOneAndUpdate({ createdBy: userId, _id: nightShift._id },
                    updateFields, {
                    returnDocument: 'after',
                    runValidators: true,
                    session
                })
            }

            return {
                msg: `Salário-hora atualizado. ${overtimeRegisters.length} horas extras e ${nightShiftRegisters.length} turnos noturnos atualizados.`,
                newWage
            }
        })
        res.status(StatusCodes.OK).json(result)
    } finally {
        await session.endSession()
    }
}


// -------------------------------------------- deleta um valor de salário-hora de um usuário ------------------------------------------
const deleteHourlyWage = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { user: { userId }, params: { id: wageId } } = req

            const wage = await Wage.findOne({ createdBy: userId, _id: wageId }).session(session)
            if (!wage) throw new NotFoundError('Registro de salário-hora não encontrado')

            // bloqueios
            const totalWages = await Wage.countDocuments({ createdBy: userId }).session(session)
            if (totalWages <= 1) throw new BadRequestError('Não é possível ficar sem valor de salário-hora. Caso queira apagar este salário, crie um novo e apague este depois.')
            if (await Overtime.exists({ createdBy: userId, wageId: wageId }).session(session)) throw new BadRequestError('Há registros de hora extra que estão utilizando este salário. Favor deletar os registros antes de apagar o valor de salário-hora.')
            if (await NightShift.exists({ createdBy: userId, wageId: wageId }).session(session)) throw new BadRequestError('Há registros de turno noturno que estão utilizando este salário. Favor deletar os registros antes de apagar o valor de salário-hora.')

            // exclusão
            const deletedWage = await Wage.findOneAndDelete({ createdBy: userId, _id: wageId }, { session: session })
            return deletedWage
        })
        res.status(StatusCodes.OK).json({ msg: 'Salário-hora deletado com sucesso!', result })
    } finally {
        await session.endSession()
    }
}

module.exports = {
    updateProfile, updatePassword, deleteAccount,
    createHourlyWage, getAllHourlyWages, updateHourlyWage,
    deleteHourlyWage
};
