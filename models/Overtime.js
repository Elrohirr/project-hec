const mongoose = require('mongoose')
const { getClosedMonthCutoff } = require('../utils/rules')

const OvertimeSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: [true, 'Por favor, insira um usuário']
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    workedHours: {
        type: String,
        required: [true, "Por favor, insira quantas horas extras foram feitas"]
    },
    workedMinutes: {
        type: Number,
        required: true
    },
    distributionMinutes: {
        he50minutes: { type: Number },
        he75minutes: { type: Number },
        he100minutes: { type: Number },
    },
    distributionHours: {
        he50hours: { type: String },
        he75hours: { type: String },
        he100hours: { type: String },
    },
    values: {
        valueHe50: { type: Number, default: 0 },
        valueHe75: { type: Number, default: 0 },
        valueHe100: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
    },
    wageAtCalculation: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: [true, "Por favor, insira uma data"]
    },
    payDate: {
        type: Date,
        required: true
    },
    isDayOff: {
        type: Boolean,
        default: false
    },
    isHoliday: {
        type: Boolean,
        default: false
    },
    bankedMinutes: {
        type: Number,
        default: 0
    },
    compensatedMinutes: {
        type: Number,
        default: 0
    },
    compensatedMinutesByTier: {
        he50minutes: { type: Number, default: 0 },
        he75minutes: { type: Number, default: 0 },
        he100minutes: { type: Number, default: 0 }
    },
    compensatedValue: {
        type: Number,
        default: 0
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

OvertimeSchema.virtual('status').get(function () {
    const { bankedMinutes = 0, compensatedMinutes = 0, isHoliday = false, date } = this

    if (compensatedMinutes > 0 && compensatedMinutes >= bankedMinutes) return 'compensated'
    if (compensatedMinutes > 0) return 'partially_compensated'
    if (isHoliday) return 'non-banked'

    const paidCutoff = getClosedMonthCutoff(new Date())
    return date < paidCutoff ? 'paid' : 'banked'
})

OvertimeSchema.virtual('netValue').get(function () {
    const totalValue = this.values.total
    const compensatedValue = this.compensatedValue

    return totalValue - compensatedValue
})

OvertimeSchema.index({ createdBy: 1, date: 1 }, { unique: true })
OvertimeSchema.index({ createdBy: 1, isHoliday: 1, date: 1 })

module.exports = mongoose.model('overtime', OvertimeSchema)