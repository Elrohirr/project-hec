const User = require('../models/User')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, NotFoundError } = require('../errors')

const updateProfile = async (req,res) => {
    const {body:{name, surname, wage, email},user:{userId}} = req

    // update parcial
    const updateFields = {}
    if (name !== undefined) {
        const trimmedName = name.trim()
        if (trimmedName === "") throw new BadRequestError("Nome não pode ser vazio")
        updateFields.name = trimmedName
    }
    if (surname !== undefined) {
        const trimmedSurname = surname.trim()
        if (trimmedSurname === "") throw new BadRequestError("Sobrenome não pode ser vazio")
        updateFields.surname = trimmedSurname
    }
    if (email !== undefined) {
        const trimmedEmail = email.trim()
        if (trimmedEmail === "") throw new BadRequestError("E-mail não pode ser vazio")
        updateFields.email = trimmedEmail
    }
    if (wage) {
        if (typeof wage !== "number" || wage <= 0) throw new BadRequestError('Salário-hora precisa ser um número positivo')
        updateFields.wage = wage
    }

    if (Object.keys(updateFields).length === 0) throw new BadRequestError('Nenhum campo enviado para atualização')
    
    const user = await User.findByIdAndUpdate(
        userId,
        updateFields,
        {returnDocument: 'after', runValidators: true}).select('-password')
    res.status(StatusCodes.OK).json(user)
}

const updatePassword = async (req,res) => {
    res.send('update password')
}

const deleteAccount = async (req,res) =>{ 
    res.send('delete user')
}

module.exports = {updateProfile, updatePassword, deleteAccount}