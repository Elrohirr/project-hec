require('dotenv').config()
const express = require('express')
const app = express()

// connect DB
const connectDB = require('./db/connectDB')
const authenticateUser = require('./middleware/authentication')

// routers
const authRouter = require('./routes/auth')
const overtimeRouter = require('./routes/overtime')
const mealVoucherRouter = require('./routes/mealVouchers')

// error handler
const notFoundMiddleware = require('./middleware/not-found')
const errorHandlerMiddleware = require('./middleware/error-handler')

app.use(express.json())

// routes
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/overtime', authenticateUser, overtimeRouter)
app.use('/api/v1/mealvoucher', authenticateUser, mealVoucherRouter)

app.use(notFoundMiddleware)
app.use(errorHandlerMiddleware)

const port = process.env.PORT || 5000

const start = async () => {
    try {
        await connectDB(process.env.MONGO_URL)
        app.listen(port, console.log(`Server is listening on port ${port}`))
    } catch (error) {
        console.log(error)
    }
}

start()