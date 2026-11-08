const { test } = require('node:test')
const assert = require('node:assert')
const Selection = require('../public/js/selection.js')

// Stub mínimo de checkbox (<input type="checkbox">)
function fakeCheckbox() {
    return {
        checked: false,
        disabled: false,
        title: '',
        indeterminate: false,
        listeners: {},
        addEventListener(type, handler) {
            this.listeners[type] = handler
        },
        change(value) {
            this.checked = value
            this.listeners.change()
        }
    }
}

// Stub mínimo de <table> (apenas classList)
function fakeTable() {
    const classes = new Set()
    return {
        classes,
        classList: {
            toggle(name, force) {
                if (force) classes.add(name)
                else classes.delete(name)
            },
            contains(name) {
                return classes.has(name)
            }
        }
    }
}

test('MAX_TOTAL respeita o limite do backend (50 ids rejeitados)', () => {
    assert.strictEqual(Selection.MAX_TOTAL, 49)
})

test('registerRow adiciona o id ao marcar o checkbox', () => {
    const state = Selection.createState()
    const cb = fakeCheckbox()
    Selection.registerRow(state, 'abc', cb)

    cb.change(true)

    assert.deepStrictEqual(Selection.getSelectedIds(state), ['abc'])
    assert.strictEqual(Selection.getSelectedCount(state), 1)
})

test('registerRow remove o id ao desmarcar o checkbox', () => {
    const state = Selection.createState()
    const cb = fakeCheckbox()
    Selection.registerRow(state, 'abc', cb)

    cb.change(true)
    cb.change(false)

    assert.deepStrictEqual(Selection.getSelectedIds(state), [])
})

test('a seleção para no limite máximo e avisa via onLimitReached', () => {
    const state = Selection.createState()
    let limitWarned = false
    state.onLimitReached = () => { limitWarned = true }

    for (let i = 0; i < Selection.MAX_TOTAL; i++) {
        const cb = fakeCheckbox()
        Selection.registerRow(state, `id-${i}`, cb)
        cb.change(true)
    }

    const extra = fakeCheckbox()
    Selection.registerRow(state, 'id-extra', extra)
    extra.change(true)

    assert.strictEqual(Selection.getSelectedCount(state), Selection.MAX_TOTAL)
    assert.strictEqual(limitWarned, true)
    assert.strictEqual(extra.checked, false, 'checkbox excedente deve ser desmarcado')
})

test('resetRows limpa a seleção e os registros de checkbox', () => {
    const state = Selection.createState()
    const cb = fakeCheckbox()
    Selection.registerRow(state, 'abc', cb)
    cb.change(true)

    Selection.resetRows(state)

    assert.deepStrictEqual(Selection.getSelectedIds(state), [])
    assert.deepStrictEqual(state.rowCheckboxesList, [])
    assert.deepStrictEqual(state.rowCheckboxes, {})
})

test('clearSelection desmarca os checkboxes registrados', () => {
    const state = Selection.createState()
    const cb = fakeCheckbox()
    Selection.registerRow(state, 'abc', cb)
    cb.change(true)

    Selection.clearSelection(state)

    assert.strictEqual(cb.checked, false)
    assert.strictEqual(Selection.getSelectedCount(state), 0)
})

test('setTableSelectionMode habilita o modo e marca a tabela', () => {
    const state = Selection.createState()
    const table = fakeTable()
    const all = fakeCheckbox()
    Selection.setAllCheckbox(state, all, false)

    Selection.setTableSelectionMode(state, true, { table })

    assert.strictEqual(state.selectionEnabled, true)
    assert.strictEqual(table.classList.contains('selection-active'), true)
    assert.strictEqual(all.checked, false)
    assert.strictEqual(all.indeterminate, false)
})

test('setTableSelectionMode desabilitado limpa a seleção e desmarca a tabela', () => {
    const state = Selection.createState()
    const table = fakeTable()
    const all = fakeCheckbox()
    const cb = fakeCheckbox()
    Selection.setAllCheckbox(state, all, false)
    Selection.registerRow(state, 'abc', cb)

    Selection.setTableSelectionMode(state, true, { table })
    cb.change(true)
    assert.strictEqual(Selection.getSelectedCount(state), 1)

    Selection.setTableSelectionMode(state, false, { table })

    assert.strictEqual(state.selectionEnabled, false)
    assert.strictEqual(table.classList.contains('selection-active'), false)
    assert.strictEqual(Selection.getSelectedCount(state), 0)
    assert.strictEqual(cb.checked, false)
    assert.strictEqual(all.checked, false)
    assert.strictEqual(all.indeterminate, false)
})

test('setTableSelectionMode usa a tabela do state quando opts.table não é informado', () => {
    const state = Selection.createState()
    const table = fakeTable()
    state.table = table

    Selection.setTableSelectionMode(state, true)

    assert.strictEqual(table.classList.contains('selection-active'), true)
    assert.strictEqual(state.selectionEnabled, true)
})

test('alternar o modo de exclusão preserva as linhas registradas', () => {
    const state = Selection.createState()
    const table = fakeTable()
    const cb = fakeCheckbox()
    Selection.registerRow(state, 'abc', cb)

    Selection.setTableSelectionMode(state, true, { table })
    Selection.setTableSelectionMode(state, false, { table })
    Selection.setTableSelectionMode(state, true, { table })

    cb.change(true)
    assert.deepStrictEqual(Selection.getSelectedIds(state), ['abc'])
})
