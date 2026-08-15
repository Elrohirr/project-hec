const mongoose = require('mongoose')

const MealVoucherConfigSchema = new mongoose.Schema({
    code: {
        type: String,
        enum: ['OVERTIME_HALF', 'OVERTIME_FULL', 'OVERTIME_DOUBLE', 'NIGHTSHIFT'],
        required: true,
    },

    label: {
        type: String,
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        min: 0.5
    },

    unitValue: {
        type: Number,
        required: true,
        min: 0
    },

    effectiveDate: {
        type: Date,
        default: Date.now
    },

    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true })

MealVoucherConfigSchema.index(
    { code: 1 },
    { unique: true, partialFilterExpression: { active: true } }
)

module.exports = mongoose.model('MealVoucherConfig', MealVoucherConfigSchema)