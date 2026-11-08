const { test } = require('node:test')
const assert = require('node:assert')
const { timeToMinutes, minutesToTime, convertToReducedNightMinutes } = require('../utils/timeConversion')

test('timeToMinutes converte "07:00" para 420', () => {
    assert.strictEqual(timeToMinutes('07:00'), 420)
})

test('timeToMinutes converte "08:05" para 485', () => {
    assert.strictEqual(timeToMinutes('08:05'), 485)
})

test('timeToMinutes aceita "7:00" sem zero à esquerda', () => {
    assert.strictEqual(timeToMinutes('7:00'), 420)
})

test('minutesToTime converte 480 para "08:00"', () => {
    assert.strictEqual(minutesToTime(480), '08:00')
})

test('minutesToTime converte 485 para "08:05"', () => {
    assert.strictEqual(minutesToTime(485), '08:05')
})

test('convertToReducedNightMinutes: 7h de relógio (420min) vira 8h reduzida (480min) — âncora CLT', () => {
    assert.strictEqual(convertToReducedNightMinutes('07:00'), 480)
})

test('convertToReducedNightMinutes arredonda 4:35 (275min) para 314min', () => {
    assert.strictEqual(convertToReducedNightMinutes('4:35'), 314)
})

test('fluxo completo: "07:00" relógio → "08:00" reduzido', () => {
    const clockMinutes = timeToMinutes('07:00')
    const reducedMinutes = convertToReducedNightMinutes('07:00')
    assert.strictEqual(minutesToTime(clockMinutes), '07:00')
    assert.strictEqual(minutesToTime(reducedMinutes), '08:00')
})