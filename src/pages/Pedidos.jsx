import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import { cargarEstadoPlan, estaBloqueadoPorPlan, puedeCrearPedido } from '../lib/planes'

const PAGE_SIZE_OPTIONS = [25, 50, 100]
const PEDIDOS_CACHE_LIMIT = 50

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

const normalizarBooleanoLocal = (valor, predeterminado = true) => {
  if (valor === null || valor === undefined) return predeterminado
  if (valor === true || valor === 'true') return true
  if (valor === false || valor === 'false') return false
  return predeterminado
}

const obtenerConfigFechaLocal = () => {
  if (typeof window === 'undefined') {
    return { formato: 'dd/mm/yyyy', mostrarAnio: true, separarPorFecha: true }
  }

  return {
    formato: localStorage.getItem(DATE_FORMAT_STORAGE_KEY) || 'dd/mm/yyyy',
    mostrarAnio: normalizarBooleanoLocal(localStorage.getItem(DATE_YEAR_STORAGE_KEY), true),
    separarPorFecha: normalizarBooleanoLocal(localStorage.getItem(GROUP_BY_DATE_STORAGE_KEY), true)
  }
}

const guardarConfigFechaLocal = ({ formato, mostrarAnio, separarPorFecha }) => {
  if (typeof window === 'undefined') return
  if (formato) localStorage.setItem(DATE_FORMAT_STORAGE_KEY, formato)
  if (typeof mostrarAnio === 'boolean') localStorage.setItem(DATE_YEAR_STORAGE_KEY, String(mostrarAnio))
  if (typeof separarPorFecha === 'boolean') localStorage.setItem(GROUP_BY_DATE_STORAGE_KEY, String(separarPorFecha))
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
  const [pedidos, setPedidos] = useState(() => leerPedidosCache())
  const [totalPedidos, setTotalPedidos] = useState(() => leerPedidosCache().length)
  const [pagina, setPagina] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(25)
  const [cargandoPedidos, setCargandoPedidos] = useState(false)
  const [estadoPlan, setEstadoPlan] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroPlataforma, setFiltroPlataforma] = useState('Todas')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [configFechaPedidos, setConfigFechaPedidos] = useState(() => obtenerConfigFechaLocal())
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
  const [modalSeguimiento, setModalSeguimiento] = useState(false)
  const [pedidoSeguimiento, setPedidoSeguimiento] = useState(null)
  const [modalFiltros, setModalFiltros] = useState(false)
  const [modalConfirmarEntrega, setModalConfirmarEntrega] = useState(false)
  const [entregaPendiente, setEntregaPendiente] = useState(null)
  const [modalConfirmarReembolso, setModalConfirmarReembolso] = useState(false)
  const [reembolsoPendiente, setReembolsoPendiente] = useState(null)
  const [montoReembolso, setMontoReembolso] = useState('')
  const [menuAccionesAbierto, setMenuAccionesAbierto] = useState(null)
  const [menuEstadoAbierto, setMenuEstadoAbierto] = useState(null)

  useEffect(() => {
    cargarPlan()
    cargarConfigPedidos()

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
    cargarPedidos()
  }, [pagina, tamanoPagina, busqueda, filtroEstado, filtroPlataforma, fechaDesde, fechaHasta])

  useEffect(() => {
    setPagina(1)
  }, [busqueda, filtroEstado, filtroPlataforma, fechaDesde, fechaHasta, tamanoPagina])

  const totalPaginas = useMemo(() => {
    return Math.max(1, Math.ceil(totalPedidos / tamanoPagina))
  }, [totalPedidos, tamanoPagina])

  const plataformas = [
    'SHEIN',
    'Temu',
    'AliExpress',
    'Catálogo',
    'Otro'
  ]

  const estadosPedido = [
    'Cotizado',
    'En camino',
    'Recibido',
    'Dejado en negocio',
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
        separarPorFecha: typeof data.pedidos_separar_por_fecha === 'boolean' ? data.pedidos_separar_por_fecha : configLocal.separarPorFecha
      }

      guardarConfigFechaLocal(configDb)
      setConfigFechaPedidos(configDb)
    } catch (error) {
      console.log(error)
    }
  }

  const cambiarSeparacionPorFecha = async (valor) => {
    const nuevaConfig = { ...configFechaPedidos, separarPorFecha: valor }
    setConfigFechaPedidos(nuevaConfig)
    guardarConfigFechaLocal(nuevaConfig)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id
      if (!userId) return

      await supabase
        .from('perfiles')
        .update({ pedidos_separar_por_fecha: valor, actualizado_en: new Date().toISOString() })
        .eq('user_id', userId)
    } catch (error) {
      console.log(error)
    }
  }

  const bloqueado = estaBloqueadoPorPlan(estadoPlan)

  const bloquearSiNoPuede = () => {
    if (!bloqueado) return false
    mostrarToast('Tu Plan Básico llegó al límite. Actualiza a Premium para modificar información.', 'error')
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

    if (!producto?.fecha_comprado) {
      return { porcentaje: 12, texto: 'Compra pendiente', tipo: 'pending' }
    }

    const inicio = new Date(producto.fecha_comprado)
    const estimada = producto?.fecha_estimada_llegada ? new Date(producto.fecha_estimada_llegada) : null
    const hoy = new Date()

    if (!estimada || Number.isNaN(estimada.getTime()) || Number.isNaN(inicio.getTime())) {
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

  const renderProgresoProductos = (pedido, compacto = false) => {
    const productos = obtenerProductosPedido(pedido).filter((producto) => {
      const progreso = calcularProgresoProducto(producto)
      return progreso.tipo !== 'done'
    })

    if (!productos.length) return null

    return (
      <div className={compacto ? 'order-mini-progress order-mini-progress-mobile' : 'order-mini-progress'}>
        {productos.slice(0, 8).map((producto, index) => {
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

        {productos.length > 8 && (
          <small className="order-mini-progress-more">+{productos.length - 8} artículos más</small>
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

    const desde = (pagina - 1) * tamanoPagina
    const hasta = desde + tamanoPagina - 1
    const texto = busqueda.trim().toLowerCase()

    let consulta = supabase
      .from('pedidos')
      .select('*, clientes(nombre, telefono), productos_pedido(id, nombre_producto, cantidad, entregado, estado_compra, fecha_comprado, fecha_estimada_llegada, fecha_recibido, fecha_dejado_negocio, fecha_entregado_cliente)', { count: 'exact' })
      .order('creado_en', { ascending: false })

    if (filtroEstado !== 'Todos') {
      consulta = consulta.eq('estado', filtroEstado)
    }

    if (filtroPlataforma !== 'Todas') {
      consulta = consulta.eq('plataforma', filtroPlataforma)
    }

    if (fechaDesde) {
      consulta = consulta.gte('creado_en', `${fechaDesde}T00:00:00`)
    }

    if (fechaHasta) {
      consulta = consulta.lte('creado_en', `${fechaHasta}T23:59:59`)
    }

    if (!texto) {
      const { data, error, count } = await consulta.range(desde, hasta)
      setCargandoPedidos(false)

      if (error) {
        console.log(error)
        mostrarToast('Error al cargar pedidos', 'error')
        return
      }

      const pedidosFinal = data || []
      setPedidos(pedidosFinal)
      setTotalPedidos(count || 0)
      guardarPedidosCache(pedidosFinal)
      return
    }

    // Para búsqueda por cliente/teléfono seguimos permitiendo encontrar datos del join.
    // Se trae un bloque razonable y se pagina en memoria solo mientras hay texto de búsqueda.
    const { data, error } = await consulta.limit(500)
    setCargandoPedidos(false)

    if (error) {
      console.log(error)
      mostrarToast('Error al buscar pedidos', 'error')
      return
    }

    const pedidosCoincidentes = (data || []).filter((pedido) => {
      const estadoNormal = normalizarEstado(pedido.estado)
      const plataformaPedido = pedido.plataforma || 'SHEIN'
      const pagoTexto = obtenerEstadoPago(pedido).texto.toLowerCase()
      const productosTexto = obtenerProductosPedido(pedido)
        .map((producto) => `${producto?.nombre_producto || ''} ${producto?.cantidad || ''}`)
        .join(' ')
        .toLowerCase()
      const fechaTexto = formatearFechaCorta(pedido.creado_en).toLowerCase()

      return (
        pedido.codigo?.toLowerCase().includes(texto) ||
        plataformaPedido.toLowerCase().includes(texto) ||
        pedido.clientes?.nombre?.toLowerCase().includes(texto) ||
        pedido.clientes?.telefono?.toLowerCase().includes(texto) ||
        estadoNormal?.toLowerCase().includes(texto) ||
        pagoTexto.includes(texto) ||
        productosTexto.includes(texto) ||
        fechaTexto.includes(texto)
      )
    })

    const pedidosPagina = pedidosCoincidentes.slice(desde, hasta + 1)
    setPedidos(pedidosPagina)
    setTotalPedidos(pedidosCoincidentes.length)
    guardarPedidosCache(pedidosPagina)
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

  const obtenerPartesFecha = (valor) => {
    if (!valor) return null
    const fecha = new Date(valor)
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
    const productos = obtenerProductosPedido(pedido)

    if (!productos.length) return 'Sin productos registrados'

    return productos
      .map((producto) => {
        const cantidad = Number(producto?.cantidad || 0)
        const prefijo = cantidad > 0 ? `${cantidad} x ` : ''
        return `- ${prefijo}${producto?.nombre_producto || 'Producto sin nombre'}`
      })
      .join('\n')
  }

  const obtenerUrlSeguimiento = (pedido) => {
    if (!pedido?.public_token) return ''
    return `${obtenerBasePublica()}/seguimiento/${pedido.public_token}`
  }

  const generarMensajeEstado = (pedido) => {
    const nombre = pedido?.clientes?.nombre || 'cliente'
    const codigo = pedido?.codigo || ''
    const estado = normalizarEstado(pedido?.estado)
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

      const payload = {
        estado: estadoNuevo,
        reembolso: false,
        reembolso_monto: 0
      }

      const montoRestante = Math.max(Number(pedidoActual?.restante || pedido.restante || 0), 0)

      if (estadoNuevo === 'Entregado') {
        if (montoRestante > 0 && opciones.registrarRestante !== true) {
          mostrarToast('Confirma el pago restante para entregar el pedido', 'error')
          return false
        }

        if (montoRestante > 0) {
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
              return false
            }
          }

          payload.anticipo = Number(pedidoActual?.anticipo || pedido.anticipo || 0) + montoRestante
          payload.restante = 0
        }

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
        payload.reembolso_monto = Math.max(Number(opciones.montoReembolso || 0), 0)
      }

      const { error } = await supabase
        .from('pedidos')
        .update(payload)
        .eq('id', pedido.id)

      if (error) {
        console.log(error)
        mostrarToast('Error al cambiar estado', 'error')
        return false
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
    const listo = await aplicarCambioEstado(entregaPendiente.pedido, 'Entregado', { registrarRestante: true })
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

    const telefono = obtenerTelefonoWhatsApp(pedidoMensaje?.clientes?.telefono)

    if (!telefono) {
      mostrarToast('Este cliente no tiene teléfono', 'error')
      return
    }

    const mensaje = encodeURIComponent(generarMensajeEstado(pedidoMensaje))
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank')
  }


  const enviarMensajePedidoDirecto = (pedido) => {
    setMenuAccionesAbierto(null)
    setMenuEstadoAbierto(null)
    const telefono = obtenerTelefonoWhatsApp(pedido?.clientes?.telefono)

    if (!telefono) {
      mostrarToast('Este cliente no tiene teléfono', 'error')
      return
    }

    const mensaje = encodeURIComponent(generarMensajeEstado(pedido))
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank')
  }

  const abrirModalSeguimiento = (pedido) => {
    setMenuAccionesAbierto(null)
    setMenuEstadoAbierto(null)
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

  const enviarLinkSeguimiento = () => {
    const url = obtenerUrlSeguimiento(pedidoSeguimiento)
    const telefono = obtenerTelefonoWhatsApp(pedidoSeguimiento?.clientes?.telefono)

    if (!url) {
      mostrarToast('Este pedido no tiene link de seguimiento', 'error')
      return
    }

    if (!telefono) {
      mostrarToast('Este cliente no tiene teléfono', 'error')
      return
    }

    const nombre = pedidoSeguimiento?.clientes?.nombre || 'cliente'
    const codigo = pedidoSeguimiento?.codigo || ''
    const mensaje = encodeURIComponent(`Hola ${nombre}, aquí está el link para revisar el seguimiento de tu pedido ${codigo}:
${url}`)
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
    setMenuAccionesAbierto(null)
    setMenuEstadoAbierto(null)
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


  const seleccionarEstadoPedido = async (pedido, estado) => {
    setMenuEstadoAbierto(null)
    await cambiarEstado(pedido, estado)
  }

  const renderEstadoControl = (pedido, compacto = false) => {
    const estadoActual = normalizarEstado(pedido?.estado)
    const menuAbierto = menuEstadoAbierto === pedido.id

    return (
      <div className={`order-status-menu-wrap ${compacto ? 'mobile-order-status-wrap' : ''}`}>
        <button
          type="button"
          className={`order-status-button ${estadoClase(estadoActual)} ${compacto ? 'mobile-order-status-button' : ''}`}
          onClick={() => {
            if (bloqueado || estaProcesando) return
            setMenuAccionesAbierto(null)
            setMenuEstadoAbierto(menuAbierto ? null : pedido.id)
          }}
          disabled={bloqueado || estaProcesando}
          aria-haspopup="menu"
          aria-expanded={menuAbierto}
          title={estadoActual}
        >
          <span className="order-status-dot" />
          <span className="order-status-text">{estadoActual}</span>
          <span className="order-status-chevron">▾</span>
        </button>

        {menuAbierto && (
          <div className="order-status-options" role="menu">
            {estadosPedido.map((estado) => (
              <button
                type="button"
                key={estado}
                className={estadoActual === estado ? 'active' : ''}
                onClick={() => seleccionarEstadoPedido(pedido, estado)}
                role="menuitem"
              >
                {estado}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const pedidosFiltrados = pedidos

  const pedidosAgrupados = useMemo(() => {
    if (!configFechaPedidos.separarPorFecha) {
      return [{ clave: 'todos', fecha: '', pedidos: pedidosFiltrados }]
    }

    const mapa = new Map()

    pedidosFiltrados.forEach((pedido) => {
      const clave = obtenerClaveFechaGrupo(pedido.creado_en)
      const fecha = clave === 'sin-fecha' ? 'Sin fecha registrada' : formatearFechaGrupo(pedido.creado_en)

      if (!mapa.has(clave)) mapa.set(clave, { clave, fecha, pedidos: [] })
      mapa.get(clave).pedidos.push(pedido)
    })

    return Array.from(mapa.values())
  }, [pedidosFiltrados, configFechaPedidos.formato, configFechaPedidos.mostrarAnio, configFechaPedidos.separarPorFecha])

  const filtrosActivos =
    busqueda.trim() !== '' ||
    filtroEstado !== 'Todos' ||
    filtroPlataforma !== 'Todas' ||
    fechaDesde !== '' ||
    fechaHasta !== ''

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroEstado('Todos')
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

              <div className="pedidos-title-actions">
                {puedeCrearPedido(estadoPlan) ? (
                  <Link to="/nuevo-pedido" className="btn btn-primary btn-new-order-small">
                    Nuevo pedido
                  </Link>
                ) : (
                  <Link to="/planes" className="btn btn-light-bordered btn-new-order-small">
                    Actualizar plan
                  </Link>
                )}

                <Link to="/compras" className="btn btn-light-bordered btn-buy-lote-small">
                  Registrar compras en plataforma
                </Link>
              </div>
            </div>

            <p>Lista de pedidos registrados</p>

            <div className="pedidos-date-toggle">
              <span>Separar por fecha</span>
              <button
                type="button"
                className={configFechaPedidos.separarPorFecha ? 'date-toggle-button date-toggle-button-on' : 'date-toggle-button'}
                onClick={() => cambiarSeparacionPorFecha(!configFechaPedidos.separarPorFecha)}
                title="Agrupar pedidos por fecha de creación"
              >
                {configFechaPedidos.separarPorFecha ? 'Activado' : 'Desactivado'}
              </button>
            </div>
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
              {(fechaDesde || fechaHasta) ? ` · ${fechaDesde || 'Inicio'} a ${fechaHasta || 'Hoy'}` : ''}
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

          <div className="filters-date-grid">
            <div className="form-field">
              <label>Creado desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Creado hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
          </div>

          <label className="config-switch-row filters-date-group-switch">
            <div>
              <strong>Separar pedidos por fecha</strong>
              <span>Divide la lista por día de creación.</span>
            </div>
            <input
              type="checkbox"
              checked={configFechaPedidos.separarPorFecha}
              onChange={(e) => cambiarSeparacionPorFecha(e.target.checked)}
            />
          </label>

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

      <div className="table-card desktop-table pedidos-table-card">
        <div className="row-between table-title">
          <h2>Pedidos encontrados: {totalPedidos}</h2>
          <span className="pagination-range">
            {cargandoPedidos ? 'Actualizando...' : `${desdeVisible}-${hastaVisible} de ${totalPedidos}`}
          </span>
        </div>

        <table className="pedidos-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Creado</th>
              <th>Plataforma</th>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Pago</th>
              <th>Total cliente</th>
              <th>Anticipo</th>
              <th>Restante</th>
              <th className="actions-th">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {pedidosAgrupados.map((grupo) => (
              <Fragment key={grupo.clave}>
                {configFechaPedidos.separarPorFecha && (
                  <tr className="orders-date-divider-row">
                    <td colSpan="11">
                      <div className="orders-date-divider">
                        <span>{grupo.fecha}</span>
                      </div>
                    </td>
                  </tr>
                )}

                {grupo.pedidos.map((pedido) => {
                  const progresoPedido = renderProgresoProductos(pedido)
                  const menuAbierto = menuAccionesAbierto === pedido.id

                  return (
                    <Fragment key={pedido.id}>
                      <tr className={esEstadoReembolso(pedido.estado) ? 'refund-censored-row' : ''} data-refund-label={esEstadoReembolso(pedido.estado) ? obtenerEtiquetaReembolso(pedido.estado) : undefined}>
                        <td className="order-code-cell">{pedido.codigo}</td>
                        <td className="order-created-cell">{formatearFechaCorta(pedido.creado_en)}</td>
                        <td>{pedido.plataforma || 'SHEIN'}</td>
                        <td>{pedido.clientes?.nombre || 'Sin cliente'}</td>
                        <td>{pedido.clientes?.telefono || '-'}</td>
                        <td className="status-cell">
                          {renderEstadoControl(pedido)}
                        </td>
                        <td>{renderPagoBadge(pedido, true)}</td>
                        <td>{formatearDinero(pedido.total_cliente)}</td>
                        <td>{formatearDinero(pedido.anticipo)}</td>
                        <td>{formatearDinero(pedido.restante)}</td>
                        <td className="actions actions-compact actions-menu-cell">
                          <Link
                            to={`/pedidos/${pedido.id}`}
                            className="btn btn-small btn-action-view"
                          >
                            Ver
                          </Link>

                          <div className="order-actions-dropdown-wrap">
                            <button
                              type="button"
                              className="btn btn-light-bordered btn-small btn-action-more"
                              onClick={() => {
                                setMenuEstadoAbierto(null)
                                setMenuAccionesAbierto(menuAbierto ? null : pedido.id)
                              }}
                              aria-haspopup="menu"
                              aria-expanded={menuAbierto}
                            >
                              Más ▾
                            </button>

                            {menuAbierto && (
                              <div className="order-actions-dropdown" role="menu">
                                <button
                                  type="button"
                                  onClick={() => enviarMensajePedidoDirecto(pedido)}
                                  role="menuitem"
                                >
                                  Enviar mensaje
                                </button>

                                <button
                                  type="button"
                                  onClick={() => abrirModalSeguimiento(pedido)}
                                  role="menuitem"
                                >
                                  Link de seguimiento
                                </button>

                                <button
                                  type="button"
                                  onClick={() => eliminarPedido(pedido.id)}
                                  className="danger"
                                  disabled={bloqueado || estaProcesando}
                                  role="menuitem"
                                >
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {progresoPedido && (
                        <tr className="order-progress-table-row">
                          <td colSpan="11">
                            {progresoPedido}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </Fragment>
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
          <h2>Pedidos encontrados: {totalPedidos}</h2>
          <span className="pagination-range">
            {cargandoPedidos ? 'Actualizando...' : `${desdeVisible}-${hastaVisible} de ${totalPedidos}`}
          </span>
        </div>

        {pedidosAgrupados.map((grupo) => (
          <Fragment key={grupo.clave}>
            {configFechaPedidos.separarPorFecha && (
              <div className="mobile-date-divider">
                <span>{grupo.fecha}</span>
              </div>
            )}

            {grupo.pedidos.map((pedido) => (
              <div className={`mobile-card mobile-order-card-compact ${esEstadoReembolso(pedido.estado) ? 'refund-censored-card' : ''}`} data-refund-label={esEstadoReembolso(pedido.estado) ? obtenerEtiquetaReembolso(pedido.estado) : undefined} key={pedido.id}>
                <div className="mobile-order-compact-head mobile-order-compact-head-v13">
                  <div className="mobile-order-main-info">
                    <span>Orden</span>
                    <h3>{pedido.codigo}</h3>
                    <p className="mobile-order-client-name">{pedido.clientes?.nombre || 'Sin cliente'}</p>
                    <p className="mobile-order-created-date">Creado: {formatearFechaCorta(pedido.creado_en)}</p>
                  </div>

                  <div className="mobile-order-payment-top">
                    {renderPagoBadge(pedido, true, 'mobile')}
                  </div>
                </div>

                <div className="mobile-order-state-row">
                  {renderEstadoControl(pedido, true)}
                </div>

                <div className="mobile-order-compact-money">
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

                <div className="mobile-card-actions mobile-order-actions-compact">
                  <Link
                    to={`/pedidos/${pedido.id}`}
                    className="btn btn-primary"
                  >
                    Ver
                  </Link>

                  <button
                    type="button"
                    onClick={() => enviarMensajePedidoDirecto(pedido)}
                    className="btn btn-light-bordered"
                  >
                    Mensaje
                  </button>

                  <button
                    type="button"
                    onClick={() => abrirModalSeguimiento(pedido)}
                    className="btn btn-light-bordered"
                  >
                    Seguimiento
                  </button>

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
          </Fragment>
        ))}

        {pedidosFiltrados.length === 0 && (
          <div className="empty-state">
            No se encontraron pedidos.
          </div>
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
                disabled={bloqueado || estaProcesando}
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
              Este pedido quedará como {reembolsoPendiente.estadoNuevo} y no contará para métricas.
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
        titulo="Link de seguimiento"
        onClose={() => setModalSeguimiento(false)}
      >
        {pedidoSeguimiento && (
          <div className="tracking-link-modal">
            <p className="muted">
              Usa este enlace cuando solo quieras compartir el seguimiento público del pedido.
            </p>

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
                Enviar link
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
