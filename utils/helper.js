const { BadRequestError } = require('../errors')

// ---------------------------------- validação de arrays - usado nos controllers de multi delete --------------------------------------
function validadeIdArray(ids, entityLabel) {
    if (!Array.isArray(ids)) throw new BadRequestError('Dado inválido.')
    const uniqueIds = [... new Set(ids)] // checa por duplicadatas
    if (ids.length <= 0) throw new BadRequestError(`Por favor, selecione as horas ${entityLabel} para exclusão.`)
    if (ids.length >= 50) throw new BadRequestError(`Por favor, selecione as horas extras para exclusão.`)
    return uniqueIds
}

module.exports = { validadeIdArray }