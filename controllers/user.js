const mongoose = require('mongoose')
const User = require("../models/User")
const Overtime = require('../models/Overtime')
const NightShift = require('../models/NightShift')
const MealVoucher = require('../models/MealVoucher');
const bcrypt = require('bcryptjs')
const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");

const updateProfile = async (req, res) => {
    const { body: { name, surname, wage, email }, user: { userId } } = req;

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
    if (wage) {
        if (typeof wage !== "number" || wage <= 0)
            throw new BadRequestError("Salário-hora precisa ser um número positivo");
        updateFields.wage = wage;
    }

    if (Object.keys(updateFields).length === 0)
        throw new BadRequestError("Nenhum campo enviado para atualização");

    const user = await User.findByIdAndUpdate(userId, updateFields, {
        returnDocument: "after",
        runValidators: true,
    }).select("-password");
    res.status(StatusCodes.OK).json(user);
};

const updatePassword = async (req, res) => {
    const { body: { currentPassword, newPassword }, user: { userId } } = req;
    if (newPassword === "") throw new BadRequestError("Digite uma senha de no mínimo 4 caracteres.")
    const userPassword = await User.findById(userId).select('password')

    const isPasswordCorrect = await userPassword.comparePassword(currentPassword)
    if (!isPasswordCorrect) throw new BadRequestError("Senha atual e senha digitada não conferem.")

    userPassword.password = newPassword; await userPassword.save()
    res.status(StatusCodes.OK).json({ msg: "Senha alterada com sucesso" });
};

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
            await User.findByIdAndDelete(userId, { session })
        })
        res.status(StatusCodes.OK).json({ msg: "Conta deletada com sucesso. Redirecionando para tela de login." })
    }
    finally {
        await session.endSession()
    }
};

module.exports = { updateProfile, updatePassword, deleteAccount };
