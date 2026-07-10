import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import { cargarEstadoPlan, estaBloqueadoPorPlan, puedeCrearPedido } from '../lib/planes'

const obtenerIdUsuarioCache = () => {
  if (typeof window === 'undefined') return 'sin_usuario'

  try {
    const llaves = Object.keys(localStorage)
    const llaveAuth = llaves.find((llave) => llave.startsWith('sb-') && llave.endsWith('-auth-token'))

    if (llaveAuth) {
      const valor = JSON.parse(localStorage.getItem(llaveAuth) || '{}')
      const userId = valor?.user?.id || valor?.currentSession?.user?.id
      if (userId) return userId
    }
  } catch (error) {
    console.log(error)
  }

  return localStorage.getItem('control_pedidos_usuario_cache') || 'sin_usuario'
}

const cacheKeyPedidos = () => `control_pedidos_pedidos_cache_${obtenerIdUsuarioCache()}`

const leerPedidosCache = () => {
  if (typeof window === 'undefined') return []

  try {
    const guardado = localStorage.getItem(cacheKeyPedidos())
    return guardado ? JSON.parse(guardado)?.pedidos || [] : []
  } catch (error) {
    console.log(error)
    return []
  }
}

const guardarPedidosCache = (pedidos) => {
  if (typeof window === 'undefined') return

  try {
    const userId = obtenerIdUsuarioCache()
    localStorage.setItem('control_pedidos_usuario_cache', userId)
    localStorage.setItem(
      cacheKeyPedidos(),
      JSON.stringify({
        pedidos,
        guardado_en: new Date().toISOString()
      })
    )
  } catch (error) {
    console.log(error)
  }
}


