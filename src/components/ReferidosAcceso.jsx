import {
  calcularComisionReferido,
  NIVELES_PREMIO_REFERIDOS,
  PORCENTAJE_COMISION_REFERIDOS
} from '../lib/referidos'

const formatearDinero = (cantidad) => Number(cantidad || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN'
})

const formatearFecha = (fecha) => {
  if (!fecha) return ''
  return new Date(fecha).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const pasos = [
  ['Solicita acceso', 'Envía tu solicitud desde esta página.'],
  ['Recibe tu enlace', 'Cuando se apruebe tendrás un código personal.'],
  ['Invita y convierte', 'La cuenta invitada compra un mes Premium o Pro.'],
  ['Recibe tu premio', 'Después de 30 días se libera la recompensa.']
]

export default function ReferidosAcceso({ estado, solicitadoEn, notaAdmin, procesando, migracionActiva, onSolicitar }) {
  const pendiente = estado === 'solicitado'
  const rechazado = estado === 'rechazado'

  return (
    <div className="referral-access-page">
      <section className="referral-access-hero">
        <div>
          <span>Programa de referidos Ordely</span>
          <h1>Comparte Ordely y recibe recompensas</h1>
          <p>Gana días Premium, días Pro y comisiones cuando las personas que invites compren su primer mes.</p>
        </div>
        <div className="referral-access-hero-reward">
          <small>Comisión máxima</small>
          <strong>{PORCENTAJE_COMISION_REFERIDOS}%</strong>
          <span>sobre el precio regular</span>
        </div>
      </section>

      {!migracionActiva && (
        <div className="referrals-activation-note">
          <span />
          <div><strong>Vista preparada en local</strong><p>El envío real de solicitudes se activará cuando autorices aplicar la migración en Supabase.</p></div>
        </div>
      )}

      <section className={`referral-access-request is-${estado}`}>
        <div>
          <span>{pendiente ? 'Solicitud enviada' : rechazado ? 'Puedes volver a solicitar' : 'Acceso al programa'}</span>
          <h2>{pendiente ? 'Tu solicitud está en revisión' : 'Solicita tu enlace personal'}</h2>
          <p>
            {pendiente
              ? `La administración revisará tu cuenta${solicitadoEn ? ` · enviada el ${formatearFecha(solicitadoEn)}` : ''}.`
              : 'Al aprobarse podrás compartir tu enlace, revisar conversiones y reclamar tus premios.'}
          </p>
          {rechazado && notaAdmin && <em>Motivo anterior: {notaAdmin}</em>}
        </div>
        <button type="button" className="btn btn-primary" onClick={onSolicitar} disabled={pendiente || procesando}>
          {procesando ? 'Enviando...' : pendiente ? 'Solicitud en revisión' : rechazado ? 'Volver a solicitar' : 'Solicitar acceso a Referidos'}
        </button>
      </section>

      <section className="referral-access-section">
        <div className="referral-access-heading">
          <span>Recompensas</span>
          <h2>Mejoran conforme crece tu comunidad</h2>
          <p>Cada referido cuenta cuando realiza su primera compra y completa la validación.</p>
        </div>
        <div className="referral-access-rewards">
          {NIVELES_PREMIO_REFERIDOS.map((nivel) => (
            <article key={nivel.id}>
              <small>{nivel.desde === nivel.hasta ? `${nivel.desde} referidos` : `${nivel.desde}–${nivel.hasta} referidos`}</small>
              <strong>{nivel.premio}</strong>
              <p>{nivel.detalle}</p>
            </article>
          ))}
        </div>
        <div className="referral-access-commission">
          <div><span>Desde 20 referidos</span><strong>20% de comisión</strong><p>{formatearDinero(calcularComisionReferido('premium', 20))} Premium · {formatearDinero(calcularComisionReferido('pro', 20))} Pro</p></div>
          <i>Sube 10% cada 10 referidos</i>
          <div><span>Desde 60 referidos</span><strong>60% máximo</strong><p>{formatearDinero(calcularComisionReferido('premium', 60))} Premium · {formatearDinero(calcularComisionReferido('pro', 60))} Pro</p></div>
        </div>
      </section>

      <section className="referral-access-section">
        <div className="referral-access-heading">
          <span>Cómo funciona</span>
          <h2>Cuatro pasos sencillos</h2>
        </div>
        <div className="referral-access-steps">
          {pasos.map(([titulo, descripcion], indice) => (
            <article key={titulo}>
              <b>{indice + 1}</b>
              <div><strong>{titulo}</strong><p>{descripcion}</p></div>
            </article>
          ))}
        </div>
      </section>

      <p className="referral-access-conditions">Solo cuentan cuentas nuevas, sin autorreferidos ni duplicados. Los pagos cancelados o reembolsados no generan recompensas.</p>
    </div>
  )
}
