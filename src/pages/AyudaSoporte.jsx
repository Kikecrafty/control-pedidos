import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import PageHelp from '../components/PageHelp'
import Toast from '../components/Toast'
import { supabase } from '../supabaseClient'

const TIPOS_COMENTARIO = [
  { value: 'Sugerencia', label: 'Sugerencia' },
  { value: 'Problema técnico', label: 'Problema técnico' },
  { value: 'Pregunta', label: 'Pregunta' },
  { value: 'Opinión', label: 'Opinión' },
  { value: 'Solicitud de función', label: 'Solicitud de función' }
]

const PREGUNTAS_FRECUENTES = [
  {
    pregunta: '¿Cómo registro una compra en plataforma?',
    respuesta: 'Primero crea el pedido. Después entra a Compras, elige la plataforma, selecciona los productos que vas a pedir juntos y confirma la compra con el monto real pagado.'
  },
  {
    pregunta: '¿Cómo marco que un producto ya llegó?',
    respuesta: 'Abre el pedido, entra a Productos y usa la acción para marcarlo como recibido. Desde Inicio también puedes abrir directamente los productos que posiblemente ya llegaron.'
  },
  {
    pregunta: '¿Cómo comparto el seguimiento con mi cliente?',
    respuesta: 'Abre el pedido, entra a Seguimiento y copia o envía el enlace privado. El cliente podrá consultar el avance sin iniciar sesión.'
  },
  {
    pregunta: '¿Cómo registro un anticipo o un pago?',
    respuesta: 'Puedes registrar el anticipo al crear el pedido. Los pagos posteriores se agregan desde la sección Pagos del detalle, indicando monto, método y fecha.'
  },
  {
    pregunta: '¿Por qué un pedido aparece en “Por comprar”?',
    respuesta: 'Porque todavía tiene al menos un producto que no se ha registrado en una compra. Entra a Compras y confirma la compra para moverlo a “Ya comprados”.'
  },
  {
    pregunta: '¿Qué hago si no necesito realizar ninguna acción?',
    respuesta: 'Puedes conservar los pedidos terminados como historial. Ordely solo requiere cambios cuando exista una compra, pago, llegada, entrega, devolución o cancelación pendiente.'
  }
]

const ESTADO_TEXTO = {
  Nuevo: 'Nuevo',
  'En revisión': 'En revisión',
  Respondido: 'Respondido',
  Resuelto: 'Resuelto',
  Descartado: 'Descartado'
}

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

const limpiarNumeroWhatsApp = (valor) => String(valor || '').replace(/\D/g, '')

