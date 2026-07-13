import Modal from './Modal'

const iconos = {
  danger: (
    <>
      <path d="M12 3.5 21 19H3L12 3.5Z" />
      <path d="M12 8.5v5M12 16.8h.01" />
    </>
  ),
  warning: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.2M12 16.2h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v6M12 7.4h.01" />
    </>
  )
}

export default function ConfirmDialog({
  abierto,
  titulo,
  descripcion,
  detalle,
  confirmarTexto = 'Confirmar',
  cancelarTexto = 'Cancelar',
  onConfirm,
  onClose,
  cargando = false,
  variante = 'danger'
}) {
  return (
    <Modal
      abierto={abierto}
      titulo=""
      onClose={() => {
        if (!cargando) onClose?.()
      }}
      className="ordely-confirm-modal"
    >
      <div className={`ordely-confirm-dialog ordely-confirm-dialog-${variante}`}>
        <span className="ordely-confirm-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {iconos[variante] || iconos.danger}
          </svg>
        </span>

        <div className="ordely-confirm-copy">
          <span className="ordely-confirm-kicker">
            {variante === 'danger' ? 'Acción permanente' : variante === 'warning' ? 'Revisa antes de continuar' : 'Confirmación'}
          </span>
          <h3>{titulo}</h3>
          {descripcion && <p>{descripcion}</p>}
          {detalle && <div className="ordely-confirm-detail">{detalle}</div>}
        </div>

        <div className="ordely-confirm-actions">
          <button type="button" className="btn btn-light-bordered" onClick={onClose} disabled={cargando}>
            {cancelarTexto}
          </button>
          <button
            type="button"
            className={variante === 'danger' ? 'btn ordely-btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={cargando}
          >
            {cargando ? 'Procesando...' : confirmarTexto}
          </button>
        </div>
      </div>
    </Modal>
  )
}
