export const agruparProductosPorPedido = (productos = []) => {
  const grupos = new Map()

  productos.forEach((producto, indice) => {
    const pedidoId = String(producto?.pedido_id || '').trim()
    const llave = pedidoId || `producto-${producto?.id || indice}`

    if (!grupos.has(llave)) {
      grupos.set(llave, {
        llave,
        pedidoId: pedidoId || null,
        codigo: producto?.pedidos?.codigo || 'Sin código',
        cliente: producto?.pedidos?.clientes?.nombre || 'Sin cliente',
        plataforma: producto?.pedidos?.plataforma || producto?.lotes_compra?.plataforma || 'Plataforma',
        productos: []
      })
    }

    grupos.get(llave).productos.push(producto)
  })

  return Array.from(grupos.values())
}

export const productoPuedeMarcarseRecibido = (producto) => {
  const estado = String(producto?.estado_compra || '').trim()
  return !['Recibido', 'Dejado en negocio', 'Entregado', 'Cancelado', 'Devuelto'].includes(estado)
}
