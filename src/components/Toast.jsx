import { useEffect } from 'react'

const configuracion = {
  success: { titulo: 'Listo', icono: '✓' },
  error: { titulo: 'No se pudo completar', icono: '!' },
  warning: { titulo: 'Revisa esto', icono: '!' },
  info: { titulo: 'Información', icono: 'i' }
}

export default function Toast({ mensaje, tipo = 'success', onClose, duracion = 3600 }) {
  useEffect(() => {
    if (!mensaje) return undefined

    const timer = setTimeout(() => {
      onClose?.()
    }, duracion)

    return () => clearTimeout(timer)
  }, [mensaje, onClose, duracion])

  if (!mensaje) return null

  const actual = configuracion[tipo] || configuracion.info

  return (
    <div
      className={`toast toast-${tipo}`}
      role={tipo === 'error' ? 'alert' : 'status'}
      aria-live={tipo === 'error' ? 'assertive' : 'polite'}
    >
      <span className="toast-icon" aria-hidden="true">{actual.icono}</span>
      <div className="toast-copy">
        <strong>{actual.titulo}</strong>
        <span>{mensaje}</span>
      </div>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Cerrar aviso">×</button>
      <i className="toast-progress" style={{ animationDuration: `${duracion}ms` }} aria-hidden="true" />
    </div>
  )
}
