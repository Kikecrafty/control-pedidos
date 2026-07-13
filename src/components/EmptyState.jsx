import { Link } from 'react-router-dom'

const iconos = {
  orders: (
    <path d="M7 3.75h10a2.25 2.25 0 0 1 2.25 2.25v12A2.25 2.25 0 0 1 17 20.25H7A2.25 2.25 0 0 1 4.75 18V6A2.25 2.25 0 0 1 7 3.75Zm1.25 4h7.5M8.25 12h7.5M8.25 16h4.5" />
  ),
  clients: (
    <>
      <path d="M8.2 11.2a3.35 3.35 0 1 0 0-6.7 3.35 3.35 0 0 0 0 6.7ZM15.9 10.1a2.6 2.6 0 1 0 0-5.2" />
      <path d="M2.9 19.3v-1.15a5.3 5.3 0 0 1 10.6 0v1.15M14.15 14.2a4.55 4.55 0 0 1 6.95 3.86v1.24" />
    </>
  ),
  purchases: (
    <>
      <path d="M5.1 7.25h13.8l-1.05 12H6.15l-1.05-12Z" />
      <path d="M8.2 9.4V6.7a3.8 3.8 0 0 1 7.6 0v2.7M8.6 13h6.8" />
    </>
  ),
  chart: (
    <>
      <path d="M4.5 19.25V10.5M10 19.25V5.25M15.5 19.25v-6.5M21 19.25V3.75" />
      <path d="M3 20.25h19" />
    </>
  ),
  search: (
    <>
      <circle cx="10.75" cy="10.75" r="6.25" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  products: (
    <>
      <path d="m4.25 7.25 7.75-4 7.75 4-7.75 4-7.75-4Z" />
      <path d="M4.25 7.25v9.5l7.75 4 7.75-4v-9.5M12 11.25v9.5" />
    </>
  ),
  history: (
    <>
      <path d="M4.7 7.1A8.4 8.4 0 1 1 3.6 14" />
      <path d="M3.4 4.5v4.8h4.8M12 7.3v5.1l3.3 2" />
    </>
  ),
  error: (
    <>
      <path d="M12 3.4 21 19H3L12 3.4Z" />
      <path d="M12 8.4v5.2M12 16.8h.01" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7.8 12.1 2.7 2.7 5.9-6" />
    </>
  ),
  loading: (
    <>
      <path d="M20 12a8 8 0 1 1-2.35-5.65" />
      <path d="M17.65 3.65v4h-4" />
    </>
  )
}

function Accion({ to, onClick, className, children }) {
  if (to) {
    return <Link to={to} className={className}>{children}</Link>
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  )
}

export default function EmptyState({
  icon = 'orders',
  eyebrow,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  secondaryLabel,
  secondaryTo,
  onSecondary,
  compact = false,
  tone = 'default',
  className = ''
}) {
  const esCarga = icon === 'loading'

  return (
    <div
      className={`ordely-empty-state ordely-empty-state-${tone} ${compact ? 'ordely-empty-state-compact' : ''} ${className}`.trim()}
      role={esCarga ? 'status' : undefined}
      aria-live={esCarga ? 'polite' : undefined}
      aria-busy={esCarga ? 'true' : undefined}
    >
      <span className={`ordely-empty-icon ${esCarga ? 'ordely-empty-icon-loading' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {iconos[icon] || iconos.orders}
        </svg>
      </span>

      <div className="ordely-empty-copy">
        {eyebrow && <span className="ordely-empty-eyebrow">{eyebrow}</span>}
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>

      {(actionLabel || secondaryLabel) && (
        <div className="ordely-empty-actions">
          {actionLabel && (
            <Accion to={actionTo} onClick={onAction} className="btn btn-primary">
              {actionLabel}
            </Accion>
          )}

          {secondaryLabel && (
            <Accion to={secondaryTo} onClick={onSecondary} className="btn btn-light-bordered">
              {secondaryLabel}
            </Accion>
          )}
        </div>
      )}
    </div>
  )
}
