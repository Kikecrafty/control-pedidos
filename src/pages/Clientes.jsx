import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import PageHelp from '../components/PageHelp'
import { cargarEstadoPlan, estaBloqueadoPorPlan } from '../lib/planes'

const PAGE_SIZE_OPTIONS = [25, 50, 100]
const CLIENTES_CACHE_LIMIT = 50

const MEDIOS_CONTACTO = [
  'WhatsApp',
  'Messenger',
  'Instagram',
  'TikTok',
  'Telegram',
  'Local / en persona',
  'Otro'
]

const requiereTelefono = (medio) => String(medio || 'WhatsApp').toLowerCase().includes('whatsapp')

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

const cacheKeyClientes = () => `control_pedidos_clientes_cache_${obtenerIdUsuarioCache()}`

const leerClientesCache = () => {
  if (typeof window === 'undefined') return []

  try {
    const guardado = localStorage.getItem(cacheKeyClientes())
    return guardado ? JSON.parse(guardado)?.clientes || [] : []
  } catch (error) {
    console.log(error)
    return []
  }
}

const guardarClientesCache = (clientes) => {
  if (typeof window === 'undefined') return

  try {
    const userId = obtenerIdUsuarioCache()
    localStorage.setItem('control_pedidos_usuario_cache', userId)
    localStorage.setItem(
      cacheKeyClientes(),
      JSON.stringify({
        clientes: (clientes || []).slice(0, CLIENTES_CACHE_LIMIT),
        guardado_en: new Date().toISOString()
      })
    )
  } catch (error) {
    console.log(error)
  }
}

const normalizarEstado = (estado) => {
  const valor = String(estado || 'Cotizado').trim().toLowerCase()

  const mapa = {
    cotizado: 'Cotizado',
    pendiente: 'Cotizado',
    'comprado en shein': 'En camino',
    comprado: 'En camino',
    'en camino': 'En camino',
    recibido: 'Recibido',
    'dejado en negocio': 'Dejado en negocio',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
    devuelto: 'Devuelto'
  }

  return mapa[valor] || estado || 'Cotizado'
}

const esPedidoActivo = (pedido) => {
  return !['Entregado', 'Cancelado', 'Devuelto'].includes(normalizarEstado(pedido?.estado))
}

const cuentaParaSaldo = (pedido) => {
  return !['Cancelado', 'Devuelto'].includes(normalizarEstado(pedido?.estado))
}

const obtenerFechaPedido = (pedido) => pedido?.fecha_pedido || pedido?.creado_en || ''

const ordenarPedidosRecientes = (pedidos) => {
  return [...(pedidos || [])].sort((a, b) => {
    return new Date(obtenerFechaPedido(b)).getTime() - new Date(obtenerFechaPedido(a)).getTime()
  })
}

const calcularResumenPedidos = (pedidos) => {
  const ordenados = ordenarPedidosRecientes(pedidos)
  const activos = ordenados.filter(esPedidoActivo)
  const saldoPendiente = ordenados
    .filter(cuentaParaSaldo)
    .reduce((total, pedido) => total + Math.max(0, Number(pedido?.restante || 0)), 0)

  return {
    total: ordenados.length,
    activos: activos.length,
    saldoPendiente,
    ultimoPedido: ordenados[0] || null
  }
}

const obtenerIniciales = (nombre) => {
  const partes = String(nombre || 'Cliente').trim().split(/\s+/).filter(Boolean)
  return partes.slice(0, 2).map((parte) => parte.charAt(0).toUpperCase()).join('') || 'CL'
}