export default function AyudaSoporte() {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [comentarios, setComentarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [faqAbierta, setFaqAbierta] = useState(0)
  const [toast, setToast] = useState(null)
  const [errorConfiguracion, setErrorConfiguracion] = useState('')
  const [formulario, setFormulario] = useState({
    tipo: 'Sugerencia',
    asunto: '',
    mensaje: '',
    calificacion: ''
  })

  const numeroSoporte = useMemo(
    () => limpiarNumeroWhatsApp(import.meta.env.VITE_SUPPORT_WHATSAPP),
    []
  )

  const version = import.meta.env.VITE_APP_VERSION || '1.0.0'

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setErrorConfiguracion('')

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user || null
    setUsuario(user)

    if (!user) {
      setCargando(false)
      return
    }

    const [{ data: perfilData }, { data: comentariosData, error: comentariosError }] = await Promise.all([
      supabase
        .from('perfiles')
        .select('user_id, nombre, correo')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('comentarios_soporte')
        .select('id, tipo, asunto, mensaje, calificacion, estado, creado_en')
        .eq('user_id', user.id)
        .order('creado_en', { ascending: false })
        .limit(8)
    ])

    setPerfil(perfilData || null)

    if (comentariosError) {
      console.log(comentariosError)
      if (comentariosError.code === '42P01' || comentariosError.code === 'PGRST205') {
        setErrorConfiguracion('Falta ejecutar el SQL de soporte en Supabase.')
      } else {
        setErrorConfiguracion('No se pudo cargar tu historial de comentarios.')
      }
      setComentarios([])
    } else {
      setComentarios(comentariosData || [])
    }

    setCargando(false)
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const abrirWhatsApp = () => {
    if (!numeroSoporte) {
      setToast({ tipo: 'warning', mensaje: 'Configura el número de soporte para habilitar WhatsApp.' })
      return
    }

    const nombre = perfil?.nombre || usuario?.user_metadata?.nombre || 'Usuario de Ordely'
    const correo = perfil?.correo || usuario?.email || 'Sin correo'
    const pagina = typeof window !== 'undefined' ? window.location.pathname : '/ayuda-soporte'
    const mensaje = encodeURIComponent(
      `Hola, necesito ayuda con Ordely.\n\n` +
      `Nombre: ${nombre}\n` +
      `Correo: ${correo}\n` +
      `Página: ${pagina}\n\n` +
      'Describe aquí el problema:'
    )

    window.open(`https://wa.me/${numeroSoporte}?text=${mensaje}`, '_blank', 'noopener,noreferrer')
  }

  const enviarComentario = async (event) => {
    event.preventDefault()

    if (enviando || !usuario) return

    const asunto = formulario.asunto.trim()
    const mensaje = formulario.mensaje.trim()

    if (asunto.length < 4) {
      setToast({ tipo: 'warning', mensaje: 'Escribe un asunto de al menos 4 caracteres.' })
      return
    }

    if (mensaje.length < 10) {
      setToast({ tipo: 'warning', mensaje: 'Describe tu comentario con al menos 10 caracteres.' })
      return
    }

    const ultimoEnvio = Number(localStorage.getItem('ordely_ultimo_comentario_soporte') || 0)
    if (Date.now() - ultimoEnvio < 30000) {
      setToast({ tipo: 'warning', mensaje: 'Espera unos segundos antes de enviar otro comentario.' })
      return
    }

    setEnviando(true)

    const nombre = perfil?.nombre || usuario.user_metadata?.nombre || 'Usuario'
    const correo = perfil?.correo || usuario.email || ''
    const pagina = typeof window !== 'undefined' ? window.location.pathname : '/ayuda-soporte'
    const calificacion = formulario.calificacion ? Number(formulario.calificacion) : null

    const { error } = await supabase
      .from('comentarios_soporte')
      .insert({
        user_id: usuario.id,
        nombre,
        correo,
        tipo: formulario.tipo,
        asunto,
        mensaje,
        pagina,
        calificacion
      })

    setEnviando(false)

    if (error) {
      console.log(error)
      if (error.code === '42P01' || error.code === 'PGRST205') {
        setErrorConfiguracion('Falta ejecutar el SQL de soporte en Supabase.')
        setToast({ tipo: 'error', mensaje: 'Primero ejecuta el SQL de soporte en Supabase.' })
      } else {
        setToast({ tipo: 'error', mensaje: 'No se pudo enviar el comentario. Intenta nuevamente.' })
      }
      return
    }

    localStorage.setItem('ordely_ultimo_comentario_soporte', String(Date.now()))
    setFormulario({ tipo: 'Sugerencia', asunto: '', mensaje: '', calificacion: '' })
    setToast({ tipo: 'success', mensaje: 'Tu comentario se envió correctamente.' })
    cargarDatos()
  }

  return (
    <Layout>
      <div className="support-page">
        <PageHelp page="soporte" />

        <header className="support-hero">
          <div>
            <span className="support-eyebrow">AYUDA Y SOPORTE</span>
            <h1>¿En qué podemos ayudarte?</h1>
            <p>Resuelve dudas, contacta a soporte o comparte ideas para mejorar Ordely.</p>
          </div>
          <div className="support-version-chip">Versión {version}</div>
        </header>

        <section className="support-action-grid">
          <article className="support-action-card support-action-whatsapp">
            <span className="support-action-icon" aria-hidden="true">↗</span>
            <div>
              <small>SOPORTE DIRECTO</small>
              <h2>Hablar por WhatsApp</h2>
              <p>Para problemas urgentes, fallas o dudas que necesiten una respuesta directa.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={abrirWhatsApp}>
              Contactar a soporte
            </button>
            {!numeroSoporte && (
              <small className="support-config-note">Falta configurar VITE_SUPPORT_WHATSAPP.</small>
            )}
          </article>

          <article className="support-action-card support-action-about">
            <span className="support-action-icon" aria-hidden="true">i</span>
            <div>
              <small>ACERCA DE ORDELY</small>
              <h2>Pedidos claros, ventas en orden.</h2>
              <p>Ordely ayuda a organizar pedidos por encargo, clientes, pagos, compras, llegadas, entregas y seguimiento.</p>
            </div>
            <div className="support-about-meta">
              <span>Diseñada para ventas por encargo</span>
              <span>Acceso desde celular y computadora</span>
              <span>Información privada por cuenta</span>
            </div>
          </article>
        </section>

        <section className="support-content-grid">
          <div className="support-faq-card">
            <div className="support-section-heading">
              <span>PREGUNTAS FRECUENTES</span>
              <h2>Resuelve lo más común</h2>
              <p>Abre una pregunta para ver la explicación.</p>
            </div>

            <div className="support-faq-list">
              {PREGUNTAS_FRECUENTES.map((item, index) => {
                const abierta = faqAbierta === index
                return (
                  <article className={`support-faq-item${abierta ? ' active' : ''}`} key={item.pregunta}>
                    <button
                      type="button"
                      onClick={() => setFaqAbierta(abierta ? -1 : index)}
                      aria-expanded={abierta}
                    >
                      <span>{item.pregunta}</span>
                      <b aria-hidden="true">{abierta ? '−' : '+'}</b>
                    </button>
                    {abierta && <p>{item.respuesta}</p>}
                  </article>
                )
              })}
            </div>
          </div>

          <div className="support-feedback-card">
            <div className="support-section-heading">
              <span>COMENTARIOS</span>
              <h2>Ayúdanos a mejorar</h2>
              <p>Envía una sugerencia, opinión o reporte. Podrás consultar su estado aquí.</p>
            </div>

            {errorConfiguracion && (
              <div className="support-setup-warning">
                <strong>Configuración pendiente</strong>
                <p>{errorConfiguracion}</p>
              </div>
            )}

            <form className="support-feedback-form" onSubmit={enviarComentario}>
              <div className="form-field">
                <label>Tipo de comentario</label>
                <select
                  value={formulario.tipo}
                  onChange={(event) => setFormulario((actual) => ({ ...actual, tipo: event.target.value }))}
                >
                  {TIPOS_COMENTARIO.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Asunto</label>
                <input
                  value={formulario.asunto}
                  onChange={(event) => setFormulario((actual) => ({ ...actual, asunto: event.target.value.slice(0, 120) }))}
                  placeholder="Ej. Mejorar el seguimiento de pedidos"
                  maxLength="120"
                />
                <small>{formulario.asunto.length}/120</small>
              </div>

              <div className="form-field support-message-field">
                <label>Mensaje</label>
                <textarea
                  value={formulario.mensaje}
                  onChange={(event) => setFormulario((actual) => ({ ...actual, mensaje: event.target.value.slice(0, 2000) }))}
                  placeholder="Describe tu idea, duda o problema con el mayor detalle posible."
                  rows="6"
                  maxLength="2000"
                />
                <small>{formulario.mensaje.length}/2000</small>
              </div>

              <div className="form-field">
                <label>Calificación opcional</label>
                <select
                  value={formulario.calificacion}
                  onChange={(event) => setFormulario((actual) => ({ ...actual, calificacion: event.target.value }))}
                >
                  <option value="">Sin calificación</option>
                  <option value="5">5 — Excelente</option>
                  <option value="4">4 — Muy buena</option>
                  <option value="3">3 — Buena</option>
                  <option value="2">2 — Puede mejorar</option>
                  <option value="1">1 — Necesita atención</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary support-submit" disabled={enviando || Boolean(errorConfiguracion)}>
                {enviando ? 'Enviando...' : 'Enviar comentario'}
              </button>
            </form>
          </div>
        </section>

        <section className="support-history-card">
          <div className="support-section-heading support-section-heading-row">
            <div>
              <span>MIS ENVÍOS</span>
              <h2>Comentarios recientes</h2>
              <p>Consulta si tu comentario es nuevo, está en revisión o ya fue resuelto.</p>
            </div>
            <button type="button" className="btn btn-light-bordered btn-small" onClick={cargarDatos} disabled={cargando}>
              {cargando ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>

          <div className="support-history-list">
            {comentarios.map((comentario) => (
              <article className="support-history-item" key={comentario.id}>
                <div>
                  <span className={`support-status support-status-${String(comentario.estado || 'Nuevo').toLowerCase().replaceAll(' ', '-')}`}>
                    {ESTADO_TEXTO[comentario.estado] || comentario.estado || 'Nuevo'}
                  </span>
                  <small>{comentario.tipo} · {formatearFecha(comentario.creado_en)}</small>
                </div>
                <h3>{comentario.asunto}</h3>
                <p>{comentario.mensaje}</p>
                {comentario.calificacion && <b>Calificación: {comentario.calificacion}/5</b>}
              </article>
            ))}

            {!cargando && comentarios.length === 0 && !errorConfiguracion && (
              <div className="support-history-empty">
                <strong>Todavía no has enviado comentarios.</strong>
                <p>Cuando envíes uno, aparecerá aquí con su estado.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {toast && (
        <Toast
          mensaje={toast.mensaje}
          tipo={toast.tipo}
          onClose={() => setToast(null)}
        />
      )}
    </Layout>
  )
}