export default function Pedidos() {
  const [pedidos, setPedidos] = useState(() => leerPedidosCache())
  const [estadoPlan, setEstadoPlan] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroPlataforma, setFiltroPlataforma] = useState('Todas')
  const [toast, setToast] = useState(null)
  const accionEnProcesoRef = useRef(false)
  const [accionEnProceso, setAccionEnProceso] = useState('')

  const iniciarAccion = (mensaje = 'Procesando...') => {
    if (accionEnProcesoRef.current) return false
    accionEnProcesoRef.current = true
    setAccionEnProceso(mensaje)
    return true
  }

  const finalizarAccion = () => {
    accionEnProcesoRef.current = false
    setAccionEnProceso('')
  }

  const estaProcesando = Boolean(accionEnProceso)

  const [modalMensaje, setModalMensaje] = useState(false)
  const [pedidoMensaje, setPedidoMensaje] = useState(null)
  const [modalFiltros, setModalFiltros] = useState(false)

  useEffect(() => {
    cargarPedidos()
    cargarPlan()
  }, [])

  const plataformas = [
    'SHEIN',
    'Temu',
    'AliExpress',
    'Catálogo',
    'Otro'
  ]

  const estadosPedido = [
    'Cotizado',
    'Comprado en plataforma',
    'En camino',
    'Recibido',
    'Entregado',
    'Cancelado',
    'Devuelto'
  ]

  const mostrarToast = (mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo })
  }

  const cargarPlan = async () => {
    const estado = await cargarEstadoPlan()
    setEstadoPlan(estado)
  }

  const bloqueado = estaBloqueadoPorPlan(estadoPlan)

  const bloquearSiNoPuede = () => {
    if (!bloqueado) return false
    mostrarToast('Tu Plan Básico llegó al límite. Actualiza a Premium para modificar información.', 'error')
    return true
  }

  const normalizarEstado = (estado) => {
    if (estado === 'Comprado en SHEIN') return 'Comprado en plataforma'
    if (estado === 'Pendiente de pago') return 'Cotizado'
    if (estado === 'Pagado por cliente') return 'Cotizado'
    return estado || 'Cotizado'
  }

  const estadoClase = (estado) => {
    const estadoNormal = normalizarEstado(estado)

    if (estadoNormal === 'Cotizado') return 'badge-gray'
    if (estadoNormal === 'Comprado en plataforma') return 'badge-dark'
    if (estadoNormal === 'En camino') return 'badge-purple'
    if (estadoNormal === 'Recibido') return 'badge-green-soft'
    if (estadoNormal === 'Entregado') return 'badge-green-strong'
    if (estadoNormal === 'Cancelado') return 'badge-red-soft'
    if (estadoNormal === 'Devuelto') return 'badge-red-strong'

    return 'badge-gray'
  }

  const esEstadoReembolso = (estado) => {
    const estadoNormal = normalizarEstado(estado)
    return estadoNormal === 'Cancelado' || estadoNormal === 'Devuelto'
  }

  const estaPagadoPorCliente = (pedido) => {
    return (
      Number(pedido?.total_cliente || 0) > 0 &&
      Number(pedido?.restante || 0) <= 0 &&
      !['Cancelado', 'Devuelto'].includes(normalizarEstado(pedido?.estado))
    )
  }

  const obtenerEstadoPago = (pedido) => {
    if (esEstadoReembolso(pedido?.estado)) {
      return { tipo: 'refund', texto: 'Reembolso' }
    }

    const total = Number(pedido?.total_cliente || 0)
    const pagado = Number(pedido?.anticipo || 0)
    const restante = Number(pedido?.restante || 0)

    if (total > 0 && (restante <= 0 || pagado >= total)) {
      return { tipo: 'paid', texto: 'Pagado por cliente' }
    }

    if (pagado > 0) {
      return { tipo: 'partial', texto: 'Pagado parcialmente' }
    }

    return { tipo: 'pending', texto: 'Pendiente' }
  }

  const renderPagoBadge = (pedido, compacto = false) => {
    const estadoPago = obtenerEstadoPago(pedido)

    if (estadoPago.tipo === 'refund') {
      return (
        <span className={compacto ? 'refund-status-badge refund-status-badge-small' : 'refund-status-badge'}>
          Reembolso
        </span>
      )
    }

    return (
      <span className={`payment-status-badge payment-status-${estadoPago.tipo} ${compacto ? 'payment-status-badge-small' : ''}`}>
        <i /> {estadoPago.texto}
      </span>
    )
  }

  const obtenerBasePublica = () => {
    const configurada = import.meta.env.VITE_PUBLIC_APP_URL

    if (configurada) {
      return configurada.replace(/\/$/, '')
    }

    if (typeof window === 'undefined') return ''

    const origin = window.location.origin

    if (origin.includes('localhost')) {
      return 'https://control-pedidos.pages.dev'
    }

    return origin
  }

  const cargarPedidos = async () => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, telefono)')
      .order('creado_en', { ascending: false })

    if (error) {
      console.log(error)
      mostrarToast('Error al cargar pedidos', 'error')
      return
    }

    const pedidosFinal = data || []
    setPedidos(pedidosFinal)
    guardarPedidosCache(pedidosFinal)
  }

  const limpiarTelefono = (telefono) => {
    return String(telefono || '').replace(/\D/g, '')
  }

  const obtenerTelefonoWhatsApp = (telefono) => {
    const limpio = limpiarTelefono(telefono)

    if (!limpio) return ''
    if (limpio.startsWith('52') && limpio.length > 10) return limpio

    return `52${limpio}`
  }

  const formatearDinero = (valor) => {
    return `$${Number(valor || 0).toFixed(2)}`
  }

  const obtenerUrlSeguimiento = (pedido) => {
    if (!pedido?.public_token) return ''
    return `${obtenerBasePublica()}/seguimiento/${pedido.public_token}`
  }

  const generarMensajeEstado = (pedido) => {
    const nombre = pedido?.clientes?.nombre || 'cliente'
    const codigo = pedido?.codigo || ''
    const plataforma = pedido?.plataforma || 'SHEIN'
    const estado = normalizarEstado(pedido?.estado)
    const total = formatearDinero(pedido?.total_cliente)
    const pagado = formatearDinero(pedido?.anticipo)
    const restante = formatearDinero(pedido?.restante)
    const tracking = pedido?.tracking || ''
    const url = obtenerUrlSeguimiento(pedido)
    const lineaSeguimiento = url ? `\n\nPuedes revisar el seguimiento aquí:\n${url}` : ''

    if (estado === 'Cotizado') {
      return `Hola ${nombre}, tu pedido ${codigo} ya fue cotizado.\n\nPlataforma: ${plataforma}\nTotal: ${total}\nRestante: ${restante}${lineaSeguimiento}`
    }


    if (estado === 'Comprado en plataforma') {
      return `Hola ${nombre}, tu pedido ${codigo} ya fue comprado en plataforma.\n\nPlataforma: ${plataforma}${lineaSeguimiento}`
    }

    if (estado === 'En camino') {
      return `Hola ${nombre}, tu pedido ${codigo} ya está en camino.\n\nPlataforma: ${plataforma}${tracking ? `\nGuía / tracking: ${tracking}` : ''}${lineaSeguimiento}`
    }

    if (estado === 'Recibido') {
      return `Hola ${nombre}, tu pedido ${codigo} ya fue recibido.\n\nTotal: ${total}\nPagado: ${pagado}\nRestante pendiente: ${restante}${lineaSeguimiento}`
    }

    if (estado === 'Entregado') {
      return `Hola ${nombre}, tu pedido ${codigo} ya fue entregado.\n\nGracias por tu compra.${lineaSeguimiento}`
    }

    if (estado === 'Cancelado') {
      return `Hola ${nombre}, te aviso que el pedido ${codigo} fue marcado como cancelado.\n\nCualquier duda quedo al pendiente.${lineaSeguimiento}`
    }

    if (estado === 'Devuelto') {
      return `Hola ${nombre}, te aviso que el pedido ${codigo} fue marcado como devuelto.\n\nCualquier duda quedo al pendiente.${lineaSeguimiento}`
    }

    return `Hola ${nombre}, tu pedido ${codigo} cambió de estado.\n\nEstado actual: ${estado}${lineaSeguimiento}`
  }

  const cambiarEstado = async (pedido, estado) => {
    if (bloquearSiNoPuede()) return
    if (!iniciarAccion('Actualizando estado...')) return

    try {
      const estadoAnterior = normalizarEstado(pedido.estado)
      const estadoNuevo = normalizarEstado(estado)

      if (estadoAnterior === estadoNuevo) return

      const { data: pedidoActual } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedido.id)
        .single()

      const payload = {
        estado: estadoNuevo,
        reembolso: false,
        reembolso_monto: 0
      }

      const montoRestante = Math.max(Number(pedidoActual?.restante || pedido.restante || 0), 0)

      if (estadoNuevo === 'Entregado' && montoRestante > 0) {
        const confirmar = confirm(`Este pedido todavía tiene ${formatearDinero(montoRestante)} pendiente. ¿Confirmas que el cliente pagó el restante al entregar?`)
        if (!confirmar) return

        const etiquetaPago = `[entrega-pedido:${pedido.id}]`
        const { data: pagoExistente } = await supabase
          .from('pagos')
          .select('id')
          .eq('pedido_id', pedido.id)
          .ilike('notas', `%${etiquetaPago}%`)
          .limit(1)

        if (!pagoExistente?.length) {
          const { error: errorPago } = await supabase
            .from('pagos')
            .insert([
              {
                pedido_id: pedido.id,
                monto: montoRestante,
                metodo_pago: 'Entrega',
                notas: `Pago restante al entregar pedido ${etiquetaPago}`,
                tipo: 'pago'
              }
            ])

          if (errorPago) {
            console.log(errorPago)
            mostrarToast('No se pudo registrar el pago restante', 'error')
            return
          }
        }

        payload.anticipo = Number(pedidoActual?.anticipo || pedido.anticipo || 0) + montoRestante
        payload.restante = 0
      }

      if (estadoNuevo === 'Entregado') {
        const ahora = new Date().toISOString()
        await supabase
          .from('productos_pedido')
          .update({
            entregado: true,
            entregado_en: ahora,
            pagado_cliente: true,
            pagado_en: ahora
          })
          .eq('pedido_id', pedido.id)
      }

      if (esEstadoReembolso(estadoNuevo)) {
        payload.reembolso = true
        payload.reembolso_monto = Number(pedidoActual?.anticipo || pedido.anticipo || 0)
      }

      const { error } = await supabase
        .from('pedidos')
        .update(payload)
        .eq('id', pedido.id)

      if (error) {
        console.log(error)
        mostrarToast('Error al cambiar estado', 'error')
        return
      }

      const pedidoActualizado = {
        ...pedido,
        ...payload
      }

      setPedidos((actuales) =>
        actuales.map((item) =>
          item.id === pedido.id ? pedidoActualizado : item
        )
      )

      setPedidoMensaje(pedidoActualizado)
      setModalMensaje(true)
      mostrarToast(esEstadoReembolso(estadoNuevo) ? 'Pedido marcado como reembolso' : 'Estado actualizado correctamente')

      cargarPedidos()
    } finally {
      finalizarAccion()
    }
  }

  const enviarMensajeWhatsApp = () => {
    if (!pedidoMensaje) return

    const telefono = obtenerTelefonoWhatsApp(pedidoMensaje?.clientes?.telefono)

    if (!telefono) {
      mostrarToast('Este cliente no tiene teléfono', 'error')
      return
    }

    const mensaje = encodeURIComponent(generarMensajeEstado(pedidoMensaje))
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank')
  }

  const copiarMensaje = async () => {
    if (!pedidoMensaje) return

    try {
      await navigator.clipboard.writeText(generarMensajeEstado(pedidoMensaje))
      mostrarToast('Mensaje copiado correctamente')
    } catch (error) {
      console.log(error)
      mostrarToast('No se pudo copiar el mensaje', 'error')
    }
  }

  const eliminarPedido = async (id) => {
    if (bloquearSiNoPuede()) return

    const confirmar = confirm('¿Seguro que quieres eliminar este pedido?')
    if (!confirmar) return
    if (!iniciarAccion('Eliminando pedido...')) return

    try {
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', id)

      if (error) {
        console.log(error)
        mostrarToast('Error al eliminar pedido', 'error')
        return
      }

      const pedidosActualizados = pedidos.filter((pedido) => pedido.id !== id)
      setPedidos(pedidosActualizados)
      guardarPedidosCache(pedidosActualizados)

      mostrarToast('Pedido eliminado correctamente')
      cargarPedidos()
    } finally {
      finalizarAccion()
    }
  }

  const pedidosFiltrados = pedidos.filter((pedido) => {
    const texto = busqueda.toLowerCase()
    const estadoNormal = normalizarEstado(pedido.estado)
    const plataformaPedido = pedido.plataforma || 'SHEIN'
    const pagoTexto = obtenerEstadoPago(pedido).texto.toLowerCase()

    const coincideBusqueda =
      pedido.codigo?.toLowerCase().includes(texto) ||
      plataformaPedido.toLowerCase().includes(texto) ||
      pedido.clientes?.nombre?.toLowerCase().includes(texto) ||
      pedido.clientes?.telefono?.toLowerCase().includes(texto) ||
      estadoNormal?.toLowerCase().includes(texto) ||
      pagoTexto.includes(texto)

    const coincideEstado =
      filtroEstado === 'Todos' || estadoNormal === filtroEstado

    const coincidePlataforma =
      filtroPlataforma === 'Todas' || plataformaPedido === filtroPlataforma

    return coincideBusqueda && coincideEstado && coincidePlataforma
  })

  const filtrosActivos =
    busqueda.trim() !== '' ||
    filtroEstado !== 'Todos' ||
    filtroPlataforma !== 'Todas'

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroEstado('Todos')
    setFiltroPlataforma('Todas')
  }

  return (
    <Layout>
      <Toast
        mensaje={toast?.mensaje}
        tipo={toast?.tipo}
        onClose={() => setToast(null)}
      />

      <div className="page-header pedidos-page-header">
        <div className="pedidos-top-row">
          <div>
            <div className="pedidos-title-line">
              <h1>Pedidos</h1>

              {puedeCrearPedido(estadoPlan) ? (
                <Link to="/nuevo-pedido" className="btn btn-primary btn-new-order-small">
                  Nuevo pedido
                </Link>
              ) : (
                <Link to="/planes" className="btn btn-light-bordered btn-new-order-small">
                  Actualizar plan
                </Link>
              )}
            </div>

            <p>Lista de pedidos registrados</p>
          </div>

          <button
            type="button"
            className={`search-circle-btn ${filtrosActivos ? 'search-circle-btn-active' : ''}`}
            onClick={() => setModalFiltros(true)}
            aria-label="Buscar pedidos"
            title="Buscar pedidos"
          >
            🔍
          </button>
        </div>
      </div>

      <PlanLimitNotice estadoPlan={estadoPlan} compacto />

      {filtrosActivos && (
        <div className="active-filters-card">
          <div>
            <span>Filtros activos</span>
            <strong>
              {busqueda || 'Sin texto'} · {filtroPlataforma} · {filtroEstado}
            </strong>
          </div>

          <button type="button" onClick={limpiarFiltros}>
            Limpiar
          </button>
        </div>
      )}

      <Modal
        abierto={modalFiltros}
        titulo="Buscar pedidos"
        onClose={() => setModalFiltros(false)}
      >
        <div className="filters-modal-content">
          <div className="form-field">
            <label>Buscar pedido</label>
            <input
              placeholder="Código, cliente, teléfono o estado"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-field">
            <label>Plataforma</label>
            <select
              value={filtroPlataforma}
              onChange={(e) => setFiltroPlataforma(e.target.value)}
            >
              <option>Todas</option>
              {plataformas.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Estado del pedido</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option>Todos</option>
              {estadosPedido.map((estado) => (
                <option key={estado}>{estado}</option>
              ))}
            </select>
          </div>

          <div className="modal-actions modal-actions-wrap filters-modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModalFiltros(false)}
            >
              Aplicar búsqueda
            </button>

            <button
              type="button"
              className="btn btn-light-bordered"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </Modal>

      <div className="table-card desktop-table">
        <div className="row-between table-title">
          <h2>Pedidos encontrados: {pedidosFiltrados.length}</h2>
        </div>

        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Plataforma</th>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Pago</th>
              <th>Total cliente</th>
              <th>Anticipo</th>
              <th>Restante</th>
              <th>Ganancia</th>
              <th>Tracking</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {pedidosFiltrados.map((pedido) => (
              <tr key={pedido.id} className={esEstadoReembolso(pedido.estado) ? 'refund-censored-row' : ''}>
                <td>{pedido.codigo}</td>
                <td>{pedido.plataforma || 'SHEIN'}</td>
                <td>{pedido.clientes?.nombre || 'Sin cliente'}</td>
                <td>{pedido.clientes?.telefono || '-'}</td>
                <td>
                  <select
                    value={normalizarEstado(pedido.estado)}
                    onChange={(e) => cambiarEstado(pedido, e.target.value)}
                    disabled={bloqueado || estaProcesando}
                  >
                    {estadosPedido.map((estado) => (
                      <option key={estado}>{estado}</option>
                    ))}
                  </select>
                </td>
                <td>{renderPagoBadge(pedido, true)}</td>
                <td>${Number(pedido.total_cliente || 0).toFixed(2)}</td>
                <td>${Number(pedido.anticipo || 0).toFixed(2)}</td>
                <td>${Number(pedido.restante || 0).toFixed(2)}</td>
                <td>${Number(pedido.ganancia || 0).toFixed(2)}</td>
                <td>{pedido.tracking || '-'}</td>
                <td className="actions">
                  <Link
                    to={`/pedidos/${pedido.id}`}
                    className="btn btn-small"
                  >
                    Ver
                  </Link>

                  <button
                    onClick={() => eliminarPedido(pedido.id)}
                    className="btn btn-danger btn-small"
                    disabled={bloqueado || estaProcesando}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {pedidosFiltrados.length === 0 && (
              <tr>
                <td colSpan="12">No se encontraron pedidos.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-list">
        <div className="mobile-list-title">
          <h2>Pedidos encontrados: {pedidosFiltrados.length}</h2>
        </div>

        {pedidosFiltrados.map((pedido) => (
          <div className={`mobile-card ${esEstadoReembolso(pedido.estado) ? 'refund-censored-card' : ''}`} key={pedido.id}>
            <div className="mobile-card-header">
              <div>
                <h3>{pedido.codigo}</h3>
                <p>{pedido.plataforma || 'SHEIN'} · {pedido.clientes?.nombre || 'Sin cliente'}</p>
              </div>

              <div className="mobile-card-badges">
                <span className={`badge ${estadoClase(pedido.estado)}`}>
                  {normalizarEstado(pedido.estado)}
                </span>

                {renderPagoBadge(pedido, true)}
              </div>
            </div>

            <div className="mobile-card-info">
              <div>
                <span>Plataforma</span>
                <strong>{pedido.plataforma || 'SHEIN'}</strong>
              </div>

              <div>
                <span>Total</span>
                <strong>${Number(pedido.total_cliente || 0).toFixed(2)}</strong>
              </div>

              <div>
                <span>Pagado</span>
                <strong>${Number(pedido.anticipo || 0).toFixed(2)}</strong>
              </div>

              <div>
                <span>Restante</span>
                <strong>${Number(pedido.restante || 0).toFixed(2)}</strong>
              </div>

              <div>
                <span>Ganancia</span>
                <strong>${Number(pedido.ganancia || 0).toFixed(2)}</strong>
              </div>

              <div>
                <span>Tracking</span>
                <strong>{pedido.tracking || '-'}</strong>
              </div>
            </div>

            <div className="mobile-status-select">
              <label>Estado</label>
              <select
                value={normalizarEstado(pedido.estado)}
                onChange={(e) => cambiarEstado(pedido, e.target.value)}
                disabled={bloqueado || estaProcesando}
              >
                {estadosPedido.map((estado) => (
                  <option key={estado}>{estado}</option>
                ))}
              </select>
            </div>

            <div className="mobile-card-actions">
              <Link
                to={`/pedidos/${pedido.id}`}
                className="btn btn-primary"
              >
                Ver pedido
              </Link>

              {pedido.clientes?.telefono && (
                <a
                  href={`https://wa.me/${obtenerTelefonoWhatsApp(pedido.clientes.telefono)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-light-bordered"
                >
                  WhatsApp
                </a>
              )}

              <button
                onClick={() => eliminarPedido(pedido.id)}
                className="btn btn-danger"
                disabled={bloqueado || estaProcesando}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        {pedidosFiltrados.length === 0 && (
          <div className="empty-state">
            No se encontraron pedidos.
          </div>
        )}
      </div>

      <Modal
        abierto={modalMensaje}
        titulo="Estado actualizado"
        onClose={() => setModalMensaje(false)}
      >
        {pedidoMensaje && (
          <div className="state-message-modal">
            <div className="state-message-summary">
              <span>Pedido</span>
              <strong>{pedidoMensaje.codigo}</strong>
              <span className={`badge ${estadoClase(pedidoMensaje.estado)}`}>
                {normalizarEstado(pedidoMensaje.estado)}
              </span>
            </div>

            <p className="muted">
              El estado se guardó correctamente. Puedes enviar el mensaje sugerido al cliente por WhatsApp.
            </p>

            <div className="message-preview-box">
              <pre>{generarMensajeEstado(pedidoMensaje)}</pre>
            </div>

            <div className="modal-actions modal-actions-wrap">
              <button
                type="button"
                className="btn btn-primary"
                onClick={enviarMensajeWhatsApp}
              >
                Enviar WhatsApp
              </button>

              <button
                type="button"
                className="btn btn-light-bordered"
                onClick={copiarMensaje}
              >
                Copiar mensaje
              </button>

              <button
                type="button"
                className="btn btn-light-bordered"
                onClick={() => setModalMensaje(false)}
              >
                No enviar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
