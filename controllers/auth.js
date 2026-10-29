const mongoose = require('mongoose')
const User = require('../models/User')
const Wage = require('../models/Wage')
const { createWageService } = require('../services/userService')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, UnauthenticatedError } = require('../errors')

// ----- funcionalidade cadastrar
const register = async (req, res) => {
    const { body: { name, surname, email, password, wage, wageDate } } = req

    const session = await mongoose.startSession()
    try {
        const result = await session.withTransaction(async () => {

            const createFields = {
                name,
                surname,
                email,
                password,
            }

            // primeiro cria o usuário, depois cria o valor do salário-hora, pois o usuário precisa existir antes
            const user = await User.create([createFields], { session: session })
            const wageObject = createWageService(user[0]._id, wage, wageDate)
            await Wage.create([wageObject], { session: session })
            return { user }
        })
        const token = result.user[0].createJWT()
        res.status(StatusCodes.CREATED).json({ user: { name: result.user[0].name + " " + result.user[0].surname }, token })
    } finally {
        await session.endSession()
    }
}

// ----- funcionalidade login
const login = async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) throw new BadRequestError("Por favor insira um email ou senha")

    const user = await User.findOne({ email })
    if (!user) throw new UnauthenticatedError("Usuário não encontrado")

    const isPasswordCorrect = await user.comparePassword(password)
    if (!isPasswordCorrect) throw new UnauthenticatedError('Senha inválida')

    try {
        await User.findByIdAndUpdate(user._id, { lastLogin: new Date() })
    } catch (error) {
        console.error('Falha ao atualizar lastLogin:', err.message)
    }
    const token = user.createJWT()
    res.status(StatusCodes.OK).json({ user: { name: user.name + " " + user.surname }, token })
}

module.exports = { register, login }