const mongoose = require('mongoose')

const WageSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: [true, 'Por favor, insira um usuário']
    },
    wage: {
        type: Number,
        required: [true, 'Por favor, insira um valor de salário-hora'],
        min: [0.01, 'O salário-hora deve ser maior que zero']
    },
    effectiveFrom: {
        type: Date,
        required: [true, 'Por favor, insira a data de vigência do salário-hora']
    }

}, { timestamps: true })

WageSchema.index({ createdBy: 1, effectiveFrom: -1 }, { unique: true })

module.exports = mongoose.model('wage', WageSchema)