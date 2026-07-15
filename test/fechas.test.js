import test from 'node:test'
import assert from 'node:assert/strict'
import { obtenerFechaLocalHoy, parsearFechaLocal } from '../src/lib/fechas.js'

test('una fecha SQL se interpreta como fecha local y no cambia de día', () => {
  const fecha = parsearFechaLocal('2026-07-01')

  assert.ok(fecha)
  assert.equal(fecha.getFullYear(), 2026)
  assert.equal(fecha.getMonth(), 6)
  assert.equal(fecha.getDate(), 1)
})

test('rechaza fechas de calendario imposibles', () => {
  assert.equal(parsearFechaLocal('2026-02-30'), null)
  assert.equal(parsearFechaLocal(''), null)
})

test('genera YYYY-MM-DD usando los componentes locales', () => {
  const fecha = new Date(2026, 0, 2, 23, 30)
  assert.equal(obtenerFechaLocalHoy(fecha), '2026-01-02')
})