export default function Clientes() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState(() => leerClientesCache())
  const [totalClientes, setTotalClientes] = useState(() => leerClientesCache().length)
  const [resumenPorCliente, setResumenPorCliente] = useState({})
  const [pagina, setPagina] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(25)
  const [busqueda, setBusqueda] = useState('')
  const [cargandoClientes, setCargandoClientes] = useState(false)

  const [estadoPlan, setEstadoPlan] = useState(null)
  const [modalCliente, setModalCliente] = useState(false)
  const [clienteEditando, setClienteEditando] = useState(null)
  const [modalDetalle, setModalDetalle] = useState(false)
  const [clienteDetalle, setClienteDetalle] = useState(null)
  const [pedidosCliente, setPedidosCliente] = useState([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [toast, setToast] = useState(null)
  const accionEnProcesoRef = useRef(false)
  const [accionEnProceso, setAccionEnProceso] = useState('')
  const [clienteAEliminar, setClienteAEliminar] = useState(null)

  const [nombre, setNombre] = useState('')
  const [medioContacto, setMedioContacto] = useState('WhatsApp')
  const [telefono, setTelefono] = useState('')
  const [usuarioContacto, setUsuarioContacto] = useState('')
  const [direccion, setDireccion] = useState('')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    setPagina(1)
  }, [busqueda, tamanoPagina])

  const totalPaginas = useMemo(() => {
    return Math.max(1, Math.ceil(totalClientes / tamanoPagina))
  }, [totalClientes, tamanoPagina])

  const resumenDetalle = useMemo(() => calcularResumenPedidos(pedidosCliente), [pedidosCliente])

  const cargarPlan = useCallback(async () => {
    const estado = await cargarEstadoPlan()
    setEstadoPlan(estado)
  }, [])

  const bloqueado = estaBloqueadoPorPlan(estadoPlan)

  const mostrarToast = useCallback((mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo })
  }, [])

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

  const bloquearSiNoPuede = () => {
    if (!bloqueado) return false
    mostrarToast('Tu Plan Básico llegó al límite. Actualiza a Premium para modificar información.', 'error')
    return true
  }

  const normalizarTelefono = (valor) => {
    const limpio = String(valor || '').replace(/\D/g, '')

    if (limpio.startsWith('52') && limpio.length > 10) {
      return limpio.slice(2, 12)
    }

    return limpio.slice(0, 10)
  }

  const obtenerContactoPrincipal = (cliente) => {
    const medio = cliente?.medio_contacto || 'WhatsApp'
    const telefonoCliente = normalizarTelefono(cliente?.telefono || '')
    const usuario = String(cliente?.usuario_contacto || '').trim()

    if (requiereTelefono(medio) && telefonoCliente) return `+52 ${telefonoCliente}`
    if (usuario) return usuario
    if (telefonoCliente) return `+52 ${telefonoCliente}`
    return 'Sin contacto directo'
  }

  const formatearMoneda = (cantidad) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0
    }).format(Number(cantidad || 0))
  }

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Sin pedidos'

    const fechaSegura = String(fecha).includes('T') ? new Date(fecha) : new Date(`${fecha}T12:00:00`)

    if (Number.isNaN(fechaSegura.getTime())) return 'Sin fecha'

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(fechaSegura)
  }

  const obtenerEstadoPago = (pedido) => {
    const restante = Math.max(0, Number(pedido?.restante || 0))
    const total = Math.max(0, Number(pedido?.total_cliente || 0))
    const pagado = Math.max(0, total - restante)

    if (restante <= 0 && total > 0) return { texto: 'Pagado', tipo: 'paid' }
    if (pagado > 0) return { texto: 'Pago parcial', tipo: 'partial' }
    return { texto: 'Pago pendiente', tipo: 'pending' }
  }

  const cargarResumenClientes = useCallback(async (clientesActuales) => {
    const ids = (clientesActuales || []).map((cliente) => cliente.id).filter(Boolean)

    if (ids.length === 0) {
      setResumenPorCliente({})
      return
    }

    const { data, error } = await supabase
      .from('pedidos')
      .select('id, cliente_id, codigo, creado_en, fecha_pedido, estado, plataforma, total_cliente, anticipo, restante')
      .in('cliente_id', ids)
      .order('creado_en', { ascending: false })

    if (error) {
      console.log(error)
      setResumenPorCliente({})
      return
    }

    const agrupados = (data || []).reduce((acumulado, pedido) => {
      const clienteId = pedido.cliente_id
      if (!acumulado[clienteId]) acumulado[clienteId] = []
      acumulado[clienteId].push(pedido)
      return acumulado
    }, {})

    const resumen = {}
    ids.forEach((id) => {
      resumen[id] = calcularResumenPedidos(agrupados[id] || [])
    })

    setResumenPorCliente(resumen)
  }, [])

  const cargarClientes = useCallback(async () => {
    setCargandoClientes(true)

    const desde = (pagina - 1) * tamanoPagina
    const hasta = desde + tamanoPagina - 1
    const texto = busqueda.trim()

    let consulta = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .order('creado_en', { ascending: false })
      .range(desde, hasta)

    if (texto) {
      const limpio = texto.replace(/[%_]/g, '')
      consulta = consulta.or(`nombre.ilike.%${limpio}%,telefono.ilike.%${limpio}%,medio_contacto.ilike.%${limpio}%,usuario_contacto.ilike.%${limpio}%,direccion.ilike.%${limpio}%,notas.ilike.%${limpio}%`)
    }

    const { data, error, count } = await consulta

    setCargandoClientes(false)

    if (error) {
      console.log(error)
      mostrarToast('Error al cargar clientes', 'error')
      return
    }

    const clientesFinal = data || []
    setClientes(clientesFinal)
    setTotalClientes(count || 0)
    guardarClientesCache(clientesFinal)
    await cargarResumenClientes(clientesFinal)
  }, [busqueda, cargarResumenClientes, mostrarToast, pagina, tamanoPagina])

  useEffect(() => {
    cargarPlan()
  }, [cargarPlan])

  useEffect(() => {
    cargarClientes()
  }, [cargarClientes])

  const limpiarFormulario = () => {
    setClienteEditando(null)
    setNombre('')
    setMedioContacto('WhatsApp')
    setTelefono('')
    setUsuarioContacto('')
    setDireccion('')
    setNotas('')
  }

  const abrirAgregarCliente = () => {
    if (bloquearSiNoPuede()) return
    limpiarFormulario()
    setModalCliente(true)
  }

  const abrirEditarCliente = (cliente) => {
    if (bloquearSiNoPuede()) return
    setModalDetalle(false)
    setClienteEditando(cliente)
    setNombre(cliente.nombre || '')
    setMedioContacto(cliente.medio_contacto || 'WhatsApp')
    setTelefono(normalizarTelefono(cliente.telefono || ''))
    setUsuarioContacto(cliente.usuario_contacto || '')
    setDireccion(cliente.direccion || '')
    setNotas(cliente.notas || '')
    setModalCliente(true)
  }

  const cerrarModalCliente = () => {
    if (estaProcesando) return
    setModalCliente(false)
    limpiarFormulario()
  }

  const abrirDetalleCliente = async (cliente) => {
    setClienteDetalle(cliente)
    setPedidosCliente([])
    setModalDetalle(true)
    setCargandoDetalle(true)

    const { data, error } = await supabase
      .from('pedidos')
      .select('id, cliente_id, codigo, creado_en, fecha_pedido, estado, plataforma, total_cliente, anticipo, restante')
      .eq('cliente_id', cliente.id)
      .order('creado_en', { ascending: false })

    setCargandoDetalle(false)

    if (error) {
      console.log(error)
      mostrarToast('No se pudo cargar el historial del cliente', 'error')
      return
    }

    setPedidosCliente(data || [])
  }

  const cerrarDetalleCliente = () => {
    setModalDetalle(false)
    setClienteDetalle(null)
    setPedidosCliente([])
  }

  const abrirNuevoPedidoCliente = (cliente) => {
    if (bloquearSiNoPuede()) return
    navigate(`/nuevo-pedido?cliente=${encodeURIComponent(cliente.id)}`)
  }

  const guardarCliente = async (e) => {
    e.preventDefault()

    if (bloquearSiNoPuede()) return
    if (accionEnProcesoRef.current) return

    const telefonoFinal = normalizarTelefono(telefono)

    if (!nombre.trim()) {
      mostrarToast('El nombre es obligatorio', 'error')
      return
    }

    if (requiereTelefono(medioContacto) && (!telefonoFinal || telefonoFinal.length < 10)) {
      mostrarToast('Para WhatsApp escribe un teléfono válido de 10 dígitos', 'error')
      return
    }

    if (!iniciarAccion(clienteEditando ? 'Guardando cambios...' : 'Guardando cliente...')) return

    try {
      if (clienteEditando) {
        const { error } = await supabase
          .from('clientes')
          .update({
            nombre: nombre.trim(),
            medio_contacto: medioContacto,
            telefono: telefonoFinal || null,
            usuario_contacto: usuarioContacto.trim(),
            direccion,
            notas
          })
          .eq('id', clienteEditando.id)

        if (error) {
          console.log(error)
          mostrarToast('Error al actualizar cliente', 'error')
          return
        }

        setModalCliente(false)
        limpiarFormulario()
        await cargarClientes()
        mostrarToast('Cliente actualizado correctamente')
        return
      }

      const { error } = await supabase
        .from('clientes')
        .insert([
          {
            nombre: nombre.trim(),
            medio_contacto: medioContacto,
            telefono: telefonoFinal || null,
            usuario_contacto: usuarioContacto.trim(),
            direccion: '',
            notas
          }
        ])

      if (error) {
        console.log(error)
        mostrarToast('Error al guardar cliente', 'error')
        return
      }

      setModalCliente(false)
      limpiarFormulario()
      setBusqueda('')
      setPagina(1)
      await cargarClientes()
      mostrarToast('Cliente agregado correctamente')
    } finally {
      finalizarAccion()
    }
  }

  const solicitarEliminarCliente = (cliente) => {
    if (bloquearSiNoPuede()) return
    if (accionEnProcesoRef.current) return
    setClienteAEliminar(cliente)
  }

  const eliminarClienteConfirmado = async () => {
    if (!clienteAEliminar) return
    if (!iniciarAccion('Validando cliente...')) return

    const id = clienteAEliminar.id

    try {
      const { count, error: errorConteo } = await supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', id)

      if (errorConteo) {
        console.log(errorConteo)
        mostrarToast('No pudimos revisar el historial del cliente. Intenta nuevamente.', 'error')
        return
      }

      if ((count || 0) > 0) {
        setClienteAEliminar(null)
        mostrarToast('Este cliente tiene pedidos y no puede eliminarse para proteger el historial.', 'error')
        return
      }

      setAccionEnProceso('Eliminando cliente...')

      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id)

      if (error) {
        console.log(error)
        mostrarToast('No se pudo eliminar el cliente. Intenta nuevamente.', 'error')
        return
      }

      setClienteAEliminar(null)
      cerrarDetalleCliente()
      const nuevaPagina = clientes.length === 1 && pagina > 1 ? pagina - 1 : pagina
      setPagina(nuevaPagina)
      await cargarClientes()
      mostrarToast('El cliente se eliminó correctamente.')
    } finally {
      finalizarAccion()
    }
  }

  const limpiarTelefono = (telefonoCliente) => normalizarTelefono(telefonoCliente)

  const limpiarBusqueda = () => {
    setBusqueda('')
    setPagina(1)
  }

  const irPaginaAnterior = () => {
    setPagina((actual) => Math.max(1, actual - 1))
  }

  const irPaginaSiguiente = () => {
    setPagina((actual) => Math.min(totalPaginas, actual + 1))
  }

  const desdeVisible = totalClientes === 0 ? 0 : ((pagina - 1) * tamanoPagina) + 1
  const hastaVisible = Math.min(pagina * tamanoPagina, totalClientes)

  return (
    <Layout>
      <PageHelp page="clientes" />

      <Toast
        mensaje={toast?.mensaje}
        tipo={toast?.tipo}
        onClose={() => setToast(null)}
      />

      <div className="page-header row-between clients-page-header">
        <div>
          <span className="page-kicker">Clientes</span>
          <h1>Clientes</h1>
          <p>Consulta sus pedidos, cuánto falta por cobrar y su información de contacto.</p>
        </div>

        <button className="btn btn-primary" onClick={abrirAgregarCliente} disabled={bloqueado || estaProcesando}>
          + Agregar cliente
        </button>
      </div>

      <PlanLimitNotice estadoPlan={estadoPlan} compacto />

      <div className="list-toolbar-card clients-toolbar-card">
        <div className="form-field clients-search-field">
          <label>Buscar cliente</label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, contacto, teléfono o notas"
          />
        </div>

        <label className="form-field list-page-size-field">
          <span>Mostrar</span>
          <select
            value={tamanoPagina}
            onChange={(e) => setTamanoPagina(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((opcion) => (
              <option key={opcion} value={opcion}>{opcion}</option>
            ))}
          </select>
        </label>

        {busqueda && (
          <button type="button" className="btn btn-light-bordered" onClick={limpiarBusqueda}>
            Limpiar
          </button>
        )}
      </div>

      <div className="table-card desktop-table clients-table-card">
        <div className="row-between table-title">
          <h2>{totalClientes} {totalClientes === 1 ? 'cliente' : 'clientes'}</h2>
          <span className="pagination-range">
            {cargandoClientes ? 'Actualizando...' : `${desdeVisible}-${hastaVisible} de ${totalClientes}`}
          </span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contacto</th>
              <th>Pedidos activos</th>
              <th>Saldo pendiente</th>
              <th>Último pedido</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {clientes.map((cliente) => {
              const resumen = resumenPorCliente[cliente.id] || calcularResumenPedidos([])

              return (
                <tr key={cliente.id}>
                  <td>
                    <button type="button" className="client-name-cell" onClick={() => abrirDetalleCliente(cliente)}>
                      <span className="client-avatar">{obtenerIniciales(cliente.nombre)}</span>
                      <span>
                        <strong>{cliente.nombre}</strong>
                        <small>{cliente.medio_contacto || 'WhatsApp'}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <div className="client-contact-cell">
                      <strong>{obtenerContactoPrincipal(cliente)}</strong>
                      <small>{cliente.direccion || 'Sin dirección registrada'}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`client-metric-pill ${resumen.activos > 0 ? 'is-active' : ''}`}>
                      {resumen.activos}
                    </span>
                  </td>
                  <td>
                    <strong className={resumen.saldoPendiente > 0 ? 'client-balance-pending' : 'client-balance-clear'}>
                      {formatearMoneda(resumen.saldoPendiente)}
                    </strong>
                  </td>
                  <td>
                    {resumen.ultimoPedido ? (
                      <div className="client-last-order">
                        <strong>{resumen.ultimoPedido.codigo || 'Pedido'}</strong>
                        <small>{formatearFecha(obtenerFechaPedido(resumen.ultimoPedido))}</small>
                      </div>
                    ) : (
                      <span className="client-no-orders">Sin pedidos</span>
                    )}
                  </td>
                  <td>
                    <div className="client-row-actions">
                      <button
                        type="button"
                        onClick={() => abrirDetalleCliente(cliente)}
                        className="btn btn-light-bordered btn-small"
                      >
                        Ver cliente
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirNuevoPedidoCliente(cliente)}
                        className="btn btn-primary btn-small"
                        disabled={bloqueado || estaProcesando}
                      >
                        Nuevo pedido
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}

            {clientes.length === 0 && (
              <tr>
                <td colSpan="6">
                  <EmptyState
                    icon="clients"
                    eyebrow="Tu lista está vacía"
                    title="Todavía no tienes clientes."
                    description="Agrega el primero para crear pedidos y consultar después su saldo e historial."
                    actionLabel="Agregar primer cliente"
                    onAction={abrirAgregarCliente}
                    compact
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-list clients-mobile-list">
        <div className="mobile-list-title">
          <h2>{totalClientes} {totalClientes === 1 ? 'cliente' : 'clientes'}</h2>
          <span className="pagination-range">
            {cargandoClientes ? 'Actualizando...' : `${desdeVisible}-${hastaVisible} de ${totalClientes}`}
          </span>
        </div>

        {clientes.map((cliente) => {
          const resumen = resumenPorCliente[cliente.id] || calcularResumenPedidos([])

          return (
            <article className="client-mobile-card" key={cliente.id}>
              <button type="button" className="client-mobile-head" onClick={() => abrirDetalleCliente(cliente)}>
                <span className="client-avatar">{obtenerIniciales(cliente.nombre)}</span>
                <span>
                  <strong>{cliente.nombre}</strong>
                  <small>{cliente.medio_contacto || 'WhatsApp'} · {obtenerContactoPrincipal(cliente)}</small>
                </span>
                <span className="client-card-arrow">›</span>
              </button>

              <div className="client-mobile-metrics">
                <div>
                  <span>Activos</span>
                  <strong>{resumen.activos}</strong>
                </div>
                <div>
                  <span>Por cobrar</span>
                  <strong className={resumen.saldoPendiente > 0 ? 'client-balance-pending' : 'client-balance-clear'}>
                    {formatearMoneda(resumen.saldoPendiente)}
                  </strong>
                </div>
                <div>
                  <span>Último pedido</span>
                  <strong>{resumen.ultimoPedido?.codigo || '—'}</strong>
                </div>
              </div>

              <div className="client-mobile-actions">
                <button type="button" className="btn btn-light-bordered" onClick={() => abrirDetalleCliente(cliente)}>
                  Ver cliente
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => abrirNuevoPedidoCliente(cliente)}
                  disabled={bloqueado || estaProcesando}
                >
                  + Nuevo pedido
                </button>
              </div>
            </article>
          )
        })}

        {clientes.length === 0 && (
          <EmptyState
            icon="clients"
            eyebrow="Tu lista está vacía"
            title="Todavía no tienes clientes."
            description="Agrega el primero para comenzar a crear pedidos y llevar su historial."
            actionLabel="Agregar primer cliente"
            onAction={abrirAgregarCliente}
            compact
            className="customers-empty-state"
          />
        )}
      </div>

      {totalClientes > tamanoPagina && (
        <div className="pagination-card">
          <button type="button" className="btn btn-light-bordered" onClick={irPaginaAnterior} disabled={pagina <= 1 || cargandoClientes}>
            Anterior
          </button>

          <div>
            <strong>Página {pagina} de {totalPaginas}</strong>
            <span>{desdeVisible}-{hastaVisible} de {totalClientes}</span>
          </div>

          <button type="button" className="btn btn-light-bordered" onClick={irPaginaSiguiente} disabled={pagina >= totalPaginas || cargandoClientes}>
            Siguiente
          </button>
        </div>
      )}

      <Modal
        abierto={modalDetalle}
        titulo="Ficha del cliente"
        onClose={cerrarDetalleCliente}
        className="client-detail-modal-card"
      >
        {clienteDetalle && (
          <div className="client-detail-modal">
            <div className="client-detail-hero">
              <span className="client-detail-avatar">{obtenerIniciales(clienteDetalle.nombre)}</span>
              <div>
                <h3>{clienteDetalle.nombre}</h3>
                <p>{clienteDetalle.medio_contacto || 'WhatsApp'} · {obtenerContactoPrincipal(clienteDetalle)}</p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => abrirNuevoPedidoCliente(clienteDetalle)}
                disabled={bloqueado || estaProcesando}
              >
                + Nuevo pedido
              </button>
            </div>

            <div className="client-detail-stats">
              <article>
                <span>Pedidos totales</span>
                <strong>{resumenDetalle.total}</strong>
              </article>
              <article>
                <span>Pedidos activos</span>
                <strong>{resumenDetalle.activos}</strong>
              </article>
              <article className={resumenDetalle.saldoPendiente > 0 ? 'has-balance' : ''}>
                <span>Saldo pendiente</span>
                <strong>{formatearMoneda(resumenDetalle.saldoPendiente)}</strong>
              </article>
            </div>

            <div className="client-detail-grid">
              <section className="client-detail-info-card">
                <div className="client-detail-section-title">
                  <div>
                    <span>Información</span>
                    <h4>Datos del cliente</h4>
                  </div>
                  <button
                    type="button"
                    className="btn btn-light-bordered btn-small"
                    onClick={() => abrirEditarCliente(clienteDetalle)}
                    disabled={bloqueado || estaProcesando}
                  >
                    Editar
                  </button>
                </div>

                <dl className="client-detail-list">
                  <div>
                    <dt>Medio</dt>
                    <dd>{clienteDetalle.medio_contacto || 'WhatsApp'}</dd>
                  </div>
                  <div>
                    <dt>Contacto</dt>
                    <dd>{obtenerContactoPrincipal(clienteDetalle)}</dd>
                  </div>
                  <div>
                    <dt>Dirección</dt>
                    <dd>{clienteDetalle.direccion || 'Sin dirección registrada'}</dd>
                  </div>
                  <div>
                    <dt>Notas</dt>
                    <dd>{clienteDetalle.notas || 'Sin notas'}</dd>
                  </div>
                </dl>

                {requiereTelefono(clienteDetalle.medio_contacto) && clienteDetalle.telefono && (
                  <a
                    href={`https://wa.me/52${limpiarTelefono(clienteDetalle.telefono)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-success client-whatsapp-button"
                  >
                    Abrir WhatsApp
                  </a>
                )}
              </section>

              <section className="client-detail-orders-card">
                <div className="client-detail-section-title">
                  <div>
                    <span>Actividad</span>
                    <h4>Pedidos recientes</h4>
                  </div>
                  {pedidosCliente.length > 0 && <small>{pedidosCliente.length} en total</small>}
                </div>

                {cargandoDetalle && <div className="client-orders-loading">Cargando pedidos...</div>}

                {!cargandoDetalle && pedidosCliente.length === 0 && (
                  <div className="client-orders-empty">
                    <strong>Aún no tiene pedidos.</strong>
                    <span>Crea el primero desde esta misma ficha.</span>
                  </div>
                )}

                {!cargandoDetalle && pedidosCliente.length > 0 && (
                  <div className="client-orders-list">
                    {pedidosCliente.slice(0, 8).map((pedido) => {
                      const pago = obtenerEstadoPago(pedido)
                      return (
                        <button
                          type="button"
                          className="client-order-row"
                          key={pedido.id}
                          onClick={() => navigate(`/pedidos/${pedido.id}`)}
                        >
                          <span>
                            <strong>{pedido.codigo || 'Pedido'}</strong>
                            <small>{pedido.plataforma || 'Sin plataforma'} · {formatearFecha(obtenerFechaPedido(pedido))}</small>
                          </span>
                          <span className="client-order-statuses">
                            <em className={`client-payment-tag ${pago.tipo}`}>{pago.texto}</em>
                            <em className="client-order-state-tag">{normalizarEstado(pedido.estado)}</em>
                          </span>
                          <span className="client-order-amount">
                            <strong>{formatearMoneda(pedido.total_cliente)}</strong>
                            <small>{Number(pedido.restante || 0) > 0 ? `${formatearMoneda(pedido.restante)} pendiente` : 'Sin saldo'}</small>
                          </span>
                          <span className="client-order-arrow">›</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>

            <div className="client-detail-footer">
              <span>Eliminar solo está disponible cuando el cliente no tiene pedidos.</span>
              <button
                type="button"
                className="client-delete-link"
                onClick={() => solicitarEliminarCliente(clienteDetalle)}
                disabled={bloqueado || estaProcesando || pedidosCliente.length > 0}
              >
                Eliminar cliente
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        abierto={modalCliente}
        titulo={clienteEditando ? 'Editar cliente' : 'Agregar cliente'}
        onClose={cerrarModalCliente}
      >
        <form onSubmit={guardarCliente}>
          <div className="modal-form-grid">
            <label className="form-field">
              <span>Nombre del cliente*</span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Medio de contacto*</span>
              <select
                value={medioContacto}
                onChange={(e) => setMedioContacto(e.target.value)}
                required
              >
                {MEDIOS_CONTACTO.map((medio) => (
                  <option key={medio} value={medio}>{medio}</option>
                ))}
              </select>
              <small className="field-help-text">Elige por dónde te escribió el cliente.</small>
            </label>

            <label className="form-field">
              <span>Teléfono{requiereTelefono(medioContacto) ? '*' : ''}</span>
              <div className="phone-field">
                <span>+52</span>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(normalizarTelefono(e.target.value))}
                  inputMode="numeric"
                  required={requiereTelefono(medioContacto)}
                />
              </div>
              <small className="field-help-text">Solo es obligatorio si el medio es WhatsApp.</small>
            </label>

            <label className="form-field">
              <span>Usuario / perfil</span>
              <input
                value={usuarioContacto}
                onChange={(e) => setUsuarioContacto(e.target.value)}
                placeholder="Ej. @cliente o nombre en Facebook"
              />
              <small className="field-help-text">Opcional para Messenger, Instagram, TikTok u otro medio.</small>
            </label>

            {clienteEditando && (
              <label className="form-field">
                <span>Dirección</span>
                <input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                />
                <small className="field-help-text">Solo se conserva para clientes que ya tenían una dirección registrada.</small>
              </label>
            )}

            <label className="form-field">
              <span>Notas</span>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows="3"
              />
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-light-bordered"
              onClick={cerrarModalCliente}
              disabled={estaProcesando}
            >
              Cancelar
            </button>

            <button className="btn btn-primary" disabled={bloqueado || estaProcesando}>
              {accionEnProceso || (clienteEditando ? 'Guardar cambios' : 'Guardar cliente')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        abierto={Boolean(clienteAEliminar)}
        titulo="¿Eliminar este cliente?"
        descripcion="Solo puede eliminarse si todavía no tiene pedidos. Esta acción no se puede deshacer."
        detalle={clienteAEliminar?.nombre || ''}
        confirmarTexto="Sí, eliminar cliente"
        onConfirm={eliminarClienteConfirmado}
        onClose={() => setClienteAEliminar(null)}
        cargando={accionEnProceso === 'Validando cliente...' || accionEnProceso === 'Eliminando cliente...'}
        variante="danger"
      />
    </Layout>
  )
}
