const mongoose = require('mongoose')

const DebtBankSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: [true, 'Por favor, insira um usuário']
    },
    date: {
        type: Date,
        required: [true, 'Por favor, insira uma data']
    },
    debtMinutes: {
        type: Number,
        required: [true, 'Por favor, insira os minutos de débito'],
        min: 1
    },
    minutesLeft: {
        type: Number,
        required: true,
        min: 0,
    },
    entriesOvertime: {
        type: [{
            overtimeId: { type: mongoose.Types.ObjectId, ref: 'Overtime', required: true },
            overtimeDate: { type: Date, required: true },
            minutesUsed: { type: Number, required: true, min: 1 },
            minutesUsedByTier: {
                he50: { type: Number, default: 0 },
                he75: { type: Number, default: 0 },
                he100: { type: Number, default: 0 }
            },
            valueLost: { type: Number, default: 0 },
            valueLostByTier: {
                he50: { type: Number, default: 0 },
                he75: { type: Number, default: 0 },
                he100: { type: Number, default: 0 }
            }
        }]
    },
    originCompensation: {
        type: mongoose.Types.ObjectId,
        ref: 'BankCompensation',
        default: null
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

DebtBankSchema.virtual('status').get(function () {
    const { minutesLeft = 0 } = this

    if (minutesLeft === 0) return 'paid off'
    return 'active'
})

DebtBankSchema.index({ createdBy: 1, minutesLeft: 1 })
DebtBankSchema.index({ createdBy: 1, date: 1 }, { unique: true })

module.exports = mongoose.model('DebtBank', DebtBankSchema)