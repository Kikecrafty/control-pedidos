export const PORCENTAJE_COMISION_REFERIDOS = 60

export const PRECIOS_BASE_REFERIDOS = Object.freeze({
  premium: 79,
  pro: 129
})

export const DIAS_POR_REFERIDO_INICIAL = 15
export const REFERIDOS_PARA_PROMOTOR = 10
export const REFERIDOS_PARA_COMISION = 20
export const COMISION_MAXIMA_REFERIDOS = 60

export const HITOS_REFERIDOS = Object.freeze([10, 20, 30, 40, 50, 60, 75, 100])

export const NIVELES_PREMIO_REFERIDOS = Object.freeze([
  { id: 'premium-15', desde: 1, hasta: 9, premio: '15 días Premium', detalle: 'por cada referido válido' },
  { id: 'premium-30', desde: 10, hasta: 49, premio: '30 días Premium', detalle: 'por cada referido válido' },
  { id: 'pro-15', desde: 50, hasta: 74, premio: '15 días Pro', detalle: 'por cada referido válido' },
  { id: 'pro-30', desde: 75, hasta: 99, premio: '30 días Pro', detalle: 'por cada referido válido' },
  { id: 'pro-ilimitado', desde: 100, hasta: 100, premio: 'Pro ilimitado', detalle: 'al alcanzar 100 referidos' }
])

export const normalizarCodigoReferido = (valor) => {
  const codigo = String(valor || '').trim().toUpperCase()
  return /^ORD-[A-Z0-9]{8,16}$/.test(codigo) ? codigo : ''
}

export const calcularPorcentajeComision = (numeroReferido) => {
  const numero = Math.max(0, Math.trunc(Number(numeroReferido || 0)))
  if (numero < REFERIDOS_PARA_COMISION) return 0
  return Math.min(Math.floor(numero / 10) * 10, COMISION_MAXIMA_REFERIDOS)
}

export const calcularComisionReferido = (plan, numeroReferido = COMISION_MAXIMA_REFERIDOS) => {
  const precioBase = PRECIOS_BASE_REFERIDOS[plan]
  if (!precioBase) return 0
  return Math.round((precioBase * calcularPorcentajeComision(numeroReferido))) / 100
}

export const calcularPremioPlan = (numeroReferido) => {
  const numero = Number(numeroReferido || 0)
  if (numero < 1) return { plan: '', dias: 0, ilimitado: false }
  if (numero < 10) return { plan: 'premium', dias: 15, ilimitado: false }
  if (numero < 50) return { plan: 'premium', dias: 30, ilimitado: false }
  if (numero < 75) return { plan: 'pro', dias: 15, ilimitado: false }
  if (numero < 100) return { plan: 'pro', dias: 30, ilimitado: false }
  if (numero === 100) return { plan: 'pro', dias: 0, ilimitado: true }
  return { plan: 'pro', dias: 0, ilimitado: true }
}

export const obtenerNivelesPremioReferidos = (aprobados) => {
  const total = Math.max(0, Math.trunc(Number(aprobados || 0)))
  const siguiente = Math.min(total + 1, 100)

  return NIVELES_PREMIO_REFERIDOS.map((nivel) => {
    const activo = siguiente >= nivel.desde && siguiente <= nivel.hasta
    const completado = !activo && total >= nivel.hasta
    return {
      ...nivel,
      estado: activo ? 'activo' : completado ? 'completado' : 'bloqueado'
    }
  })
}

export const calcularRecompensasConversion = (numeroReferido, plan) => {
  const numero = Math.max(0, Math.trunc(Number(numeroReferido || 0)))
  const premioPlan = calcularPremioPlan(numero)
  const porcentajeComision = calcularPorcentajeComision(numero)

  return {
    premioPlan,
    porcentajeComision,
    comision: calcularComisionReferido(plan, numero)
  }
}

export const obtenerProximoHitoReferidos = (aprobados) => {
  const total = Math.max(0, Math.trunc(Number(aprobados || 0)))
  return HITOS_REFERIDOS.find((hito) => total < hito) || 100
}

export const obtenerProgresoReferidos = (aprobados) => {
  const total = Math.max(0, Math.trunc(Number(aprobados || 0)))
  const siguiente = obtenerProximoHitoReferidos(total)
  const indiceSiguiente = HITOS_REFERIDOS.indexOf(siguiente)
  const anterior = indiceSiguiente > 0 ? HITOS_REFERIDOS[indiceSiguiente - 1] : 0
  const completado = total >= 100
  const avance = completado ? 100 - anterior : Math.min(Math.max(total - anterior, 0), siguiente - anterior)
  const porcentaje = completado ? 100 : Math.round((avance / Math.max(siguiente - anterior, 1)) * 100)

  return {
    total,
    anterior,
    siguiente,
    faltan: completado ? 0 : Math.max(siguiente - total, 0),
    porcentaje
  }
}

export const obtenerPorcentajeRutaReferidos = (aprobados) => {
  const total = Math.max(0, Math.trunc(Number(aprobados || 0)))
  if (total < HITOS_REFERIDOS[0]) return 0
  if (total >= HITOS_REFERIDOS.at(-1)) return 100

  let indiceAnterior = 0
  HITOS_REFERIDOS.forEach((hito, indice) => {
    if (total >= hito) indiceAnterior = indice
  })
  const anterior = HITOS_REFERIDOS[indiceAnterior]
  const siguiente = HITOS_REFERIDOS[indiceAnterior + 1]
  const avanceDelTramo = (total - anterior) / (siguiente - anterior)

  return Math.round(((indiceAnterior + avanceDelTramo) / (HITOS_REFERIDOS.length - 1)) * 100)
}

export const crearEnlaceReferido = (origen, codigo) => {
  const codigoValido = normalizarCodigoReferido(codigo)
  if (!codigoValido) return ''

  const base = String(origen || '').replace(/\/$/, '')
  return `${base}/login?modo=registro&ref=${encodeURIComponent(codigoValido)}`
}
