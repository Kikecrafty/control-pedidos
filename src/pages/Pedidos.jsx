import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import { cargarEstadoPlan, estaBloqueadoPorPlan, puedeCrearPedido } from '../lib/planes'

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([])
  const [estadoPlan, setEstadoPlan] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroPlataforma, setFiltroPlataforma] = useState('Todas')
  const [toast, setToast] = useState(null)

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
    'Pendiente de pago',
    'Pagado por cliente',
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
    return estado || 'Cotizado'
  }

  const estadoClase = (estado) => {
    const estadoNormal = normalizarEstado(estado)

    if (estadoNormal === 'Cotizado') return 'badge-gray'
    if (estadoNormal === 'Pendiente de pago') return 'badge-yellow'
    if (estadoNormal === 'Pagado por cliente') return 'badge-blue'
    if (estadoNormal === 'Comprado en plataforma') return 'badge-dark'
    if (estadoNormal === 'En camino') return 'badge-purple'
    if (estadoNormal === 'Recibido') return 'badge-green-soft'
    if (estadoNormal === 'Entregado') return 'badge-green-strong'
    if (estadoNormal === 'Cancelado') return 'badge-red-soft'
    if (estadoNormal === 'Devuelto') return 'badge-red-strong'

    return 'badge-gray'
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

    setPedidos(data || [])
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
    return `${window.location.origin}/seguimiento/${pedido.public_token}`
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

    if (estado === 'Pendiente de pago') {
      return `Hola ${nombre}, tu pedido ${codigo} está pendiente de pago.\n\nTotal: ${total}\nPagado: ${pagado}\nRestante pendiente: ${restante}${lineaSeguimiento}`
    }

    if (estado === 'Pagado por cliente') {
      return `Hola ${nombre}, recibimos tu pago del pedido ${codigo}.\n\nPagado hasta ahora: ${pagado}\nRestante pendiente: ${restante}${lineaSeguimiento}`
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

    const estadoAnterior = normalizarEstado(pedido.estado)

    if (estadoAnterior === estado) return

    const { error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', pedido.id)

    if (error) {
      console.log(error)
      mostrarToast('Error al cambiar estado', 'error')
      return
    }

    const pedidoActualizado = {
      ...pedido,
      estado
    }

    setPedidos((actuales) =>
      actuales.map((item) =>
        item.id === pedido.id ? pedidoActualizado : item
      )
    )

    setPedidoMensaje(pedidoActualizado)
    setModalMensaje(true)
    mostrarToast('Estado actualizado correctamente')

    cargarPedidos()
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

    const { error } = await supabase
      .from('pedidos')
      .delete()
      .eq('id', id)

    if (error) {
      console.log(error)
      mostrarToast('Error al eliminar pedido', 'error')
      return
    }

    mostrarToast('Pedido eliminado correctamente')
    cargarPedidos()
  }

  const pedidosFiltrados = pedidos.filter((pedido) => {
    const texto = busqueda.toLowerCase()
    const estadoNormal = normalizarEstado(pedido.estado)
    const plataformaPedido = pedido.plataforma || 'SHEIN'

    const coincideBusqueda =
      pedido.codigo?.toLowerCase().includes(texto) ||
      plataformaPedido.toLowerCase().includes(texto) ||
      pedido.clientes?.nombre?.toLowerCase().includes(texto) ||
      pedido.clientes?.telefono?.toLowerCase().includes(texto) ||
      estadoNormal?.toLowerCase().includes(texto)

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
              <tr key={pedido.id}>
                <td>{pedido.codigo}</td>
                <td>{pedido.plataforma || 'SHEIN'}</td>
                <td>{pedido.clientes?.nombre || 'Sin cliente'}</td>
                <td>{pedido.clientes?.telefono || '-'}</td>
                <td>
                  <select
                    value={normalizarEstado(pedido.estado)}
                    onChange={(e) => cambiarEstado(pedido, e.target.value)}
                    disabled={bloqueado}
                  >
                    {estadosPedido.map((estado) => (
                      <option key={estado}>{estado}</option>
                    ))}
                  </select>
                </td>
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
                    disabled={bloqueado}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {pedidosFiltrados.length === 0 && (
              <tr>
                <td colSpan="11">No se encontraron pedidos.</td>
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
          <div className="mobile-card" key={pedido.id}>
            <div className="mobile-card-header">
              <div>
                <h3>{pedido.codigo}</h3>
                <p>{pedido.plataforma || 'SHEIN'} · {pedido.clientes?.nombre || 'Sin cliente'}</p>
              </div>

              <span className={`badge ${estadoClase(pedido.estado)}`}>
                {normalizarEstado(pedido.estado)}
              </span>
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
                disabled={bloqueado}
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
                disabled={bloqueado}
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
