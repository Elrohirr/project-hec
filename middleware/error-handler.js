const { StatusCodes } = require('http-status-codes')

const errorHandlerMiddleware = (err, req, res, next) => {
  let customError = {
    // default settings
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    msg: err.message || 'Algo deu errado, tente mais tarde'
  }
  if (err.code && err.code === 11000) {
    customError.statusCode = StatusCodes.BAD_REQUEST
    customError.msg = `O e-mail ${Object.keys(err.keyValue)} já está em uso. Tente outro`
  }
  if (err.name === 'ValidationError') {
    customError.statusCode = StatusCodes.BAD_REQUEST
    customError.msg = Object.values(err.errors).map((item) => item.message).join(', ')
  }
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    customError.statusCode = StatusCodes.NOT_FOUND
    customError.msg = `Nenhuma HE com o ID: ${err.value}`
  }
  if (err.name === 'CastError' && err.kind === 'date') {
    customError.statusCode = StatusCodes.BAD_REQUEST
    customError.msg = 'Data invalida'
  }
  // return res.status(customError.statusCode).json({ err }) // --- just for testing errors
  return res.status(customError.statusCode).json({ msg: customError.msg })
}

module.exports = errorHandlerMiddleware
