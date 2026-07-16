const numeroSeguro = (valor) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

const redondear = (valor) => Number(numeroSeguro(valor).toFixed(2))

const datosProducto = (producto) => {
  const cantidad = Math.max(numeroSeguro(producto?.cantidad), 0)
  const precioPagina = Math.max(numeroSeguro(producto?.precio_pagina ?? producto?.precio_shein), 0)

  return {
    id: producto?.id,
    cantidad,
    precioPagina,
    subtotal: redondear(precioPagina * cantidad)
  }
}

export const inicializarCostosManuales = (productos, descuentoTotal = 0) => {
  const lineas = (productos || []).map(datosProducto)
  const subtotal = lineas.reduce((total, linea) => total + linea.subtotal, 0)
  const descuento = Math.min(Math.max(numeroSeguro(descuentoTotal), 0), subtotal)
  let descuentoAsignado = 0

  return lineas.reduce((costos, linea, indice) => {
    const esUltimo = indice === lineas.length - 1
    const descuentoLinea = esUltimo
      ? redondear(descuento - descuentoAsignado)
      : redondear(subtotal > 0 ? descuento * (linea.subtotal / subtotal) : 0)

    descuentoAsignado = redondear(descuentoAsignado + descuentoLinea)
    costos[linea.id] = redondear(Math.max(linea.subtotal - descuentoLinea, 0)).toFixed(2)
    return costos
  }, {})
}

export const calcularResumenCostosManuales = (productos, costos, cargosExtra = 0) => {
  const lineas = (productos || []).map((producto) => {
    const datos = datosProducto(producto)
    const texto = String(costos?.[datos.id] ?? '').trim()
    const costo = texto === '' ? Number.NaN : Number(texto)
    const valido = Number.isFinite(costo) && costo >= 0
    const costoTotal = valido ? redondear(costo) : 0

    return {
      ...datos,
      costoTotal,
      ahorro: redondear(Math.max(datos.subtotal - costoTotal, 0)),
      valido
    }
  })

  const subtotalProductos = redondear(lineas.reduce((total, linea) => total + linea.subtotal, 0))
  const costoProductos = redondear(lineas.reduce((total, linea) => total + linea.costoTotal, 0))
  const ahorroProductos = redondear(lineas.reduce((total, linea) => total + linea.ahorro, 0))
  const extras = redondear(Math.max(numeroSeguro(cargosExtra), 0))

  return {
    valido: lineas.length > 0 && lineas.every((linea) => linea.valido),
    faltantes: lineas.filter((linea) => !linea.valido).map((linea) => linea.id),
    subtotalProductos,
    costoProductos,
    ahorroProductos,
    cargosExtra: extras,
    totalEstimado: redondear(costoProductos + extras),
    lineas
  }
}
