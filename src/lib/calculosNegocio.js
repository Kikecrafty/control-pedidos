export function normalizarEstadoPedido(estado) {
  if (estado === 'Comprado en SHEIN') return 'Comprado en plataforma'
  if (estado === 'Pendiente de pago') return 'Cotizado'
  if (estado === 'Pagado por cliente') return 'Cotizado'
  return estado || 'Cotizado'
}

export function pedidoCuentaComoVenta(pedido) {
  return !['Cancelado', 'Devuelto'].includes(normalizarEstadoPedido(pedido?.estado))
}

export function esPedidoActivo(pedido) {
  return !['Entregado', 'Cancelado', 'Devuelto'].includes(normalizarEstadoPedido(pedido?.estado))
}

export function obtenerDescuentoCompra(compra) {
  const descuentoModerno = Number(compra?.descuento_total || 0)
  if (descuentoModerno > 0) return descuentoModerno
  return Number(compra?.ahorro_total || 0)
}

export function obtenerCostosExtraCompra(compra) {
  const totalModerno = Number(compra?.costos_extra_total || 0)
  if (totalModerno > 0) return totalModerno

  return ['envio', 'importacion', 'impuestos', 'comisiones']
    .reduce((total, campo) => total + Number(compra?.[campo] || 0), 0)
}

export function obtenerCostosExtraAsignados(productosLote, pedidosIncluidos) {
  const ids = pedidosIncluidos instanceof Set ? pedidosIncluidos : new Set(pedidosIncluidos || [])

  return (productosLote || [])
    .filter((producto) => ids.has(producto?.pedido_id))
    .reduce((total, producto) => {
      return total
        + Number(producto?.envio_asignado || 0)
        + Number(producto?.importacion_asignada || 0)
        + Number(producto?.impuesto_asignado || 0)
        + Number(producto?.comision_asignada || 0)
    }, 0)
}

export function validarMontoPago({ monto, restante, montoAnterior = 0 }) {
  const valor = Number(monto)
  const maximo = Math.max(Number(restante || 0) + Number(montoAnterior || 0), 0)

  if (!Number.isFinite(valor) || valor <= 0) {
    return { valido: false, maximo, motivo: 'positivo' }
  }

  if (valor > maximo + 0.005) {
    return { valido: false, maximo, motivo: 'excede_saldo' }
  }

  return { valido: true, maximo, motivo: null }
}
