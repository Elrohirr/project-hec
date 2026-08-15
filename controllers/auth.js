const User = require('../models/User')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, UnauthenticatedError } = require('../errors')

// ----- funcionalidade cadastrar
const register = async (req, res) => {
    const createFields = {
        name: req.body.name,
        surname: req.body.surname,
        email: req.body.email,
        password: req.body.password,
        wage: req.body.wage,
    }
    const user = await User.create(createFields)
    const token = user.createJWT()
    res.status(StatusCodes.CREATED).json({ user: { name: user.name + " " + user.surname }, token })
}

// ----- funcionalidade login
const login = async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) {
        throw new BadRequestError("Por favor insira um email ou senha")
    }
    const user = await User.findOne({ email })
    if (!user) {
        throw new UnauthenticatedError("Usuário não encontrado")
    }
    const isPasswordCorrect = await user.comparePassword(password)
    if (!isPasswordCorrect) {
        throw new UnauthenticatedError('Senha inválida')
    }
    const token = user.createJWT()
    res.status(StatusCodes.OK).json({ user: { name: user.name + " " + user.surname }, token })
}

module.exports = { register, login }