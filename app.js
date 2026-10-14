require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const path = require('path')
const app = express()

app.set('trust proxy', 1)
app.use(helmet())

// Definição de limites de requisições
// Limite geral
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { msg: 'Muitas requisições. Tente novamente em alguns minutos.' },
});
app.use('/api', generalLimiter)

// Limite para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { msg: 'Muitas requisições de login. Tente novamente em 15 minutos.' },
});
app.use('/api/v1/auth/login', loginLimiter)

// Limite para import PDF (rota pesada)
const importLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { msg: 'Muitas requisições de importação de pdf. Tente novamente em uma hora.' },
});
app.use('/api/v1/preview', importLimiter)


// connect DB
const connectDB = require('./db/connectDB')

// routers
const authRouter = require('./routes/auth')
const overtimeRouter = require('./routes/overtime')
const nightShiftRouter = require('./routes/nightShift')
const mealVoucherRouter = require('./routes/mealVoucher')
const userRouter = require('./routes/user')
const adminRouter = require('./routes/admin')
const importRouter = require('./routes/import')
const bankRouter = require('./routes/bank')
const receivablesRouter = require('./routes/receivables')
const graphicRouter = require('./routes/graphic')

// middlewares
const authenticateUser = require('./middleware/authentication')
const authorizeUser = require('./middleware/authorizeUser')

// error handler
const notFoundMiddleware = require('./middleware/not-found')
const errorHandlerMiddleware = require('./middleware/error-handler')

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// routes
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/overtime', authenticateUser, overtimeRouter)
app.use('/api/v1/nightShift', authenticateUser, nightShiftRouter)
app.use('/api/v1/mealvoucher', authenticateUser, mealVoucherRouter)
app.use('/api/v1/user', authenticateUser, userRouter)
app.use('/api/v1/admin', authenticateUser, authorizeUser, adminRouter)
app.use('/api/v1/preview', authenticateUser, importRouter)
app.use('/api/v1/bank', authenticateUser, bankRouter)
app.use('/api/v1/receivables', authenticateUser, receivablesRouter)
app.use('/api/v1/graphic', authenticateUser, graphicRouter)

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