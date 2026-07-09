import { useEffect } from 'react'

export default function Toast({ mensaje, tipo = 'success', onClose }) {
  useEffect(() => {
    if (!mensaje) return

    const timer = setTimeout(() => {
      onClose?.()
    }, 2600)

    return () => clearTimeout(timer)
  }, [mensaje, onClose])

  if (!mensaje) return null

  return (
    <div className={`toast toast-${tipo}`}>
      {tipo === 'success' ? '✅' : '⚠️'} {mensaje}
    </div>
  )
}
