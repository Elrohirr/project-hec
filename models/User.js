const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Por favor, insira um nome'],
        minlenght: 4,
        maxlenght: 20
    },
    surname: {
        type: String,
        required: [true, 'Por favor, insira um sobrenome'],
        minlenght: 4,
        maxlenght: 20
    },
    email: {
        type: String,
        required: [true, "Por favor, digite um e-mail"],
        match: [/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
            'Por favor, digite um e-mail'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Por favor, insira uma senha'],
        minlenght: 4,
        maxlenght: 15
    },
    wage: {
        type: Number,
        require: [true, "Por favor, insira seu salário hora"]
    },
    isAdmin: {
        type: Boolean,
        default: false
    }
})

UserSchema.pre('save', async function () {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
})

UserSchema.methods.createJWT = function () {
    return jwt.sign({ userId: this._id, name: this.name }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_LIFETIME })
}

UserSchema.methods.comparePassword = async function (candidatePassword) {
    const isMatch = await bcrypt.compare(candidatePassword, this.password)
    return isMatch
}

module.exports = mongoose.model('User', UserSchema)
