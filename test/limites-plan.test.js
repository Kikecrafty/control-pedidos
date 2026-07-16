import test from 'node:test'
import assert from 'node:assert/strict'
import {
  estaCercaDelLimiteBasico,
  pedidosRestantesPlanBasico
} from '../src/lib/limitesPlan.js'

const estadoBasico = (usados, limite = 30) => ({
  plan_actual: 'basico',
  pedidos_usados: usados,
  limite_pedidos: limite
})

test('el aviso preventivo se activa desde cinco pedidos restantes', () => {
  assert.equal(estaCercaDelLimiteBasico(estadoBasico(24)), false)
  assert.equal(estaCercaDelLimiteBasico(estadoBasico(25)), true)
  assert.equal(estaCercaDelLimiteBasico(estadoBasico(29)), true)
})

test('el límite agotado no se confunde con el aviso preventivo', () => {
  assert.equal(pedidosRestantesPlanBasico(estadoBasico(30)), 0)
  assert.equal(estaCercaDelLimiteBasico(estadoBasico(30)), false)
  assert.equal(pedidosRestantesPlanBasico(estadoBasico(35)), 0)
})

test('los planes ilimitados no reciben avisos del límite Básico', () => {
  const premium = { plan_actual: 'premium', pedidos_usados: 29, limite_pedidos: 30 }

  assert.equal(pedidosRestantesPlanBasico(premium), null)
  assert.equal(estaCercaDelLimiteBasico(premium), false)
})
