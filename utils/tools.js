function capitalize(string) {
    if (!string) return ''
    return string.charAt(0).toUpperCase() + string.slice(1)
}

function roundCurrency(value, decimals = 2) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
}

module.exports = { capitalize, roundCurrency }