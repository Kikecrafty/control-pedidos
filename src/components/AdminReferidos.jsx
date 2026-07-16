import { useEffect, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../supabaseClient'
import '../styles/34-referidos.css'

const datosVacios = {
  resumen: {
    solicitudes_pendientes: 0,
    registrados: 0,
    validando: 0,
    aprobados: 0,
    requieren_revision: 0,
    comisiones_disponibles: 0,
    retiros_pendientes: 0,
    comisiones_pagadas: 0
  },
  solicitudes: [],
  referidos: [],
  retiros: []
}

const estadoTexto = {
  registrado: 'Registrado',
  validando: 'Validando compra',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
  revision: 'Requiere revisión',
  solicitado: 'Solicitado',
  pagado: 'Pagado',
  activo: 'Activo'
}

const formatearDinero = (cantidad) => Number(cantidad || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN'
})

const formatearFecha = (fecha) => {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function AdminReferidos() {
  const [datos, setDatos] = useState(datosVacios)
  const [cargando, setCargando] = useState(true)
  const [activo, setActivo] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [solicitudAccion, setSolicitudAccion] = useState(null)
  const [tipoSolicitud, setTipoSolicitud] = useState('')
  const [referidoAccion, setReferidoAccion] = useState(null)
  const [tipoAccion, setTipoAccion] = useState('')
  const [nota, setNota] = useState('')
  const [retiroAccion, setRetiroAccion] = useState(null)
  const [referenciaPago, setReferenciaPago] = useState('')
  const [procesando, setProcesando] = useState(false)

  const cargar = async () => {
    setCargando(true)
    const { data, error } = await supabase.rpc('admin_listar_referidos_v1')

    if (error) {
      console.log('Administración de referidos pendiente:', error)
      setActivo(false)
      setDatos(datosVacios)
    } else {
      setActivo(true)
      setDatos(data || datosVacios)
    }
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const abrirSolicitud = (solicitud, tipo) => {
    setSolicitudAccion(solicitud)
    setTipoSolicitud(tipo)
    setNota('')
    setMensaje('')
  }

  const cerrarSolicitud = () => {
    if (procesando) return
    setSolicitudAccion(null)
    setTipoSolicitud('')
    setNota('')
  }

  const procesarSolicitud = async (event) => {
    event.preventDefault()
    if (!solicitudAccion) return
    if (tipoSolicitud === 'rechazar' && nota.trim().length < 3) {
      setMensaje('Escribe el motivo del rechazo.')
      return
    }

    setProcesando(true)
    const { error } = await supabase.rpc('admin_resolver_solicitud_referidos_v1', {
      p_user_id: solicitudAccion.user_id,
      p_aprobar: tipoSolicitud === 'aprobar',
      p_nota: nota.trim() || null
    })

    if (error) {
      setMensaje(error.message || 'No se pudo procesar la solicitud.')
      setProcesando(false)
      return
    }

    setProcesando(false)
    setSolicitudAccion(null)
    setTipoSolicitud('')
    setNota('')
    await cargar()
  }

  const abrirAccion = (referido, tipo) => {
    setReferidoAccion(referido)
    setTipoAccion(tipo)
    setNota('')
    setMensaje('')
  }

  const cerrarAccion = () => {
    if (procesando) return
    setReferidoAccion(null)
    setTipoAccion('')
    setNota('')
  }

  const procesarReferido = async (event) => {
    event.preventDefault()
    if (!referidoAccion) return

    if (tipoAccion === 'rechazar' && nota.trim().length < 3) {
      setMensaje('Escribe el motivo del rechazo.')
      return
    }

    setProcesando(true)
    const resultado = tipoAccion === 'aprobar'
      ? await supabase.rpc('admin_aprobar_referido_v1', {
          p_referido_id: referidoAccion.id,
          p_nota: nota.trim() || null
        })
      : await supabase.rpc('admin_rechazar_referido_v1', {
          p_referido_id: referidoAccion.id,
          p_nota: nota.trim()
        })

    if (resultado.error) {
      setMensaje(resultado.error.message || 'No se pudo procesar el referido.')
      setProcesando(false)
      return
    }

    setProcesando(false)
    setReferidoAccion(null)
    setTipoAccion('')
    setNota('')
    await cargar()
  }

  const abrirRetiro = (retiro) => {
    setRetiroAccion(retiro)
    setReferenciaPago('')
    setNota('')
    setMensaje('')
  }

  const pagarRetiro = async (event) => {
    event.preventDefault()
    if (!retiroAccion) return

    if (referenciaPago.trim().length < 3) {
      setMensaje('Registra la referencia del pago realizado.')
      return
    }

    setProcesando(true)
    const { error } = await supabase.rpc('admin_marcar_retiro_referidos_pagado_v1', {
      p_retiro_id: retiroAccion.id,
      p_referencia: referenciaPago.trim(),
      p_notas: nota.trim() || null
    })

    if (error) {
      setMensaje(error.message || 'No se pudo registrar el pago.')
      setProcesando(false)
      return
    }

    setRetiroAccion(null)
    setProcesando(false)
    await cargar()
  }

  const hoy = Date.now()

  return (
    <div className="admin-referrals-panel">
      {!activo && (
        <div className="admin-data-status">
          <span />
          <div>
            <strong>Programa preparado en local</strong>
            <p>Este registro se activará cuando se aplique la migración de referidos en Supabase.</p>
          </div>
        </div>
      )}

      <div className="cards-grid admin-referrals-summary">
        <div className="card"><span>Solicitudes</span><strong>{datos.resumen.solicitudes_pendientes}</strong></div>
        <div className="card"><span>Invitaciones</span><strong>{datos.resumen.registrados}</strong></div>
        <div className="card"><span>Validando</span><strong>{datos.resumen.validando}</strong></div>
        <div className="card"><span>Aprobados</span><strong>{datos.resumen.aprobados}</strong></div>
        <div className="card"><span>Revisión</span><strong>{datos.resumen.requieren_revision}</strong></div>
        <div className="card"><span>Por retirar</span><strong>{formatearDinero(datos.resumen.retiros_pendientes)}</strong></div>
        <div className="card"><span>Pagado</span><strong>{formatearDinero(datos.resumen.comisiones_pagadas)}</strong></div>
      </div>

      <div className="table-card admin-referrals-table-card">
        <div className="table-title row-between">
          <div>
            <h2>Solicitudes de acceso</h2>
            <p className="muted">Aprueba únicamente las cuentas que podrán compartir un enlace y generar recompensas.</p>
          </div>
          <button type="button" className="btn btn-light-bordered" onClick={cargar} disabled={cargando}>Actualizar</button>
        </div>

        <div className="admin-referral-applications">
          {datos.solicitudes.map((solicitud) => (
            <article key={solicitud.user_id}>
              <div><small>Cuenta</small><strong>{solicitud.nombre || solicitud.correo}</strong><span>{solicitud.correo}</span></div>
              <div><small>Solicitud</small><strong>{formatearFecha(solicitud.solicitado_en)}</strong>{solicitud.nota_admin && <span>{solicitud.nota_admin}</span>}</div>
              <em className={`is-${solicitud.estado}`}>{estadoTexto[solicitud.estado] || solicitud.estado}</em>
              <div className="admin-referral-actions">
                {solicitud.estado === 'solicitado' && (
                  <>
                    <button type="button" className="btn btn-primary btn-small" onClick={() => abrirSolicitud(solicitud, 'aprobar')}>Aprobar</button>
                    <button type="button" className="btn btn-light-bordered btn-small" onClick={() => abrirSolicitud(solicitud, 'rechazar')}>Rechazar</button>
                  </>
                )}
              </div>
            </article>
          ))}
          {datos.solicitudes.length === 0 && <div className="empty-state">Todavía no hay solicitudes de acceso al programa.</div>}
        </div>
      </div>

      <div className="table-card admin-referrals-table-card">
        <div className="table-title row-between">
          <div>
            <h2>Conversiones por revisar</h2>
            <p className="muted">La aprobación crea una sola recompensa después de 30 días y confirma que el primer pago siga vigente.</p>
          </div>
          <button type="button" className="btn btn-light-bordered" onClick={cargar} disabled={cargando}>Actualizar</button>
        </div>

        <div className="admin-referrals-list">
          {datos.referidos.map((referido) => {
            const puedeAprobar = referido.estado === 'validando'
              && referido.valida_desde
              && new Date(referido.valida_desde).getTime() <= hoy

            return (
              <article key={referido.id}>
                <div className="admin-referral-people">
                  <small>Promotor</small>
                  <strong>{referido.promotor_nombre || referido.promotor_correo}</strong>
                  <span>{referido.promotor_correo}</span>
                  <i>invitó a</i>
                  <small>Cuenta nueva</small>
                  <strong>{referido.invitado_nombre || referido.invitado_correo}</strong>
                  <span>{referido.invitado_correo}</span>
                </div>
                <div className="admin-referral-purchase">
                  <small>Primera compra</small>
                  <strong>{referido.plan_comprado ? `Plan ${referido.plan_comprado}` : 'Aún no compra'}</strong>
                  <span>
                    {referido.plan_comprado
                      ? referido.estado === 'aprobado' && Number(referido.porcentaje_comision) > 0
                        ? `${formatearDinero(referido.precio_base)} base · ${referido.porcentaje_comision}% = ${formatearDinero(referido.comision_mxn)}`
                        : `${formatearDinero(referido.precio_base)} base · premio calculado al aprobar`
                      : formatearFecha(referido.registrado_en)}
                  </span>
                  {referido.valida_desde && <p>Validar desde: <b>{formatearFecha(referido.valida_desde)}</b></p>}
                </div>
                <div className="admin-referral-state">
                  <em className={`is-${referido.estado}`}>{estadoTexto[referido.estado] || referido.estado}</em>
                  {referido.nota_admin && <p>{referido.nota_admin}</p>}
                </div>
                <div className="admin-referral-actions">
                  {referido.estado === 'validando' && (
                    <button type="button" className="btn btn-primary btn-small" onClick={() => abrirAccion(referido, 'aprobar')} disabled={!puedeAprobar} title={!puedeAprobar ? 'Aún no termina la validación de 30 días' : ''}>Aprobar</button>
                  )}
                  {['registrado', 'validando', 'revision'].includes(referido.estado) && (
                    <button type="button" className="btn btn-light-bordered btn-small" onClick={() => abrirAccion(referido, 'rechazar')}>Rechazar</button>
                  )}
                </div>
              </article>
            )
          })}
          {datos.referidos.length === 0 && <div className="empty-state">Aún no hay cuentas registradas mediante referidos.</div>}
        </div>
      </div>

      <div className="table-card admin-referrals-table-card">
        <div className="table-title">
          <h2>Solicitudes de pago</h2>
          <p className="muted">Registra la referencia únicamente después de enviar el dinero al promotor.</p>
        </div>
        <div className="admin-referrals-withdrawals">
          {datos.retiros.map((retiro) => (
            <article key={retiro.id}>
              <div><small>Promotor</small><strong>{retiro.promotor_nombre || retiro.promotor_correo}</strong><span>{retiro.promotor_correo}</span></div>
              <div><small>Monto</small><strong>{formatearDinero(retiro.monto_mxn)}</strong><span>{formatearFecha(retiro.solicitado_en)}</span></div>
              <em className={`is-${retiro.estado}`}>{estadoTexto[retiro.estado] || retiro.estado}</em>
              {retiro.estado === 'solicitado' && <button type="button" className="btn btn-primary btn-small" onClick={() => abrirRetiro(retiro)}>Registrar pago</button>}
              {retiro.referencia_pago && <p>Referencia: <b>{retiro.referencia_pago}</b></p>}
            </article>
          ))}
          {datos.retiros.length === 0 && <div className="empty-state">No hay pagos de promotores pendientes.</div>}
        </div>
      </div>

      <Modal abierto={Boolean(solicitudAccion)} titulo={tipoSolicitud === 'aprobar' ? 'Aprobar acceso a Referidos' : 'Rechazar solicitud'} onClose={cerrarSolicitud}>
        {solicitudAccion && (
          <form className="modal-form-grid" onSubmit={procesarSolicitud}>
            <div className="admin-referral-modal-summary">
              <span>Cuenta</span><strong>{solicitudAccion.nombre || solicitudAccion.correo}</strong>
              <span>Correo</span><strong>{solicitudAccion.correo}</strong>
              <p>{tipoSolicitud === 'aprobar' ? 'La cuenta recibirá su enlace personal inmediatamente.' : 'La cuenta podrá leer el motivo y volver a solicitar después.'}</p>
            </div>
            <div className="form-field">
              <label>{tipoSolicitud === 'aprobar' ? 'Nota administrativa (opcional)' : 'Motivo del rechazo'}</label>
              <textarea rows="4" value={nota} onChange={(event) => setNota(event.target.value)} required={tipoSolicitud === 'rechazar'} />
            </div>
            {mensaje && <p className="error-text">{mensaje}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-light-bordered" onClick={cerrarSolicitud} disabled={procesando}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={procesando}>{procesando ? 'Procesando...' : 'Confirmar'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal abierto={Boolean(referidoAccion)} titulo={tipoAccion === 'aprobar' ? 'Aprobar referido' : 'Rechazar referido'} onClose={cerrarAccion}>
        {referidoAccion && (
          <form className="modal-form-grid" onSubmit={procesarReferido}>
            <div className="admin-referral-modal-summary">
              <span>Promotor</span><strong>{referidoAccion.promotor_nombre || referidoAccion.promotor_correo}</strong>
              <span>Cuenta invitada</span><strong>{referidoAccion.invitado_nombre || referidoAccion.invitado_correo}</strong>
              {referidoAccion.plan_comprado && <p>{referidoAccion.plan_comprado} · la recompensa se calculará según el número de referido aprobado</p>}
            </div>
            <div className="form-field">
              <label>{tipoAccion === 'aprobar' ? 'Nota administrativa (opcional)' : 'Motivo del rechazo'}</label>
              <textarea rows="4" value={nota} onChange={(event) => setNota(event.target.value)} required={tipoAccion === 'rechazar'} />
            </div>
            {mensaje && <p className="error-text">{mensaje}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-light-bordered" onClick={cerrarAccion} disabled={procesando}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={procesando}>{procesando ? 'Procesando...' : tipoAccion === 'aprobar' ? 'Confirmar aprobación' : 'Confirmar rechazo'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal abierto={Boolean(retiroAccion)} titulo="Registrar pago al promotor" onClose={() => !procesando && setRetiroAccion(null)}>
        {retiroAccion && (
          <form className="modal-form-grid" onSubmit={pagarRetiro}>
            <div className="admin-referral-modal-summary">
              <span>Promotor</span><strong>{retiroAccion.promotor_nombre || retiroAccion.promotor_correo}</strong>
              <span>Monto</span><strong>{formatearDinero(retiroAccion.monto_mxn)}</strong>
            </div>
            <div className="form-field"><label>Referencia o folio del pago</label><input value={referenciaPago} onChange={(event) => setReferenciaPago(event.target.value)} required /></div>
            <div className="form-field"><label>Notas (opcional)</label><textarea rows="3" value={nota} onChange={(event) => setNota(event.target.value)} /></div>
            {mensaje && <p className="error-text">{mensaje}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-light-bordered" onClick={() => setRetiroAccion(null)} disabled={procesando}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={procesando}>{procesando ? 'Guardando...' : 'Marcar como pagado'}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
