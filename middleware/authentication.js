const User = require('../models/User')
const jwt = require('jsonwebtoken')
const { UnauthenticatedError } = require('../errors')

const auth = async (req, res, next) => {
    // check header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthenticatedError('Token not provided')
    }
    const token = authHeader.split(' ')[1]

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        // attach the user to the tracker routes
        req.user = { userId: payload.userId, name: payload.name, wage: payload.wage }
        next()
    } catch (error) {
        throw new UnauthenticatedError('Token not provided')
    }
}

module.exports = auth