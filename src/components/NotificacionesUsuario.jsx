import { useCallback, useEffect, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../supabaseClient'
import '../styles/36-notificaciones.css'

const formatearFechaNotificacion = (valor) => {
  if (!valor) return ''
  return new Date(valor).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
      <path d="M3.5 5.5 2 4M20.5 5.5 22 4" />
    </svg>
  )
}

export default function NotificacionesUsuario({ usuarioId }) {
  const [notificaciones, setNotificaciones] = useState([])
  const [abiertas, setAbiertas] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  const cargarNotificaciones = useCallback(async () => {
    if (!usuarioId) {
      setNotificaciones([])
      return
    }

    const { data, error } = await supabase
      .from('notificaciones_usuario')
      .select('id,tipo,titulo,mensaje,creado_en')
      .is('leida_en', null)
      .order('creado_en', { ascending: false })
      .limit(20)

    if (error) {
      // No interrumpe la aplicación mientras la migración esté pendiente.
      setNotificaciones([])
      return
    }

    setNotificaciones(data || [])
  }, [usuarioId])

  useEffect(() => {
    void cargarNotificaciones()

    const intervalo = window.setInterval(() => {
      void cargarNotificaciones()
    }, 30000)

    const revisarAlVolver = () => {
      if (document.visibilityState === 'visible') void cargarNotificaciones()
    }

    document.addEventListener('visibilitychange', revisarAlVolver)
    window.addEventListener('focus', cargarNotificaciones)

    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', revisarAlVolver)
      window.removeEventListener('focus', cargarNotificaciones)
    }
  }, [cargarNotificaciones])

  const marcarLeida = async (notificacionId) => {
    if (procesando) return
    setProcesando(true)
    setErrorAccion('')

    const { error } = await supabase.rpc('marcar_mi_notificacion_leida_v1', {
      p_notificacion_id: notificacionId
    })

    setProcesando(false)

    if (error) {
      setErrorAccion('No se pudo marcar el mensaje como leído.')
      return
    }

    const siguientes = notificaciones.filter((item) => item.id !== notificacionId)
    setNotificaciones(siguientes)
    if (siguientes.length === 0) setAbiertas(false)
  }

  const marcarTodasLeidas = async () => {
    if (procesando) return
    setProcesando(true)
    setErrorAccion('')

    const { error } = await supabase.rpc('marcar_mis_notificaciones_leidas_v1')
    setProcesando(false)

    if (error) {
      setErrorAccion('No se pudieron marcar los mensajes como leídos.')
      return
    }

    setNotificaciones([])
    setAbiertas(false)
  }

  if (!usuarioId) return null

  return (
    <>
      {notificaciones.length > 0 && (
        <button
          type="button"
          className="ordely-notification-trigger"
          onClick={() => { setErrorAccion(''); setAbiertas(true) }}
          aria-label={`${notificaciones.length} ${notificaciones.length === 1 ? 'notificación pendiente' : 'notificaciones pendientes'}`}
        >
          <span className="ordely-notification-badge">
            {notificaciones.length > 9 ? '9+' : notificaciones.length}
          </span>
          <span className="ordely-notification-bell"><BellIcon /></span>
        </button>
      )}

      <Modal
        abierto={abiertas && notificaciones.length > 0}
        titulo="Tus notificaciones"
        onClose={() => setAbiertas(false)}
        className="ordely-notifications-modal"
      >
        <div className="ordely-notifications-content">
          <div className="ordely-notifications-heading">
            <div className="ordely-notifications-heading-icon"><BellIcon /></div>
            <div>
              <span>Mensajes pendientes</span>
              <strong>{notificaciones.length === 1 ? 'Tienes una notificación' : `Tienes ${notificaciones.length} notificaciones`}</strong>
            </div>
          </div>

          <div className="ordely-notifications-list">
            {notificaciones.map((notificacion) => (
              <article key={notificacion.id}>
                <div>
                  <span>{formatearFechaNotificacion(notificacion.creado_en)}</span>
                  <strong>{notificacion.titulo || 'Mensaje de Ordely'}</strong>
                  <p>{notificacion.mensaje}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-light-bordered"
                  onClick={() => marcarLeida(notificacion.id)}
                  disabled={procesando}
                >
                  Marcar como leída
                </button>
              </article>
            ))}
          </div>

          {errorAccion && <p className="ordely-notifications-error">{errorAccion}</p>}

          <div className="ordely-notifications-actions">
            <button type="button" className="btn btn-light-bordered" onClick={() => setAbiertas(false)} disabled={procesando}>
              Cerrar
            </button>
            {notificaciones.length > 1 && (
              <button type="button" className="btn btn-primary" onClick={marcarTodasLeidas} disabled={procesando}>
                {procesando ? 'Guardando...' : 'Marcar todas como leídas'}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
