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
    nightHoursClock:{
        type:String,
        default:'07:00'
    },
    nightHoursReduced:{
        type:String,
        default:'08:00'
    },
    nightShiftValue:{
        type:Number,
        required:true
    },
    wageAtCalculation:{
        type:Number,
        required:true
    },
    payDate:{
        type:Date,
        required:true
    }
})

module.exports = mongoose.model('nightShift',NightShiftSchema)