const mongoose = require('mongoose')
const MealVoucherConfig = require('../models/MealVoucherConfig')

const seedMealVoucherConfig = async () => {
    try {
        await MealVoucherConfig.deleteMany({})
        await MealVoucherConfig.insertMany([
            {
                code: 'OVERTIME_HALF',
                label: 'Meio VL Hora Extra',
                quantity: 0.5,
                unitValue: 59.13
            },
            {
                code: 'OVERTIME_FULL',
                label: 'VL Completo Hora Extra',
                quantity: 1,
                unitValue: 59.13
            },
            {
                code: 'OVERTIME_DOUBLE',
                label: '2 VL Hora Extra',
                quantity: 2,
                unitValue: 59.13
            },
            {
                code: 'NIGHT_SHIFT',
                label: 'VL Turno Noturno',
                quantity: 1,
                unitValue: 19.81
            }
        ])

        console.log('MealVoucherConfig populado com sucesso')
        process.exit(0)
    } catch (error) {
        console.error(error)
        process.exit(1)
    }
}

module.exports = seedMealVoucherConfig