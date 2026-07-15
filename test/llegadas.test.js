import test from 'node:test'
import assert from 'node:assert/strict'
import {
  agruparProductosPorPedido,
  productoPuedeMarcarseRecibido
} from '../src/lib/llegadas.js'

test('las llegadas reúnen todos los productos de un mismo pedido y cliente', () => {
  const productos = [
    {
      id: 'producto-1',
      pedido_id: 'pedido-1',
      nombre_producto: 'Vestido',
      pedidos: { codigo: 'SHN-1', clientes: { nombre: 'Ana' } }
    },
    {
      id: 'producto-2',
      pedido_id: 'pedido-1',
      nombre_producto: 'Bolsa',
      pedidos: { codigo: 'SHN-1', clientes: { nombre: 'Ana' } }
    }
  ]

  const grupos = agruparProductosPorPedido(productos)

  assert.equal(grupos.length, 1)
  assert.equal(grupos[0].cliente, 'Ana')
  assert.equal(grupos[0].codigo, 'SHN-1')
  assert.deepEqual(grupos[0].productos.map((producto) => producto.id), ['producto-1', 'producto-2'])
})

test('pedidos diferentes permanecen separados aunque pertenezcan al mismo cliente', () => {
  const grupos = agruparProductosPorPedido([
    { id: 'producto-1', pedido_id: 'pedido-1', pedidos: { clientes: { nombre: 'Ana' } } },
    { id: 'producto-2', pedido_id: 'pedido-2', pedidos: { clientes: { nombre: 'Ana' } } }
  ])

  assert.equal(grupos.length, 2)
  assert.deepEqual(grupos.map((grupo) => grupo.pedidoId), ['pedido-1', 'pedido-2'])
})

test('solo los productos todavía en tránsito permiten marcar llegada', () => {
  assert.equal(productoPuedeMarcarseRecibido({ estado_compra: 'En camino' }), true)
  assert.equal(productoPuedeMarcarseRecibido({ estado_compra: 'Comprado' }), true)
  assert.equal(productoPuedeMarcarseRecibido({ estado_compra: 'Recibido' }), false)
  assert.equal(productoPuedeMarcarseRecibido({ estado_compra: 'Entregado' }), false)
})
