import test from 'node:test'
import assert from 'node:assert/strict'
import {
  esPedidoActivo,
  obtenerCostosExtraAsignados,
  obtenerCostosExtraCompra,
  obtenerDescuentoCompra,
  pedidoCuentaComoVenta,
  validarMontoPago
} from '../src/lib/calculosNegocio.js'
import { prefijoPlataforma } from '../src/lib/plataformas.js'

test('un pedido entregado no se cuenta como activo pero sí como venta', () => {
  const pedido = { estado: 'Entregado' }
  assert.equal(esPedidoActivo(pedido), false)
  assert.equal(pedidoCuentaComoVenta(pedido), true)
})

test('cancelados y devueltos quedan fuera de ventas', () => {
  assert.equal(pedidoCuentaComoVenta({ estado: 'Cancelado' }), false)
  assert.equal(pedidoCuentaComoVenta({ estado: 'Devuelto' }), false)
})

test('cada compra usa su propio respaldo de descuentos y costos antiguos', () => {
  const compras = [
    { descuento_total: 25, ahorro_total: 25, costos_extra_total: 10, envio: 10 },
    { descuento_total: 0, ahorro_total: 8, costos_extra_total: 0, envio: 5, comisiones: 2 }
  ]

  assert.equal(compras.reduce((suma, compra) => suma + obtenerDescuentoCompra(compra), 0), 33)
  assert.equal(compras.reduce((suma, compra) => suma + obtenerCostosExtraCompra(compra), 0), 17)
})

test('la ganancia de un rango solo descuenta extras asignados a sus pedidos', () => {
  const productos = [
    { pedido_id: 'a', envio_asignado: 3, impuesto_asignado: 1 },
    { pedido_id: 'b', envio_asignado: 5, comision_asignada: 2 }
  ]

  assert.equal(obtenerCostosExtraAsignados(productos, new Set(['a'])), 4)
})

test('un pago debe ser positivo y no superar el saldo disponible', () => {
  assert.deepEqual(validarMontoPago({ monto: 0, restante: 100 }), {
    valido: false,
    maximo: 100,
    motivo: 'positivo'
  })

  assert.equal(validarMontoPago({ monto: 101, restante: 100 }).motivo, 'excede_saldo')
  assert.equal(validarMontoPago({ monto: 120, restante: 100, montoAnterior: 20 }).valido, true)
})

test('los prefijos de folio coinciden con los generados por la base', () => {
  assert.equal(prefijoPlataforma('TikTok Shop'), 'TTS')
  assert.equal(prefijoPlataforma('Mercado Libre'), 'ML')
  assert.equal(prefijoPlataforma('Amazon'), 'AMZ')
  assert.equal(prefijoPlataforma('Otro'), 'OTR')
})
