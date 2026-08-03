const mongoose = require('mongoose')

const NightShiftSchema = new mongoose.Schema({
    createdBy:{
        type:mongoose.Types.ObjectId,
        ref:'User',
        required:[true, 'Por favor, insira um usuário']
    },
    createdAt:{
        type:Date,
        default:Date.now
    },
    date:{
        type:Date,
        required:[true,'Por favor insira uma data']
    },
    totalNightHours:{
        type:Number,
        default:7,
        min:1,
        max:7
    },
    nightShiftValue:{
        type:Number,
    },
    wageAtCalculation:{
        type:Number,
    },
    payDate:{
        type:Date
    }
})

module.exports = mongoose.model('nightShift',NightShiftSchema)