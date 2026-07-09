import { useEffect, useState } from 'react'
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

  const [modalPedido, setModalPedido] = useState(false)
  const [modalProducto, setModalProducto] = useState(false)
  const [modalPago, setModalPago] = useState(false)

  const [modalMensajeEstado, setModalMensajeEstado] = useState(false)
  const [pedidoMensajeEstado, setPedidoMensajeEstado] = useState(null)

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
    'Pendiente de pago',
    'Pagado por cliente',
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

    const { error } = await supabase
      .from('pedidos')
      .update({
        cliente_id: clienteIdPedido || null,
        plataforma: plataformaPedido,
        estado: estadoPedido,
        tracking: trackingPedido,
        notas: notasPedido
      })
      .eq('id', id)

    if (error) {
      console.log(error)
      mostrarToast('Error al actualizar pedido', 'error')
      return
    }

    const clienteSeleccionado = clientes.find((cliente) => cliente.id === clienteIdPedido)

    const pedidoActualizado = {
      ...pedido,
      cliente_id: clienteIdPedido || null,
      plataforma: plataformaPedido,
      estado: estadoPedido,
      tracking: trackingPedido,
      notas: notasPedido,
      clientes: clienteSeleccionado || pedido.clientes
    }

    setModalPedido(false)
    await cargarTodo()
    mostrarToast('Pedido actualizado correctamente')

    if (estadoAnterior !== estadoPedido) {
      setPedidoMensajeEstado(pedidoActualizado)
      setModalMensajeEstado(true)
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
  }

  const eliminarProducto = async (productoId) => {
    if (bloquearSiNoPuede()) return

    const confirmar = confirm('¿Eliminar este producto?')
    if (!confirmar) return

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
  }

  const eliminarPago = async (pagoId) => {
    if (bloquearSiNoPuede()) return

    const confirmar = confirm('¿Eliminar este pago?')
    if (!confirmar) return

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
    return `${window.location.origin}/seguimiento/${pedido.public_token}`
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

Puedes consultarlo aquí:
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
      ? `${window.location.origin}/seguimiento/${pedidoBase.public_token}`
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

    if (estado === 'Pendiente de pago') {
      return `Hola ${nombre}, tu pedido ${codigo} está pendiente de pago.

Total: ${total}
Pagado: ${pagado}
Restante pendiente: ${restante}${lineaSeguimiento}`
    }

    if (estado === 'Pagado por cliente') {
      return `Hola ${nombre}, recibimos tu pago del pedido ${codigo}.

Pagado hasta ahora: ${pagado}
Restante pendiente: ${restante}${lineaSeguimiento}`
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

          <button className="btn btn-light-bordered" onClick={copiarLinkSeguimiento}>
            Copiar seguimiento
          </button>

          <button className="btn btn-light-bordered" onClick={enviarSeguimientoWhatsApp}>
            Enviar seguimiento
          </button>

          <button className="btn btn-light-bordered" onClick={abrirEditarPedido} disabled={bloqueado}>
            Editar pedido
          </button>
        </div>
      </div>

      <PlanLimitNotice estadoPlan={estadoPlan} compacto />

      <div className="cards-grid detail-summary-grid">
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

        <button className="btn btn-primary" onClick={abrirAgregarProducto} disabled={bloqueado}>
          Agregar producto
        </button>
      </div>

      <div className="table-card desktop-table">
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
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {productos.map((producto) => (
              <tr key={producto.id}>
                <td>{producto.nombre_producto}</td>
                <td>{producto.talla || '-'}</td>
                <td>{producto.color || '-'}</td>
                <td>{producto.cantidad}</td>
                <td>${Number(producto.precio_shein || 0).toFixed(2)}</td>
                <td>${Number(producto.precio_venta || 0).toFixed(2)}</td>
                <td>
                  {producto.link_shein && (
                    <a href={producto.link_shein} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                  )}
                </td>
                <td className="actions">
                  <button
                    onClick={() => abrirEditarProducto(producto)}
                    className="btn btn-light-bordered btn-small"
                    disabled={bloqueado}
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => eliminarProducto(producto.id)}
                    className="btn btn-danger btn-small"
                    disabled={bloqueado}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {productos.length === 0 && (
              <tr>
                <td colSpan="8">Este pedido todavía no tiene productos.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-list detail-mobile-list">
        {productos.map((producto) => (
          <div className="mobile-card" key={producto.id}>
            <div className="mobile-card-header">
              <div>
                <h3>{producto.nombre_producto}</h3>
                <p>{producto.talla || 'Sin talla'} · {producto.color || 'Sin color'}</p>
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
                disabled={bloqueado}
              >
                Editar
              </button>

              <button
                onClick={() => eliminarProducto(producto.id)}
                className="btn btn-danger"
                disabled={bloqueado}
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

        <button className="btn btn-primary" onClick={abrirAgregarPago} disabled={bloqueado}>
          Agregar pago
        </button>
      </div>

      <div className="table-card desktop-table">
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
              <tr key={pago.id}>
                <td>${Number(pago.monto || 0).toFixed(2)}</td>
                <td>{pago.metodo_pago || '-'}</td>
                <td>{pago.fecha_pago}</td>
                <td>{pago.notas || '-'}</td>
                <td className="actions">
                  <button
                    onClick={() => abrirEditarPago(pago)}
                    className="btn btn-light-bordered btn-small"
                    disabled={bloqueado}
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => eliminarPago(pago.id)}
                    className="btn btn-danger btn-small"
                    disabled={bloqueado}
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
          <div className="mobile-card" key={pago.id}>
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
                disabled={bloqueado}
              >
                Editar
              </button>

              <button
                onClick={() => eliminarPago(pago.id)}
                className="btn btn-danger"
                disabled={bloqueado}
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
            <select
              value={plataformaPedido}
              onChange={(e) => setPlataformaPedido(e.target.value)}
              required
            >
              {plataformas.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

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

            <select
              value={estadoPedido}
              onChange={(e) => setEstadoPedido(e.target.value)}
            >
              {estadosPedido.map((estado) => (
                <option key={estado}>{estado}</option>
              ))}
            </select>

            <input
              placeholder="Tracking / guía"
              value={trackingPedido}
              onChange={(e) => setTrackingPedido(e.target.value)}
            />

            <input
              placeholder="Notas del pedido"
              value={notasPedido}
              onChange={(e) => setNotasPedido(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-light-bordered"
              onClick={() => setModalPedido(false)}
            >
              Cancelar
            </button>

            <button className="btn btn-primary" disabled={bloqueado}>
              Guardar cambios
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
            <input
              placeholder="Nombre producto"
              value={nombreProducto}
              onChange={(e) => setNombreProducto(e.target.value)}
              required
            />

            <input
              placeholder="Link del producto"
              value={linkShein}
              onChange={(e) => setLinkShein(e.target.value)}
            />

            <input
              placeholder="Talla"
              value={talla}
              onChange={(e) => setTalla(e.target.value)}
            />

            <input
              placeholder="Color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />

            <input
              type="number"
              min="1"
              placeholder="Cantidad"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
            />

            <input
              type="number"
              step="0.01"
              placeholder="Costo plataforma"
              value={precioShein}
              onChange={(e) => setPrecioShein(e.target.value)}
              required
            />

            <input
              type="number"
              step="0.01"
              placeholder="Precio venta"
              value={precioVenta}
              onChange={(e) => setPrecioVenta(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-light-bordered"
              onClick={cerrarModalProducto}
            >
              Cancelar
            </button>

            <button className="btn btn-primary" disabled={bloqueado}>
              {productoEditando ? 'Guardar cambios' : 'Guardar producto'}
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
            <input
              type="number"
              step="0.01"
              placeholder="Monto"
              value={montoPago}
              onChange={(e) => setMontoPago(e.target.value)}
              required
            />

            <input
              placeholder="Método de pago"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            />

            <input
              placeholder="Notas"
              value={notasPago}
              onChange={(e) => setNotasPago(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-light-bordered"
              onClick={cerrarModalPago}
            >
              Cancelar
            </button>

            <button className="btn btn-primary" disabled={bloqueado}>
              {pagoEditando ? 'Guardar cambios' : 'Guardar pago'}
            </button>
          </div>
        </form>
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
