const mongoose = require('mongoose')
const User = require("../models/User")
const Overtime = require('../models/Overtime')
const NightShift = require('../models/NightShift')
const MealVoucher = require('../models/MealVoucher');
const BankCompensation = require('../models/BankCompensation')
const Wage = require('../models/Wage')
const { createWageService } = require('../services/userService')
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
    const createFields = createWageService(userId, wage, date)
    const newWage = await Wage.create(createFields)
    res.status(StatusCodes.CREATED).json({ msg: 'Novo valor de saláio hora criado. Lembre-se que os registros de hora estra e turno noturno não são editados com essa mudança.', newWage })
}

const updateHourlyWage = async (req, res) => {
    res.json('update')
}

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
