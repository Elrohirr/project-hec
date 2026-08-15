const UnauthenticatedError = require('./unauthenticated')
const NotFoundError = require('./not-found')
const BadRequestError = require('./bad-request')
const ForbiddenError = require('./authorizeAdmin')

module.exports = {
  UnauthenticatedError,
  NotFoundError,
  BadRequestError,
  ForbiddenError
}
