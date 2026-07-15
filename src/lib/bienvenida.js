export const BIENVENIDA_FLUJO_ID = 'flujo-principal-v1'

export const crearLlaveBienvenida = (userId) => {
  const id = String(userId || '').trim()
  return id ? `ordely_bienvenida:${id}` : ''
}

const obtenerStorage = (storage) => {
  if (storage) return storage
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export const bienvenidaFueVista = (userId, storage) => {
  const llave = crearLlaveBienvenida(userId)
  if (!llave) return true

  try {
    return obtenerStorage(storage)?.getItem(llave) === BIENVENIDA_FLUJO_ID
  } catch {
    return false
  }
}

export const marcarBienvenidaVista = (userId, storage) => {
  const llave = crearLlaveBienvenida(userId)
  if (!llave) return false

  try {
    obtenerStorage(storage)?.setItem(llave, BIENVENIDA_FLUJO_ID)
    return true
  } catch {
    return false
  }
}
