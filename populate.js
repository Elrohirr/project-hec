require('dotenv').config()

const mongoose = require('mongoose')
const seedMealVoucherConfig = require('./seeds/mealVoucherConfig')

const start = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL)

        await seedMealVoucherConfig()

        await mongoose.disconnect()
    } catch (error) {
        console.error(error)
    }
}

start()