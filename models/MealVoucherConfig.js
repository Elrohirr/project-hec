const mongoose = require('mongoose')

const MealVoucherConfigSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
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

module.exports = mongoose.model('MealVoucherConfig', MealVoucherConfigSchema)