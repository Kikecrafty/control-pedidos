import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import { cargarEstadoPlan, estaBloqueadoPorPlan } from '../lib/planes'

export default function DetallePedido() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [pedido, setPedido] = useState(null)
  const [estadoPlan, setEstadoPlan] = useState(null)
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [pagos, setPagos] = useState([])
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

  const [modalPedido, setModalPedido] = useState(false)
  const [modalProducto, setModalProducto] = useState(false)
  const [modalPago, setModalPago] = useState(false)
  const [menuPedidoAbierto, setMenuPedidoAbierto] = useState(false)
  const [menuProductoAbierto, setMenuProductoAbierto] = useState(null)

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
  const [estadoPedido, setEstadoPedido] = useState('Cotizado')
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
  const [precioVenta, setPrecioVenta] = useState('')

  const [pagoEditando, setPagoEditando] = useState(null)
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('')
  const [notasPago, setNotasPago] = useState('')

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

  useEffect(() => {
    cargarTodo()
    cargarPlan()
  }, [id])

  const mostrarToast = (mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo })
  }

  const volverAtras = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate('/pedidos')
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


  const bloquearSiPedidoCerrado = () => {
    if (!pedido || !esEstadoReembolso(pedido.estado)) return false
    mostrarToast('Este pedido está cancelado/devuelto. Reactívalo desde Editar pedido para hacer cambios.', 'error')
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

  const esEstadoReembolso = (estado) => {
    const estadoNormal = normalizarEstado(estado)
    return estadoNormal === 'Cancelado' || estadoNormal === 'Devuelto'
  }

  const obtenerEtiquetaReembolso = (estado = pedido?.estado) => {
    const estadoNormal = normalizarEstado(estado)
    return estadoNormal === 'Devuelto' ? 'Devuelto' : 'Cancelado'
  }

  const estaPagadoPorCliente = (pedidoBase = pedido) => {
    return (
      Number(pedidoBase?.total_cliente || 0) > 0 &&
      Number(pedidoBase?.restante || 0) <= 0 &&
      !['Cancelado', 'Devuelto'].includes(normalizarEstado(pedidoBase?.estado))
    )
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

  const totalProductoVenta = (producto) => {
    return Number(producto?.precio_venta || 0) * Number(producto?.cantidad || 0)
  }

  const totalProductoCosto = (producto) => {
    if (producto?.costo_real_total !== null && producto?.costo_real_total !== undefined) {
      return Number(producto.costo_real_total || 0)
    }

    return Number(producto?.precio_shein || producto?.precio_pagina || 0) * Number(producto?.cantidad || 0)
  }

  const totalProductoPagina = (producto) => {
    return Number(producto?.precio_pagina ?? producto?.precio_shein ?? 0) * Number(producto?.cantidad || 0)
  }

  const gananciaProducto = (producto) => {
    if (producto?.ganancia_real !== null && producto?.ganancia_real !== undefined) {
      return Number(producto.ganancia_real || 0)
    }

    return totalProductoVenta(producto) - totalProductoCosto(producto)
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
    const fecha = new Date(valor)
    if (Number.isNaN(fecha.getTime())) return '-'
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const obtenerEstadoCompraProducto = (producto) => {
    if (productoEntregado(producto) || producto?.estado_compra === 'Entregado') return 'Entregado'
    return producto?.estado_compra || 'Pendiente de compra'
  }

  const obtenerProgresoProducto = (producto) => {
    const estadoCompra = obtenerEstadoCompraProducto(producto)

    if (estadoCompra === 'Pendiente de compra') {
      return { porcentaje: 8, texto: 'Pendiente de compra', clase: 'product-progress-pending' }
    }

    if (estadoCompra === 'Recibido') {
      return { porcentaje: 82, texto: 'Recibido por ti', clase: 'product-progress-received' }
    }

    if (estadoCompra === 'Dejado en negocio') {
      return { porcentaje: 92, texto: 'Dejado en negocio', clase: 'product-progress-shop' }
    }

    if (estadoCompra === 'Entregado') {
      return { porcentaje: 100, texto: 'Entregado al cliente', clase: 'product-progress-delivered' }
    }

    const comprado = producto?.fecha_comprado ? new Date(producto.fecha_comprado) : null
    const estimada = producto?.fecha_estimada_llegada ? new Date(producto.fecha_estimada_llegada) : null

    if (!comprado || !estimada || Number.isNaN(comprado.getTime()) || Number.isNaN(estimada.getTime())) {
      return { porcentaje: 42, texto: 'En camino · sin fecha estimada', clase: 'product-progress-moving' }
    }

    const ahora = new Date()
    const total = Math.max(estimada.getTime() - comprado.getTime(), 1)
    const avance = Math.max(ahora.getTime() - comprado.getTime(), 0)
    const porcentaje = Math.min(Math.round((avance / total) * 100), 100)

    if (porcentaje >= 100) {
      return { porcentaje: 100, texto: 'Posiblemente ya llegó', clase: 'product-progress-arrived' }
    }

    return { porcentaje: Math.max(porcentaje, 15), texto: `Posible llegada: ${formatearFecha(producto.fecha_estimada_llegada)}`, clase: 'product-progress-moving' }
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

  const cargarTodo = async () => {
    const { data: pedidoData, error: errorPedido } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, telefono, direccion)')
      .eq('id', id)
      .single()

    if (errorPedido) {
      console.log(errorPedido)
      mostrarToast('Error al cargar pedido', 'error')
      return
    }

    const { data: clientesData } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true })

    const { data: productosData } = await supabase
      .from('productos_pedido')
      .select('*')
      .eq('pedido_id', id)
      .order('creado_en', { ascending: false })

    const { data: pagosData } = await supabase
      .from('pagos')
      .select('*')
      .eq('pedido_id', id)
      .order('creado_en', { ascending: false })

    setPedido(pedidoData)
    setClientes(clientesData || [])
    setProductos(productosData || [])
    setPagos(pagosData || [])
  }

  const recalcularPedido = async () => {
    const { data: pedidoRecalculado, error: errorRpc } = await supabase.rpc('recalcular_totales_pedido', {
      p_pedido_id: id
    })

    if (!errorRpc && pedidoRecalculado) {
      setPedido((actual) => actual ? { ...actual, ...pedidoRecalculado } : pedidoRecalculado)
      return pedidoRecalculado
    }

    console.log(errorRpc)

    // Respaldo temporal: si todavía no ejecutaste el SQL de la Parte 2,
    // la app sigue recalculando como antes para no romper el uso diario.
    const { data: productosActuales } = await supabase
      .from('productos_pedido')
      .select('*')
      .eq('pedido_id', id)

    const { data: pagosActuales } = await supabase
      .from('pagos')
      .select('*')
      .eq('pedido_id', id)

    const totalShein = (productosActuales || []).reduce(
      (sum, p) => sum + Number(p.precio_shein || 0) * Number(p.cantidad || 0),
      0
    )

    const totalCliente = (productosActuales || []).reduce(
      (sum, p) => sum + Number(p.precio_venta || 0) * Number(p.cantidad || 0),
      0
    )

    const anticipo = (pagosActuales || []).reduce(
      (sum, p) => sum + Number(p.monto || 0),
      0
    )

    const restante = Math.max(totalCliente - anticipo, 0)
    const ganancia = totalCliente - totalShein

    const { data: pedidoActualizado } = await supabase
      .from('pedidos')
      .update({
        total_shein: totalShein,
        total_cliente: totalCliente,
        anticipo,
        restante,
        ganancia
      })
      .eq('id', id)
      .select()
      .single()

    if (pedidoActualizado) {
      setPedido((actual) => actual ? { ...actual, ...pedidoActualizado } : pedidoActualizado)
    }

    return pedidoActualizado
  }

  const abrirEditarPedido = () => {
    if (bloquearSiNoPuede()) return
    if (!pedido) return

    setClienteIdPedido(pedido.cliente_id || '')
    setPlataformaPedido(pedido.plataforma || 'SHEIN')
    setEstadoPedido(normalizarEstado(pedido.estado))
    setTrackingPedido(pedido.tracking || '')
    setNotasPedido(pedido.notas || '')
    setModalPedido(true)
  }


  const sincronizarProductosConEstadoPedido = async (estadoNuevo) => {
    const estadoNormal = normalizarEstado(estadoNuevo)
    const ahora = new Date().toISOString()

    if (estadoNormal !== 'Recibido' && estadoNormal !== 'Dejado en negocio') return null

    const payload = estadoNormal === 'Recibido'
      ? {
          estado_compra: 'Recibido',
          fecha_recibido: ahora
        }
      : {
          estado_compra: 'Dejado en negocio',
          fecha_recibido: ahora,
          fecha_dejado_negocio: ahora
        }

    const { error } = await supabase
      .from('productos_pedido')
      .update(payload)
      .eq('pedido_id', id)
      .or('entregado.is.null,entregado.eq.false')

    if (error) {
      console.log(error)
      mostrarToast('El pedido se actualizó, pero no se pudieron actualizar todos los productos', 'error')
    }

    return error
  }

  const guardarPedidoGeneral = async (e) => {
    e.preventDefault()

    if (bloquearSiNoPuede()) return

    const estadoAnterior = normalizarEstado(pedido.estado)
    const estadoNuevo = normalizarEstado(estadoPedido)

    const payloadPedido = {
      cliente_id: clienteIdPedido || null,
      plataforma: plataformaPedido,
      estado: estadoNuevo,
      tracking: trackingPedido,
      notas: notasPedido,
      reembolso: false,
      reembolso_monto: 0
    }

    if (estadoAnterior !== estadoNuevo && estadoNuevo === 'Entregado') {
      setEntregaPendiente({
        payload: payloadPedido,
        montoRestante: Math.max(Number(pedido.restante || 0), 0)
      })
      setModalPedido(false)
      setModalConfirmarEntrega(true)
      return
    }

    if (estadoAnterior !== estadoNuevo && esEstadoReembolso(estadoNuevo)) {
      const montoPagado = Math.max(Number(pedido.anticipo || 0), 0)
      setReembolsoPendiente({
        payload: {
          ...payloadPedido,
          estado: estadoNuevo,
          reembolso: true
        },
        estadoAnterior,
        estadoNuevo,
        montoPagado
      })
      setMontoReembolso(montoPagado.toFixed(2))
      setModalPedido(false)
      setModalConfirmarReembolso(true)
      return
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

    if (estadoAnterior !== estadoNuevo) {
      await sincronizarProductosConEstadoPedido(estadoNuevo)
    }

    const clienteSeleccionado = clientes.find((cliente) => cliente.id === clienteIdPedido)

    const pedidoActualizado = {
      ...pedido,
      ...payloadPedido,
      clientes: clienteSeleccionado || pedido.clientes
    }

    setModalPedido(false)
    await cargarTodo()
    mostrarToast(esEstadoReembolso(estadoNuevo) ? 'Pedido marcado como reembolso' : 'Pedido actualizado correctamente')

    if (estadoAnterior !== estadoNuevo) {
      setPedidoMensajeEstado(pedidoActualizado)
      setModalMensajeEstado(true)
    }
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
      const montoFinal = Math.max(Number(montoReembolso || 0), 0)
      const payload = {
        ...reembolsoPendiente.payload,
        reembolso: true,
        reembolso_monto: montoFinal
      }

      const { error } = await supabase
        .from('pedidos')
        .update(payload)
        .eq('id', id)

      if (error) {
        console.log(error)
        mostrarToast('No se pudo guardar el reembolso', 'error')
        return
      }

      const clienteSeleccionado = clientes.find((cliente) => cliente.id === payload.cliente_id)
      const pedidoActualizado = {
        ...pedido,
        ...payload,
        clientes: clienteSeleccionado || pedido.clientes
      }

      setModalConfirmarReembolso(false)
      setReembolsoPendiente(null)
      setMontoReembolso('')
      await cargarTodo()
      mostrarToast(`${payload.estado} guardado con reembolso de ${formatearDinero(montoFinal)}`)
      setPedidoMensajeEstado(pedidoActualizado)
      setModalMensajeEstado(true)
    } finally {
      finalizarAccion()
    }
  }

  const confirmarEntregaPedido = async () => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    if (!iniciarAccion('Confirmando entrega...')) return

    try {
      const { data: pedidoActual, error: errorPedidoActual } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', id)
        .single()

      if (errorPedidoActual) {
        console.log(errorPedidoActual)
        mostrarToast('No se pudo validar el pedido', 'error')
        return
      }

      if (normalizarEstado(pedidoActual?.estado) === 'Entregado' && Number(pedidoActual?.restante || 0) <= 0) {
        setModalConfirmarEntrega(false)
        setEntregaPendiente(null)
        await cargarTodo()
        mostrarToast('Este pedido ya estaba entregado')
        return
      }

      const montoRestante = Math.max(Number(pedidoActual?.restante || entregaPendiente?.montoRestante || pedido?.restante || 0), 0)
      const ahora = new Date().toISOString()
      const etiquetaPago = `[entrega-pedido:${id}]`

      if (montoRestante > 0) {
        const { data: pagoExistente } = await supabase
          .from('pagos')
          .select('id, notas')
          .eq('pedido_id', id)
          .or(`notas.ilike.%${etiquetaPago}%,notas.eq.Pago restante al entregar pedido`)
          .limit(1)

        if (!pagoExistente?.length) {
          const { error: errorPago } = await supabase
            .from('pagos')
            .insert([
              {
                pedido_id: id,
                monto: montoRestante,
                metodo_pago: 'Entrega',
                notas: 'Pago restante al entregar pedido',
                tipo: 'pago'
              }
            ])

          if (errorPago) {
            console.log(errorPago)
            mostrarToast('No se pudo registrar el pago restante', 'error')
            return
          }
        }
      }

      const { error: errorProductos } = await supabase
        .from('productos_pedido')
        .update({
          entregado: true,
          entregado_en: ahora,
          pagado_cliente: true,
          pagado_en: ahora,
          estado_compra: 'Entregado',
          fecha_recibido: ahora,
          fecha_entregado_cliente: ahora
        })
        .eq('pedido_id', id)

      if (errorProductos) {
        console.log(errorProductos)
        mostrarToast('No se pudieron marcar los productos como entregados', 'error')
        return
      }

      await recalcularPedido()

      const payload = entregaPendiente?.payload || {
        cliente_id: pedidoActual.cliente_id,
        plataforma: pedidoActual.plataforma || 'SHEIN',
        tracking: pedidoActual.tracking || '',
        notas: pedidoActual.notas || ''
      }

      const { error } = await supabase
        .from('pedidos')
        .update({
          ...payload,
          estado: 'Entregado',
          reembolso: false,
          reembolso_monto: 0
        })
        .eq('id', id)

      if (error) {
        console.log(error)
        mostrarToast('No se pudo confirmar la entrega', 'error')
        return
      }

      const pedidoActualizado = {
        ...pedidoActual,
        ...payload,
        estado: 'Entregado',
        anticipo: Number(pedidoActual.anticipo || 0) + montoRestante,
        restante: 0,
        reembolso: false,
        reembolso_monto: 0
      }

      setModalConfirmarEntrega(false)
      setEntregaPendiente(null)
      await cargarTodo()
      mostrarToast(montoRestante > 0 ? 'Entrega confirmada y restante registrado' : 'Entrega confirmada')
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
    setModalConfirmarProducto(true)
  }

  const confirmarEntregaProducto = async () => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return
    if (!productoEntregaPendiente?.producto) return
    if (!iniciarAccion('Confirmando producto...')) return

    try {
      const productoOriginal = productoEntregaPendiente.producto
      const ahora = new Date().toISOString()

      const { data: productoMarcado, error: errorProducto } = await supabase
        .from('productos_pedido')
        .update({
          entregado: true,
          entregado_en: ahora,
          pagado_cliente: true,
          pagado_en: ahora,
          estado_compra: 'Entregado',
          fecha_recibido: ahora,
          fecha_entregado_cliente: ahora
        })
        .eq('id', productoOriginal.id)
        .or('entregado.is.null,entregado.eq.false')
        .select('*')
        .maybeSingle()

      if (errorProducto) {
        console.log(errorProducto)
        mostrarToast('No se pudo marcar el producto como entregado', 'error')
        return
      }

      if (!productoMarcado) {
        setModalConfirmarProducto(false)
        setProductoEntregaPendiente(null)
        await cargarTodo()
        mostrarToast('Este producto ya estaba entregado')
        return
      }

      const { data: pedidoActual } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', id)
        .single()

      const { data: productosActuales } = await supabase
        .from('productos_pedido')
        .select('id, entregado, precio_venta, cantidad')
        .eq('pedido_id', id)

      const productosPendientes = (productosActuales || []).filter((item) => item.id !== productoMarcado.id && item.entregado !== true)
      const esUltimoProductoPendiente = productosPendientes.length === 0
      const montoACobrar = calcularMontoCobroProducto(productoMarcado, productosActuales || [], pedidoActual || pedido)
      const etiquetaPago = `[producto:${productoMarcado.id}]`

      if (montoACobrar > 0) {
        const { data: pagoExistente } = await supabase
          .from('pagos')
          .select('id, notas')
          .eq('pedido_id', id)
          .ilike('notas', `%${etiquetaPago}%`)
          .limit(1)

        if (!pagoExistente?.length) {
          const { error: errorPago } = await supabase
            .from('pagos')
            .insert([
              {
                pedido_id: id,
                monto: montoACobrar,
                metodo_pago: 'Entrega producto',
                notas: `Pago al entregar: ${productoMarcado.nombre_producto || 'producto'}`,
                tipo: 'pago'
              }
            ])

          if (errorPago) {
            console.log(errorPago)
            mostrarToast('No se pudo registrar el pago del producto', 'error')
            return
          }
        }
      }

      await recalcularPedido()

      if (esUltimoProductoPendiente) {
        await supabase
          .from('pedidos')
          .update({
            estado: 'Entregado',
            reembolso: false,
            reembolso_monto: 0
          })
          .eq('id', id)
      }

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
    setPrecioVenta('')
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
    setPrecioVenta(producto.precio_venta || '')
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
      const payload = {
        pedido_id: id,
        nombre_producto: nombreProducto,
        link_shein: linkShein,
        talla,
        color,
        cantidad: Number(cantidad),
        precio_pagina: Number(precioPagina || precioShein || 0),
        precio_shein: Number(precioShein || precioPagina || 0),
        precio_venta: Number(precioPagina || precioShein || precioVenta || 0),
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

  const eliminarProducto = async (productoId) => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return

    const confirmar = confirm('¿Eliminar este producto?')
    if (!confirmar) return
    if (!iniciarAccion('Eliminando producto...')) return

    try {
      const { error } = await supabase
        .from('productos_pedido')
        .delete()
        .eq('id', productoId)

      if (error) {
        console.log(error)
        mostrarToast('Error al eliminar producto', 'error')
        return
      }

      await recalcularPedido()
      await cargarTodo()
      mostrarToast('Producto eliminado correctamente')
    } finally {
      finalizarAccion()
    }
  }

  const limpiarPago = () => {
    setPagoEditando(null)
    setMontoPago('')
    setMetodoPago('')
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
    setMetodoPago(pago.metodo_pago || '')
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
      const payload = {
        pedido_id: id,
        monto: Number(montoPago),
        metodo_pago: metodoPago,
        notas: notasPago
      }

      if (pagoEditando) {
        const { error } = await supabase
          .from('pagos')
          .update(payload)
          .eq('id', pagoEditando.id)

        if (error) {
          console.log(error)
          mostrarToast('Error al actualizar pago', 'error')
          return
        }

        cerrarModalPago()
        await recalcularPedido()
        await cargarTodo()
        mostrarToast('Pago actualizado correctamente')
        return
      }

      const { error } = await supabase
        .from('pagos')
        .insert([payload])

      if (error) {
        console.log(error)
        mostrarToast('Error al agregar pago', 'error')
        return
      }

      cerrarModalPago()
      await recalcularPedido()
      await cargarTodo()
      mostrarToast('Pago agregado correctamente')
    } finally {
      finalizarAccion()
    }
  }

  const eliminarPago = async (pagoId) => {
    if (bloquearSiNoPuede()) return
    if (bloquearSiPedidoCerrado()) return

    const confirmar = confirm('¿Eliminar este pago?')
    if (!confirmar) return
    if (!iniciarAccion('Eliminando pago...')) return

    try {
      const { error } = await supabase
        .from('pagos')
        .delete()
        .eq('id', pagoId)

      if (error) {
        console.log(error)
        mostrarToast('Error al eliminar pago', 'error')
        return
      }

      await recalcularPedido()
      await cargarTodo()
      mostrarToast('Pago eliminado correctamente')
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

  const obtenerUrlSeguimiento = () => {
    if (!pedido?.public_token) return ''
    return `${obtenerBasePublica()}/seguimiento/${pedido.public_token}`
  }

  const copiarLinkSeguimiento = async () => {
    const url = obtenerUrlSeguimiento()

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

  const generarMensajeSeguimiento = () => {
    const nombre = pedido?.clientes?.nombre || 'cliente'
    const codigo = pedido?.codigo || ''
    const plataforma = pedido?.plataforma || 'SHEIN'
    const estado = normalizarEstado(pedido?.estado)
    const total = formatearDinero(pedido?.total_cliente)
    const pagado = formatearDinero(pedido?.anticipo)
    const restante = formatearDinero(pedido?.restante)
    const url = obtenerUrlSeguimiento()

    return `Hola ${nombre}, te comparto el seguimiento de tu pedido ${codigo}.

Plataforma: ${plataforma}
Estado: ${estado}
Total: ${total}
Pagado: ${pagado}
Restante: ${restante}${url ? `

Link de seguimiento:
${url}` : ''}`
  }

  const generarMensajeEstado = (pedidoBase = pedido) => {
    const nombre = pedidoBase?.clientes?.nombre || 'cliente'
    const codigo = pedidoBase?.codigo || ''
    const plataforma = pedidoBase?.plataforma || 'SHEIN'
    const estado = normalizarEstado(pedidoBase?.estado)
    const total = formatearDinero(pedidoBase?.total_cliente)
    const pagado = formatearDinero(pedidoBase?.anticipo)
    const restante = formatearDinero(pedidoBase?.restante)
    const tracking = pedidoBase?.tracking || ''
    const url = pedidoBase?.public_token
      ? `${obtenerBasePublica()}/seguimiento/${pedidoBase.public_token}`
      : ''
    const lineaSeguimiento = url ? `

Puedes revisar el seguimiento aquí:
${url}` : ''

    if (estado === 'Cotizado') {
      return `Hola ${nombre}, tu pedido ${codigo} ya fue cotizado.

Plataforma: ${plataforma}
Total: ${total}
Restante: ${restante}${lineaSeguimiento}`
    }

    if (estado === 'En camino') {
      return `Hola ${nombre}, tu pedido ${codigo} ya está en camino.

Plataforma: ${plataforma}${tracking ? `
Guía / tracking: ${tracking}` : ''}${lineaSeguimiento}`
    }

    if (estado === 'Recibido') {
      return `Hola ${nombre}, tu pedido ${codigo} ya fue recibido.

Total: ${total}
Pagado: ${pagado}
Restante pendiente: ${restante}${lineaSeguimiento}`
    }

    if (estado === 'Dejado en negocio') {
      return `Hola ${nombre}, tu pedido ${codigo} ya está listo en el negocio.

Puedes pasar a recogerlo cuando gustes.${lineaSeguimiento}`
    }

    if (estado === 'Entregado') {
      return `Hola ${nombre}, tu pedido ${codigo} ya fue entregado.

Gracias por tu compra.${lineaSeguimiento}`
    }

    if (estado === 'Cancelado') {
      return `Hola ${nombre}, te aviso que el pedido ${codigo} fue marcado como cancelado.

Cualquier duda quedo al pendiente.${lineaSeguimiento}`
    }

    if (estado === 'Devuelto') {
      return `Hola ${nombre}, te aviso que el pedido ${codigo} fue marcado como devuelto.

Cualquier duda quedo al pendiente.${lineaSeguimiento}`
    }

    return `Hola ${nombre}, tu pedido ${codigo} cambió de estado.

Estado actual: ${estado}${lineaSeguimiento}`
  }

  const enviarSeguimientoWhatsApp = () => {
    const telefono = obtenerTelefonoWhatsApp(pedido?.clientes?.telefono)

    if (!telefono) {
      mostrarToast('Este cliente no tiene teléfono', 'error')
      return
    }

    const mensaje = encodeURIComponent(generarMensajeSeguimiento())
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank')
  }

  const enviarMensajeEstadoWhatsApp = () => {
    if (!pedidoMensajeEstado) return

    const telefono = obtenerTelefonoWhatsApp(pedidoMensajeEstado?.clientes?.telefono)

    if (!telefono) {
      mostrarToast('Este cliente no tiene teléfono', 'error')
      return
    }

    const mensaje = encodeURIComponent(generarMensajeEstado(pedidoMensajeEstado))
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank')
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



  const renderProductoDetalle = (producto) => {
    const progreso = obtenerProgresoProducto(producto)
    const estadoCompra = obtenerEstadoCompraProducto(producto)
    const menuAbierto = menuProductoAbierto === producto.id

    return (
      <article key={producto.id} className={`detail-product-card ${pedidoConReembolso ? 'refund-censored-card' : ''}`} data-refund-label={pedidoConReembolso ? obtenerEtiquetaReembolso() : undefined}>
        <div className="detail-product-top">
          <div className="detail-product-title-block">
            <span className="detail-product-kicker">Producto</span>
            <h3>{producto.nombre_producto || 'Producto sin nombre'}</h3>
            <p>{producto.talla || 'Sin talla'} · {producto.color || 'Sin color'} · Cantidad {producto.cantidad || 0}</p>
          </div>

          <div className="detail-product-status-area">
            <span className={`detail-product-logistic-pill ${estadoCompra === 'Entregado' ? 'is-delivered' : estadoCompra === 'Dejado en negocio' ? 'is-shop' : estadoCompra === 'Recibido' ? 'is-received' : estadoCompra === 'En camino' ? 'is-moving' : 'is-pending'}`}>
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
                      eliminarProducto(producto.id)
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
            <span>Precio página</span>
            <strong>{formatearDinero(Number(producto.precio_pagina ?? producto.precio_shein ?? 0))}</strong>
          </div>
          <div>
            <span>Costo real</span>
            <strong>{producto.lote_compra_id ? formatearDinero(Number(producto.costo_real_unitario ?? producto.precio_shein ?? 0)) : 'Pendiente'}</strong>
          </div>
          <div>
            <span>Total producto</span>
            <strong>{formatearDinero(totalProductoVenta(producto))}</strong>
          </div>
          <div>
            <span>Comprado</span>
            <strong>{formatearFecha(producto.fecha_comprado)}</strong>
          </div>
          <div>
            <span>Estimado</span>
            <strong>{formatearFecha(producto.fecha_estimada_llegada)}</strong>
          </div>
          <div>
            <span>Link</span>
            <strong>{producto.link_shein ? 'Disponible' : '-'}</strong>
          </div>
        </div>

        <div className="detail-product-progress-row">
          <span>{progreso.texto}</span>
          <div className={`detail-product-progress-line ${progreso.clase}`}>
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
        <p>Cargando pedido...</p>
      </Layout>
    )
  }

  const pedidoConReembolso = esEstadoReembolso(pedido.estado)

  return (
    <Layout>
      <Toast
        mensaje={toast?.mensaje}
        tipo={toast?.tipo}
        onClose={() => setToast(null)}
      />

      <div className="page-header row-between">
        <div>
          <h1>Pedido {pedido.codigo}</h1>
          <p>{pedido.plataforma || 'SHEIN'} · Cliente: {pedido.clientes?.nombre || 'Sin cliente'}</p>
        </div>

        <div className="actions detail-header-actions">
          <button type="button" className="btn btn-light-bordered detail-back-button" onClick={volverAtras}>
            ← Regresar
          </button>

          <span className={`badge ${estadoClase(pedido.estado)}`}>
            {normalizarEstado(pedido.estado)}
          </span>

          {renderPagoBadge()}

          <div className="detail-order-actions-menu-wrap">
            <button
              type="button"
              className="btn btn-light-bordered"
              onClick={() => setMenuPedidoAbierto(!menuPedidoAbierto)}
              disabled={estaProcesando}
            >
              Acciones ▾
            </button>

            {menuPedidoAbierto && (
              <div className="detail-order-actions-menu">
                <button
                  type="button"
                  onClick={() => {
                    setMenuPedidoAbierto(false)
                    copiarLinkSeguimiento()
                  }}
                >
                  Copiar seguimiento
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuPedidoAbierto(false)
                    enviarSeguimientoWhatsApp()
                  }}
                >
                  Enviar seguimiento
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuPedidoAbierto(false)
                    abrirEditarPedido()
                  }}
                  disabled={bloqueado || estaProcesando}
                >
                  Editar pedido
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <PlanLimitNotice estadoPlan={estadoPlan} compacto />

      {pedidoConReembolso && (
        <div className="refund-locked-notice">
          <strong>{obtenerEtiquetaReembolso()}</strong>
          <span>
            Este pedido quedó fuera de métricas. Reembolso registrado: {formatearDinero(pedido.reembolso_monto || 0)}. Para hacer cambios, reactívalo desde "Editar pedido".
          </span>
        </div>
      )}

      <div className={`cards-grid detail-summary-grid ${pedidoConReembolso ? 'refund-censored-surface' : ''}`} data-refund-label={pedidoConReembolso ? obtenerEtiquetaReembolso() : undefined}>
        <div className="card">
          <span>Plataforma</span>
          <strong>{pedido.plataforma || 'SHEIN'}</strong>
        </div>

        <div className="card">
          <span>Total cliente</span>
          <strong>${Number(pedido.total_cliente || 0).toFixed(2)}</strong>
        </div>

        <div className="card">
          <span>Pagado</span>
          <strong>${Number(pedido.anticipo || 0).toFixed(2)}</strong>
        </div>

        <div className="card">
          <span>Restante</span>
          <strong>${Number(pedido.restante || 0).toFixed(2)}</strong>
        </div>

        <div className="card">
          <span>Ganancia</span>
          <strong>${Number(pedido.ganancia || 0).toFixed(2)}</strong>
        </div>

        <div className="card">
          <span>Tracking</span>
          <strong>{pedido.tracking || '-'}</strong>
        </div>
      </div>


      <div className="section-header row-between">
        <div>
          <h2>Productos</h2>
          <p className="muted">Productos agregados al pedido</p>
        </div>

        <button className="btn btn-primary" onClick={abrirAgregarProducto} disabled={bloqueado || estaProcesando || pedidoConReembolso}>
          Agregar producto
        </button>
      </div>

      <div className="detail-products-list">
        {productos.map((producto) => renderProductoDetalle(producto))}

        {productos.length === 0 && (
          <div className="empty-state">
            Este pedido todavía no tiene productos.
          </div>
        )}
      </div>

      <div className="section-header row-between">
        <div>
          <h2>Pagos</h2>
          <p className="muted">Pagos y abonos del pedido</p>
        </div>

        <button className="btn btn-primary" onClick={abrirAgregarPago} disabled={bloqueado || estaProcesando || pedidoConReembolso}>
          Agregar pago
        </button>
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
                <td>${Number(pago.monto || 0).toFixed(2)}</td>
                <td>{pago.metodo_pago || '-'}</td>
                <td>{pago.fecha_pago}</td>
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
                    onClick={() => eliminarPago(pago.id)}
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
                <td colSpan="5">Este pedido todavía no tiene pagos.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-list detail-mobile-list">
        {pagos.map((pago) => (
          <div className={`mobile-card ${pedidoConReembolso ? 'refund-censored-card' : ''}`} data-refund-label={pedidoConReembolso ? obtenerEtiquetaReembolso() : undefined} key={pago.id}>
            <div className="mobile-card-header">
              <div>
                <h3>${Number(pago.monto || 0).toFixed(2)}</h3>
                <p>{pago.metodo_pago || 'Sin método'} · {pago.fecha_pago}</p>
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
                onClick={() => eliminarPago(pago.id)}
                className="btn btn-danger"
                disabled={bloqueado || estaProcesando || pedidoConReembolso}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        {pagos.length === 0 && (
          <div className="empty-state">
            Este pedido todavía no tiene pagos.
          </div>
        )}
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
                {plataformas.map((item) => (
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
                    {cliente.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Estado del pedido*</span>
              <select
                value={estadoPedido}
                onChange={(e) => setEstadoPedido(e.target.value)}
                required
              >
                {estadosPedido.map((estado) => (
                  <option key={estado}>{estado}</option>
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
                min="0"
                value={precioPagina}
                onChange={(e) => setPrecioPagina(e.target.value)}
                required
              />
            </label>

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
              <span>Método de pago</span>
              <input
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Notas</span>
              <input
                value={notasPago}
                onChange={(e) => setNotasPago(e.target.value)}
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
            Este pedido quedará como {reembolsoPendiente?.estadoNuevo || 'cancelado/devuelto'} y no contará para métricas.
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
              El estado se guardó correctamente. Puedes enviar el mensaje sugerido al cliente por WhatsApp.
            </p>

            <div className="message-preview-box">
              <pre>{generarMensajeEstado(pedidoMensajeEstado)}</pre>
            </div>

            <div className="modal-actions modal-actions-wrap">
              <button
                type="button"
                className="btn btn-primary"
                onClick={enviarMensajeEstadoWhatsApp}
              >
                Enviar WhatsApp
              </button>

              <button
                type="button"
                className="btn btn-light-bordered"
                onClick={copiarMensajeEstado}
              >
                Copiar mensaje
              </button>

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
    </Layout>
  )
}
