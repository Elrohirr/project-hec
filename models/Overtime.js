const mongoose = require('mongoose')

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
    workedHours:{
        type:String,
        required:[true, "Por favor, insira quantas horas extras foram feitas"]
    },
    workedMinutes:{
        type:Number,
        required:true
    },
    distributionMinutes: {
        he50minutes: {type: Number},
        he75minutes: {type: Number},
        he100minutes: {type: Number},
    },
    distributionHours:{
        he50hours: {type: String},
        he75hours: {type: String},
        he100hours: {type: String},
    },
    values:{
        valueHe50: { type: Number, default: 0 },
        valueHe75: { type: Number, default: 0 },
        valueHe100: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
    },
    wageAtCalculation:{
        type:Number,
        required:true
    },
    date: {
        type: Date,
        required: [true, "Por favor, insira uma data"]
    },
    payDate: {
        type: Date,
        required:true
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

OvertimeSchema.index({ createdBy: 1, date: 1 }, { unique: true })

module.exports = mongoose.model('overtime', OvertimeSchema)