const numeroSeguro = (valor, respaldo = 0) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : respaldo
}

const precioUnitarioProducto = (producto) => {
  return numeroSeguro(
    producto?.precio_venta ??
    producto?.precio_pagina ??
    producto?.precio_shein ??
    0
  )
}

export const formatearProductosParaMensaje = (productos = [], formatearDinero) => {
  if (!Array.isArray(productos) || productos.length === 0) {
    return 'Sin productos registrados'
  }

  const aDinero = typeof formatearDinero === 'function'
    ? formatearDinero
    : (valor) => `$${numeroSeguro(valor).toFixed(2)}`

  return productos
    .map((producto, index) => {
      const nombre = String(producto?.nombre_producto || `Producto ${index + 1}`).trim()
      const cantidad = Math.max(numeroSeguro(producto?.cantidad, 1), 1)
      const precioUnitario = precioUnitarioProducto(producto)
      const precioTexto = aDinero(precioUnitario)

      if (cantidad > 1) {
        const totalProducto = precioUnitario * cantidad
        return `- ${cantidad} x ${nombre} — ${precioTexto} c/u · Total: ${aDinero(totalProducto)}`
      }

      return `- ${nombre} — ${precioTexto}`
    })
    .join('\n')
}
