import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import PageHelp from '../components/PageHelp'
import { cargarEstadoPlan, estaBloqueadoPorPlan } from '../lib/planes'
import { PLATAFORMAS } from '../lib/plataformas'
import {
  METODOS_PAGO,
  METODO_PAGO_PREDETERMINADO,
  obtenerFechaLocalHoy,
  normalizarFechaParaInput
} from '../lib/metodosPago'
import { formatearProductosParaMensaje } from '../lib/mensajesProductos'
import { validarMontoPago } from '../lib/calculosNegocio'
import { parsearFechaLocal } from '../lib/fechas'


const obtenerEstiloMenuPedido = (elemento, ancho = 260, altoEstimado = 190) => {
  if (!elemento || typeof window === 'undefined') return null

  const rect = elemento.getBoundingClientRect()
  const margen = 12
  const espacioAbajo = window.innerHeight - rect.bottom - margen
  const espacioArriba = rect.top - margen
  const abrirArriba = espacioAbajo < altoEstimado && espacioArriba > espacioAbajo
  const left = Math.max(margen, Math.min(rect.right - ancho, window.innerWidth - ancho - margen))

  return {
    position: 'fixed',
    left: `${left}px`,
    top: abrirArriba ? 'auto' : `${rect.bottom + 8}px`,
    bottom: abrirArriba ? `${window.innerHeight - rect.top + 8}px` : 'auto',
    width: `${ancho}px`,
    maxHeight: `${Math.max(150, abrirArriba ? espacioArriba - 14 : espacioAbajo - 14)}px`,
    overflowY: 'auto',
    zIndex: 2147483000
  }
}

