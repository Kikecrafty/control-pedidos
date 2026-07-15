import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import PageHelp from '../components/PageHelp'
import { cargarEstadoPlan, estaBloqueadoPorPlan, puedeCrearPedido } from '../lib/planes'
import { PLATAFORMAS } from '../lib/plataformas'
import { formatearProductosParaMensaje } from '../lib/mensajesProductos'
import { METODOS_PAGO, METODO_PAGO_PREDETERMINADO, obtenerFechaLocalHoy } from '../lib/metodosPago'
import { parsearFechaLocal } from '../lib/fechas'

const PAGE_SIZE_OPTIONS = [25, 50, 100]
const PEDIDOS_CACHE_LIMIT = 50

const obtenerEstiloMenuPortal = (elemento, ancho = 225, altoEstimado = 320, alinear = 'izquierda') => {
  if (!elemento || typeof window === 'undefined') return null

  const rect = elemento.getBoundingClientRect()
  const margen = 10
  const espacioAbajo = window.innerHeight - rect.bottom - margen
  const espacioArriba = rect.top - margen
  const abrirArriba = espacioAbajo < Math.min(altoEstimado, 260) && espacioArriba > espacioAbajo

  let left = alinear === 'derecha' ? rect.right - ancho : rect.left
  left = Math.max(margen, Math.min(left, window.innerWidth - ancho - margen))

  return {
    position: 'fixed',
    left: `${left}px`,
    top: abrirArriba ? 'auto' : `${rect.bottom + 7}px`,
    bottom: abrirArriba ? `${window.innerHeight - rect.top + 7}px` : 'auto',
    width: `${ancho}px`,
    maxHeight: `${Math.max(150, abrirArriba ? espacioArriba - 12 : espacioAbajo - 12)}px`,
    overflowY: 'auto',
    zIndex: 2147483000
  }
}

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


const DATE_FORMAT_STORAGE_KEY = 'ordely_fecha_formato'
const DATE_YEAR_STORAGE_KEY = 'ordely_fecha_mostrar_anio'
const GROUP_BY_DATE_STORAGE_KEY = 'ordely_pedidos_separar_fecha'
const DATE_FILTER_TYPE_STORAGE_KEY = 'ordely_pedidos_fecha_tipo_busqueda'
const DATE_GROUP_TYPE_STORAGE_KEY = 'ordely_pedidos_fecha_tipo_agrupacion'

const normalizarBooleanoLocal = (valor, predeterminado = true) => {
  if (valor === null || valor === undefined) return predeterminado
  if (valor === true || valor === 'true') return true
  if (valor === false || valor === 'false') return false
  return predeterminado
}

const obtenerConfigFechaLocal = () => {
  if (typeof window === 'undefined') {
    return { formato: 'dd/mm/yyyy', mostrarAnio: true, separarPorFecha: true, tipoFechaBusqueda: 'creado_en', tipoFechaAgrupacion: 'creado_en' }
  }

  return {
    formato: localStorage.getItem(DATE_FORMAT_STORAGE_KEY) || 'dd/mm/yyyy',
    mostrarAnio: normalizarBooleanoLocal(localStorage.getItem(DATE_YEAR_STORAGE_KEY), true),
    separarPorFecha: normalizarBooleanoLocal(localStorage.getItem(GROUP_BY_DATE_STORAGE_KEY), true),
    tipoFechaBusqueda: localStorage.getItem(DATE_FILTER_TYPE_STORAGE_KEY) || 'creado_en',
    tipoFechaAgrupacion: localStorage.getItem(DATE_GROUP_TYPE_STORAGE_KEY) || 'creado_en'
  }
}

const guardarConfigFechaLocal = ({ formato, mostrarAnio, separarPorFecha, tipoFechaBusqueda, tipoFechaAgrupacion }) => {
  if (typeof window === 'undefined') return
  if (formato) localStorage.setItem(DATE_FORMAT_STORAGE_KEY, formato)
  if (typeof mostrarAnio === 'boolean') localStorage.setItem(DATE_YEAR_STORAGE_KEY, String(mostrarAnio))
  if (typeof separarPorFecha === 'boolean') localStorage.setItem(GROUP_BY_DATE_STORAGE_KEY, String(separarPorFecha))
  if (tipoFechaBusqueda) localStorage.setItem(DATE_FILTER_TYPE_STORAGE_KEY, tipoFechaBusqueda)
  if (tipoFechaAgrupacion) localStorage.setItem(DATE_GROUP_TYPE_STORAGE_KEY, tipoFechaAgrupacion)
}

const guardarPedidosCache = (pedidos) => {
  if (typeof window === 'undefined') return

  try {
    const userId = obtenerIdUsuarioCache()
    localStorage.setItem('control_pedidos_usuario_cache', userId)
    localStorage.setItem(
      cacheKeyPedidos(),
      JSON.stringify({
        pedidos: (pedidos || []).slice(0, PEDIDOS_CACHE_LIMIT),
        guardado_en: new Date().toISOString()
      })
    )
  } catch (error) {
    console.log(error)
  }
}


