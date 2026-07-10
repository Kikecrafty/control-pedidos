import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import { cargarEstadoPlan, estaBloqueadoPorPlan } from '../lib/planes'

export default function DetallePedido() {
  const { id } = useParams()

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

  const [modalMensajeEstado, setModalMensajeEstado] = useState(false)
  const [pedidoMensajeEstado, setPedidoMensajeEstado] = useState(null)
  const [modalConfirmarEntrega, setModalConfirmarEntrega] = useState(false)
  const [entregaPendiente, setEntregaPendiente] = useState(null)
  const [modalConfirmarProducto, setModalConfirmarProducto] = useState(false)
  const [productoEntregaPendiente, setProductoEntregaPendiente] = useState(null)

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
    'Comprado en plataforma',
    'En camino',
    'Recibido',
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

    return { tipo: 'pending', texto: 'Pendiente' }
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

  const productoEntregado = (producto) => producto?.entregado === true
  const productoPagado = (producto) => producto?.pagado_cliente === true || productoEntregado(producto)

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

    const restante = totalCliente - anticipo
    const ganancia = totalCliente - totalShein

    await supabase
      .from('pedidos')
      .update({
        total_shein: totalShein,
        total_cliente: totalCliente,
        anticipo,
        restante,
        ganancia
      })
      .eq('id', id)
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

    if (esEstadoReembolso(estadoNuevo)) {
      payloadPedido.reembolso = true
      payloadPedido.reembolso_monto = Number(pedido.anticipo || 0)
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

  const confirmarEntregaPedido = async () => {
    if (bloquearSiNoPuede()) return
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
          .select('id')
          .eq('pedido_id', id)
          .ilike('notas', `%${etiquetaPago}%`)
          .limit(1)

        if (!pagoExistente?.length) {
          const { error: errorPago } = await supabase
            .from('pagos')
            .insert([
              {
                pedido_id: id,
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
      }

      const { error: errorProductos } = await supabase
        .from('productos_pedido')
        .update({
          entregado: true,
          entregado_en: ahora,
          pagado_cliente: true,
          pagado_en: ahora
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
    if (productoEntregado(producto)) return

    const productosPendientesDespues = productos.filter((item) => item.id !== producto.id && !productoEntregado(item)).length
    const esUltimoProductoPendiente = productosPendientesDespues === 0
    const restantePedido = Math.max(Number(pedido?.restante || 0), 0)
    const montoProducto = totalProductoVenta(producto)
    const montoACobrar = esUltimoProductoPendiente ? restantePedido : Math.min(montoProducto, restantePedido)

    setProductoEntregaPendiente({
      producto,
      montoACobrar,
      esUltimoProductoPendiente
    })
    setModalConfirmarProducto(true)
  }

  const confirmarEntregaProducto = async () => {
    if (bloquearSiNoPuede()) return
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
          pagado_en: ahora
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
      const restanteActual = Math.max(Number(pedidoActual?.restante || pedido?.restante || 0), 0)
      const montoProducto = totalProductoVenta(productoMarcado)
      const montoACobrar = esUltimoProductoPendiente ? restanteActual : Math.min(montoProducto, restanteActual)
      const etiquetaPago = `[producto:${productoMarcado.id}]`

      if (montoACobrar > 0) {
        const { data: pagoExistente } = await supabase
          .from('pagos')
          .select('id')
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
                notas: `Pago al entregar: ${productoMarcado.nombre_producto || 'producto'} ${etiquetaPago}`,
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
    setPrecioShein('')
    setPrecioVenta('')
  }

  const abrirAgregarProducto = () => {
    if (bloquearSiNoPuede()) return
    limpiarProducto()
    setModalProducto(true)
  }

  const abrirEditarProducto = (producto) => {
    if (bloquearSiNoPuede()) return
    setProductoEditando(producto)
    setNombreProducto(producto.nombre_producto || '')
    setLinkShein(producto.link_shein || '')
    setTalla(producto.talla || '')
    setColor(producto.color || '')
    setCantidad(producto.cantidad || 1)
    setPrecioShein(producto.precio_shein || '')
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
    if (!iniciarAccion(productoEditando ? 'Guardando cambios...' : 'Guardando producto...')) return

    try {
      const payload = {
        pedido_id: id,
        nombre_producto: nombreProducto,
        link_shein: linkShein,
        talla,
        color,
        cantidad: Number(cantidad),
        precio_shein: Number(precioShein),
        precio_venta: Number(precioVenta)
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
    limpiarPago()
    setModalPago(true)
  }

  const abrirEditarPago = (pago) => {
    if (bloquearSiNoPuede()) return
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


    if (estado === 'Comprado en plataforma') {
      return `Hola ${nombre}, tu pedido ${codigo} ya fue comprado en plataforma.

Plataforma: ${plataforma}${lineaSeguimiento}`
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
          <span className={`badge ${estadoClase(pedido.estado)}`}>
            {normalizarEstado(pedido.estado)}
          </span>

          {renderPagoBadge()}

          <button className="btn btn-light-bordered" onClick={copiarLinkSeguimiento}>
            Copiar seguimiento
          </button>

          <button className="btn btn-light-bordered" onClick={enviarSeguimientoWhatsApp}>
            Enviar seguimiento
          </button>

          <button className="btn btn-light-bordered" onClick={abrirEditarPedido} disabled={bloqueado || estaProcesando}>
            Editar pedido
          </button>
        </div>
      </div>

      <PlanLimitNotice estadoPlan={estadoPlan} compacto />

      <div className={`cards-grid detail-summary-grid ${pedidoConReembolso ? 'refund-censored-surface' : ''}`}>
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

        <button className="btn btn-primary" onClick={abrirAgregarProducto} disabled={bloqueado || estaProcesando}>
          Agregar producto
        </button>
      </div>

      <div className={`table-card desktop-table ${pedidoConReembolso ? 'refund-censored-surface' : ''}`}>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Talla</th>
              <th>Color</th>
              <th>Cantidad</th>
              <th>Costo plataforma</th>
              <th>Precio venta</th>
              <th>Link</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {productos.map((producto) => (
              <tr key={producto.id} className={pedidoConReembolso ? 'refund-censored-row' : ''}>
                <td>{producto.nombre_producto}</td>
                <td>{producto.talla || '-'}</td>
                <td>{producto.color || '-'}</td>
                <td>{producto.cantidad}</td>
                <td>${Number(producto.precio_shein || 0).toFixed(2)}</td>
                <td>${Number(producto.precio_venta || 0).toFixed(2)}</td>
                <td>
                  {producto.link_shein ? (
                    <a href={producto.link_shein} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                  ) : '-'}
                </td>
                <td>
                  <div className="product-status-pills">
                    {productoPagado(producto) && <span className="mini-status-pill mini-status-paid">Pagado</span>}
                    {productoEntregado(producto) && <span className="mini-status-pill mini-status-delivered">Entregado</span>}
                    {!productoPagado(producto) && !productoEntregado(producto) && <span className="mini-status-pill">Pendiente</span>}
                  </div>
                </td>
                <td className="actions product-actions-inline">
                  {!productoEntregado(producto) && (
                    <button
                      onClick={() => abrirConfirmarEntregaProducto(producto)}
                      className="btn btn-success btn-small"
                      disabled={bloqueado || estaProcesando}
                    >
                      Entregado
                    </button>
                  )}

                  <button
                    onClick={() => abrirEditarProducto(producto)}
                    className="btn btn-light-bordered btn-small"
                    disabled={bloqueado || estaProcesando}
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => eliminarProducto(producto.id)}
                    className="btn btn-danger btn-small"
                    disabled={bloqueado || estaProcesando}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {productos.length === 0 && (
              <tr>
                <td colSpan="9">Este pedido todavía no tiene productos.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-list detail-mobile-list">
        {productos.map((producto) => (
          <div className={`mobile-card ${pedidoConReembolso ? 'refund-censored-card' : ''}`} key={producto.id}>
            <div className="mobile-card-header">
              <div>
                <h3>{producto.nombre_producto}</h3>
                <p>{producto.talla || 'Sin talla'} · {producto.color || 'Sin color'}</p>
              </div>
              <div className="product-status-pills product-status-pills-mobile">
                {productoPagado(producto) && <span className="mini-status-pill mini-status-paid">Pagado</span>}
                {productoEntregado(producto) && <span className="mini-status-pill mini-status-delivered">Entregado</span>}
                {!productoPagado(producto) && !productoEntregado(producto) && <span className="mini-status-pill">Pendiente</span>}
              </div>
            </div>

            <div className="mobile-card-info">
              <div>
                <span>Cantidad</span>
                <strong>{producto.cantidad}</strong>
              </div>
              <div>
                <span>Costo</span>
                <strong>${Number(producto.precio_shein || 0).toFixed(2)}</strong>
              </div>
              <div>
                <span>Venta</span>
                <strong>${Number(producto.precio_venta || 0).toFixed(2)}</strong>
              </div>
              <div>
                <span>Ganancia</span>
                <strong>${((Number(producto.precio_venta || 0) - Number(producto.precio_shein || 0)) * Number(producto.cantidad || 0)).toFixed(2)}</strong>
              </div>
            </div>

            <div className="mobile-card-actions multi-actions">
              {!productoEntregado(producto) && (
                <button
                  onClick={() => abrirConfirmarEntregaProducto(producto)}
                  className="btn btn-success"
                  disabled={bloqueado || estaProcesando}
                >
                  Entregado
                </button>
              )}

              {producto.link_shein && (
                <a
                  href={producto.link_shein}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-light-bordered"
                >
                  Abrir link
                </a>
              )}

              <button
                onClick={() => abrirEditarProducto(producto)}
                className="btn btn-light-bordered"
                disabled={bloqueado || estaProcesando}
              >
                Editar
              </button>

              <button
                onClick={() => eliminarProducto(producto.id)}
                className="btn btn-danger"
                disabled={bloqueado || estaProcesando}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

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

        <button className="btn btn-primary" onClick={abrirAgregarPago} disabled={bloqueado || estaProcesando}>
          Agregar pago
        </button>
      </div>

      <div className={`table-card desktop-table ${pedidoConReembolso ? 'refund-censored-surface' : ''}`}>
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
                <td>{pago.notas || '-'}</td>
                <td className="actions">
                  <button
                    onClick={() => abrirEditarPago(pago)}
                    className="btn btn-light-bordered btn-small"
                    disabled={bloqueado || estaProcesando}
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => eliminarPago(pago.id)}
                    className="btn btn-danger btn-small"
                    disabled={bloqueado || estaProcesando}
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
          <div className={`mobile-card ${pedidoConReembolso ? 'refund-censored-card' : ''}`} key={pago.id}>
            <div className="mobile-card-header">
              <div>
                <h3>${Number(pago.monto || 0).toFixed(2)}</h3>
                <p>{pago.metodo_pago || 'Sin método'} · {pago.fecha_pago}</p>
              </div>
            </div>

            <div className="mobile-card-info single">
              <div>
                <span>Notas</span>
                <strong>{pago.notas || '-'}</strong>
              </div>
            </div>

            <div className="mobile-card-actions multi-actions">
              <button
                onClick={() => abrirEditarPago(pago)}
                className="btn btn-light-bordered"
                disabled={bloqueado || estaProcesando}
              >
                Editar
              </button>

              <button
                onClick={() => eliminarPago(pago.id)}
                className="btn btn-danger"
                disabled={bloqueado || estaProcesando}
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
              <span>Costo plataforma*</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precioShein}
                onChange={(e) => setPrecioShein(e.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Precio venta*</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precioVenta}
                onChange={(e) => setPrecioVenta(e.target.value)}
                required
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

            <button className="btn btn-primary" disabled={bloqueado || estaProcesando}>
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

            <button className="btn btn-primary" disabled={bloqueado || estaProcesando}>
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
              disabled={bloqueado || estaProcesando}
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

            <div className="confirm-delivery-amount">
              <span>Monto a registrar</span>
              <strong>{formatearDinero(productoEntregaPendiente.montoACobrar)}</strong>
            </div>

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
                disabled={bloqueado || estaProcesando}
              >
                {accionEnProceso || 'Confirmar'}
              </button>
            </div>
          </div>
        )}
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
