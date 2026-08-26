const User = require('../models/User')
const Overtime = require('../models/Overtime')
const NightShift = require('../models/NightShift')
const MealVoucher = require('../models/MealVoucher')
const MealVoucherConfig = require('../models/MealVoucherConfig')
const mongoose = require('mongoose')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, NotFoundError } = require('../errors')
const { getLabel } = require('../utils/rules')

// ----------------- pega todas as configuração de tickets ------------------------------------
const getAllMealVoucherConfig = async (req, res) => {
    const config = await MealVoucherConfig.find({}).sort('-active')
    res.status(StatusCodes.OK).json(config)
}

// ----------------- cria uma nova configuração de ticket vigente ------------------------------------
const createMealVoucherConfig = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { body: { code, unitValue }, user: { userId } } = req
            if (typeof unitValue !== 'number' || unitValue <= 0) throw new BadRequestError('Valor do ticket precisa ser um número positivo')

            const label = getLabel(code)
            const currentConfigId = await MealVoucherConfig.findOne({ code: code, active: true }).session(session)
            if (currentConfigId) {
                await MealVoucherConfig.findByIdAndUpdate(
                    currentConfigId._id,
                    { active: false },
                    { returnDocument: 'after', runValidators: true, session })
            }

            const createFields = {
                code,
                label: label.label,
                quantity: label.quantity,
                unitValue,
                active: true,
                effectiveDate: Date.now()
            }

            const [config] = await MealVoucherConfig.create([createFields], { session })
            return config
        })
        res.status(StatusCodes.CREATED).json(result)
    } finally {
        await session.endSession()
    }
}

// ----------------- ativa uma configuração de ticket ------------------------------------
const activeMealVoucherConfig = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { params: { id: configId } } = req

            const mealVoucherConfig = await MealVoucherConfig.findById(configId).session(session)
            if (!mealVoucherConfig) throw new BadRequestError('Configuração não encontrada')

            await MealVoucherConfig.findOneAndUpdate(
                { code: mealVoucherConfig.code, active: true },
                { active: false },
                { returnDocument: 'after', runValidators: true, session })

            const newConfig = await MealVoucherConfig.findByIdAndUpdate(configId,
                { active: true, effectiveDate: Date.now() },
                { returnDocument: 'after', runValidators: true, session })

            return newConfig
        })
        res.status(StatusCodes.OK).json(result)
    } finally {
        await session.endSession()
    }
}

// ----------------- pega todos os usuários cadastrados ------------------------------------
const getAllUsers = async (req, res) => {
    const users = await User.find({}).select(['-wage', '-password'])
    res.status(StatusCodes.OK).json(users)
}

// ----------------- deleta usuários e seus registros do sistema -------------------------------------------
const deleteUser = async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {
            const { body: { password }, user: { userId }, params: { id: deleteUserId } } = req
            const userPassword = await User.findById(userId).select('password').session(session)

            const userToBeDeleted = await User.findById(deleteUserId).session(session)
            if (!userToBeDeleted) throw new NotFoundError("Usuário não encontrado")

            if (userId === deleteUserId) {
                throw new BadRequestError('Não é possivel apagar a própria conta, pare de tentar se matar :(')
            }

            const isPasswordCorret = await userPassword.comparePassword(password)
            if (!isPasswordCorret) throw new BadRequestError("Senha inválida.")

            await Overtime.deleteMany({ createdBy: deleteUserId }, { session })
            await NightShift.deleteMany({ createdBy: deleteUserId }, { session })
            await MealVoucher.deleteMany({ createdBy: deleteUserId }, { session })
            await User.findByIdAndDelete(deleteUserId, { session })
        })
        res.status(StatusCodes.OK).json({ msg: "Usuário e seus registros deletados com sucesso" })
    }
    finally {
        await session.endSession()
    }
}

module.exports = { createMealVoucherConfig, activeMealVoucherConfig, getAllMealVoucherConfig, getAllUsers, deleteUser }