export default function Pedidos() {
  const [todosPedidos, setTodosPedidos] = useState(() => leerPedidosCache())
  const [pagina, setPagina] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(25)
  const [cargandoPedidos, setCargandoPedidos] = useState(false)
  const [estadoPlan, setEstadoPlan] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [vistaCompra, setVistaCompra] = useState('pendientes')
  const [agruparComprados, setAgruparComprados] = useState(true)
  const [filtroPlataforma, setFiltroPlataforma] = useState('Todas')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [configFechaPedidos, setConfigFechaPedidos] = useState(() => obtenerConfigFechaLocal())
  const [toast, setToast] = useState(null)
  const accionEnProcesoRef = useRef(false)
  const [accionEnProceso, setAccionEnProceso] = useState('')
  const [pedidoAEliminar, setPedidoAEliminar] = useState(null)

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
  const [modalSeguimiento, setModalSeguimiento] = useState(false)
  const [pedidoSeguimiento, setPedidoSeguimiento] = useState(null)
  const [modalFiltros, setModalFiltros] = useState(false)
  const [modalConfirmarEntrega, setModalConfirmarEntrega] = useState(false)
  const [entregaPendiente, setEntregaPendiente] = useState(null)
  const [metodoPagoEntrega, setMetodoPagoEntrega] = useState(METODO_PAGO_PREDETERMINADO)
  const [fechaPagoEntrega, setFechaPagoEntrega] = useState(obtenerFechaLocalHoy())
  const [modalConfirmarReembolso, setModalConfirmarReembolso] = useState(false)
  const [reembolsoPendiente, setReembolsoPendiente] = useState(null)
  const [montoReembolso, setMontoReembolso] = useState('')
  const [menuAccionesAbierto, setMenuAccionesAbierto] = useState(null)
  const [menuEstadoAbierto, setMenuEstadoAbierto] = useState(null)
  const [estiloMenuAcciones, setEstiloMenuAcciones] = useState(null)
  const [, setEstiloMenuEstado] = useState(null)

  useEffect(() => {
    cargarPlan()
    cargarConfigPedidos()
    cargarPedidos()

    const actualizarConfigFechas = () => {
      setConfigFechaPedidos(obtenerConfigFechaLocal())
      cargarConfigPedidos()
    }

    window.addEventListener('ordelyConfigFechasActualizada', actualizarConfigFechas)

    return () => {
      window.removeEventListener('ordelyConfigFechasActualizada', actualizarConfigFechas)
    }
  }, [])

  useEffect(() => {
    setPagina(1)
  }, [busqueda, filtroPlataforma, fechaDesde, fechaHasta, tamanoPagina, vistaCompra])

  useEffect(() => {
    if (!menuAccionesAbierto && !menuEstadoAbierto) return undefined

    const cerrarMenus = () => {
      setMenuAccionesAbierto(null)
      setMenuEstadoAbierto(null)
      setEstiloMenuAcciones(null)
      setEstiloMenuEstado(null)
    }

    const cerrarAlPulsarFuera = (evento) => {
      const objetivo = evento.target
      if (!(objetivo instanceof Element)) return

      if (objetivo.closest('.order-status-options-portal, .order-actions-dropdown-portal, .order-status-button, .btn-action-more')) {
        return
      }

      cerrarMenus()
    }

    window.addEventListener('resize', cerrarMenus)
    window.addEventListener('scroll', cerrarMenus, true)
    document.addEventListener('pointerdown', cerrarAlPulsarFuera)

    return () => {
      window.removeEventListener('resize', cerrarMenus)
      window.removeEventListener('scroll', cerrarMenus, true)
      document.removeEventListener('pointerdown', cerrarAlPulsarFuera)
    }
  }, [menuAccionesAbierto, menuEstadoAbierto])

  const mostrarToast = (mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo })
  }

  const cargarPlan = async () => {
    const estado = await cargarEstadoPlan()
    setEstadoPlan(estado)
  }

  const cargarConfigPedidos = async () => {
    const configLocal = obtenerConfigFechaLocal()
    setConfigFechaPedidos(configLocal)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id
      if (!userId) return

      const { data, error } = await supabase
        .from('perfiles')
        .select('fecha_formato, fecha_mostrar_anio, pedidos_separar_por_fecha')
        .eq('user_id', userId)
        .maybeSingle()

      if (error || !data) return

      const configDb = {
        formato: data.fecha_formato || configLocal.formato || 'dd/mm/yyyy',
        mostrarAnio: typeof data.fecha_mostrar_anio === 'boolean' ? data.fecha_mostrar_anio : configLocal.mostrarAnio,
        separarPorFecha: typeof data.pedidos_separar_por_fecha === 'boolean' ? data.pedidos_separar_por_fecha : configLocal.separarPorFecha,
        tipoFechaBusqueda: configLocal.tipoFechaBusqueda || 'creado_en',
        tipoFechaAgrupacion: configLocal.tipoFechaAgrupacion || 'creado_en'
      }

      guardarConfigFechaLocal(configDb)
      setConfigFechaPedidos(configDb)
    } catch (error) {
      console.log(error)
    }
  }

  const bloqueado = estaBloqueadoPorPlan(estadoPlan)

  const bloquearSiNoPuede = () => {
    if (!bloqueado) return false
    mostrarToast('Tu cuenta no permite modificaciones en este momento.', 'error')
    return true
  }

  const normalizarEstado = (estado) => {
    if (estado === 'Comprado en SHEIN') return 'En camino'
    if (estado === 'Comprado en plataforma') return 'En camino'
    if (estado === 'Pendiente de pago') return 'Cotizado'
    if (estado === 'Pagado por cliente') return 'Cotizado'
    return estado || 'Cotizado'
  }

  const estadoClase = (estado) => {
    const estadoNormal = normalizarEstado(estado)

    if (estadoNormal === 'Pendiente de compra') return 'badge-amber'
    if (estadoNormal === 'Cotizado') return 'badge-gray'
    if (estadoNormal === 'En camino') return 'badge-purple'
    if (estadoNormal === 'Recibido') return 'badge-green-soft'
    if (estadoNormal === 'Dejado en negocio') return 'badge-blue'
    if (estadoNormal === 'Entregado') return 'badge-green-strong'
    if (estadoNormal === 'Cancelado') return 'badge-red-soft'
    if (estadoNormal === 'Devuelto') return 'badge-red-strong'

    return 'badge-gray'
  }


  const obtenerProductosPedido = (pedido) => {
    if (Array.isArray(pedido?.productos_pedido)) return pedido.productos_pedido
    return []
  }

  const normalizarEstadoProducto = (estado) => {
    return String(estado || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  const productoEstaComprado = (producto) => {
    const estado = normalizarEstadoProducto(producto?.estado_compra)

    return Boolean(
      producto?.fecha_comprado ||
      producto?.lote_compra_id ||
      producto?.fecha_estimada_llegada ||
      producto?.fecha_recibido ||
      producto?.fecha_dejado_negocio ||
      producto?.fecha_entregado_cliente ||
      producto?.entregado === true ||
      estado.includes('comprado') ||
      estado.includes('camino') ||
      estado.includes('recibido') ||
      estado.includes('negocio') ||
      estado.includes('entregado')
    )
  }

  const pedidoEstaCerradoParaCompra = (pedido) => {
    const estado = normalizarEstado(pedido?.estado)
    return ['Entregado', 'Cancelado', 'Devuelto'].includes(estado)
  }

  const pedidoEstaComprado = (pedido) => {
    if (pedidoEstaCerradoParaCompra(pedido)) return true

    const productos = obtenerProductosPedido(pedido)
    return productos.length > 0 && productos.every(productoEstaComprado)
  }

  const obtenerFechaCompraPedido = (pedido) => {
    const fechas = obtenerProductosPedido(pedido)
      .map((producto) => producto?.fecha_comprado)
      .filter(Boolean)
      .map((fecha) => new Date(fecha))
      .filter((fecha) => !Number.isNaN(fecha.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())

    return fechas[0]?.toISOString() || null
  }

  const obtenerConteoCompraPedido = (pedido) => {
    const productos = obtenerProductosPedido(pedido)

    if (pedidoEstaCerradoParaCompra(pedido)) {
      return { total: productos.length, comprados: productos.length, pendientes: 0 }
    }

    const comprados = productos.filter(productoEstaComprado).length
    return { total: productos.length, comprados, pendientes: Math.max(productos.length - comprados, 0) }
  }

  const obtenerResumenCompraPedido = (pedido) => {
    const estado = normalizarEstado(pedido?.estado)
    const fechaCompra = obtenerFechaCompraPedido(pedido)

    if (estado === 'Cancelado') return 'Pedido cancelado'
    if (estado === 'Devuelto') return 'Pedido devuelto'
    if (estado === 'Entregado' && !fechaCompra) return 'Pedido entregado'
    if (pedidoEstaComprado(pedido) && fechaCompra) return `Comprado: ${formatearFechaCorta(fechaCompra)}`
    if (pedidoEstaComprado(pedido)) return 'Compra completada'

    const pendientes = obtenerConteoCompraPedido(pedido).pendientes
    return `${pendientes} producto${pendientes === 1 ? '' : 's'} por comprar`
  }

  const obtenerEstadoAutomatico = (pedido) => {
    const guardado = normalizarEstado(pedido?.estado)
    if (guardado === 'Cancelado' || guardado === 'Devuelto') return guardado

    const productos = obtenerProductosPedido(pedido)
    if (!productos.length) return 'Pendiente de compra'

    const todosEntregados = productos.every((producto) =>
      producto?.entregado === true ||
      Boolean(producto?.fecha_entregado_cliente) ||
      normalizarEstadoProducto(producto?.estado_compra).includes('entregado')
    )
    if (todosEntregados) return 'Entregado'

    if (productos.some((producto) => !productoEstaComprado(producto))) return 'Pendiente de compra'

    const algunoEnCamino = productos.some((producto) => {
      const estado = normalizarEstadoProducto(producto?.estado_compra)
      return !producto?.fecha_recibido && !estado.includes('recibido') && !estado.includes('negocio') && !estado.includes('entregado')
    })
    if (algunoEnCamino) return 'En camino'

    const algunoRecibido = productos.some((producto) => {
      const estado = normalizarEstadoProducto(producto?.estado_compra)
      return Boolean(producto?.fecha_recibido) || estado.includes('recibido')
    })
    const algunoPendienteDejar = productos.some((producto) => {
      const estado = normalizarEstadoProducto(producto?.estado_compra)
      return !producto?.fecha_dejado_negocio && !estado.includes('negocio') && !estado.includes('entregado')
    })
    if (algunoRecibido && algunoPendienteDejar) return 'Recibido'

    return 'Dejado en negocio'
  }

  const calcularProgresoProducto = (producto) => {
    const estado = normalizarEstadoProducto(producto?.estado_compra)

    if (
      producto?.entregado ||
      producto?.fecha_entregado_cliente ||
      estado.includes('entregado')
    ) {
      return { porcentaje: 100, texto: 'Entregado', tipo: 'done' }
    }

    if (producto?.fecha_dejado_negocio || estado.includes('negocio')) {
      return { porcentaje: 94, texto: 'Listo para recoger', tipo: 'ready' }
    }

    if (producto?.fecha_recibido || estado.includes('recibido')) {
      return { porcentaje: 88, texto: 'Recibido', tipo: 'received' }
    }

    if (!productoEstaComprado(producto)) {
      return { porcentaje: 12, texto: 'Compra pendiente', tipo: 'pending' }
    }

    if (!producto?.fecha_comprado) {
      return { porcentaje: 45, texto: 'Comprado', tipo: 'moving' }
    }

    const inicio = parsearFechaLocal(producto.fecha_comprado)
    const estimada = parsearFechaLocal(producto?.fecha_estimada_llegada)
    const hoy = new Date()

    if (!inicio || !estimada) {
      return { porcentaje: 45, texto: 'En camino', tipo: 'moving' }
    }

    const totalDias = Math.max(1, Math.ceil((estimada - inicio) / 86400000))
    const diasTranscurridos = Math.max(0, Math.ceil((hoy - inicio) / 86400000))
    const diasFaltantes = Math.ceil((estimada - hoy) / 86400000)
    const porcentaje = Math.min(85, Math.max(22, Math.round((diasTranscurridos / totalDias) * 82)))

    if (diasFaltantes <= 0) {
      return { porcentaje: 86, texto: 'Posiblemente ya llegó', tipo: 'arrival' }
    }

    return {
      porcentaje,
      texto: diasFaltantes === 1 ? 'Falta 1 día' : `Faltan ${diasFaltantes} días`,
      tipo: 'moving'
    }
  }


  const obtenerEtiquetaProgreso = (progreso) => {
    if (progreso?.tipo === 'pending') return 'Compra pendiente'
    if (progreso?.tipo === 'moving') return 'En camino'
    if (progreso?.tipo === 'arrival') return 'Posible llegada'
    if (progreso?.tipo === 'received') return 'Recibido'
    if (progreso?.tipo === 'ready') return 'Listo para recoger'
    if (progreso?.tipo === 'done') return 'Entregado'
    return progreso?.texto || 'En proceso'
  }

  const obtenerEstadoProductoMovil = (progreso) => {
    if (progreso?.tipo === 'pending') return 'Pendiente de compra'
    if (progreso?.tipo === 'moving') return 'En camino'
    if (progreso?.tipo === 'arrival') return 'Posiblemente ya llegó'
    if (progreso?.tipo === 'received') return 'Llegó'
    if (progreso?.tipo === 'ready') return 'Listo para recoger'
    if (progreso?.tipo === 'done') return 'Entregado'
    return progreso?.texto || 'En proceso'
  }

  const renderProgresoProductos = (pedido, compacto = false) => {
    const productosTodos = obtenerProductosPedido(pedido)
    const productosPendientes = productosTodos.filter((producto) => {
      const progreso = calcularProgresoProducto(producto)
      return progreso.tipo !== 'done'
    })

    if (compacto) {
      if (!productosTodos.length) return null

      return (
        <div className="order-products-mobile-list">
          <div className="order-products-mobile-header">
            <span>Productos</span>
            <strong>{productosTodos.length}</strong>
          </div>

          <div className="order-products-mobile-body">
            {productosTodos.slice(0, 5).map((producto, index) => {
              const progreso = calcularProgresoProducto(producto)
              const nombre = producto?.nombre_producto || `Producto ${index + 1}`

              return (
                <div
                  className="order-product-mobile-row"
                  key={producto?.id || `${pedido.id}-${index}`}
                  title={`${nombre}: ${obtenerEstadoProductoMovil(progreso)}`}
                  aria-label={`${nombre}: ${obtenerEstadoProductoMovil(progreso)}`}
                >
                  <span className="order-product-mobile-name">{nombre}</span>
                  <span className={`order-product-mobile-state order-product-mobile-state-${progreso.tipo}`}>
                    {obtenerEstadoProductoMovil(progreso)}
                  </span>
                </div>
              )
            })}
          </div>

          {productosTodos.length > 5 && (
            <small className="order-mini-progress-more">
              +{productosTodos.length - 5} producto{productosTodos.length - 5 === 1 ? '' : 's'} más
            </small>
          )}
        </div>
      )
    }

    if (!productosPendientes.length) return null

    return (
      <div className="order-mini-progress">
        {productosPendientes.slice(0, 8).map((producto, index) => {
          const progreso = calcularProgresoProducto(producto)
          const nombre = producto?.nombre_producto || `Artículo ${index + 1}`

          return (
            <div
              className="order-mini-progress-item"
              key={producto?.id || `${pedido.id}-${index}`}
              title={`${nombre}: ${progreso.texto}`}
              aria-label={`${nombre}: ${progreso.texto}`}
            >
              <small className="order-mini-progress-label">{obtenerEtiquetaProgreso(progreso)}</small>
              <div className={`order-mini-progress-line order-mini-progress-${progreso.tipo}`}>
                <span style={{ width: `${progreso.porcentaje}%` }} />
              </div>
            </div>
          )
        })}

        {productosPendientes.length > 8 && (
          <small className="order-mini-progress-more">+{productosPendientes.length - 8} artículos más</small>
        )}
      </div>
    )
  }

  const esEstadoReembolso = (estado) => {
    const estadoNormal = normalizarEstado(estado)
    return estadoNormal === 'Cancelado' || estadoNormal === 'Devuelto'
  }

  const obtenerEtiquetaReembolso = (estado) => {
    const estadoNormal = normalizarEstado(estado)
    return estadoNormal === 'Devuelto' ? 'Devuelto' : 'Cancelado'
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

    return { tipo: 'pending', texto: 'Pago pendiente' }
  }

  const renderPagoBadge = (pedido, compacto = false, vista = 'desktop') => {
    const estadoPago = obtenerEstadoPago(pedido)
    const esMovil = vista === 'mobile'

    const textosMovil = {
      paid: 'Pagado',
      partial: 'Pago parcial',
      pending: 'Pago pendiente',
      refund: 'Reembolso'
    }

    const texto = esMovil ? (textosMovil[estadoPago.tipo] || estadoPago.texto) : estadoPago.texto

    if (estadoPago.tipo === 'refund') {
      return (
        <span className={`${compacto ? 'refund-status-badge refund-status-badge-small' : 'refund-status-badge'} ${esMovil ? 'payment-status-mobile-top' : ''}`}>
          {texto}
        </span>
      )
    }

    return (
      <span className={`payment-status-badge payment-status-${estadoPago.tipo} ${compacto ? 'payment-status-badge-small' : ''} ${esMovil ? 'payment-status-mobile-top' : ''}`}>
        <i /> <span>{texto}</span>
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
    setCargandoPedidos(true)

    const { data, error } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, telefono, medio_contacto, usuario_contacto), productos_pedido(id, lote_compra_id, nombre_producto, cantidad, entregado, estado_compra, fecha_comprado, fecha_estimada_llegada, fecha_recibido, fecha_dejado_negocio, fecha_entregado_cliente)')
      .order('creado_en', { ascending: false })

    setCargandoPedidos(false)

    if (error) {
      console.log(error)
      mostrarToast('Error al cargar pedidos', 'error')
      return
    }

    const pedidosCargados = data || []
    setTodosPedidos(pedidosCargados)
    guardarPedidosCache(pedidosCargados)
  }

  const limpiarTelefono = (telefono) => {
    return String(telefono || '').replace(/\D/g, '')
  }

  const obtenerMedioContactoVisible = (cliente) => {
    const medio = String(cliente?.medio_contacto || 'WhatsApp').trim()
    const medioNormalizado = medio.toLowerCase()

    if (medioNormalizado.includes('facebook') || medioNormalizado.includes('messenger')) {
      return 'Messenger'
    }

    return medio || 'WhatsApp'
  }

  const obtenerTelefonoWhatsApp = (telefono) => {
    const limpio = limpiarTelefono(telefono)

    if (!limpio) return ''
    if (limpio.startsWith('52') && limpio.length > 10) return limpio

    return `52${limpio}`
  }

  const obtenerContactoCliente = (cliente) => {
    const medio = cliente?.medio_contacto || 'WhatsApp'
    const telefono = limpiarTelefono(cliente?.telefono || '')
    const usuario = String(cliente?.usuario_contacto || '').trim()

    if (medio.toLowerCase().includes('whatsapp') && telefono) return `+52 ${telefono.startsWith('52') ? telefono.slice(2) : telefono}`
    if (usuario) return usuario
    if (telefono) return `+52 ${telefono.startsWith('52') ? telefono.slice(2) : telefono}`
    return 'Sin contacto'
  }

  const obtenerContactoTabla = (cliente) => {
    const medio = String(cliente?.medio_contacto || 'WhatsApp')
    const telefono = limpiarTelefono(cliente?.telefono || '')
    const usuario = String(cliente?.usuario_contacto || '').trim()

    if (medio.toLowerCase().includes('whatsapp') && telefono) {
      return telefono.startsWith('52') && telefono.length > 10 ? telefono.slice(2) : telefono
    }

    if (usuario) return usuario
    if (telefono) return telefono.startsWith('52') && telefono.length > 10 ? telefono.slice(2) : telefono
    return 'Sin contacto'
  }

  const esContactoWhatsApp = (cliente) => {
    return String(cliente?.medio_contacto || 'WhatsApp').toLowerCase().includes('whatsapp')
  }

  const puedeEnviarPorWhatsApp = (cliente) => {
    return esContactoWhatsApp(cliente) && Boolean(obtenerTelefonoWhatsApp(cliente?.telefono))
  }

  const obtenerTextoMedioContacto = (cliente) => {
    const medio = obtenerMedioContactoVisible(cliente)
    const contacto = obtenerContactoCliente(cliente)
    return `${medio}${contacto && contacto !== 'Sin contacto' ? ` · ${contacto}` : ''}`
  }

  const formatearDinero = (valor) => {
    return `$${Number(valor || 0).toFixed(2)}`
  }

  const obtenerPartesFecha = (valor) => {
    if (!valor) return null

    let fecha
    const textoValor = String(valor)

    if (/^\d{4}-\d{2}-\d{2}$/.test(textoValor)) {
      const [anioTexto, mesTexto, diaTexto] = textoValor.split('-')
      fecha = new Date(Number(anioTexto), Number(mesTexto) - 1, Number(diaTexto))
    } else {
      fecha = new Date(valor)
    }

    if (Number.isNaN(fecha.getTime())) return null

    const dia = String(fecha.getDate()).padStart(2, '0')
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const anio = String(fecha.getFullYear())
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ]

    return { fecha, dia, mes, anio, mesNombre: meses[fecha.getMonth()] }
  }

  const formatearFechaConfig = (valor, opciones = {}) => {
    const partes = obtenerPartesFecha(valor)
    if (!partes) return '-'

    const formato = opciones.formato || configFechaPedidos.formato || 'dd/mm/yyyy'
    const mostrarAnio = typeof opciones.mostrarAnio === 'boolean' ? opciones.mostrarAnio : configFechaPedidos.mostrarAnio
    const { dia, mes, anio, mesNombre } = partes

    if (formato === 'yyyy/mm/dd') return mostrarAnio ? `${anio}/${mes}/${dia}` : `${mes}/${dia}`
    if (formato === 'mm/dd/yyyy') return mostrarAnio ? `${mes}/${dia}/${anio}` : `${mes}/${dia}`
    if (formato === 'dd-mm-yyyy') return mostrarAnio ? `${dia}-${mes}-${anio}` : `${dia}-${mes}`
    if (formato === 'texto') return mostrarAnio ? `${Number(dia)} de ${mesNombre} del ${anio}` : `${Number(dia)} de ${mesNombre}`

    return mostrarAnio ? `${dia}/${mes}/${anio}` : `${dia}/${mes}`
  }

  const formatearFechaCorta = (valor) => {
    return formatearFechaConfig(valor)
  }

  const formatearFechaGrupo = (valor) => {
    return formatearFechaConfig(valor, { formato: 'texto', mostrarAnio: configFechaPedidos.mostrarAnio })
  }

  const obtenerClaveFechaGrupo = (valor) => {
    const partes = obtenerPartesFecha(valor)
    if (!partes) return 'sin-fecha'
    return `${partes.anio}-${partes.mes}-${partes.dia}`
  }

  const obtenerResumenProductos = (pedido) => {
    return formatearProductosParaMensaje(obtenerProductosPedido(pedido), formatearDinero)
  }

  const obtenerUrlSeguimiento = (pedido) => {
    if (!pedido?.public_token) return ''
    return `${obtenerBasePublica()}/seguimiento/${pedido.public_token}`
  }

  const generarMensajeEstado = (pedido) => {
    const nombre = pedido?.clientes?.nombre || 'cliente'
    const codigo = pedido?.codigo || ''
    const estado = obtenerEstadoAutomatico(pedido)
    const total = formatearDinero(pedido?.total_cliente)
    const anticipo = formatearDinero(pedido?.anticipo)
    const restante = formatearDinero(pedido?.restante)
    const productosTexto = obtenerResumenProductos(pedido)

    const encabezados = {
      Cotizado: `Hola ${nombre}, tu pedido ${codigo} ya quedó cotizado.`,
      'En camino': `Hola ${nombre}, tu pedido ${codigo} ya va en camino.`,
      Recibido: `Hola ${nombre}, tu pedido ${codigo} ya fue recibido.`,
      'Dejado en negocio': `Hola ${nombre}, tu pedido ${codigo} ya está listo para recoger.`,
      Entregado: `Hola ${nombre}, tu pedido ${codigo} ya fue entregado.`,
      Cancelado: `Hola ${nombre}, te aviso que tu pedido ${codigo} fue cancelado.`,
      Devuelto: `Hola ${nombre}, te aviso que tu pedido ${codigo} fue marcado como devuelto.`
    }

    return `${encabezados[estado] || `Hola ${nombre}, tu pedido ${codigo} fue actualizado.`}

Nombre: ${nombre}
Productos:
${productosTexto}
Estado: ${estado}
Costo total: ${total}
Anticipo: ${anticipo}
Restante: ${restante}`
  }


  const generarMensajeSeguimiento = (pedido) => {
    const url = obtenerUrlSeguimiento(pedido)
    if (!url) return ''

    const nombre = pedido?.clientes?.nombre || 'cliente'
    const codigo = pedido?.codigo || ''

    return `Hola ${nombre}, puedes revisar el seguimiento de tu pedido ${codigo} aquí:
${url}`
  }

  const aplicarCambioEstado = async (pedido, estadoNuevo, opciones = {}) => {
    if (!iniciarAccion('Actualizando estado...')) return false

    try {
      const { data: pedidoActual, error: errorPedidoActual } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedido.id)
        .single()

      if (errorPedidoActual) {
        console.log(errorPedidoActual)
        mostrarToast('No se pudo validar el pedido', 'error')
        return false
      }

      const montoRestante = Math.max(Number(pedidoActual?.restante || pedido.restante || 0), 0)
      let pedidoGuardado = null

      if (estadoNuevo === 'Entregado') {
        if (montoRestante > 0 && opciones.registrarRestante !== true) {
          mostrarToast('Confirma el pago restante para entregar el pedido', 'error')
          return false
        }

        const { data, error } = await supabase.rpc('entregar_pedido_completo', {
          p_pedido_id: pedido.id,
          p_metodo: opciones.metodoPago || metodoPagoEntrega || METODO_PAGO_PREDETERMINADO,
          p_fecha: opciones.fechaPago || fechaPagoEntrega || obtenerFechaLocalHoy()
        })

        if (error) {
          console.log(error)
          mostrarToast(error.message || 'No se pudo confirmar la entrega', 'error')
          return false
        }

        pedidoGuardado = Array.isArray(data) ? data[0] : data
      } else if (esEstadoReembolso(estadoNuevo)) {
        const montoReembolsoFinal = Number(opciones.montoReembolso || 0)
        const montoPagado = Math.max(Number(pedidoActual?.anticipo || 0), 0)

        if (!Number.isFinite(montoReembolsoFinal) || montoReembolsoFinal < 0 || montoReembolsoFinal > montoPagado) {
          mostrarToast('El reembolso debe estar entre $0.00 y lo pagado por el cliente.', 'error')
          return false
        }

        const { data, error } = await supabase.rpc('registrar_reembolso_pedido', {
          p_pedido_id: pedido.id,
          p_estado: estadoNuevo,
          p_monto: montoReembolsoFinal
        })

        if (error) {
          console.log(error)
          mostrarToast(error.message || 'No se pudo guardar el reembolso', 'error')
          return false
        }

        pedidoGuardado = Array.isArray(data) ? data[0] : data
      } else {
        const { data, error } = await supabase
          .from('pedidos')
          .update({ estado: estadoNuevo, reembolso: false, reembolso_monto: 0 })
          .eq('id', pedido.id)
          .select()
          .single()

        if (error) {
          console.log(error)
          mostrarToast('Error al cambiar estado', 'error')
          return false
        }

        pedidoGuardado = data
      }

      const pedidoActualizado = {
        ...pedido,
        ...pedidoGuardado
      }

      setTodosPedidos((actuales) =>
        actuales.map((item) =>
          item.id === pedido.id ? pedidoActualizado : item
        )
      )

      setPedidoMensaje(pedidoActualizado)
      setModalMensaje(true)
      mostrarToast(esEstadoReembolso(estadoNuevo) ? 'Pedido marcado como reembolso' : 'Estado actualizado correctamente')
      cargarPedidos()
      return true
    } finally {
      finalizarAccion()
    }
  }

  const cambiarEstado = async (pedido, estado) => {
    if (bloquearSiNoPuede()) return
    if (accionEnProcesoRef.current) return

    const estadoAnterior = normalizarEstado(pedido.estado)
    const estadoNuevo = normalizarEstado(estado)

    if (estadoAnterior === estadoNuevo) return

    const montoRestante = Math.max(Number(pedido.restante || 0), 0)

    if (estadoNuevo === 'Entregado' && montoRestante > 0) {
      setEntregaPendiente({ pedido, estadoNuevo, montoRestante })
      setMetodoPagoEntrega(METODO_PAGO_PREDETERMINADO)
      setFechaPagoEntrega(obtenerFechaLocalHoy())
      setModalConfirmarEntrega(true)
      return
    }

    if (esEstadoReembolso(estadoNuevo)) {
      const montoPagado = Math.max(Number(pedido.anticipo || 0), 0)
      setReembolsoPendiente({ pedido, estadoNuevo, montoPagado })
      setMontoReembolso(montoPagado.toFixed(2))
      setModalConfirmarReembolso(true)
      return
    }

    await aplicarCambioEstado(pedido, estadoNuevo)
  }

  const confirmarEntregaPedidoLista = async () => {
    if (!entregaPendiente?.pedido) return
    const listo = await aplicarCambioEstado(entregaPendiente.pedido, 'Entregado', {
      registrarRestante: true,
      metodoPago: metodoPagoEntrega,
      fechaPago: fechaPagoEntrega
    })
    if (listo) {
      setModalConfirmarEntrega(false)
      setEntregaPendiente(null)
    }
  }

  const aplicarMontoReembolsoRapido = (tipo) => {
    const montoPagado = Math.max(Number(reembolsoPendiente?.montoPagado || 0), 0)

    if (tipo === 'todo') {
      setMontoReembolso(montoPagado.toFixed(2))
      return
    }

    if (tipo === 'mitad') {
      setMontoReembolso((montoPagado / 2).toFixed(2))
      return
    }

    setMontoReembolso('0.00')
  }

  const confirmarReembolsoPedidoLista = async () => {
    if (!reembolsoPendiente?.pedido) return

    const listo = await aplicarCambioEstado(reembolsoPendiente.pedido, reembolsoPendiente.estadoNuevo, {
      montoReembolso: montoReembolso
    })

    if (listo) {
      setModalConfirmarReembolso(false)
      setReembolsoPendiente(null)
      setMontoReembolso('')
    }
  }

  const enviarMensajeWhatsApp = () => {
    if (!pedidoMensaje) return

    if (!puedeEnviarPorWhatsApp(pedidoMensaje?.clientes)) {
      mostrarToast('Este cliente no está configurado para WhatsApp. Copia el mensaje y envíalo por su medio de contacto.', 'error')
      return
    }

    const telefono = obtenerTelefonoWhatsApp(pedidoMensaje?.clientes?.telefono)
    const mensaje = encodeURIComponent(generarMensajeEstado(pedidoMensaje))
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank')
  }

  const enviarMensajePedidoDirecto = (pedido) => {
    setMenuAccionesAbierto(null)
    setMenuEstadoAbierto(null)
    setEstiloMenuAcciones(null)
    setEstiloMenuEstado(null)

    if (!puedeEnviarPorWhatsApp(pedido?.clientes)) {
      setPedidoMensaje(pedido)
      setModalMensaje(true)
      mostrarToast('Cliente registrado por otro medio. Copia el mensaje para enviarlo manualmente.', 'success')
      return
    }

    const telefono = obtenerTelefonoWhatsApp(pedido?.clientes?.telefono)
    const mensaje = encodeURIComponent(generarMensajeEstado(pedido))
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank')
  }

  const abrirModalSeguimiento = (pedido) => {
    setMenuAccionesAbierto(null)
    setMenuEstadoAbierto(null)
    setEstiloMenuAcciones(null)
    setEstiloMenuEstado(null)
    setPedidoSeguimiento(pedido)
    setModalSeguimiento(true)
  }

  const copiarLinkSeguimiento = async () => {
    const url = obtenerUrlSeguimiento(pedidoSeguimiento)

    if (!url) {
      mostrarToast('Este pedido no tiene link de seguimiento', 'error')
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      mostrarToast('Link de seguimiento copiado')
    } catch (error) {
      console.log(error)
      mostrarToast('No se pudo copiar el link', 'error')
    }
  }

  const enviarSeguimientoPedido = async (pedidoBase) => {
    const texto = generarMensajeSeguimiento(pedidoBase)

    if (!texto) {
      mostrarToast('Este pedido no tiene link de seguimiento', 'error')
      return
    }

    if (!puedeEnviarPorWhatsApp(pedidoBase?.clientes)) {
      try {
        await navigator.clipboard.writeText(texto)
        mostrarToast('Seguimiento copiado. Envíalo por el medio del cliente.')
      } catch (error) {
        console.log(error)
        mostrarToast('No se pudo copiar el seguimiento', 'error')
      }
      return
    }

    const telefono = obtenerTelefonoWhatsApp(pedidoBase?.clientes?.telefono)
    const mensaje = encodeURIComponent(texto)
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank')
  }

  const enviarLinkSeguimiento = async () => {
    if (!pedidoSeguimiento) return
    await enviarSeguimientoPedido(pedidoSeguimiento)
  }

  const copiarContactoMensaje = async (pedidoBase = pedidoMensaje) => {
    const contacto = obtenerContactoCliente(pedidoBase?.clientes)

    if (!contacto || contacto === 'Sin contacto') {
      mostrarToast('Este cliente no tiene contacto guardado', 'error')
      return
    }

    try {
      await navigator.clipboard.writeText(contacto)
      mostrarToast('Contacto copiado')
    } catch (error) {
      console.log(error)
      mostrarToast('No se pudo copiar el contacto', 'error')
    }
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

  const solicitarEstadoEspecialLista = (pedido, estadoNuevo) => {
    setMenuAccionesAbierto(null)
    setMenuEstadoAbierto(null)
    setEstiloMenuAcciones(null)
    setEstiloMenuEstado(null)
    cambiarEstado(pedido, estadoNuevo)
  }

  const solicitarEliminarPedido = (pedido) => {
    setMenuAccionesAbierto(null)
    setMenuEstadoAbierto(null)
    setEstiloMenuAcciones(null)
    setEstiloMenuEstado(null)
    if (bloquearSiNoPuede()) return
    if ((pedido?.productos_pedido || []).some((producto) => producto.lote_compra_id)) {
      mostrarToast('Este pedido ya forma parte del historial de compras y no se puede eliminar.', 'error')
      return
    }
    setPedidoAEliminar(pedido)
  }

  const eliminarPedidoConfirmado = async () => {
    if (!pedidoAEliminar) return
    if (!iniciarAccion('Eliminando pedido...')) return

    const id = pedidoAEliminar.id

    try {
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', id)

      if (error) {
        console.log(error)
        mostrarToast(error.message || 'No se pudo eliminar el pedido. Intenta nuevamente.', 'error')
        return
      }

      const pedidosActualizados = todosPedidos.filter((pedido) => pedido.id !== id)
      setTodosPedidos(pedidosActualizados)
      guardarPedidosCache(pedidosActualizados)
      setPedidoAEliminar(null)

      mostrarToast('El pedido se eliminó correctamente.')
      cargarPedidos()
    } finally {
      finalizarAccion()
    }
  }


  const renderEstadoControl = (pedido, compacto = false) => {
    const estadoActual = obtenerEstadoAutomatico(pedido)

    return (
      <span className={`order-status-static badge ${estadoClase(estadoActual)} ${compacto ? 'order-status-static-mobile' : ''}`.trim()}>
        <span className="order-status-dot" />
        <span>{estadoActual}</span>
      </span>
    )
  }

  const datosVistaPedidos = (() => {
    const texto = busqueda.trim().toLowerCase()

    let coincidencias = todosPedidos.filter((pedido) => {
      if (filtroPlataforma !== 'Todas' && (pedido.plataforma || 'SHEIN') !== filtroPlataforma) {
        return false
      }

      if (!texto) return true

      const estadoAutomatico = obtenerEstadoAutomatico(pedido)
      const plataformaPedido = pedido.plataforma || 'SHEIN'
      const pagoTexto = obtenerEstadoPago(pedido).texto.toLowerCase()
      const productosTexto = obtenerProductosPedido(pedido)
        .map((producto) => `${producto?.nombre_producto || ''} ${producto?.cantidad || ''}`)
        .join(' ')
        .toLowerCase()
      const fechaCompra = formatearFechaCorta(obtenerFechaCompraPedido(pedido)).toLowerCase()

      return (
        pedido.codigo?.toLowerCase().includes(texto) ||
        plataformaPedido.toLowerCase().includes(texto) ||
        pedido.clientes?.nombre?.toLowerCase().includes(texto) ||
        pedido.clientes?.telefono?.toLowerCase().includes(texto) ||
        pedido.clientes?.medio_contacto?.toLowerCase().includes(texto) ||
        pedido.clientes?.usuario_contacto?.toLowerCase().includes(texto) ||
        estadoAutomatico.toLowerCase().includes(texto) ||
        pagoTexto.includes(texto) ||
        productosTexto.includes(texto) ||
        fechaCompra.includes(texto)
      )
    })

    const pendientes = coincidencias
      .filter((pedido) => !pedidoEstaComprado(pedido))
      .sort((a, b) => {
        const fechaB = parsearFechaLocal(b.fecha_pedido || b.creado_en)?.getTime() || 0
        const fechaA = parsearFechaLocal(a.fecha_pedido || a.creado_en)?.getTime() || 0
        return fechaB - fechaA
      })

    let comprados = coincidencias.filter(pedidoEstaComprado)

    if (fechaDesde || fechaHasta) {
      comprados = comprados.filter((pedido) => {
        const fechaCompra = obtenerFechaCompraPedido(pedido)
        if (!fechaCompra) return false
        const fecha = fechaCompra.slice(0, 10)
        if (fechaDesde && fecha < fechaDesde) return false
        if (fechaHasta && fecha > fechaHasta) return false
        return true
      })
    }

    comprados.sort((a, b) => {
      const fechaB = parsearFechaLocal(obtenerFechaCompraPedido(b))?.getTime() || 0
      const fechaA = parsearFechaLocal(obtenerFechaCompraPedido(a))?.getTime() || 0
      return fechaB - fechaA
    })

    return {
      pendientes,
      comprados,
      resumen: {
        pendientes: pendientes.length,
        comprados: comprados.length
      }
    }
  })()

  const resumenCompra = datosVistaPedidos.resumen
  const listaActiva = vistaCompra === 'comprados' ? datosVistaPedidos.comprados : datosVistaPedidos.pendientes
  const totalPedidos = listaActiva.length
  const totalPaginas = Math.max(1, Math.ceil(totalPedidos / tamanoPagina))
  const desde = (pagina - 1) * tamanoPagina
  const pedidosFiltrados = listaActiva.slice(desde, desde + tamanoPagina)

  const pedidosAgrupados = (() => {
    if (vistaCompra !== 'comprados' || !agruparComprados) {
      return [{ clave: vistaCompra, fecha: '', pedidos: pedidosFiltrados }]
    }

    const mapa = new Map()

    pedidosFiltrados.forEach((pedido) => {
      const fechaBase = obtenerFechaCompraPedido(pedido)
      const clave = obtenerClaveFechaGrupo(fechaBase)
      const fecha = clave === 'sin-fecha' ? 'Compra sin fecha' : formatearFechaGrupo(fechaBase)

      if (!mapa.has(clave)) mapa.set(clave, { clave, fecha, pedidos: [] })
      mapa.get(clave).pedidos.push(pedido)
    })

    return Array.from(mapa.values())
  })()

  const renderCompraYAvance = (pedido) => {
    const conteo = obtenerConteoCompraPedido(pedido)
    const productos = obtenerProductosPedido(pedido)

    return (
      <div className="order-purchase-progress-cell order-purchase-products-cell">
        <div className="order-purchase-status-row">
          {renderEstadoControl(pedido)}
          <small>
            {pedidoEstaComprado(pedido)
              ? obtenerResumenCompraPedido(pedido)
              : `${conteo.comprados}/${conteo.total} comprados`}
          </small>
        </div>

        {productos.length > 0 ? (
          <div className="order-products-desktop-list">
            {productos.slice(0, 3).map((producto, index) => {
              const progreso = calcularProgresoProducto(producto)
              const nombre = producto?.nombre_producto || `Producto ${index + 1}`

              return (
                <div
                  className="order-product-desktop-row"
                  key={producto?.id || `${pedido.id}-desktop-${index}`}
                  title={`${nombre}: ${obtenerEstadoProductoMovil(progreso)}`}
                >
                  <span className="order-product-desktop-name">{nombre}</span>
                  <span className={`order-product-desktop-state order-product-desktop-state-${progreso.tipo}`}>
                    {obtenerEstadoProductoMovil(progreso)}
                  </span>
                </div>
              )
            })}

            {productos.length > 3 && (
              <small className="order-products-desktop-more">
                +{productos.length - 3} producto{productos.length - 3 === 1 ? '' : 's'} más
              </small>
            )}
          </div>
        ) : (
          <small className="order-products-desktop-empty">Sin productos registrados</small>
        )}
      </div>
    )
  }

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas)
  }, [pagina, totalPaginas])

  const filtrosActivos =
    busqueda.trim() !== '' ||
    filtroPlataforma !== 'Todas' ||
    fechaDesde !== '' ||
    fechaHasta !== ''

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroPlataforma('Todas')
    setFechaDesde('')
    setFechaHasta('')
    setPagina(1)
  }

  const irPaginaAnterior = () => {
    setPagina((actual) => Math.max(1, actual - 1))
  }

  const irPaginaSiguiente = () => {
    setPagina((actual) => Math.min(totalPaginas, actual + 1))
  }

  const desdeVisible = totalPedidos === 0 ? 0 : ((pagina - 1) * tamanoPagina) + 1
  const hastaVisible = Math.min(pagina * tamanoPagina, totalPedidos)

  return (
    <Layout>
      <PageHelp page="pedidos" />

      <Toast
        mensaje={toast?.mensaje}
        tipo={toast?.tipo}
        onClose={() => setToast(null)}
      />

      <div className="page-header pedidos-page-header pedidos-page-header-simple">
        <div className="pedidos-simple-title-row">
          <div>
            <span className="page-kicker">Pedidos</span>
            <h1>Pedidos</h1>
            <p>Separa lo que falta comprar de lo que ya pediste en plataforma.</p>
          </div>

          {puedeCrearPedido(estadoPlan) ? (
            <Link to="/nuevo-pedido" className="btn btn-primary btn-new-order-small">
              ＋ Nuevo pedido
            </Link>
          ) : (
            <Link to="/planes" className="btn btn-light-bordered btn-new-order-small">
              Actualizar plan
            </Link>
          )}
        </div>

        <div className="pedidos-search-toolbar">
          <label className="pedidos-search-field">
            <span>Buscar</span>
            <input
              placeholder="Código, cliente, teléfono, producto o estado"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>

          <button
            type="button"
            className={`btn btn-light-bordered pedidos-filter-button ${filtrosActivos ? 'pedidos-filter-button-active' : ''}`}
            onClick={() => setModalFiltros(true)}
          >
            Filtros {filtrosActivos ? '•' : ''}
          </button>

          {filtrosActivos && (
            <button type="button" className="pedidos-clear-button" onClick={limpiarFiltros}>
              Limpiar
            </button>
          )}
        </div>
      </div>

      <PlanLimitNotice estadoPlan={estadoPlan} compacto />

      <section className="order-purchase-view-tabs" aria-label="Estado de compra de los pedidos">
        <button
          type="button"
          className={vistaCompra === 'pendientes' ? 'active' : ''}
          onClick={() => {
            setVistaCompra('pendientes')
            setFechaDesde('')
            setFechaHasta('')
          }}
        >
          <span>Por comprar</span>
          <strong>{resumenCompra.pendientes}</strong>
        </button>
        <button
          type="button"
          className={vistaCompra === 'comprados' ? 'active' : ''}
          onClick={() => setVistaCompra('comprados')}
        >
          <span>Ya comprados</span>
          <strong>{resumenCompra.comprados}</strong>
        </button>
      </section>

      {vistaCompra === 'pendientes' && (
        <div className="order-purchase-guidance">
          <div>
            <span>Estos pedidos todavía tienen productos sin comprar.</span>
            <strong>Selecciona los productos y registra la compra desde el apartado Compras.</strong>
          </div>
          <Link to="/compras" className="btn btn-primary">Ir a Compras</Link>
        </div>
      )}

      {filtrosActivos && (
        <div className="active-filters-card">
          <div>
            <span>Filtros activos</span>
            <strong>
              {busqueda || 'Sin texto'} · {filtroPlataforma}
              {(fechaDesde || fechaHasta) ? ` · Fecha de compra: ${fechaDesde || 'Inicio'} a ${fechaHasta || 'Hoy'}` : ''}
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
              placeholder="Código, cliente, teléfono, producto, fecha o estado"
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
              {PLATAFORMAS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          {vistaCompra === 'comprados' ? (
            <>
              <div className="filters-date-grid">
                <div className="form-field">
                  <label>Compra desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Compra hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                  />
                </div>
              </div>

              <label className="config-switch-row filters-date-group-switch">
                <div>
                  <strong>Agrupar por fecha de compra</strong>
                  <span>Separa los pedidos usando el día en que terminaste de comprarlos.</span>
                </div>
                <input
                  type="checkbox"
                  checked={agruparComprados}
                  onChange={(e) => setAgruparComprados(e.target.checked)}
                />
              </label>
            </>
          ) : (
            <div className="order-pending-filter-note">
              Los pedidos pendientes todavía no tienen fecha de compra. Regístralos desde la sección Compras.
            </div>
          )}

          <div className="form-field">
            <label>Mostrar por página</label>
            <select
              value={tamanoPagina}
              onChange={(e) => setTamanoPagina(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((opcion) => (
                <option key={opcion} value={opcion}>{opcion}</option>
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

      <div className="table-card desktop-table pedidos-table-card pedidos-table-simple pedidos-table-instant">
        <div className="row-between table-title">
          <h2>{vistaCompra === 'comprados' ? 'Ya comprados' : 'Por comprar'} · {totalPedidos}</h2>
          <span className="pagination-range">
            {cargandoPedidos ? 'Actualizando...' : `${desdeVisible}-${hastaVisible} de ${totalPedidos}`}
          </span>
        </div>

        <table className="pedidos-table pedidos-table-compact">
          <thead>
            <tr>
              <th>Pedido / cliente</th>
              <th>Compra y avance</th>
              <th>Cobro</th>
              <th className="actions-th">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {pedidosAgrupados.map((grupo) => (
              <Fragment key={grupo.clave}>
                {vistaCompra === 'comprados' && agruparComprados && (
                  <tr className="orders-date-divider-row">
                    <td colSpan="4">
                      <div className="orders-date-divider">
                        <span>{grupo.fecha}</span>
                      </div>
                    </td>
                  </tr>
                )}

                {grupo.pedidos.map((pedido) => {
                  const menuAbierto = menuAccionesAbierto === pedido.id

                  return (
                    <Fragment key={pedido.id}>
                      <tr
                        className={`${esEstadoReembolso(pedido.estado) ? 'refund-censored-row' : ''} ${(menuAbierto || menuEstadoAbierto === pedido.id) ? 'order-row-menu-open' : ''}`.trim()}
                        data-refund-label={esEstadoReembolso(pedido.estado) ? obtenerEtiquetaReembolso(pedido.estado) : undefined}
                      >
                        <td className="order-summary-cell">
                          <div className="order-summary-main">
                            <strong>{pedido.codigo}</strong>
                            <span>{pedido.plataforma || 'SHEIN'}</span>
                          </div>
                          <p>{pedido.clientes?.nombre || 'Sin cliente'}</p>
                          <small>{obtenerResumenCompraPedido(pedido)}</small>
                        </td>

                        <td className="status-cell order-status-simple">
                          {renderCompraYAvance(pedido)}
                        </td>

                        <td className="payment-cell order-payment-simple">
                          {renderPagoBadge(pedido, true)}
                          <small>Total: {formatearDinero(pedido.total_cliente)}</small>
                          <strong className="order-payment-remaining">
                            {Number(pedido.restante || 0) > 0
                              ? `Pendiente: ${formatearDinero(pedido.restante)}`
                              : 'Sin saldo pendiente'}
                          </strong>
                        </td>


                        <td className="actions-menu-cell">
                          <div className="actions-compact order-actions-inline">
                            <Link to={`/pedidos/${pedido.id}`} className="btn btn-small btn-action-view">
                              Ver pedido
                            </Link>

                            <div className={`order-actions-dropdown-wrap ${menuAbierto ? 'order-actions-dropdown-open' : ''}`}>
                              <button
                                type="button"
                                className="btn btn-light-bordered btn-small btn-action-more"
                                onClick={(evento) => {
                                  if (menuAbierto) {
                                    setMenuAccionesAbierto(null)
                                    setEstiloMenuAcciones(null)
                                    return
                                  }

                                  const estilo = obtenerEstiloMenuPortal(evento.currentTarget, 200, 210, 'derecha')
                                  setMenuEstadoAbierto(null)
                                  setEstiloMenuEstado(null)
                                  setEstiloMenuAcciones(estilo)
                                  setMenuAccionesAbierto(pedido.id)
                                }}
                                aria-haspopup="menu"
                                aria-expanded={menuAbierto}
                              >
                                •••
                              </button>

                              {menuAbierto && typeof document !== 'undefined' && !window.matchMedia('(max-width: 800px)').matches && createPortal(
                                <div className="order-actions-dropdown order-actions-dropdown-portal" role="menu" style={estiloMenuAcciones}>
                                  <button type="button" onClick={() => { setMenuAccionesAbierto(null); setEstiloMenuAcciones(null); enviarMensajePedidoDirecto(pedido) }} role="menuitem">
                                    Enviar mensaje
                                  </button>
                                  <button type="button" onClick={() => { setMenuAccionesAbierto(null); setEstiloMenuAcciones(null); abrirModalSeguimiento(pedido) }} role="menuitem">
                                    Enviar seguimiento
                                  </button>
                                  {obtenerEstadoAutomatico(pedido) === 'Entregado' ? (
                                    <button type="button" onClick={() => { setMenuAccionesAbierto(null); setEstiloMenuAcciones(null); solicitarEstadoEspecialLista(pedido, 'Devuelto') }} className="danger" disabled={bloqueado || estaProcesando} role="menuitem">
                                      Marcar como devuelto
                                    </button>
                                  ) : !esEstadoReembolso(pedido.estado) ? (
                                    <button type="button" onClick={() => { setMenuAccionesAbierto(null); setEstiloMenuAcciones(null); solicitarEstadoEspecialLista(pedido, 'Cancelado') }} className="danger" disabled={bloqueado || estaProcesando} role="menuitem">
                                      Cancelar pedido
                                    </button>
                                  ) : null}
                                  <button type="button" onClick={() => { setMenuAccionesAbierto(null); setEstiloMenuAcciones(null); solicitarEliminarPedido(pedido) }} className="danger" disabled={bloqueado || estaProcesando} role="menuitem">
                                    Eliminar pedido
                                  </button>
                                </div>,
                                document.body
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

                    </Fragment>
                  )
                })}
              </Fragment>
            ))}

            {pedidosFiltrados.length === 0 && (
              <tr>
                <td colSpan="4">
                  <EmptyState
                    icon={filtrosActivos ? 'search' : 'orders'}
                    eyebrow={filtrosActivos ? 'Sin resultados' : 'Empieza aquí'}
                    title={filtrosActivos ? 'No encontramos pedidos con esos filtros.' : (vistaCompra === 'comprados' ? 'Todavía no tienes pedidos comprados.' : 'No tienes pedidos pendientes de compra.')}
                    description={filtrosActivos
                      ? 'Prueba con otro texto, cambia la plataforma o limpia los filtros.'
                      : (vistaCompra === 'comprados'
                        ? 'Cuando registres una compra desde Compras, el pedido aparecerá aquí con su fecha.'
                        : 'Los pedidos nuevos aparecerán aquí hasta que termines de comprarlos.')}
                    actionLabel={filtrosActivos ? 'Limpiar filtros' : (vistaCompra === 'comprados' ? 'Ir a Compras' : 'Crear pedido')}
                    actionTo={filtrosActivos ? undefined : (vistaCompra === 'comprados' ? '/compras' : '/nuevo-pedido')}
                    onAction={filtrosActivos ? limpiarFiltros : undefined}
                    compact
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-list pedidos-mobile-simple">
        <div className="mobile-list-title">
          <h2>{vistaCompra === 'comprados' ? 'Ya comprados' : 'Por comprar'} · {totalPedidos}</h2>
          <span className="pagination-range">
            {cargandoPedidos ? 'Actualizando...' : `${desdeVisible}-${hastaVisible} de ${totalPedidos}`}
          </span>
        </div>

        {pedidosAgrupados.map((grupo) => (
          <Fragment key={grupo.clave}>
            {vistaCompra === 'comprados' && agruparComprados && (
              <div className="mobile-date-divider">
                <span>{grupo.fecha}</span>
              </div>
            )}

            {grupo.pedidos.map((pedido) => {
              const menuAbierto = menuAccionesAbierto === pedido.id

              return (
                <article
                  className={`mobile-card mobile-order-card-simple ${esEstadoReembolso(pedido.estado) ? 'refund-censored-card' : ''}`}
                  data-refund-label={esEstadoReembolso(pedido.estado) ? obtenerEtiquetaReembolso(pedido.estado) : undefined}
                  key={pedido.id}
                >
                  <div className="mobile-order-simple-head">
                    <div>
                      <div className="mobile-order-code-line">
                        <strong>{pedido.codigo}</strong>
                        <span>{pedido.plataforma || 'SHEIN'}</span>
                      </div>
                      <h3>{pedido.clientes?.nombre || 'Sin cliente'}</h3>
                      <p>{obtenerMedioContactoVisible(pedido.clientes)} · {obtenerContactoTabla(pedido.clientes)}</p>
                    </div>
                    {renderPagoBadge(pedido, true, 'mobile')}
                  </div>

                  <div className="mobile-order-simple-state">
                    {renderEstadoControl(pedido, true)}
                  </div>

                  <small className="mobile-order-purchase-date mobile-order-purchase-date-below-state">
                    {obtenerResumenCompraPedido(pedido)}
                  </small>

                  <div className="mobile-order-simple-money">
                    <div>
                      <span>Total</span>
                      <strong>{formatearDinero(pedido.total_cliente)}</strong>
                    </div>
                    <div>
                      <span>Restante</span>
                      <strong>{formatearDinero(pedido.restante)}</strong>
                    </div>
                  </div>


                  {renderProgresoProductos(pedido, true)}

                  <div className="mobile-card-actions mobile-order-actions-simple">
                    <Link to={`/pedidos/${pedido.id}`} className="btn btn-primary">
                      Ver pedido
                    </Link>

                    <button type="button" onClick={() => abrirModalSeguimiento(pedido)} className="btn btn-light-bordered">
                      Seguimiento
                    </button>

                    <div className={`order-actions-dropdown-wrap ${menuAbierto ? 'order-actions-dropdown-open' : ''}`}>
                      <button
                        type="button"
                        className="btn btn-light-bordered"
                        onClick={(evento) => {
                          if (menuAbierto) {
                            setMenuAccionesAbierto(null)
                            setEstiloMenuAcciones(null)
                            return
                          }

                          const estilo = obtenerEstiloMenuPortal(evento.currentTarget, 210, 210, 'derecha')
                          setMenuEstadoAbierto(null)
                          setEstiloMenuEstado(null)
                          setEstiloMenuAcciones(estilo)
                          setMenuAccionesAbierto(pedido.id)
                        }}
                      >
                        Más
                      </button>

                      {menuAbierto && typeof document !== 'undefined' && window.matchMedia('(max-width: 800px)').matches && createPortal(
                        <div className="order-actions-dropdown order-actions-dropdown-portal" role="menu" style={estiloMenuAcciones}>
                          <button type="button" onClick={() => { setMenuAccionesAbierto(null); setEstiloMenuAcciones(null); enviarMensajePedidoDirecto(pedido) }} role="menuitem">
                            Enviar mensaje
                          </button>
                          {obtenerEstadoAutomatico(pedido) === 'Entregado' ? (
                            <button type="button" onClick={() => { setMenuAccionesAbierto(null); setEstiloMenuAcciones(null); solicitarEstadoEspecialLista(pedido, 'Devuelto') }} className="danger" disabled={bloqueado || estaProcesando} role="menuitem">
                              Marcar como devuelto
                            </button>
                          ) : !esEstadoReembolso(pedido.estado) ? (
                            <button type="button" onClick={() => { setMenuAccionesAbierto(null); setEstiloMenuAcciones(null); solicitarEstadoEspecialLista(pedido, 'Cancelado') }} className="danger" disabled={bloqueado || estaProcesando} role="menuitem">
                              Cancelar pedido
                            </button>
                          ) : null}
                          <button type="button" onClick={() => { setMenuAccionesAbierto(null); setEstiloMenuAcciones(null); solicitarEliminarPedido(pedido) }} className="danger" disabled={bloqueado || estaProcesando} role="menuitem">
                            Eliminar pedido
                          </button>
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </Fragment>
        ))}

        {pedidosFiltrados.length === 0 && (
          <EmptyState
            icon={filtrosActivos ? 'search' : 'orders'}
            eyebrow={filtrosActivos ? 'Sin resultados' : 'Empieza aquí'}
            title={filtrosActivos ? 'No encontramos pedidos.' : 'Todavía no tienes pedidos.'}
            description={filtrosActivos
              ? 'Cambia los filtros o limpia la búsqueda para volver a ver tus pedidos.'
              : 'Crea el primero para empezar a controlar pagos y entregas.'}
            actionLabel={filtrosActivos ? 'Limpiar filtros' : (vistaCompra === 'comprados' ? 'Ir a Compras' : 'Crear pedido')}
            actionTo={filtrosActivos ? undefined : (vistaCompra === 'comprados' ? '/compras' : '/nuevo-pedido')}
            onAction={filtrosActivos ? limpiarFiltros : undefined}
            compact
            className="orders-empty-mobile"
          />
        )}
      </div>

      {totalPedidos > tamanoPagina && (
        <div className="pagination-card">
          <button type="button" className="btn btn-light-bordered" onClick={irPaginaAnterior} disabled={pagina <= 1 || cargandoPedidos}>
            Anterior
          </button>

          <div>
            <strong>Página {pagina} de {totalPaginas}</strong>
            <span>{desdeVisible}-{hastaVisible} de {totalPedidos}</span>
          </div>

          <button type="button" className="btn btn-light-bordered" onClick={irPaginaSiguiente} disabled={pagina >= totalPaginas || cargandoPedidos}>
            Siguiente
          </button>
        </div>
      )}

      <Modal
        abierto={modalConfirmarEntrega}
        titulo="Confirmar entrega"
        onClose={() => {
          if (estaProcesando) return
          setModalConfirmarEntrega(false)
          setEntregaPendiente(null)
        }}
      >
        {entregaPendiente?.pedido && (
          <div className="confirm-delivery-modal">
            <p className="muted">
              Este pedido tiene saldo pendiente. Confirma que el cliente pagó el restante para marcarlo como entregado.
            </p>

            <div className="confirm-delivery-amount">
              <span>Restante a cobrar</span>
              <strong>{formatearDinero(entregaPendiente.montoRestante)}</strong>
            </div>

            <div className="modal-form-grid">
              <label className="form-field">
                <span>Método del pago*</span>
                <select
                  value={metodoPagoEntrega}
                  onChange={(event) => setMetodoPagoEntrega(event.target.value)}
                  disabled={estaProcesando}
                  required
                >
                  {METODOS_PAGO.map((metodo) => (
                    <option value={metodo} key={metodo}>{metodo}</option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Fecha del pago*</span>
                <input
                  type="date"
                  value={fechaPagoEntrega}
                  onChange={(event) => setFechaPagoEntrega(event.target.value)}
                  disabled={estaProcesando}
                  required
                />
              </label>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-light-bordered"
                onClick={() => {
                  setModalConfirmarEntrega(false)
                  setEntregaPendiente(null)
                }}
                disabled={estaProcesando}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmarEntregaPedidoLista}
                disabled={bloqueado || estaProcesando || !metodoPagoEntrega || !fechaPagoEntrega}
              >
                {accionEnProceso || 'Confirmar pago y entrega'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        abierto={modalConfirmarReembolso}
        titulo={`Confirmar ${reembolsoPendiente?.estadoNuevo || 'reembolso'}`}
        onClose={() => {
          if (estaProcesando) return
          setModalConfirmarReembolso(false)
          setReembolsoPendiente(null)
          setMontoReembolso('')
        }}
      >
        {reembolsoPendiente?.pedido && (
          <div className="refund-confirm-modal">
            <p className="muted">
              Este pedido quedará como {reembolsoPendiente.estadoNuevo} y no contará para estadísticas.
            </p>

            <div className="confirm-delivery-amount">
              <span>Pagado por el cliente</span>
              <strong>{formatearDinero(reembolsoPendiente.montoPagado)}</strong>
            </div>

            <div className="refund-quick-actions">
              <button type="button" className="btn btn-light-bordered" onClick={() => aplicarMontoReembolsoRapido('todo')} disabled={estaProcesando}>
                Devolví todo
              </button>
              <button type="button" className="btn btn-light-bordered" onClick={() => aplicarMontoReembolsoRapido('mitad')} disabled={estaProcesando}>
                Devolví la mitad
              </button>
              <button type="button" className="btn btn-light-bordered" onClick={() => aplicarMontoReembolsoRapido('nada')} disabled={estaProcesando}>
                No devolví nada
              </button>
            </div>

            <label className="form-field">
              <span>Cuánto devolviste</span>
              <input
                type="number"
                min="0"
                max={Math.max(Number(reembolsoPendiente?.montoPagado || 0), 0)}
                step="0.01"
                value={montoReembolso}
                onChange={(e) => setMontoReembolso(e.target.value)}
                disabled={estaProcesando}
              />
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-light-bordered"
                onClick={() => {
                  setModalConfirmarReembolso(false)
                  setReembolsoPendiente(null)
                  setMontoReembolso('')
                }}
                disabled={estaProcesando}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmarReembolsoPedidoLista}
                disabled={bloqueado || estaProcesando}
              >
                {accionEnProceso || 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        abierto={modalSeguimiento}
        titulo="Enviar seguimiento"
        onClose={() => setModalSeguimiento(false)}
      >
        {pedidoSeguimiento && (
          <div className="tracking-link-modal">
            <p className="muted">
              Este envío contiene únicamente el enlace para que el cliente consulte su pedido.
            </p>
            <div className="contact-delivery-hint">
              <span>Medio del cliente</span>
              <strong>{obtenerTextoMedioContacto(pedidoSeguimiento.clientes)}</strong>
            </div>

            <div className="tracking-link-box">
              {obtenerUrlSeguimiento(pedidoSeguimiento) || 'Este pedido todavía no tiene link de seguimiento.'}
            </div>

            <div className="modal-actions modal-actions-wrap">
              <button
                type="button"
                className="btn btn-primary"
                onClick={copiarLinkSeguimiento}
              >
                Copiar link
              </button>

              <button
                type="button"
                className="btn btn-light-bordered"
                onClick={enviarLinkSeguimiento}
              >
                {puedeEnviarPorWhatsApp(pedidoSeguimiento.clientes) ? 'Enviar seguimiento' : 'Copiar seguimiento'}
              </button>

              <button
                type="button"
                className="btn btn-light-bordered"
                onClick={() => setModalSeguimiento(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

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
              <span className={`badge ${estadoClase(obtenerEstadoAutomatico(pedidoMensaje))}`}>
                {obtenerEstadoAutomatico(pedidoMensaje)}
              </span>
            </div>

            <p className="muted">
              {puedeEnviarPorWhatsApp(pedidoMensaje.clientes)
                ? 'Puedes enviar este mensaje directo por WhatsApp.'
                : 'Este cliente usa otro medio de contacto. Copia el mensaje y envíalo manualmente.'}
            </p>
            <div className="contact-delivery-hint">
              <span>Medio del cliente</span>
              <strong>{obtenerTextoMedioContacto(pedidoMensaje.clientes)}</strong>
            </div>

            <div className="message-preview-box">
              <pre>{generarMensajeEstado(pedidoMensaje)}</pre>
            </div>

            <div className="modal-actions modal-actions-wrap">
              {puedeEnviarPorWhatsApp(pedidoMensaje.clientes) ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={enviarMensajeWhatsApp}
                >
                  Enviar mensaje
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={copiarMensaje}
                >
                  Copiar mensaje
                </button>
              )}

              <button
                type="button"
                className="btn btn-light-bordered"
                onClick={() => enviarSeguimientoPedido(pedidoMensaje)}
              >
                Enviar seguimiento
              </button>

              {!puedeEnviarPorWhatsApp(pedidoMensaje.clientes) && (
                <button
                  type="button"
                  className="btn btn-light-bordered"
                  onClick={() => copiarContactoMensaje(pedidoMensaje)}
                >
                  Copiar contacto
                </button>
              )}

              {puedeEnviarPorWhatsApp(pedidoMensaje.clientes) && (
                <button
                  type="button"
                  className="btn btn-light-bordered"
                  onClick={copiarMensaje}
                >
                  Copiar mensaje
                </button>
              )}

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
      <ConfirmDialog
        abierto={Boolean(pedidoAEliminar)}
        titulo="¿Eliminar este pedido?"
        descripcion="Se borrarán el pedido y su información asociada. Esta acción no se puede deshacer."
        detalle={pedidoAEliminar ? `${pedidoAEliminar.codigo || 'Pedido'} · ${pedidoAEliminar.clientes?.nombre || 'Sin cliente'}` : ''}
        confirmarTexto="Sí, eliminar pedido"
        onConfirm={eliminarPedidoConfirmado}
        onClose={() => setPedidoAEliminar(null)}
        cargando={accionEnProceso === 'Eliminando pedido...'}
        variante="danger"
      />
    </Layout>
  )
}
