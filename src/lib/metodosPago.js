export const METODOS_PAGO = [
  'Transferencia SPEI',
  'Efectivo',
  'Tarjeta de débito o crédito',
  'Depósito en efectivo',
  'Mercado Pago',
  'PayPal',
  'Otro'
]

export const METODO_PAGO_PREDETERMINADO = 'Transferencia SPEI'

export const obtenerFechaLocalHoy = () => {
  const fecha = new Date()
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export const normalizarFechaParaInput = (valor) => {
  if (!valor) return obtenerFechaLocalHoy()

  const texto = String(valor)
  const coincidencia = texto.match(/^(\d{4}-\d{2}-\d{2})/)
  if (coincidencia) return coincidencia[1]

  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return obtenerFechaLocalHoy()

  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export const convertirFechaPagoAISO = (fecha) => `${fecha || obtenerFechaLocalHoy()}T12:00:00`
