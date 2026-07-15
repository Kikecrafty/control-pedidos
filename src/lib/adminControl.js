const fechaValida = (valor) => {
  const fecha = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

export const fechaBaseParaSumarDias = (venceEn, ahora = new Date()) => {
  const hoy = fechaValida(ahora) || new Date()
  const vencimiento = fechaValida(venceEn)

  if (!vencimiento || vencimiento < hoy) return hoy
  return vencimiento
}

export const calcularVencimientoConDias = (venceEn, dias, ahora = new Date()) => {
  const cantidad = Number(dias)
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 3650) return null

  const resultado = new Date(fechaBaseParaSumarDias(venceEn, ahora))
  resultado.setDate(resultado.getDate() + cantidad)
  return resultado
}

export const fechaContablePago = (pago) => pago?.pagado_en || pago?.creado_en || null

export const inicioPeriodoPagos = (periodo, ahora = new Date()) => {
  const fecha = fechaValida(ahora) || new Date()

  if (periodo === 'hoy') {
    fecha.setHours(0, 0, 0, 0)
    return fecha
  }

  if (periodo === '7d' || periodo === '30d' || periodo === '90d') {
    fecha.setDate(fecha.getDate() - Number(periodo.replace('d', '')))
    return fecha
  }

  if (periodo === 'mes') {
    return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
  }

  if (periodo === 'anio') {
    return new Date(fecha.getFullYear(), 0, 1)
  }

  return null
}

export const filtrarPagosPorPeriodo = (pagos, periodo, ahora = new Date()) => {
  const inicio = inicioPeriodoPagos(periodo, ahora)
  if (!inicio) return [...pagos]

  return pagos.filter((pago) => {
    const fecha = fechaValida(fechaContablePago(pago))
    return fecha && fecha >= inicio
  })
}

export const resumirPagos = (pagos) => pagos.reduce((resumen, pago) => {
  const monto = Number(pago.monto || 0)
  const comision = Number(pago.comision || 0)
  const netoGuardado = pago.monto_neto
  const neto = netoGuardado === null || netoGuardado === undefined
    ? Math.max(monto - comision, 0)
    : Number(netoGuardado || 0)

  resumen.registros += 1

  if (pago.estado_pago === 'pagado') {
    resumen.pagados += 1
    resumen.bruto += monto
    resumen.comisiones += comision
    resumen.neto += neto
  } else if (pago.estado_pago === 'reembolsado') {
    resumen.reembolsos += monto
  } else if (pago.estado_pago === 'pendiente') {
    resumen.pendientes += 1
  }

  return resumen
}, {
  registros: 0,
  pagados: 0,
  pendientes: 0,
  bruto: 0,
  comisiones: 0,
  neto: 0,
  reembolsos: 0
})

const escaparCsv = (valor) => {
  const texto = String(valor ?? '')
  if (!/[",\n\r]/.test(texto)) return texto
  return `"${texto.replaceAll('"', '""')}"`
}

export const crearCsvPagos = (pagos) => {
  const encabezados = [
    'Folio',
    'Fecha pagada',
    'Usuario',
    'Correo',
    'Plan',
    'Estado',
    'Método',
    'Referencia',
    'Monto bruto',
    'Comisión',
    'Monto neto',
    'Moneda',
    'Vencimiento'
  ]

  const filas = pagos.map((pago) => [
    pago.folio_pago || pago.id,
    fechaContablePago(pago),
    pago.nombre,
    pago.correo,
    pago.plan,
    pago.estado_pago,
    pago.metodo_pago,
    pago.referencia_pago,
    Number(pago.monto || 0).toFixed(2),
    Number(pago.comision || 0).toFixed(2),
    Number(pago.monto_neto ?? (Number(pago.monto || 0) - Number(pago.comision || 0))).toFixed(2),
    pago.moneda || 'MXN',
    pago.fecha_fin
  ])

  return [encabezados, ...filas]
    .map((fila) => fila.map(escaparCsv).join(','))
    .join('\r\n')
}
