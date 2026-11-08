const { ForbiddenError } = require('../errors')

const forbidden = (req, res, next) => {
    const isAdmin = req.user.isAdmin
    if (!isAdmin) throw new ForbiddenError('Usuário não autorizado')
    next()
}

module.exports = forbidden