const mongoose = require('mongoose')
const { BadRequestError } = require('../errors')

const OvertimeSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: [true, 'Por favor, insira um usuário']
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    quantity: {
        type: Number,
        required: [true, "Por favor, insira quantas horas extras foram feitas"],
        min: 1,
        max: 12
    },
    distribution: {
        he50: {
            type: Number
        },
        he75: {
            type: Number
        },
        he100: {
            type: Number,
        }
    },
    date: {
        type: Date,
        required: [true, "Por favor, insira uma data"]
    },
    payDate: {
        type: Date
    },
    isDayOff: {
        type: Boolean,
        default: false
    },
    isHoliday: {
        type: Boolean,
        default: false
    },

})

//OvertimeSchema.index({ createdBy: 1, date: 1 }, { unique: true })

module.exports = mongoose.model('overtime', OvertimeSchema)