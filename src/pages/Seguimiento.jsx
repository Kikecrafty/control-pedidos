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

          <span className={`badge ${estadoClase(pedido.estado)}`}>
            {normalizarEstado(pedido.estado)}
          </span>
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
