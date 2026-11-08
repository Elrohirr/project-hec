function capitalize(string) {
    if (!string) return ''
    return string.charAt(0).toUpperCase() + string.slice(1)
}

function roundCurrency(value, decimals = 2) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
}

function findColumn(itemX, map) {

    var minor = Math.abs(itemX - map[0].x)
    var column = map[0].column

    for (let i = 1; i <= map.length - 1; i++) {
        const distance = Math.abs(itemX - map[i].x)
        if (distance <= minor) {
            minor = distance
            column = map[i].column
        }
    }
    return column
}

module.exports = { capitalize, roundCurrency, findColumn }