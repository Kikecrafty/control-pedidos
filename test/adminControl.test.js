import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularVencimientoConDias,
  crearCsvPagos,
  fechaBaseParaSumarDias,
  filtrarPagosPorPeriodo,
  resumirPagos
} from '../src/lib/adminControl.js'

test('sumar días conserva el vencimiento futuro como base', () => {
  const ahora = new Date('2026-07-14T12:00:00Z')
  const base = fechaBaseParaSumarDias('2026-08-01T12:00:00Z', ahora)
  const resultado = calcularVencimientoConDias('2026-08-01T12:00:00Z', 30, ahora)

  assert.equal(base.toISOString(), '2026-08-01T12:00:00.000Z')
  assert.equal(resultado.toISOString(), '2026-08-31T12:00:00.000Z')
})

test('sumar días usa hoy si la vigencia ya venció', () => {
  const ahora = new Date('2026-07-14T12:00:00Z')
  const resultado = calcularVencimientoConDias('2026-06-01T12:00:00Z', 10, ahora)

  assert.equal(resultado.toISOString(), '2026-07-24T12:00:00.000Z')
})

test('resumen contable separa bruto, comisión, neto y reembolsos', () => {
  const resumen = resumirPagos([
    { estado_pago: 'pagado', monto: 100, comision: 4, monto_neto: 96 },
    { estado_pago: 'pagado', monto: 50, comision: 0 },
    { estado_pago: 'pendiente', monto: 80 },
    { estado_pago: 'reembolsado', monto: 20 }
  ])

  assert.deepEqual(resumen, {
    registros: 4,
    pagados: 2,
    pendientes: 1,
    bruto: 150,
    comisiones: 4,
    neto: 146,
    reembolsos: 20
  })
})

test('filtro de pagos usa pagado_en y no la fecha de creación cuando existe', () => {
  const ahora = new Date('2026-07-14T12:00:00Z')
  const pagos = [
    { id: 'reciente', creado_en: '2026-01-01T00:00:00Z', pagado_en: '2026-07-13T00:00:00Z' },
    { id: 'viejo', creado_en: '2026-07-14T00:00:00Z', pagado_en: '2026-01-01T00:00:00Z' }
  ]

  assert.deepEqual(filtrarPagosPorPeriodo(pagos, '7d', ahora).map((pago) => pago.id), ['reciente'])
})

test('CSV conserva comas y comillas de las referencias', () => {
  const csv = crearCsvPagos([{
    id: '1',
    nombre: 'Ana, María',
    referencia_pago: 'Folio "ABC"',
    estado_pago: 'pagado',
    monto: 59.99
  }])

  assert.match(csv, /"Ana, María"/)
  assert.match(csv, /"Folio ""ABC"""/)
})