export default function DetallePedido() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [pedido, setPedido] = useState(null)
  const [estadoPlan, setEstadoPlan] = useState(null)
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [pagos, setPagos] = useState([])
  const [toast, setToast] = useState(null)
  const accionEnProcesoRef = useRef(false)
  const [accionEnProceso, setAccionEnProceso] = useState('')
  const [cargandoPedido, setCargandoPedido] = useState(true)
  const [errorCargaPedido, setErrorCargaPedido] = useState('')
  const [elementoAEliminar, setElementoAEliminar] = useState(null)

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

  const [modalPedido, setModalPedido] = useState(false)
  const [modalProducto, setModalProducto] = useState(false)
  const [modalPago, setModalPago] = useState(false)
  const [menuPedidoAbierto, setMenuPedidoAbierto] = useState(false)
  const [estiloMenuPedido, setEstiloMenuPedido] = useState(null)
  const botonMenuPedidoRef = useRef(null)
  const [menuProductoAbierto, setMenuProductoAbierto] = useState(null)
  const [seccionActiva, setSeccionActiva] = useState('productos')

  useEffect(() => {
    const seccionSolicitada = searchParams.get('seccion')
    const seccionesValidas = ['productos', 'pagos', 'seguimiento', 'historial']

    if (seccionesValidas.includes(seccionSolicitada)) {
      setSeccionActiva(seccionSolicitada)
      return
    }

    setSeccionActiva('productos')
  }, [id, searchParams])

  useEffect(() => {
    const productoSolicitado = searchParams.get('producto')
    if (!productoSolicitado || seccionActiva !== 'productos' || productos.length === 0) return undefined

    const temporizador = window.setTimeout(() => {
      const elemento = document.getElementById(`producto-${productoSolicitado}`)
      elemento?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      elemento?.classList.add('detail-product-card-highlight')
      window.setTimeout(() => elemento?.classList.remove('detail-product-card-highlight'), 2200)
    }, 180)

    return () => window.clearTimeout(temporizador)
  }, [searchParams, seccionActiva, productos])

  const [modalMensajeEstado, setModalMensajeEstado] = useState(false)
  const [pedidoMensajeEstado, setPedidoMensajeEstado] = useState(null)
  const [modalConfirmarEntrega, setModalConfirmarEntrega] = useState(false)
  const [entregaPendiente, setEntregaPendiente] = useState(null)
  const [modalConfirmarProducto, setModalConfirmarProducto] = useState(false)
  const [productoEntregaPendiente, setProductoEntregaPendiente] = useState(null)
  const [modalConfirmarReembolso, setModalConfirmarReembolso] = useState(false)
  const [reembolsoPendiente, setReembolsoPendiente] = useState(null)
  const [montoReembolso, setMontoReembolso] = useState('')

  const [clienteIdPedido, setClienteIdPedido] = useState('')
  const [plataformaPedido, setPlataformaPedido] = useState('SHEIN')
  const [trackingPedido, setTrackingPedido] = useState('')
  const [notasPedido, setNotasPedido] = useState('')

  const [productoEditando, setProductoEditando] = useState(null)
  const [nombreProducto, setNombreProducto] = useState('')
  const [linkShein, setLinkShein] = useState('')
  const [talla, setTalla] = useState('')
  const [color, setColor] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [precioPagina, setPrecioPagina] = useState('')
  const [precioShein, setPrecioShein] = useState('')
  const [cobraComisionProducto, setCobraComisionProducto] = useState(false)
  const [comisionExtraProducto, setComisionExtraProducto] = useState('')

  const [pagoEditando, setPagoEditando] = useState(null)
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState(METODO_PAGO_PREDETERMINADO)
  const [fechaPago, setFechaPago] = useState(() => obtenerFechaLocalHoy())
  const [notasPago, setNotasPago] = useState('')
  const [metodoPagoEntrega, setMetodoPagoEntrega] = useState(METODO_PAGO_PREDETERMINADO)
  const [fechaPagoEntrega, setFechaPagoEntrega] = useState(() => obtenerFechaLocalHoy())

  useEffect(() => {
    if (!menuPedidoAbierto) return undefined

    const cerrarSiCorresponde = (evento) => {
      if (botonMenuPedidoRef.current?.contains(evento.target)) return
      if (evento.target?.closest?.('.ordely-v56-order-menu-portal')) return
      setMenuPedidoAbierto(false)
      setEstiloMenuPedido(null)
    }

    const cerrarPorMovimiento = () => {
      setMenuPedidoAbierto(false)
      setEstiloMenuPedido(null)
    }

    document.addEventListener('pointerdown', cerrarSiCorresponde)
    window.addEventListener('resize', cerrarPorMovimiento)
    window.addEventListener('scroll', cerrarPorMovimiento, true)

    return () => {
      document.removeEventListener('pointerdown', cerrarSiCorresponde)
      window.removeEventListener('resize', cerrarPorMovimiento)
      window.removeEventListener('scroll', cerrarPorMovimiento, true)
    }
  }, [menuPedidoAbierto])

  const mostrarToast = useCallback((mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo })
  }, [])

  const volverAtras = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate('/pedidos')
  }

  const cargarPlan = useCallback(async () => {
    const estado = await cargarEstadoPlan()
    setEstadoPlan(estado)
  }, [])

  const bloqueado = estaBloqueadoPorPlan(estadoPlan)

  const bloquearSiNoPuede = () => {
    if (!bloqueado) return false
    mostrarToast('Tu cuenta no permite modificaciones en este momento.', 'error')
    return true
  }


  const bloquearSiPedidoCerrado = () => {
    if (!pedido || !esEstadoReembolso(pedido.estado)) return false
    mostrarToast('Este pedido está cancelado o devuelto y ya no permite modificaciones.', 'error')
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

  const esEstadoReembolso = (estado) => {
    const estadoNormal = normalizarEstado(estado)
    return estadoNormal === 'Cancelado' || estadoNormal === 'Devuelto'
  }

  const obtenerEtiquetaReembolso = (estado = pedido?.estado) => {
    const estadoNormal = normalizarEstado(estado)
    return estadoNormal === 'Devuelto' ? 'Devuelto' : 'Cancelado'
  }

  const obtenerEstadoPago = (pedidoBase = pedido) => {
    if (esEstadoReembolso(pedidoBase?.estado)) {
      return { tipo: 'refund', texto: 'Reembolso' }
    }

    const total = Number(pedidoBase?.total_cliente || 0)
    const pagado = Number(pedidoBase?.anticipo || 0)
    const restante = Number(pedidoBase?.restante || 0)

    if (total > 0 && (restante <= 0 || pagado >= total)) {
      return { tipo: 'paid', texto: 'Pagado por cliente' }
    }

    if (pagado > 0) {
      return { tipo: 'partial', texto: 'Pagado parcialmente' }
    }

    return { tipo: 'pending', texto: 'Pago pendiente' }
  }

  const renderPagoBadge = (pedidoBase = pedido, compacto = false) => {
    const estadoPago = obtenerEstadoPago(pedidoBase)

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

  const precioUnitarioCliente = (producto) => {
    return Number(producto?.precio_venta ?? producto?.precio_pagina ?? producto?.precio_shein ?? 0)
  }

  const totalProductoVenta = (producto) => {
    return precioUnitarioCliente(producto) * Number(producto?.cantidad || 0)
  }

  const calcularMontoCobroProducto = (productoObjetivo, productosBase = productos, pedidoBase = pedido) => {
    const restantePedido = Math.max(Number(pedidoBase?.restante || 0), 0)
    const totalProducto = totalProductoVenta(productoObjetivo)

    if (restantePedido <= 0 || totalProducto <= 0) return 0

    const totalEntregadoPrevio = (productosBase || [])
      .filter((item) => item.id !== productoObjetivo.id && productoEntregado(item))
      .reduce((sum, item) => sum + totalProductoVenta(item), 0)

    const pagadoPedido = Math.max(Number(pedidoBase?.anticipo || 0), 0)
    const pagoDisponibleParaEsteProducto = Math.max(pagadoPedido - totalEntregadoPrevio, 0)
    const saldoProducto = Math.max(totalProducto - pagoDisponibleParaEsteProducto, 0)

    return Math.min(saldoProducto, restantePedido)
  }

  const productoEntregado = (producto) => producto?.entregado === true
  const productoPagado = (producto) => producto?.pagado_cliente === true || productoEntregado(producto)

  const formatearFecha = (valor) => {
    if (!valor) return '-'
    const fecha = parsearFechaLocal(valor)
    if (!fecha) return '-'
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const obtenerEstadoCompraProducto = (producto) => {
    if (productoEntregado(producto) || producto?.fecha_entregado_cliente || producto?.estado_compra === 'Entregado') return 'Entregado'
    if (producto?.fecha_dejado_negocio || producto?.estado_compra === 'Dejado en negocio') return 'Dejado en negocio'
    if (producto?.fecha_recibido || producto?.estado_compra === 'Recibido') return 'Recibido'

    const estadoGuardado = String(producto?.estado_compra || '').trim()
    const compraRegistrada = Boolean(producto?.fecha_comprado || producto?.lote_compra_id)

    // Compatibilidad con compras creadas por versiones anteriores: si ya existe lote
    // o fecha de compra, nunca debe mostrarse como pendiente aunque el campo antiguo
    // estado_compra no se haya sincronizado.
    if (compraRegistrada && (!estadoGuardado || estadoGuardado === 'Pendiente de compra')) {
      return 'Comprado'
    }

    return estadoGuardado || 'Pendiente de compra'
  }

  const obtenerEstadoAutomaticoPedido = (pedidoBase = pedido, productosBase = productos) => {
    const guardado = normalizarEstado(pedidoBase?.estado)
    if (guardado === 'Cancelado' || guardado === 'Devuelto') return guardado

    const lista = Array.isArray(productosBase) ? productosBase : []
    if (!lista.length) return 'Pendiente de compra'

    const todosEntregados = lista.every((producto) =>
      productoEntregado(producto) ||
      Boolean(producto?.fecha_entregado_cliente) ||
      obtenerEstadoCompraProducto(producto) === 'Entregado'
    )
    if (todosEntregados) return 'Entregado'

    const algunoPendienteCompra = lista.some((producto) => obtenerEstadoCompraProducto(producto) === 'Pendiente de compra')
    if (algunoPendienteCompra) return 'Pendiente de compra'

    const algunoEnCamino = lista.some((producto) => {
      const estado = obtenerEstadoCompraProducto(producto)
      return !['Recibido', 'Dejado en negocio', 'Entregado'].includes(estado)
    })
    if (algunoEnCamino) return 'En camino'

    const algunoRecibido = lista.some((producto) => obtenerEstadoCompraProducto(producto) === 'Recibido')
    if (algunoRecibido) return 'Recibido'

    return 'Dejado en negocio'
  }

  const obtenerProgresoProducto = (producto) => {
    const estadoCompra = obtenerEstadoCompraProducto(producto)

    if (estadoCompra === 'Pendiente de compra') {
      return { porcentaje: 8, texto: 'Pendiente de compra', clase: 'product-progress-pending' }
    }

    if (estadoCompra === 'Recibido') {
      return { porcentaje: 86, texto: 'Recibido por ti', clase: 'product-progress-received' }
    }

    if (estadoCompra === 'Dejado en negocio') {
      return { porcentaje: 94, texto: 'Dejado en negocio', clase: 'product-progress-shop' }
    }

    if (estadoCompra === 'Entregado') {
      return { porcentaje: 100, texto: 'Entregado al cliente', clase: 'product-progress-delivered' }
    }

    const comprado = parsearFechaLocal(producto?.fecha_comprado)
    const estimada = parsearFechaLocal(producto?.fecha_estimada_llegada)

    if (!comprado || !estimada) {
      return { porcentaje: 35, texto: 'En camino · sin fecha estimada', clase: 'product-progress-moving' }
    }

    const ahora = new Date()
    const total = Math.max(estimada.getTime() - comprado.getTime(), 1)
    const avance = Math.max(ahora.getTime() - comprado.getTime(), 0)
    const proporcionTrayecto = Math.min(Math.max(avance / total, 0), 1)
    const porcentaje = Math.round(30 + (proporcionTrayecto * 42))

    if (ahora.getTime() >= estimada.getTime()) {
      return { porcentaje: 78, texto: 'Posiblemente llegó', clase: 'product-progress-arrived' }
    }

    return { porcentaje, texto: `En camino · llegada estimada ${formatearFecha(producto.fecha_estimada_llegada)}`, clase: 'product-progress-moving' }
  }

  const marcarEstadoLogisticoProducto = async (producto, estadoLogistico) => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    if (!iniciarAccion('Actualizando producto...')) return

    const { error } = await supabase.rpc('actualizar_estado_producto_logistica', {
      p_producto_id: producto.id,
      p_estado: estadoLogistico
    })

    finalizarAccion()

    if (error) {
      console.log(error)
      mostrarToast(error.message || 'No se pudo actualizar el producto', 'error')
      return
    }

    mostrarToast(
      estadoLogistico === 'Dejado en negocio'
        ? 'Producto marcado como dejado en negocio'
        : 'Producto marcado como recibido'
    )
    cargarTodo()
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

  const cargarTodo = useCallback(async () => {
    setCargandoPedido(true)
    setErrorCargaPedido('')

    const { data: pedidoData, error: errorPedido } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, telefono, direccion, medio_contacto, usuario_contacto)')
      .eq('id', id)
      .single()

    if (errorPedido) {
      console.log(errorPedido)
      setErrorCargaPedido('No pudimos cargar este pedido. Revisa tu conexión e intenta nuevamente.')
      setCargandoPedido(false)
      return
    }

    const [respuestaClientes, respuestaProductos, respuestaPagos] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre', { ascending: true }),
      supabase.from('productos_pedido').select('*').eq('pedido_id', id).order('creado_en', { ascending: false }),
      supabase.from('pagos').select('*').eq('pedido_id', id).order('creado_en', { ascending: false })
    ])

    if (respuestaProductos.error || respuestaPagos.error) {
      console.log(respuestaProductos.error || respuestaPagos.error)
      mostrarToast('El pedido cargó, pero algunos movimientos no pudieron actualizarse.', 'warning')
    }

    setPedido(pedidoData)
    setClientes(respuestaClientes.data || [])
    setProductos(respuestaProductos.data || [])
    setPagos(respuestaPagos.data || [])
    setCargandoPedido(false)
  }, [id, mostrarToast])

  useEffect(() => {
    cargarTodo()
    cargarPlan()
  }, [cargarPlan, cargarTodo])

  const recalcularPedido = async () => {
    const { data: pedidoRecalculado, error: errorRpc } = await supabase.rpc('recalcular_totales_pedido', {
      p_pedido_id: id
    })

    if (errorRpc) {
      console.log(errorRpc)
      mostrarToast('No se pudieron recalcular los totales de forma segura.', 'error')
      return null
    }

    if (pedidoRecalculado) {
      setPedido((actual) => actual ? { ...actual, ...pedidoRecalculado } : pedidoRecalculado)
    }

    return pedidoRecalculado || null
  }

  const abrirEditarPedido = () => {
    if (bloquearSiNoPuede()) return
    if (!pedido) return

    setClienteIdPedido(pedido.cliente_id || '')
    setPlataformaPedido(pedido.plataforma || 'SHEIN')
    setTrackingPedido(pedido.tracking || '')
    setNotasPedido(pedido.notas || '')
    setModalPedido(true)
  }


  const guardarPedidoGeneral = async (e) => {
    e.preventDefault()

    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    if (!iniciarAccion('Guardando cambios...')) return

    try {
      const payloadPedido = {
        cliente_id: clienteIdPedido || null,
        plataforma: plataformaPedido,
        tracking: trackingPedido,
        notas: notasPedido
      }

      const { error } = await supabase
        .from('pedidos')
        .update(payloadPedido)
        .eq('id', id)

      if (error) {
        console.log(error)
        mostrarToast('Error al actualizar pedido', 'error')
        return
      }

      setModalPedido(false)
      await cargarTodo()
      mostrarToast('Datos del pedido actualizados correctamente')
    } finally {
      finalizarAccion()
    }
  }

  const abrirCambioEspecialPedido = (estadoNuevo) => {
    if (bloquearSiNoPuede()) return
    if (!pedido || accionEnProcesoRef.current) return

    const estadoActual = obtenerEstadoAutomaticoPedido()
    if (estadoNuevo === 'Devuelto' && estadoActual !== 'Entregado') return
    if (estadoNuevo === 'Cancelado' && ['Entregado', 'Cancelado', 'Devuelto'].includes(estadoActual)) return

    const montoPagado = Math.max(Number(pedido.anticipo || 0), 0)
    setReembolsoPendiente({
      payload: {
        cliente_id: pedido.cliente_id || null,
        plataforma: pedido.plataforma || 'SHEIN',
        tracking: pedido.tracking || '',
        notas: pedido.notas || '',
        estado: estadoNuevo,
        reembolso: true
      },
      estadoAnterior: estadoActual,
      estadoNuevo,
      montoPagado
    })
    setMontoReembolso(montoPagado.toFixed(2))
    setModalConfirmarReembolso(true)
  }

  const aplicarMontoReembolsoRapido = (tipo) => {
    const montoPagado = Math.max(Number(reembolsoPendiente?.montoPagado || pedido?.anticipo || 0), 0)

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

  const confirmarReembolsoPedido = async () => {
    if (bloquearSiNoPuede()) return
    if (!reembolsoPendiente?.payload) return
    if (!iniciarAccion('Guardando reembolso...')) return

    try {
      const montoFinal = Number(montoReembolso || 0)
      const montoPagado = Math.max(Number(reembolsoPendiente.montoPagado || pedido?.anticipo || 0), 0)

      if (!Number.isFinite(montoFinal) || montoFinal < 0 || montoFinal > montoPagado) {
        mostrarToast('El reembolso debe estar entre $0.00 y lo pagado por el cliente.', 'error')
        return
      }

      const { data: pedidoGuardado, error } = await supabase.rpc('registrar_reembolso_pedido', {
        p_pedido_id: id,
        p_estado: reembolsoPendiente.estadoNuevo,
        p_monto: montoFinal
      })

      if (error) {
        console.log(error)
        mostrarToast(error.message || 'No se pudo guardar el reembolso', 'error')
        return
      }

      const pedidoActualizado = {
        ...pedido,
        ...(Array.isArray(pedidoGuardado) ? pedidoGuardado[0] : pedidoGuardado)
      }

      setModalConfirmarReembolso(false)
      setReembolsoPendiente(null)
      setMontoReembolso('')
      await cargarTodo()
      mostrarToast(`${reembolsoPendiente.estadoNuevo} guardado con reembolso de ${formatearDinero(montoFinal)}`)
      setPedidoMensajeEstado(pedidoActualizado)
      setModalMensajeEstado(true)
    } finally {
      finalizarAccion()
    }
  }

  const confirmarEntregaPedido = async () => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return

    const montoPrevisto = Math.max(Number(entregaPendiente?.montoRestante || pedido?.restante || 0), 0)
    if (montoPrevisto > 0 && (!metodoPagoEntrega || !fechaPagoEntrega)) {
      mostrarToast('Selecciona el método y la fecha del pago de entrega', 'error')
      return
    }

    if (!iniciarAccion('Confirmando entrega...')) return

    try {
      const { data: pedidoGuardado, error } = await supabase.rpc('entregar_pedido_completo', {
        p_pedido_id: id,
        p_metodo: metodoPagoEntrega || METODO_PAGO_PREDETERMINADO,
        p_fecha: fechaPagoEntrega || obtenerFechaLocalHoy()
      })

      if (error) {
        console.log(error)
        mostrarToast(error.message || 'No se pudo confirmar la entrega', 'error')
        return
      }

      const pedidoActualizado = {
        ...pedido,
        ...(Array.isArray(pedidoGuardado) ? pedidoGuardado[0] : pedidoGuardado)
      }

      setModalConfirmarEntrega(false)
      setEntregaPendiente(null)
      await cargarTodo()
      mostrarToast(montoPrevisto > 0 ? 'Entrega confirmada y restante registrado' : 'Entrega confirmada')
      setPedidoMensajeEstado(pedidoActualizado)
      setModalMensajeEstado(true)
    } finally {
      finalizarAccion()
    }
  }

  const abrirConfirmarEntregaProducto = (producto) => {
    if (accionEnProcesoRef.current) return
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    if (productoEntregado(producto)) return

    const productosPendientesDespues = productos.filter((item) => item.id !== producto.id && !productoEntregado(item)).length
    const esUltimoProductoPendiente = productosPendientesDespues === 0
    const totalProducto = totalProductoVenta(producto)
    const montoACobrar = calcularMontoCobroProducto(producto, productos, pedido)

    setProductoEntregaPendiente({
      producto,
      totalProducto,
      montoACobrar,
      esUltimoProductoPendiente
    })
    setMetodoPagoEntrega(METODO_PAGO_PREDETERMINADO)
    setFechaPagoEntrega(obtenerFechaLocalHoy())
    setModalConfirmarProducto(true)
  }

  const confirmarEntregaProducto = async () => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    if (!productoEntregaPendiente?.producto) return

    if (Number(productoEntregaPendiente.montoACobrar || 0) > 0 && (!metodoPagoEntrega || !fechaPagoEntrega)) {
      mostrarToast('Selecciona el método y la fecha del pago', 'error')
      return
    }

    if (!iniciarAccion('Confirmando producto...')) return

    try {
      const productoOriginal = productoEntregaPendiente.producto
      const { data: resultadoEntrega, error } = await supabase.rpc('entregar_producto_pedido', {
        p_producto_id: productoOriginal.id,
        p_metodo: metodoPagoEntrega || METODO_PAGO_PREDETERMINADO,
        p_fecha: fechaPagoEntrega || obtenerFechaLocalHoy()
      })

      if (error) {
        console.log(error)
        mostrarToast(error.message || 'No se pudo confirmar la entrega del producto', 'error')
        return
      }

      const resultado = Array.isArray(resultadoEntrega) ? resultadoEntrega[0] : resultadoEntrega
      const montoACobrar = Number(resultado?.monto_cobrado ?? productoEntregaPendiente.montoACobrar ?? 0)

      setModalConfirmarProducto(false)
      setProductoEntregaPendiente(null)
      await cargarTodo()
      mostrarToast(montoACobrar > 0 ? 'Producto entregado y pago registrado' : 'Producto entregado')
    } finally {
      finalizarAccion()
    }
  }

  const limpiarProducto = () => {
    setProductoEditando(null)
    setNombreProducto('')
    setLinkShein('')
    setTalla('')
    setColor('')
    setCantidad(1)
    setPrecioPagina('')
    setPrecioShein('')
    setCobraComisionProducto(false)
    setComisionExtraProducto('')
  }

  const abrirAgregarProducto = () => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    limpiarProducto()
    setModalProducto(true)
  }

  const abrirEditarProducto = (producto) => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    setProductoEditando(producto)
    setNombreProducto(producto.nombre_producto || '')
    setLinkShein(producto.link_shein || '')
    setTalla(producto.talla || '')
    setColor(producto.color || '')
    setCantidad(producto.cantidad || 1)
    setPrecioPagina(producto.precio_pagina ?? producto.precio_shein ?? '')
    setPrecioShein(producto.lote_compra_id ? (producto.precio_shein || '') : '')
    const precioBase = Number(producto.precio_pagina ?? producto.precio_shein ?? 0)
    const comisionGuardada = Math.max(Number(producto.precio_venta || precioBase) - precioBase, 0)
    setCobraComisionProducto(comisionGuardada > 0)
    setComisionExtraProducto(comisionGuardada > 0 ? String(comisionGuardada) : '')
    setModalProducto(true)
  }

  const cerrarModalProducto = () => {
    setModalProducto(false)
    limpiarProducto()
  }

  const guardarProducto = async (e) => {
    e.preventDefault()

    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    if (!iniciarAccion(productoEditando ? 'Guardando cambios...' : 'Guardando producto...')) return

    try {
      const precioBase = Number(precioPagina || precioShein || 0)
      const comisionExtra = cobraComisionProducto ? Number(comisionExtraProducto) : 0

      if (cobraComisionProducto && (!Number.isFinite(comisionExtra) || comisionExtra < 0)) {
        mostrarToast('Escribe una comisión extra válida', 'error')
        return
      }

      if (productoEditando?.lote_compra_id) {
        const precioVentaNuevo = precioBase + comisionExtra
        const cambioImportes =
          Number(cantidad) !== Number(productoEditando.cantidad) ||
          Math.abs(precioBase - Number(productoEditando.precio_pagina ?? 0)) > 0.005 ||
          Math.abs(Number(precioShein || precioPagina || 0) - Number(productoEditando.precio_shein ?? 0)) > 0.005 ||
          Math.abs(precioVentaNuevo - Number(productoEditando.precio_venta ?? 0)) > 0.005

        if (cambioImportes) {
          mostrarToast('Este producto ya forma parte de una compra. Puedes corregir sus datos descriptivos, pero no sus cantidades ni importes.', 'error')
          return
        }
      }

      const payload = {
        pedido_id: id,
        nombre_producto: nombreProducto,
        link_shein: linkShein,
        talla,
        color,
        cantidad: Number(cantidad),
        precio_pagina: precioBase,
        precio_shein: Number(precioShein || precioPagina || 0),
        precio_venta: precioBase + comisionExtra,
        estado_compra: productoEditando?.estado_compra || 'Pendiente de compra',
        fecha_agregado: productoEditando?.fecha_agregado || new Date().toISOString()
      }

      if (productoEditando) {
        const { error } = await supabase
          .from('productos_pedido')
          .update(payload)
          .eq('id', productoEditando.id)

        if (error) {
          console.log(error)
          mostrarToast('Error al actualizar producto', 'error')
          return
        }

        cerrarModalProducto()
        await recalcularPedido()
        await cargarTodo()
        mostrarToast('Producto actualizado correctamente')
        return
      }

      const { error } = await supabase
        .from('productos_pedido')
        .insert([payload])

      if (error) {
        console.log(error)
        mostrarToast('Error al agregar producto', 'error')
        return
      }

      cerrarModalProducto()
      await recalcularPedido()
      await cargarTodo()
      mostrarToast('Producto agregado correctamente')
    } finally {
      finalizarAccion()
    }
  }

  const solicitarEliminarProducto = (producto) => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    if (producto?.lote_compra_id) {
      mostrarToast('Este producto ya forma parte del historial de una compra y no se puede eliminar.', 'error')
      return
    }
    setElementoAEliminar({ tipo: 'producto', item: producto })
  }

  const eliminarProductoConfirmado = async () => {
    const producto = elementoAEliminar?.tipo === 'producto' ? elementoAEliminar.item : null
    if (!producto) return
    if (!iniciarAccion('Eliminando producto...')) return

    try {
      const { error } = await supabase
        .from('productos_pedido')
        .delete()
        .eq('id', producto.id)

      if (error) {
        console.log(error)
        mostrarToast('No se pudo eliminar el producto. Intenta nuevamente.', 'error')
        return
      }

      setElementoAEliminar(null)
      await recalcularPedido()
      await cargarTodo()
      mostrarToast('El producto se eliminó correctamente.')
    } finally {
      finalizarAccion()
    }
  }

  const limpiarPago = () => {
    setPagoEditando(null)
    setMontoPago('')
    setMetodoPago(METODO_PAGO_PREDETERMINADO)
    setFechaPago(obtenerFechaLocalHoy())
    setNotasPago('')
  }

  const abrirAgregarPago = () => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    limpiarPago()
    setModalPago(true)
  }

  const abrirEditarPago = (pago) => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    setPagoEditando(pago)
    setMontoPago(pago.monto || '')
    setMetodoPago(pago.metodo_pago || METODO_PAGO_PREDETERMINADO)
    setFechaPago(normalizarFechaParaInput(pago.fecha_pago || pago.creado_en))
    setNotasPago(pago.notas || '')
    setModalPago(true)
  }

  const cerrarModalPago = () => {
    setModalPago(false)
    limpiarPago()
  }

  const guardarPago = async (e) => {
    e.preventDefault()

    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    if (!iniciarAccion(pagoEditando ? 'Guardando pago...' : 'Agregando pago...')) return

    try {
      if (!metodoPago) {
        mostrarToast('Selecciona un método de pago', 'error')
        return
      }

      if (!fechaPago) {
        mostrarToast('Selecciona la fecha del pago', 'error')
        return
      }

      const montoFinal = Number(montoPago)
      const validacionPago = validarMontoPago({
        monto: montoFinal,
        restante: pedido?.restante,
        montoAnterior: pagoEditando?.monto
      })
      const maximoPermitido = validacionPago.maximo

      if (validacionPago.motivo === 'positivo') {
        mostrarToast('El pago debe ser mayor a $0.00.', 'error')
        return
      }

      if (validacionPago.motivo === 'excede_saldo') {
        mostrarToast(`El pago no puede superar el saldo disponible de ${formatearDinero(maximoPermitido)}.`, 'error')
        return
      }

      const { error } = await supabase.rpc('guardar_pago_pedido', {
        p_pedido_id: id,
        p_pago_id: pagoEditando?.id || null,
        p_monto: montoFinal,
        p_metodo: metodoPago,
        p_fecha: fechaPago,
        p_notas: notasPago
      })

      if (error) {
        console.log(error)
        mostrarToast(error.message || 'No se pudo guardar el pago', 'error')
        return
      }

      const editando = Boolean(pagoEditando)
      cerrarModalPago()
      await cargarTodo()
      mostrarToast(editando ? 'Pago actualizado correctamente' : 'Pago agregado correctamente')
    } finally {
      finalizarAccion()
    }
  }

  const solicitarEliminarPago = (pago) => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    setElementoAEliminar({ tipo: 'pago', item: pago })
  }

  const eliminarPagoConfirmado = async () => {
    const pago = elementoAEliminar?.tipo === 'pago' ? elementoAEliminar.item : null
    if (!pago) return
    if (!iniciarAccion('Eliminando pago...')) return

    try {
      const { error } = await supabase.rpc('eliminar_pago_pedido', {
        p_pago_id: pago.id
      })

      if (error) {
        console.log(error)
        mostrarToast('No se pudo eliminar el pago. Intenta nuevamente.', 'error')
        return
      }

      setElementoAEliminar(null)
      await cargarTodo()
      mostrarToast('El pago se eliminó correctamente.')
    } finally {
      finalizarAccion()
    }
  }




  const limpiarTelefono = (telefono) => {
    return String(telefono || '').replace(/\D/g, '')
  }

  const formatearDinero = (valor) => {
    return `$${Number(valor || 0).toFixed(2)}`
  }

  const limpiarNotaPago = (nota) => {
    const limpia = String(nota || '').replace(/\s*\[(?:entrega-(?:pedido|producto)|producto):[^\]]+\]/gi, '').trim()
    return limpia || '-'
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

  const esContactoWhatsApp = (cliente) => {
    return String(cliente?.medio_contacto || 'WhatsApp').toLowerCase().includes('whatsapp')
  }

  const puedeEnviarPorWhatsApp = (cliente) => {
    return esContactoWhatsApp(cliente) && Boolean(obtenerTelefonoWhatsApp(cliente?.telefono))
  }

  const obtenerTextoMedioContacto = (cliente) => {
    const medio = cliente?.medio_contacto || 'WhatsApp'
    const contacto = obtenerContactoCliente(cliente)
    return `${medio}${contacto && contacto !== 'Sin contacto' ? ` · ${contacto}` : ''}`
  }

  const obtenerUrlSeguimiento = () => {
    if (!pedido?.public_token) return ''
    return `${obtenerBasePublica()}/seguimiento/${pedido.public_token}`
  }

  const generarMensajeSeguimiento = () => {
    const url = obtenerUrlSeguimiento()
    if (!url) return ''

    const nombre = pedido?.clientes?.nombre || 'cliente'
    const codigo = pedido?.codigo || ''

    return `Hola ${nombre}, puedes revisar el seguimiento de tu pedido ${codigo} aquí:
${url}`
  }

  const generarMensajeEstado = (pedidoBase = pedido) => {
    const nombre = pedidoBase?.clientes?.nombre || pedido?.clientes?.nombre || 'cliente'
    const codigo = pedidoBase?.codigo || pedido?.codigo || ''
    const estado = obtenerEstadoAutomaticoPedido(pedidoBase || pedido, productos)
    const total = formatearDinero(pedidoBase?.total_cliente ?? pedido?.total_cliente)
    const anticipo = formatearDinero(pedidoBase?.anticipo ?? pedido?.anticipo)
    const restante = formatearDinero(pedidoBase?.restante ?? pedido?.restante)
    const productosTexto = formatearProductosParaMensaje(productos, formatearDinero)

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

  const enviarSeguimientoWhatsApp = async () => {
    const texto = generarMensajeSeguimiento()

    if (!texto) {
      mostrarToast('Este pedido no tiene link de seguimiento', 'error')
      return
    }

    if (!puedeEnviarPorWhatsApp(pedido?.clientes)) {
      try {
        await navigator.clipboard.writeText(texto)
        mostrarToast('Mensaje de seguimiento copiado. Envíalo por el medio del cliente.')
      } catch (error) {
        console.log(error)
        mostrarToast('No se pudo copiar el mensaje de seguimiento', 'error')
      }
      return
    }

    const telefono = obtenerTelefonoWhatsApp(pedido?.clientes?.telefono)
    const mensaje = encodeURIComponent(texto)
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank')
  }

  const enviarMensajePedidoActual = async () => {
    const texto = generarMensajeEstado(pedido)

    if (!puedeEnviarPorWhatsApp(pedido?.clientes)) {
      try {
        await navigator.clipboard.writeText(texto)
        mostrarToast('Mensaje copiado. Envíalo por el medio del cliente.')
      } catch (error) {
        console.log(error)
        mostrarToast('No se pudo copiar el mensaje', 'error')
      }
      return
    }

    const telefono = obtenerTelefonoWhatsApp(pedido?.clientes?.telefono)
    const mensaje = encodeURIComponent(texto)
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank')
  }

  const enviarMensajeEstadoWhatsApp = () => {
    if (!pedidoMensajeEstado) return

    if (!puedeEnviarPorWhatsApp(pedidoMensajeEstado?.clientes)) {
      mostrarToast('Este cliente usa otro medio. Copia el mensaje para enviarlo manualmente.', 'error')
      return
    }

    const telefono = obtenerTelefonoWhatsApp(pedidoMensajeEstado?.clientes?.telefono)
    const mensaje = encodeURIComponent(generarMensajeEstado(pedidoMensajeEstado))
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank')
  }

  const copiarContactoMensajeEstado = async () => {
    const contacto = obtenerContactoCliente(pedidoMensajeEstado?.clientes || pedido?.clientes)

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

  const copiarMensajeEstado = async () => {
    if (!pedidoMensajeEstado) return

    try {
      await navigator.clipboard.writeText(generarMensajeEstado(pedidoMensajeEstado))
      mostrarToast('Mensaje copiado correctamente')
    } catch (error) {
      console.log(error)
      mostrarToast('No se pudo copiar el mensaje', 'error')
    }
  }



  const copiarLinkSeguimiento = async () => {
    const url = obtenerUrlSeguimiento()

    if (!url) {
      mostrarToast('Este pedido todavía no tiene enlace de seguimiento', 'error')
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      mostrarToast('Enlace de seguimiento copiado')
    } catch (error) {
      console.log(error)
      mostrarToast('No se pudo copiar el enlace', 'error')
    }
  }

  const formatearFechaHora = (valor) => {
    if (!valor) return '-'
    const fecha = new Date(valor)
    if (Number.isNaN(fecha.getTime())) return formatearFecha(valor)

    return fecha.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const obtenerHistorialPedido = () => {
    const eventos = []

    if (pedido?.fecha_pedido || pedido?.creado_en) {
      eventos.push({
        id: `pedido-${pedido.id}`,
        fecha: pedido.fecha_pedido || pedido.creado_en,
        titulo: 'Pedido creado',
        descripcion: `${pedido.codigo || 'Pedido'} registrado para ${pedido.clientes?.nombre || 'el cliente'}.`,
        tipo: 'pedido'
      })
    }

    pagos.forEach((pago) => {
      eventos.push({
        id: `pago-${pago.id}`,
        fecha: pago.fecha_pago || pago.creado_en,
        titulo: `Pago de ${formatearDinero(pago.monto)} registrado`,
        descripcion: `${pago.metodo_pago || 'Método no especificado'}${limpiarNotaPago(pago.notas) !== '-' ? ` · ${limpiarNotaPago(pago.notas)}` : ''}`,
        tipo: 'pago'
      })
    })

    productos.forEach((producto) => {
      const nombre = producto.nombre_producto || 'Producto'

      if (producto.fecha_comprado) {
        eventos.push({
          id: `comprado-${producto.id}`,
          fecha: producto.fecha_comprado,
          titulo: 'Producto comprado',
          descripcion: nombre,
          tipo: 'compra'
        })
      }

      if (producto.fecha_recibido) {
        eventos.push({
          id: `recibido-${producto.id}`,
          fecha: producto.fecha_recibido,
          titulo: 'Producto recibido',
          descripcion: nombre,
          tipo: 'recibido'
        })
      }

      if (producto.fecha_dejado_negocio) {
        eventos.push({
          id: `negocio-${producto.id}`,
          fecha: producto.fecha_dejado_negocio,
          titulo: 'Producto dejado en el negocio',
          descripcion: nombre,
          tipo: 'negocio'
        })
      }

      if (producto.fecha_entregado_cliente || producto.entregado_en) {
        eventos.push({
          id: `entregado-${producto.id}`,
          fecha: producto.fecha_entregado_cliente || producto.entregado_en,
          titulo: 'Producto entregado al cliente',
          descripcion: nombre,
          tipo: 'entrega'
        })
      }
    })

    return eventos
      .filter((evento) => evento.fecha)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }

  const renderProductoDetalle = (producto) => {
    const progreso = obtenerProgresoProducto(producto)
    const estadoCompra = obtenerEstadoCompraProducto(producto)
    const menuAbierto = menuProductoAbierto === producto.id
    const precioPlataforma = Number(producto.precio_pagina ?? producto.precio_shein ?? 0)
    const precioCliente = precioUnitarioCliente(producto)
    const comisionCliente = Math.max(precioCliente - precioPlataforma, 0)

    return (
      <article id={`producto-${producto.id}`} key={producto.id} className={`detail-product-card ${pedidoConReembolso ? 'refund-censored-card' : ''}`} data-refund-label={pedidoConReembolso ? obtenerEtiquetaReembolso() : undefined}>
        <div className="detail-product-top">
          <div className="detail-product-title-block">
            <span className="detail-product-kicker">Producto</span>
            <h3>{producto.nombre_producto || 'Producto sin nombre'}</h3>
            <div className="detail-product-variants" aria-label="Características del producto">
              <span>
                <small>Talla</small>
                <strong>{producto.talla || 'Sin especificar'}</strong>
              </span>
              <span>
                <small>Color</small>
                <strong>{producto.color || 'Sin especificar'}</strong>
              </span>
              <span>
                <small>Cantidad</small>
                <strong>{Number(producto.cantidad || 0)}</strong>
              </span>
            </div>
          </div>

          <div className="detail-product-status-area">
            <span className={`detail-product-logistic-pill ${estadoCompra === 'Entregado' ? 'is-delivered' : estadoCompra === 'Dejado en negocio' ? 'is-shop' : estadoCompra === 'Recibido' ? 'is-received' : ['Comprado', 'En camino'].includes(estadoCompra) ? 'is-moving' : 'is-pending'}`}>
              {estadoCompra === 'Pendiente de compra' ? 'Compra pendiente' : estadoCompra}
            </span>

            <div className="product-status-pills">
              {productoPagado(producto) && <span className="mini-status-pill mini-status-paid">Pagado</span>}
              {productoEntregado(producto) && <span className="mini-status-pill mini-status-delivered">Entregado</span>}
              {!productoPagado(producto) && !productoEntregado(producto) && <span className="mini-status-pill">Pendiente</span>}
            </div>

            <div className="detail-product-menu-wrap">
              <button
                type="button"
                className="btn btn-light-bordered btn-small detail-product-action-toggle"
                onClick={() => setMenuProductoAbierto(menuAbierto ? null : producto.id)}
                disabled={estaProcesando || pedidoConReembolso}
              >
                Acciones ▾
              </button>

              {menuAbierto && (
                <div className="detail-product-menu">
                  {['Comprado', 'En camino'].includes(estadoCompra) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuProductoAbierto(null)
                        marcarEstadoLogisticoProducto(producto, 'Recibido')
                      }}
                      disabled={bloqueado || estaProcesando || pedidoConReembolso}
                    >
                      Marcar como recibido
                    </button>
                  )}

                  {estadoCompra === 'Recibido' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuProductoAbierto(null)
                        marcarEstadoLogisticoProducto(producto, 'Dejado en negocio')
                      }}
                      disabled={bloqueado || estaProcesando || pedidoConReembolso}
                    >
                      Marcar como dejado en negocio
                    </button>
                  )}

                  {!productoEntregado(producto) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuProductoAbierto(null)
                        abrirConfirmarEntregaProducto(producto)
                      }}
                      disabled={bloqueado || estaProcesando || pedidoConReembolso}
                    >
                      Entregar al cliente
                    </button>
                  )}

                  {producto.link_shein && (
                    <a
                      href={producto.link_shein}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setMenuProductoAbierto(null)}
                    >
                      Abrir link
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setMenuProductoAbierto(null)
                      abrirEditarProducto(producto)
                    }}
                    disabled={bloqueado || estaProcesando || pedidoConReembolso}
                  >
                    Editar producto
                  </button>

                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setMenuProductoAbierto(null)
                      solicitarEliminarProducto(producto)
                    }}
                    disabled={bloqueado || estaProcesando || pedidoConReembolso}
                  >
                    Eliminar producto
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="detail-product-data-grid">
          <div>
            <span>Precio en plataforma</span>
            <strong>{formatearDinero(precioPlataforma)}</strong>
          </div>
          <div className="detail-product-client-price">
            <span>Precio al cliente</span>
            <strong>{formatearDinero(precioCliente)}</strong>
            <small>
              {comisionCliente > 0
                ? `Incluye ${formatearDinero(comisionCliente)} de comisión`
                : 'Sin comisión adicional'}
            </small>
          </div>
          <div>
            <span>Comprado</span>
            <strong>{formatearFecha(producto.fecha_comprado)}</strong>
          </div>
          <div>
            <span>Llegada estimada</span>
            <strong>{formatearFecha(producto.fecha_estimada_llegada)}</strong>
          </div>
        </div>

        <div className="detail-product-progress-row">
          <div className="detail-product-progress-copy">
            <span>{progreso.texto}</span>
            <strong>{progreso.porcentaje}%</strong>
          </div>
          <div
            className={`detail-product-progress-line ${progreso.clase}`}
            role="progressbar"
            aria-label={progreso.texto}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={progreso.porcentaje}
          >
            <i style={{ width: `${progreso.porcentaje}%` }} />
          </div>
        </div>
      </article>
    )
  }

  if (!pedido) {
    return (
      <Layout>
        <Toast
          mensaje={toast?.mensaje}
          tipo={toast?.tipo}
          onClose={() => setToast(null)}
        />
        <div className="ordely-page-state-wrap">
          <EmptyState
            icon={errorCargaPedido ? 'error' : cargandoPedido ? 'loading' : 'orders'}
            tone={errorCargaPedido ? 'error' : 'default'}
            eyebrow={errorCargaPedido ? 'No pudimos abrirlo' : 'Cargando pedido'}
            title={errorCargaPedido || 'Estamos preparando toda la información.'}
            description={errorCargaPedido
              ? 'Tus datos no se modificaron. Puedes volver a intentarlo o regresar a la lista.'
              : 'Un momento, estamos consultando productos, pagos y seguimiento.'}
            actionLabel={errorCargaPedido ? 'Intentar de nuevo' : undefined}
            onAction={errorCargaPedido ? cargarTodo : undefined}
            secondaryLabel={errorCargaPedido ? 'Volver a pedidos' : undefined}
            secondaryTo={errorCargaPedido ? '/pedidos' : undefined}
          />
        </div>
      </Layout>
    )
  }

  const pedidoConReembolso = esEstadoReembolso(pedido.estado)
  const estadoAutomaticoPedido = obtenerEstadoAutomaticoPedido(pedido, productos)
  const historialPedido = obtenerHistorialPedido()
  const urlSeguimiento = obtenerUrlSeguimiento()

  const secciones = [
    { id: 'productos', texto: `Productos (${productos.length})` },
    { id: 'pagos', texto: `Pagos (${pagos.length})` },
    { id: 'seguimiento', texto: 'Seguimiento' },
    { id: 'historial', texto: 'Historial' }
  ]

  return (
    <Layout>
      <PageHelp page="detallePedido" />

      <Toast
        mensaje={toast?.mensaje}
        tipo={toast?.tipo}
        onClose={() => setToast(null)}
      />

      <section className="ordely-v56-detail-hero">
        <div className="ordely-v56-detail-hero-top">
          <button type="button" className="ordely-v56-back" onClick={volverAtras}>
            ← Volver a pedidos
          </button>

          <div className="ordely-v56-hero-menu">
            <button
              ref={botonMenuPedidoRef}
              type="button"
              className="btn btn-light-bordered"
              onClick={(evento) => {
                if (menuPedidoAbierto) {
                  setMenuPedidoAbierto(false)
                  setEstiloMenuPedido(null)
                  return
                }

                setEstiloMenuPedido(obtenerEstiloMenuPedido(evento.currentTarget))
                setMenuPedidoAbierto(true)
              }}
              disabled={estaProcesando}
              aria-haspopup="menu"
              aria-expanded={menuPedidoAbierto}
            >
              Más acciones ▾
            </button>

            {menuPedidoAbierto && estiloMenuPedido && typeof document !== 'undefined' && createPortal(
              <div
                className="detail-order-actions-menu ordely-v56-order-menu ordely-v56-order-menu-portal"
                role="menu"
                style={estiloMenuPedido}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuPedidoAbierto(false)
                    setEstiloMenuPedido(null)
                    enviarMensajePedidoActual()
                  }}
                  role="menuitem"
                >
                  Enviar mensaje de estado
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuPedidoAbierto(false)
                    setEstiloMenuPedido(null)
                    enviarSeguimientoWhatsApp()
                  }}
                  role="menuitem"
                >
                  Enviar seguimiento
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuPedidoAbierto(false)
                    setEstiloMenuPedido(null)
                    abrirEditarPedido()
                  }}
                  disabled={bloqueado || estaProcesando || pedidoConReembolso}
                  role="menuitem"
                >
                  Editar datos del pedido
                </button>
              </div>,
              document.body
            )}
          </div>
        </div>

        <div className="ordely-v56-detail-title-row">
          <div className="ordely-v56-detail-title">
            <span className="ordely-v56-detail-kicker">Detalle del pedido</span>
            <h1>{pedido.codigo || 'Pedido'}</h1>
            <p>
              {pedido.clientes?.nombre || 'Sin cliente'} · {pedido.plataforma || 'Sin plataforma'}
            </p>
          </div>

          <div className="ordely-v56-detail-badges">
            <span className={`badge ${estadoClase(estadoAutomaticoPedido)}`}>
              {estadoAutomaticoPedido}
            </span>
            {renderPagoBadge()}
          </div>
        </div>

        <div className="ordely-v56-detail-money">
          <div>
            <span>Total</span>
            <strong>{formatearDinero(pedido.total_cliente)}</strong>
          </div>
          <div>
            <span>Pagado</span>
            <strong>{formatearDinero(pedido.anticipo)}</strong>
          </div>
          <div className={Number(pedido.restante || 0) > 0 ? 'is-pending' : 'is-complete'}>
            <span>Restante</span>
            <strong>{formatearDinero(pedido.restante)}</strong>
          </div>
        </div>

        <div className="ordely-v56-primary-actions">
          {!pedidoConReembolso && (
            <button
              type="button"
              className={estadoAutomaticoPedido === 'Entregado' ? 'btn btn-light-bordered detail-special-action is-return' : 'btn btn-light-bordered detail-special-action'}
              onClick={() => abrirCambioEspecialPedido(estadoAutomaticoPedido === 'Entregado' ? 'Devuelto' : 'Cancelado')}
              disabled={bloqueado || estaProcesando}
            >
              {estadoAutomaticoPedido === 'Entregado' ? 'Marcar como devuelto' : 'Cancelar pedido'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={abrirAgregarPago}
            disabled={bloqueado || estaProcesando || pedidoConReembolso}
          >
            Registrar pago
          </button>
          <button
            type="button"
            className="btn btn-light-bordered"
            onClick={enviarSeguimientoWhatsApp}
          >
            Enviar seguimiento
          </button>
        </div>
      </section>

      <PlanLimitNotice estadoPlan={estadoPlan} compacto />

      {pedidoConReembolso && (
        <div className="refund-locked-notice">
          <strong>{obtenerEtiquetaReembolso()}</strong>
          <span>
            Este pedido quedó fuera de estadísticas. Reembolso registrado: {formatearDinero(pedido.reembolso_monto || 0)}. Este pedido ya no permite cambios operativos.
          </span>
        </div>
      )}

      <nav className="ordely-v56-detail-tabs" aria-label="Secciones del pedido">
        {secciones.map((seccion) => (
          <button
            key={seccion.id}
            type="button"
            className={seccionActiva === seccion.id ? 'active' : ''}
            onClick={() => setSeccionActiva(seccion.id)}
          >
            {seccion.texto}
          </button>
        ))}
      </nav>

      {seccionActiva === 'productos' && (
        <section className="ordely-v56-section">
          <div className="ordely-v56-section-header">
            <div>
              <span className="ordely-v56-section-kicker">Productos</span>
              <h2>Avance de cada producto</h2>
              <p>Actualiza la compra, recepción y entrega sin perder de vista los precios.</p>
            </div>

            <button className="btn btn-primary" onClick={abrirAgregarProducto} disabled={bloqueado || estaProcesando || pedidoConReembolso}>
              Agregar producto
            </button>
          </div>

          <div className="detail-products-list ordely-v56-products-list">
            {productos.map((producto) => renderProductoDetalle(producto))}

            {productos.length === 0 && (
              <EmptyState
                icon="products"
                eyebrow="Pedido sin productos"
                title="Agrega el primer producto."
                description="Después podrás registrar su compra, llegada y entrega desde esta misma sección."
                actionLabel="Agregar primer producto"
                onAction={abrirAgregarProducto}
              />
            )}
          </div>
        </section>
      )}

      {seccionActiva === 'pagos' && (
        <section className="ordely-v56-section">
          <div className="ordely-v56-section-header">
            <div>
              <span className="ordely-v56-section-kicker">Pagos</span>
              <h2>Movimientos del pedido</h2>
              <p>Consulta anticipos, abonos y el saldo que todavía falta por cobrar.</p>
            </div>

            <button className="btn btn-primary" onClick={abrirAgregarPago} disabled={bloqueado || estaProcesando || pedidoConReembolso}>
              Registrar pago
            </button>
          </div>

          <div className="ordely-v56-payment-summary">
            <div>
              <span>Total del pedido</span>
              <strong>{formatearDinero(pedido.total_cliente)}</strong>
            </div>
            <div>
              <span>Total pagado</span>
              <strong>{formatearDinero(pedido.anticipo)}</strong>
            </div>
            <div className={Number(pedido.restante || 0) > 0 ? 'is-pending' : 'is-complete'}>
              <span>Saldo pendiente</span>
              <strong>{formatearDinero(pedido.restante)}</strong>
            </div>
          </div>

          <div className={`table-card desktop-table ${pedidoConReembolso ? 'refund-censored-surface' : ''}`} data-refund-label={pedidoConReembolso ? obtenerEtiquetaReembolso() : undefined}>
            <table>
              <thead>
                <tr>
                  <th>Monto</th>
                  <th>Método</th>
                  <th>Fecha</th>
                  <th>Notas</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {pagos.map((pago) => (
                  <tr key={pago.id} className={pedidoConReembolso ? 'refund-censored-row' : ''}>
                    <td><strong>{formatearDinero(pago.monto)}</strong></td>
                    <td>{pago.metodo_pago || '-'}</td>
                    <td>{formatearFechaHora(pago.fecha_pago || pago.creado_en)}</td>
                    <td>{limpiarNotaPago(pago.notas)}</td>
                    <td className="actions">
                      <button
                        onClick={() => abrirEditarPago(pago)}
                        className="btn btn-light-bordered btn-small"
                        disabled={bloqueado || estaProcesando || pedidoConReembolso}
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => solicitarEliminarPago(pago)}
                        className="btn btn-danger btn-small"
                        disabled={bloqueado || estaProcesando || pedidoConReembolso}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}

                {pagos.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <EmptyState
                        icon="history"
                        eyebrow="Sin movimientos"
                        title="Todavía no hay pagos registrados."
                        description="Registra el anticipo o el primer abono para mantener el saldo actualizado."
                        actionLabel="Registrar primer pago"
                        onAction={abrirAgregarPago}
                        compact
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mobile-list detail-mobile-list ordely-v56-payment-mobile-list">
            {pagos.map((pago) => (
              <div className={`mobile-card ${pedidoConReembolso ? 'refund-censored-card' : ''}`} data-refund-label={pedidoConReembolso ? obtenerEtiquetaReembolso() : undefined} key={pago.id}>
                <div className="mobile-card-header">
                  <div>
                    <h3>{formatearDinero(pago.monto)}</h3>
                    <p>{pago.metodo_pago || 'Sin método'} · {formatearFechaHora(pago.fecha_pago || pago.creado_en)}</p>
                  </div>
                </div>

                <div className="mobile-card-info single">
                  <div>
                    <span>Notas</span>
                    <strong>{limpiarNotaPago(pago.notas)}</strong>
                  </div>
                </div>

                <div className="mobile-card-actions multi-actions">
                  <button
                    onClick={() => abrirEditarPago(pago)}
                    className="btn btn-light-bordered"
                    disabled={bloqueado || estaProcesando || pedidoConReembolso}
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => solicitarEliminarPago(pago)}
                    className="btn btn-danger"
                    disabled={bloqueado || estaProcesando || pedidoConReembolso}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}

            {pagos.length === 0 && (
              <EmptyState
                icon="history"
                eyebrow="Sin movimientos"
                title="Todavía no hay pagos registrados."
                description="Registra el anticipo o el primer abono para mantener el saldo actualizado."
                actionLabel="Registrar primer pago"
                onAction={abrirAgregarPago}
              />
            )}
          </div>
        </section>
      )}

      {seccionActiva === 'seguimiento' && (
        <section className="ordely-v56-section">
          <div className="ordely-v56-section-header">
            <div>
              <span className="ordely-v56-section-kicker">Seguimiento</span>
              <h2>Comparte el avance con tu cliente</h2>
              <p>El cliente puede consultar estado, pagos y fechas sin iniciar sesión.</p>
            </div>
          </div>

          <div className="ordely-v56-tracking-grid">
            <article className="ordely-v56-tracking-card">
              <span className="ordely-v56-section-kicker">Enlace privado</span>
              <h3>{urlSeguimiento ? 'Seguimiento listo para compartir' : 'Aún no hay enlace disponible'}</h3>
              <p>
                {urlSeguimiento
                  ? 'Copia el enlace, ábrelo para revisarlo o envíalo al cliente por su medio de contacto.'
                  : 'El enlace aparecerá cuando el pedido tenga un token público de seguimiento.'}
              </p>

              {urlSeguimiento && (
                <div className="ordely-v56-tracking-url">
                  <span>{urlSeguimiento}</span>
                </div>
              )}

              <div className="ordely-v56-tracking-actions">
                <button type="button" className="btn btn-primary" onClick={enviarSeguimientoWhatsApp} disabled={!urlSeguimiento}>
                  Enviar seguimiento
                </button>
                <button type="button" className="btn btn-light-bordered" onClick={copiarLinkSeguimiento} disabled={!urlSeguimiento}>
                  Copiar enlace
                </button>
                {urlSeguimiento && (
                  <a className="btn btn-light-bordered" href={urlSeguimiento} target="_blank" rel="noreferrer">
                    Abrir vista pública
                  </a>
                )}
              </div>
            </article>

            <article className="ordely-v56-client-preview">
              <div className="ordely-v56-client-preview-head">
                <span>Vista del cliente</span>
                <strong>{pedido.codigo}</strong>
              </div>
              <div className="ordely-v56-client-preview-body">
                <span className={`badge ${estadoClase(estadoAutomaticoPedido)}`}>{estadoAutomaticoPedido}</span>
                <h3>{pedido.clientes?.nombre || 'Cliente'}</h3>
                <p>{productos.length} producto{productos.length === 1 ? '' : 's'} en este pedido</p>
                <div>
                  <span>Pagado</span>
                  <strong>{formatearDinero(pedido.anticipo)}</strong>
                </div>
                <div>
                  <span>Restante</span>
                  <strong>{formatearDinero(pedido.restante)}</strong>
                </div>
              </div>
            </article>
          </div>
        </section>
      )}

      {seccionActiva === 'historial' && (
        <section className="ordely-v56-section">
          <div className="ordely-v56-section-header">
            <div>
              <span className="ordely-v56-section-kicker">Historial</span>
              <h2>Actividad del pedido</h2>
              <p>Los movimientos disponibles se ordenan del más reciente al más antiguo.</p>
            </div>
          </div>

          <div className="ordely-v56-timeline">
            {historialPedido.map((evento) => (
              <article key={evento.id} className={`ordely-v56-timeline-item is-${evento.tipo}`}>
                <span className="ordely-v56-timeline-dot" />
                <div>
                  <time>{formatearFechaHora(evento.fecha)}</time>
                  <h3>{evento.titulo}</h3>
                  <p>{evento.descripcion}</p>
                </div>
              </article>
            ))}

            {historialPedido.length === 0 && (
              <EmptyState
                icon="history"
                eyebrow="Historial vacío"
                title="Todavía no hay movimientos para mostrar."
                description="Los pagos y avances de productos aparecerán aquí automáticamente."
                compact
              />
            )}
          </div>
        </section>
      )}

      <div className="ordely-v56-mobile-actions" aria-label="Acciones rápidas del pedido">
        <button type="button" onClick={abrirEditarPedido} disabled={bloqueado || estaProcesando}>
          <span>Estado</span>
        </button>
        <button type="button" className="primary" onClick={abrirAgregarPago} disabled={bloqueado || estaProcesando || pedidoConReembolso}>
          <span>Pago</span>
        </button>
        <button type="button" onClick={enviarSeguimientoWhatsApp}>
          <span>Compartir</span>
        </button>
      </div>

      <Modal
        abierto={modalPedido}
        titulo="Editar pedido"
        onClose={() => setModalPedido(false)}
      >
        <form onSubmit={guardarPedidoGeneral}>
          <div className="modal-form-grid">
            <label className="form-field">
              <span>Plataforma*</span>
              <select
                value={plataformaPedido}
                onChange={(e) => setPlataformaPedido(e.target.value)}
                required
              >
                {PLATAFORMAS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Cliente*</span>
              <select
                value={clienteIdPedido}
                onChange={(e) => setClienteIdPedido(e.target.value)}
                required
              >
                <option value="">Selecciona cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre} · {cliente.medio_contacto || 'WhatsApp'}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Tracking / guía</span>
              <input
                value={trackingPedido}
                onChange={(e) => setTrackingPedido(e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Notas del pedido</span>
              <input
                value={notasPedido}
                onChange={(e) => setNotasPedido(e.target.value)}
              />
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-light-bordered"
              onClick={() => setModalPedido(false)}
            >
              Cancelar
            </button>

            <button className="btn btn-primary" disabled={bloqueado || estaProcesando}>
              {accionEnProceso || 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        abierto={modalProducto}
        titulo={productoEditando ? 'Editar producto' : 'Agregar producto'}
        onClose={cerrarModalProducto}
      >
        <form onSubmit={guardarProducto}>
          <div className="modal-form-grid">
            <label className="form-field">
              <span>Nombre producto*</span>
              <input
                value={nombreProducto}
                onChange={(e) => setNombreProducto(e.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Link del producto</span>
              <input
                value={linkShein}
                onChange={(e) => setLinkShein(e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Talla</span>
              <input
                value={talla}
                onChange={(e) => setTalla(e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Color</span>
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Cantidad*</span>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Precio página*</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={Math.max(Number(pedido?.restante || 0) + Number(pagoEditando?.monto || 0), 0)}
                value={precioPagina}
                onChange={(e) => setPrecioPagina(e.target.value)}
                required
              />
            </label>

            <div className="product-commission-field product-commission-field-modal">
              <label className="product-commission-toggle">
                <input
                  type="checkbox"
                  checked={cobraComisionProducto}
                  onChange={(e) => setCobraComisionProducto(e.target.checked)}
                />
                <span>
                  <strong>Cobrar comisión extra</strong>
                  <small>Se suma al precio de plataforma por cada unidad.</small>
                </span>
              </label>

              {cobraComisionProducto && (
                <label className="form-field product-commission-amount">
                  <span>Comisión por unidad*</span>
                  <div className="money-input-with-prefix">
                    <i>$</i>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={comisionExtraProducto}
                      onChange={(e) => setComisionExtraProducto(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <small className="field-help-text">
                    Precio final para el cliente: ${(
                      Number(precioPagina || 0) + Number(comisionExtraProducto || 0)
                    ).toFixed(2)} por unidad.
                  </small>
                </label>
              )}
            </div>

            <label className="form-field">
              <span>Costo real</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precioShein}
                onChange={(e) => setPrecioShein(e.target.value)}
                placeholder="Se calcula al crear lote"
              />
            </label>

          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-light-bordered"
              onClick={cerrarModalProducto}
            >
              Cancelar
            </button>

            <button className="btn btn-primary" disabled={bloqueado || estaProcesando || pedidoConReembolso}>
              {accionEnProceso || (productoEditando ? 'Guardar cambios' : 'Guardar producto')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        abierto={modalPago}
        titulo={pagoEditando ? 'Editar pago' : 'Agregar pago'}
        onClose={cerrarModalPago}
      >
        <form onSubmit={guardarPago}>
          <div className="modal-form-grid">
            <label className="form-field">
              <span>Monto*</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Método de pago*</span>
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} required>
                {metodoPago && !METODOS_PAGO.includes(metodoPago) && (
                  <option value={metodoPago}>{metodoPago}</option>
                )}
                {METODOS_PAGO.map((metodo) => (
                  <option value={metodo} key={metodo}>{metodo}</option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Fecha del pago*</span>
              <input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                required
              />
              <small className="field-help-text">Hoy aparece seleccionado, pero puedes cambiarlo.</small>
            </label>

            <label className="form-field payment-notes-field">
              <span>Notas</span>
              <input
                value={notasPago}
                onChange={(e) => setNotasPago(e.target.value)}
                placeholder="Opcional"
              />
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-light-bordered"
              onClick={cerrarModalPago}
            >
              Cancelar
            </button>

            <button className="btn btn-primary" disabled={bloqueado || estaProcesando || pedidoConReembolso}>
              {accionEnProceso || (pagoEditando ? 'Guardar cambios' : 'Guardar pago')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        abierto={modalConfirmarEntrega}
        titulo="Confirmar entrega"
        onClose={() => {
          setModalConfirmarEntrega(false)
          setEntregaPendiente(null)
        }}
      >
        <div className="confirm-delivery-modal">
          <p className="muted">
            Se marcará el pedido como entregado. Si todavía hay saldo pendiente, se registrará automáticamente como pago de entrega.
          </p>

          <div className="confirm-delivery-amount">
            <span>Restante a cobrar</span>
            <strong>{formatearDinero(entregaPendiente?.montoRestante || pedido?.restante || 0)}</strong>
          </div>

          {Number(entregaPendiente?.montoRestante || pedido?.restante || 0) > 0 && (
            <div className="payment-delivery-fields">
              <label className="form-field">
                <span>Método de pago*</span>
                <select value={metodoPagoEntrega} onChange={(e) => setMetodoPagoEntrega(e.target.value)} required>
                  {METODOS_PAGO.map((metodo) => (
                    <option value={metodo} key={metodo}>{metodo}</option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Fecha del pago*</span>
                <input type="date" value={fechaPagoEntrega} onChange={(e) => setFechaPagoEntrega(e.target.value)} required />
              </label>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-light-bordered"
              onClick={() => {
                setModalConfirmarEntrega(false)
                setEntregaPendiente(null)
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmarEntregaPedido}
              disabled={bloqueado || estaProcesando || pedidoConReembolso}
            >
              {accionEnProceso || 'Confirmar entrega'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        abierto={modalConfirmarProducto}
        titulo="Confirmar producto entregado"
        onClose={() => {
          setModalConfirmarProducto(false)
          setProductoEntregaPendiente(null)
        }}
      >
        {productoEntregaPendiente?.producto && (
          <div className="confirm-delivery-modal">
            <p className="muted">
              Se marcará este producto como pagado y entregado. Si corresponde, se registrará el pago pendiente.
            </p>

            <div className="confirm-delivery-product">
              <span>Producto</span>
              <strong>{productoEntregaPendiente.producto.nombre_producto}</strong>
            </div>

            <div className="confirm-delivery-product-totals">
              <div>
                <span>Total del producto</span>
                <strong>{formatearDinero(productoEntregaPendiente.totalProducto)}</strong>
              </div>
              <div>
                <span>Monto a registrar</span>
                <strong>{formatearDinero(productoEntregaPendiente.montoACobrar)}</strong>
              </div>
            </div>

            {productoEntregaPendiente.montoACobrar > 0 && (
              <div className="payment-delivery-fields">
                <label className="form-field">
                  <span>Método de pago*</span>
                  <select value={metodoPagoEntrega} onChange={(e) => setMetodoPagoEntrega(e.target.value)} required>
                    {METODOS_PAGO.map((metodo) => (
                      <option value={metodo} key={metodo}>{metodo}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Fecha del pago*</span>
                  <input type="date" value={fechaPagoEntrega} onChange={(e) => setFechaPagoEntrega(e.target.value)} required />
                </label>
              </div>
            )}

            {productoEntregaPendiente.montoACobrar <= 0 && (
              <p className="muted">
                Este producto ya queda cubierto con los pagos registrados. Solo se marcará como pagado y entregado.
              </p>
            )}

            {productoEntregaPendiente.esUltimoProductoPendiente && (
              <p className="muted">
                Este es el último producto pendiente. Al confirmar, el pedido también quedará como entregado.
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-light-bordered"
                onClick={() => {
                  setModalConfirmarProducto(false)
                  setProductoEntregaPendiente(null)
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmarEntregaProducto}
                disabled={bloqueado || estaProcesando || pedidoConReembolso}
              >
                {accionEnProceso || 'Confirmar'}
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
        <div className="refund-confirm-modal">
          <p className="muted">
            Este pedido quedará como {reembolsoPendiente?.estadoNuevo || 'cancelado/devuelto'} y no contará para estadísticas.
          </p>

          <div className="confirm-delivery-amount">
            <span>Pagado por el cliente</span>
            <strong>{formatearDinero(reembolsoPendiente?.montoPagado || pedido?.anticipo || 0)}</strong>
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
              max={Math.max(Number(reembolsoPendiente?.montoPagado || pedido?.anticipo || 0), 0)}
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
              onClick={confirmarReembolsoPedido}
              disabled={bloqueado || estaProcesando}
            >
              {accionEnProceso || 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        abierto={modalMensajeEstado}
        titulo="Estado actualizado"
        onClose={() => setModalMensajeEstado(false)}
      >
        {pedidoMensajeEstado && (
          <div className="state-message-modal">
            <div className="state-message-summary">
              <span>Pedido</span>
              <strong>{pedidoMensajeEstado.codigo}</strong>
              <span className={`badge ${estadoClase(pedidoMensajeEstado.estado)}`}>
                {normalizarEstado(pedidoMensajeEstado.estado)}
              </span>
            </div>

            <p className="muted">
              {puedeEnviarPorWhatsApp(pedidoMensajeEstado.clientes)
                ? 'Puedes enviar este mensaje directo por WhatsApp.'
                : 'Este cliente usa otro medio de contacto. Copia el mensaje y envíalo manualmente.'}
            </p>
            <div className="contact-delivery-hint">
              <span>Medio del cliente</span>
              <strong>{obtenerTextoMedioContacto(pedidoMensajeEstado.clientes)}</strong>
            </div>

            <div className="message-preview-box">
              <pre>{generarMensajeEstado(pedidoMensajeEstado)}</pre>
            </div>

            <div className="modal-actions modal-actions-wrap">
              {puedeEnviarPorWhatsApp(pedidoMensajeEstado.clientes) ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={enviarMensajeEstadoWhatsApp}
                >
                  Enviar mensaje
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={copiarMensajeEstado}
                >
                  Copiar mensaje
                </button>
              )}

              <button
                type="button"
                className="btn btn-light-bordered"
                onClick={enviarSeguimientoWhatsApp}
              >
                Enviar seguimiento
              </button>

              {!puedeEnviarPorWhatsApp(pedidoMensajeEstado.clientes) && (
                <button
                  type="button"
                  className="btn btn-light-bordered"
                  onClick={copiarContactoMensajeEstado}
                >
                  Copiar contacto
                </button>
              )}

              {puedeEnviarPorWhatsApp(pedidoMensajeEstado.clientes) && (
                <button
                  type="button"
                  className="btn btn-light-bordered"
                  onClick={copiarMensajeEstado}
                >
                  Copiar mensaje
                </button>
              )}

              <button
                type="button"
                className="btn btn-light-bordered"
                onClick={() => setModalMensajeEstado(false)}
              >
                No enviar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        abierto={Boolean(elementoAEliminar)}
        titulo={elementoAEliminar?.tipo === 'pago' ? '¿Eliminar este pago?' : '¿Eliminar este producto?'}
        descripcion={elementoAEliminar?.tipo === 'pago'
          ? 'El saldo del pedido se volverá a calcular. Esta acción no se puede deshacer.'
          : 'El total del pedido se volverá a calcular. Esta acción no se puede deshacer.'}
        detalle={elementoAEliminar?.tipo === 'pago'
          ? formatearDinero(elementoAEliminar?.item?.monto || 0)
          : (elementoAEliminar?.item?.nombre_producto || 'Producto')}
        confirmarTexto={elementoAEliminar?.tipo === 'pago' ? 'Sí, eliminar pago' : 'Sí, eliminar producto'}
        onConfirm={elementoAEliminar?.tipo === 'pago' ? eliminarPagoConfirmado : eliminarProductoConfirmado}
        onClose={() => setElementoAEliminar(null)}
        cargando={accionEnProceso === 'Eliminando producto...' || accionEnProceso === 'Eliminando pago...'}
        variante="danger"
      />
    </Layout>
  )
}
