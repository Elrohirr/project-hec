const mongoose = require('mongoose')

const BankCompesationSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    totalMinutes: {
        type: Number,
        required: true
    },
    entries: {
        type: [{
            overtimeId: { type: mongoose.Types.ObjectId, ref: 'Overtime', required: true },
            minutesUsed: { type: Number, required: true }
        }],
        required: true
    },
    source: {
        type: String,
        enum: ['manual', 'pdf_import'],
        required: true
    },
}, { timestamps: true })

BankCompesationSchema.index({ createdBy: 1, date: 1 })

module.exports = mongoose.model('BankCompensation', BankCompesationSchema)