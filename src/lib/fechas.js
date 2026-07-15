export function obtenerFechaLocalHoy(fecha = new Date()) {
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, '0')
  const day = String(fecha.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parsearFechaLocal(valor) {
  if (!valor) return null

  const texto = String(valor).trim()
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)

  if (soloFecha) {
    const [, year, month, day] = soloFecha
    const fecha = new Date(Number(year), Number(month) - 1, Number(day))

    if (
      fecha.getFullYear() !== Number(year) ||
      fecha.getMonth() !== Number(month) - 1 ||
      fecha.getDate() !== Number(day)
    ) {
      return null
    }

    return fecha
  }

  const fecha = new Date(texto)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}
