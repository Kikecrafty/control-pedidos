export const PLATAFORMAS = [
  'SHEIN',
  'Temu',
  'AliExpress',
  'TikTok Shop',
  'Mercado Libre',
  'Amazon',
  'Catálogo',
  'Otro'
]

export const PLATAFORMA_PREDETERMINADA = 'SHEIN'

export const normalizarPlataforma = (valor) => {
  const encontrada = PLATAFORMAS.find(
    (item) => item.toLowerCase() === String(valor || '').trim().toLowerCase()
  )

  return encontrada || PLATAFORMA_PREDETERMINADA
}

export const prefijoPlataforma = (valor) => {
  const plataforma = normalizarPlataforma(valor)

  const prefijos = {
    SHEIN: 'SHN',
    Temu: 'TEM',
    AliExpress: 'ALI',
    'TikTok Shop': 'TTS',
    'Mercado Libre': 'ML',
    Amazon: 'AMZ',
    Catálogo: 'CAT',
    Otro: 'OTR'
  }

  return prefijos[plataforma] || 'ORD'
}

export const diasEstimadosPlataforma = (plataforma, configuracion = {}) => {
  const normalizada = normalizarPlataforma(plataforma)

  const dias = {
    SHEIN: Number(configuracion.tiempo_shein_dias || 10),
    Temu: Number(configuracion.tiempo_temu_dias || 14),
    AliExpress: Number(configuracion.tiempo_aliexpress_dias || 25),
    'TikTok Shop': Number(configuracion.tiempo_tiktok_shop_dias || 12),
    'Mercado Libre': Number(configuracion.tiempo_mercado_libre_dias || 5),
    Amazon: Number(configuracion.tiempo_amazon_dias || 7),
    Catálogo: Number(configuracion.tiempo_catalogo_dias || 7),
    Otro: Number(configuracion.tiempo_otro_dias || 15)
  }

  return dias[normalizada] || dias.Otro
}
