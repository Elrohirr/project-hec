const mongoose = require('mongoose')
const User = require('./User')
const Overtime = require('./Overtime')

const MealVoucherSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: [true, 'Por favor, insira um usuário']
    },
    ref_Id: {
        type: mongoose.Types.ObjectId,
        refPath: 'source'
    },
    source: {
        type: String,
        enum: ['overtime', 'nightShift'],
        required: true
    },
    ruleCode: {
        type: String,
        enum: ['OVERTIME_HALF', 'OVERTIME_FULL', 'OVERTIME_DOUBLE', 'NIGHTSHIFT'],
        required: true
    },
    date: {
        type: Date,
        required: [true, "Por favor, insira uma data"]
    },
    quantity: {
        type: Number,
        required: [true, "Por favor, insira a quantidade de tickets recebidos"],
        min: 0.5
    },
    unitValue: {
        type: Number,
        required: true
    },
    totalValue: {
        type: Number,
        required: [true, "Necessário calcular valor do ticket"]
    }
})

MealVoucherSchema.index({ createdBy: 1, date: 1 }, { unique: true })

module.exports = mongoose.model('MealVoucher', MealVoucherSchema)