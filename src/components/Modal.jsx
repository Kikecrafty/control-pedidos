import { useId } from 'react'

export default function Modal({ abierto, titulo, children, onClose, className = '' }) {
  const titleId = useId()

  if (!abierto) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal-card ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? titleId : undefined}
      >
        <div className={`modal-header ${!titulo ? 'modal-header-no-title' : ''}`.trim()}>
          {titulo && <h2 id={titleId}>{titulo}</h2>}
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar ventana">
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
