import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularResumenCostosManuales,
  inicializarCostosManuales
} from '../src/lib/comprasCostos.js'

const productos = [
  { id: 'uno', cantidad: 2, precio_pagina: 50 },
  { id: 'dos', cantidad: 1, precio_pagina: 200 }
]

test('sugiere costos proporcionales sin perder centavos del descuento', () => {
  const costos = inicializarCostosManuales(productos, 50)

  assert.deepEqual(costos, {
    uno: '83.33',
    dos: '166.67'
  })
})

test('los costos manuales sustituyen el reparto automatico del cupon', () => {
  const resumen = calcularResumenCostosManuales(productos, {
    uno: '70.00',
    dos: '155.50'
  }, 24.5)

  assert.equal(resumen.valido, true)
  assert.equal(resumen.subtotalProductos, 300)
  assert.equal(resumen.costoProductos, 225.5)
  assert.equal(resumen.ahorroProductos, 74.5)
  assert.equal(resumen.totalEstimado, 250)
})

test('no permite confirmar si falta el costo de algun producto', () => {
  const resumen = calcularResumenCostosManuales(productos, {
    uno: '70.00',
    dos: ''
  })

  assert.equal(resumen.valido, false)
  assert.deepEqual(resumen.faltantes, ['dos'])
})
