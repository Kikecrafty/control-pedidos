import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Seguimiento() {
  const { token } = useParams()
  const [pedido, setPedido] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarSeguimiento()
  }, [token])

  const normalizarEstado = (estado) => {
    if (estado === 'Comprado en SHEIN') return 'En camino'
    if (estado === 'Comprado en plataforma') return 'En camino'
    if (estado === 'Pendiente de pago') return 'Cotizado'
    if (estado === 'Pagado por cliente') return 'Cotizado'
    return estado || 'Cotizado'
  }

  const estaPagadoPorCliente = () => {
    return (
      Number(pedido?.total_cliente || 0) > 0 &&
      Number(pedido?.restante || 0) <= 0 &&
      !['Cancelado', 'Devuelto'].includes(normalizarEstado(pedido?.estado))
    )
  }

  const obtenerEstadoPago = () => {
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

  const renderPagoBadge = () => {
    const estadoPago = obtenerEstadoPago()

    if (estadoPago.tipo === 'refund') {
      return <span className="refund-status-badge refund-status-badge-small">Reembolso</span>
    }

    return (
      <span className={`payment-status-badge payment-status-${estadoPago.tipo} payment-status-badge-small`}>
        <i /> {estadoPago.texto}
      </span>
    )
  }

  const esEstadoReembolso = (estado) => {
    const estadoNormal = normalizarEstado(estado)
    return estadoNormal === 'Cancelado' || estadoNormal === 'Devuelto'
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

  const estadoProductoCliente = (producto) => {
    if (producto.entregado || producto.estado_compra === 'Entregado') return 'Entregado'
    if (producto.estado_compra === 'Dejado en negocio') return 'Listo para recoger'
    if (producto.estado_compra === 'Recibido') return 'Recibido por vendedor'
    if (producto.estado_compra === 'Comprado' || producto.estado_compra === 'En camino') {
      if (producto.fecha_estimada_llegada) return `En camino · estimado ${producto.fecha_estimada_llegada}`
      return 'En camino'
    }
    return 'Pendiente de compra'
  }

  const cargarSeguimiento = async () => {
    setCargando(true)
    setError('')

    const { data, error } = await supabase.rpc('public_obtener_seguimiento', {
      p_token: token
    })

    if (error) {
      console.log(error)
      setError('No se pudo cargar el seguimiento del pedido.')
      setCargando(false)
      return
    }

    const resultado = Array.isArray(data) ? data[0] : data

    if (!resultado) {
      setError('No se encontró este pedido.')
      setCargando(false)
      return
    }

    setPedido(resultado)
    setCargando(false)
  }

  if (cargando) {
    return (
      <div className="tracking-page">
        <div className="tracking-card">
          <p>Cargando seguimiento...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="tracking-page">
        <div className="tracking-card">
          <h1>Seguimiento</h1>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const productos = Array.isArray(pedido.productos) ? pedido.productos : []

  return (
    <div className="tracking-page">
      <div className="tracking-card tracking-main-card">
        <div className="tracking-top">
          <div>
            <span className="tracking-label">Seguimiento de pedido</span>
            <h1>{pedido.codigo}</h1>
            <p>{pedido.plataforma || 'Plataforma'} · {pedido.cliente_nombre || 'Cliente'}</p>
          </div>

          <div className="mobile-card-badges">
            <span className={`badge ${estadoClase(pedido.estado)}`}>
              {normalizarEstado(pedido.estado)}
            </span>

            {renderPagoBadge()}
          </div>
        </div>

        <div className="tracking-summary-grid">
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
            <span>Tracking</span>
            <strong>{pedido.tracking || '-'}</strong>
          </div>
        </div>
      </div>

      <div className="tracking-card">
        <h2>Productos</h2>

        <div className="tracking-products">
          {productos.map((producto, index) => (
            <div className="tracking-product" key={`${producto.nombre_producto}-${index}`}>
              <div>
                <h3>{producto.nombre_producto || 'Producto'}</h3>
                <p>{producto.talla || 'Sin talla'} · {producto.color || 'Sin color'}</p>
                <span className="tracking-product-status">{estadoProductoCliente(producto)}</span>
              </div>

              <strong>x{producto.cantidad || 1}</strong>
            </div>
          ))}

          {productos.length === 0 && (
            <p className="muted">Este pedido todavía no tiene productos registrados.</p>
          )}
        </div>
      </div>

      <p className="tracking-footer">
        Esta página es solo de consulta. Para dudas o cambios, contacta a quien registró tu pedido.
      </p>
    </div>
  )
}
