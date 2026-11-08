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
        default: 480
    },
    entries: {
        type: [{
            overtimeId: { type: mongoose.Types.ObjectId, ref: 'Overtime', required: true },
            overtimeDate: { type: Date, required: true },
            minutesUsed: { type: Number, required: true },
            minutesUsedByTier: {
                he50: { type: Number, default: 0 },
                he75: { type: Number, default: 0 },
                he100: { type: Number, default: 0 },
            },
            valueLost: { type: Number, required: true },
            valueLostByTier: {
                he50: { type: Number, default: 0 },
                he75: { type: Number, default: 0 },
                he100: { type: Number, default: 0 },
            }
        }],
        required: true
    },
    source: {
        type: String,
        enum: ['manual', 'pdf_import'],
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'cancelled'],
        default: 'active'
    }
}, { timestamps: true })

BankCompesationSchema.index(
    { createdBy: 1, date: 1 },
    { unique: true, partialFilterExpression: { status: 'active' } })

module.exports = mongoose.model('BankCompensation', BankCompesationSchema)