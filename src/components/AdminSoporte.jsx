import { useCallback, useEffect, useMemo, useState } from 'react'
import EmptyState from './EmptyState'
import Modal from './Modal'
import Toast from './Toast'
import { supabase } from '../supabaseClient'

const ESTADOS = ['Nuevo', 'En revisión', 'Respondido', 'Resuelto', 'Descartado']
const PRIORIDADES = ['Baja', 'Normal', 'Alta', 'Urgente']

const formatearFecha = (valor) => {
  if (!valor) return '-'
  return new Date(valor).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const normalizarClase = (valor) => String(valor || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replaceAll(' ', '-')

export default function AdminSoporte() {
  const [comentarios, setComentarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('Todos')
  const [tipoFiltro, setTipoFiltro] = useState('Todos')
  const [seleccionado, setSeleccionado] = useState(null)
  const [estadoEdicion, setEstadoEdicion] = useState('Nuevo')
  const [prioridadEdicion, setPrioridadEdicion] = useState('Normal')
  const [notasEdicion, setNotasEdicion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState(null)

  const cargarComentarios = useCallback(async () => {
    setCargando(true)
    setErrorCarga('')

    const { data, error } = await supabase
      .from('comentarios_soporte')
      .select('*')
      .order('creado_en', { ascending: false })

    if (error) {
      console.log(error)
      if (error.code === '42P01' || error.code === 'PGRST205') {
        setErrorCarga('Falta ejecutar el SQL de soporte en Supabase.')
      } else {
        setErrorCarga('No se pudieron cargar los comentarios de soporte.')
      }
      setComentarios([])
    } else {
      setComentarios(data || [])
    }

    setCargando(false)
  }, [])

  useEffect(() => {
    cargarComentarios()
  }, [cargarComentarios])

  const tipos = useMemo(() => {
    return Array.from(new Set(comentarios.map((comentario) => comentario.tipo).filter(Boolean))).sort()
  }, [comentarios])

  const resumen = useMemo(() => ({
    total: comentarios.length,
    nuevos: comentarios.filter((item) => item.estado === 'Nuevo').length,
    revision: comentarios.filter((item) => item.estado === 'En revisión').length,
    urgentes: comentarios.filter((item) => item.prioridad === 'Urgente').length,
    resueltos: comentarios.filter((item) => item.estado === 'Resuelto').length
  }), [comentarios])

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return comentarios.filter((comentario) => {
      const coincideTexto = !texto || [
        comentario.nombre,
        comentario.correo,
        comentario.asunto,
        comentario.mensaje,
        comentario.tipo
      ].some((valor) => String(valor || '').toLowerCase().includes(texto))

      const coincideEstado = estadoFiltro === 'Todos' || comentario.estado === estadoFiltro
      const coincideTipo = tipoFiltro === 'Todos' || comentario.tipo === tipoFiltro

      return coincideTexto && coincideEstado && coincideTipo
    })
  }, [comentarios, busqueda, estadoFiltro, tipoFiltro])

  const abrirComentario = (comentario) => {
    setSeleccionado(comentario)
    setEstadoEdicion(comentario.estado || 'Nuevo')
    setPrioridadEdicion(comentario.prioridad || 'Normal')
    setNotasEdicion(comentario.notas_admin || '')
  }

  const cerrarComentario = () => {
    if (guardando) return
    setSeleccionado(null)
  }

  const guardarComentario = async () => {
    if (!seleccionado || guardando) return

    setGuardando(true)
    const ahora = new Date().toISOString()
    const payload = {
      estado: estadoEdicion,
      prioridad: prioridadEdicion,
      notas_admin: notasEdicion.trim() || null,
      actualizado_en: ahora,
      resuelto_en: estadoEdicion === 'Resuelto' ? (seleccionado.resuelto_en || ahora) : null
    }

    const { data, error } = await supabase
      .from('comentarios_soporte')
      .update(payload)
      .eq('id', seleccionado.id)
      .select('*')
      .single()

    setGuardando(false)

    if (error) {
      console.log(error)
      setToast({ tipo: 'error', mensaje: 'No se pudo actualizar el comentario.' })
      return
    }

    setComentarios((actuales) => actuales.map((item) => item.id === data.id ? data : item))
    setSeleccionado(data)
    setToast({ tipo: 'success', mensaje: 'Comentario actualizado correctamente.' })
  }

  const abrirCorreo = () => {
    if (!seleccionado?.correo) return
    const asunto = encodeURIComponent(`Respuesta de Ordely: ${seleccionado.asunto}`)
    window.location.href = `mailto:${seleccionado.correo}?subject=${asunto}`
  }

  return (
    <div className="admin-support-section">
      <div className="admin-support-summary">
        <article><span>Total</span><strong>{resumen.total}</strong></article>
        <article><span>Nuevos</span><strong>{resumen.nuevos}</strong></article>
        <article><span>En revisión</span><strong>{resumen.revision}</strong></article>
        <article><span>Urgentes</span><strong>{resumen.urgentes}</strong></article>
        <article><span>Resueltos</span><strong>{resumen.resueltos}</strong></article>
      </div>

      <div className="table-card admin-support-card">
        <div className="table-title row-between admin-support-title">
          <div>
            <h2>Soporte y comentarios</h2>
            <p className="muted">Sugerencias, opiniones, preguntas y reportes enviados desde Ordely.</p>
          </div>
          <button type="button" className="btn btn-light-bordered" onClick={cargarComentarios} disabled={cargando}>
            {cargando ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {errorCarga && (
          <div className="admin-support-error">
            <strong>Configuración pendiente</strong>
            <p>{errorCarga}</p>
          </div>
        )}

        <div className="admin-support-filters">
          <div className="form-field">
            <label>Buscar</label>
            <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Usuario, asunto o mensaje" />
          </div>
          <div className="form-field">
            <label>Estado</label>
            <select value={estadoFiltro} onChange={(event) => setEstadoFiltro(event.target.value)}>
              <option>Todos</option>
              {ESTADOS.map((estado) => <option key={estado}>{estado}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Tipo</label>
            <select value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value)}>
              <option>Todos</option>
              {tipos.map((tipo) => <option key={tipo}>{tipo}</option>)}
            </select>
          </div>
        </div>

        <div className="admin-support-list">
          {filtrados.map((comentario) => (
            <button type="button" className="admin-support-item" key={comentario.id} onClick={() => abrirComentario(comentario)}>
              <div className="admin-support-item-top">
                <div>
                  <strong>{comentario.asunto}</strong>
                  <span>{comentario.nombre || 'Usuario'} · {comentario.correo || 'Sin correo'}</span>
                </div>
                <div className="admin-support-item-badges">
                  <span className={`support-status support-status-${normalizarClase(comentario.estado || 'Nuevo')}`}>
                    {comentario.estado || 'Nuevo'}
                  </span>
                  <span className={`admin-support-priority priority-${normalizarClase(comentario.prioridad || 'Normal')}`}>
                    {comentario.prioridad || 'Normal'}
                  </span>
                </div>
              </div>
              <p>{comentario.mensaje}</p>
              <div className="admin-support-item-meta">
                <span>{comentario.tipo}</span>
                <span>{formatearFecha(comentario.creado_en)}</span>
                {comentario.calificacion && <span>{comentario.calificacion}/5</span>}
              </div>
            </button>
          ))}

          {!cargando && !errorCarga && filtrados.length === 0 && (
            <EmptyState
              icon="search"
              eyebrow="Sin resultados"
              title="No hay comentarios con esos filtros."
              description="Cambia la búsqueda, el estado o el tipo para ver otros envíos."
              compact
            />
          )}
        </div>
      </div>

      <Modal abierto={Boolean(seleccionado)} titulo="Detalle del comentario" onClose={cerrarComentario} className="admin-support-modal">
        {seleccionado && (
          <div className="admin-support-modal-content">
            <div className="admin-support-detail-head">
              <div>
                <span>{seleccionado.tipo}</span>
                <h3>{seleccionado.asunto}</h3>
                <p>{seleccionado.nombre || 'Usuario'} · {seleccionado.correo || 'Sin correo'}</p>
              </div>
              <span className={`support-status support-status-${normalizarClase(seleccionado.estado || 'Nuevo')}`}>
                {seleccionado.estado || 'Nuevo'}
              </span>
            </div>

            <div className="admin-support-message">
              <strong>Mensaje</strong>
              <p>{seleccionado.mensaje}</p>
            </div>

            <div className="admin-support-detail-grid">
              <div><span>Fecha</span><strong>{formatearFecha(seleccionado.creado_en)}</strong></div>
              <div><span>Página</span><strong>{seleccionado.pagina || '-'}</strong></div>
              <div><span>Calificación</span><strong>{seleccionado.calificacion ? `${seleccionado.calificacion}/5` : 'Sin calificación'}</strong></div>
              <div><span>Resuelto</span><strong>{seleccionado.resuelto_en ? formatearFecha(seleccionado.resuelto_en) : 'No'}</strong></div>
            </div>

            <div className="admin-support-edit-grid">
              <div className="form-field">
                <label>Estado</label>
                <select value={estadoEdicion} onChange={(event) => setEstadoEdicion(event.target.value)}>
                  {ESTADOS.map((estado) => <option key={estado}>{estado}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Prioridad</label>
                <select value={prioridadEdicion} onChange={(event) => setPrioridadEdicion(event.target.value)}>
                  {PRIORIDADES.map((prioridad) => <option key={prioridad}>{prioridad}</option>)}
                </select>
              </div>
            </div>

            <div className="form-field">
              <label>Notas internas</label>
              <textarea
                value={notasEdicion}
                onChange={(event) => setNotasEdicion(event.target.value.slice(0, 2000))}
                rows="4"
                maxLength="2000"
                placeholder="Seguimiento, decisión o respuesta enviada..."
              />
            </div>

            <div className="modal-actions modal-actions-wrap">
              <button type="button" className="btn btn-light-bordered" onClick={abrirCorreo} disabled={!seleccionado.correo}>
                Responder por correo
              </button>
              <button type="button" className="btn btn-primary" onClick={guardarComentario} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
