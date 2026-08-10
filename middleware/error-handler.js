const { StatusCodes } = require('http-status-codes')

const errorHandlerMiddleware = (err, req, res, next) => {
  let customError = {
    // default settings
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    msg: err.message || 'Algo deu errado, tente mais tarde'
  }
  if (err.code === 11000 && err.keyValue.createdBy && err.keyValue.date) {
    customError.statusCode = StatusCodes.BAD_REQUEST
    // o erro E11000 do Mongo traz o nome da coleção no err.message; diferencia a origem do conflito
    if (/mealvouchers/i.test(err.message)) {
      customError.msg = `Não é permitido gerar dois vale-refeição para a mesma data e categoria.`
    } else {
      customError.msg = `Não é permitido criar dois registros de hora extra para a mesma data.`
    }
  }
  // erro de e-mail já cadastrado
  if (err.code === 11000 && err.keyValue.email) {
    customError.statusCode = StatusCodes.BAD_REQUEST
    customError.msg = `O ${Object.keys(err.keyValue)} inserido já está em uso. Tente outro`
  }
  if (err.name === 'ValidationError') {
    customError.statusCode = StatusCodes.BAD_REQUEST
    customError.msg = Object.values(err.errors).map((item) => item.message).join(', ')
  }
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    customError.statusCode = StatusCodes.NOT_FOUND
    customError.msg = `Nenhuma hora extra com o ID: ${err.value}`
  }
  if (err.name === 'CastError' && err.kind === 'date') {
    customError.statusCode = StatusCodes.BAD_REQUEST
    customError.msg = 'Data invalida'
  }
  //return res.status(customError.statusCode).json({ err }) // --- just for testing errors
  return res.status(customError.statusCode).json({ msg: customError.msg })
}

module.exports = errorHandlerMiddleware
