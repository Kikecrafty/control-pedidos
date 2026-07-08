import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'

export default function DetallePedido() {
  const { id } = useParams()

  const [pedido, setPedido] = useState(null)
  const [productos, setProductos] = useState([])
  const [pagos, setPagos] = useState([])

  const [nombreProducto, setNombreProducto] = useState('')
  const [linkShein, setLinkShein] = useState('')
  const [talla, setTalla] = useState('')
  const [color, setColor] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [precioShein, setPrecioShein] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')

  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('')
  const [notasPago, setNotasPago] = useState('')

  useEffect(() => {
    cargarTodo()
  }, [id])

  const cargarTodo = async () => {
    const { data: pedidoData, error: errorPedido } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, telefono, direccion)')
      .eq('id', id)
      .single()

    if (errorPedido) {
      console.log(errorPedido)
      alert('Error al cargar pedido')
      return
    }

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

  const agregarProducto = async (e) => {
    e.preventDefault()

    const { error } = await supabase
      .from('productos_pedido')
      .insert([
        {
          pedido_id: id,
          nombre_producto: nombreProducto,
          link_shein: linkShein,
          talla,
          color,
          cantidad: Number(cantidad),
          precio_shein: Number(precioShein),
          precio_venta: Number(precioVenta)
        }
      ])

    if (error) {
      console.log(error)
      alert('Error al agregar producto')
      return
    }

    setNombreProducto('')
    setLinkShein('')
    setTalla('')
    setColor('')
    setCantidad(1)
    setPrecioShein('')
    setPrecioVenta('')

    await recalcularPedido()
    cargarTodo()
  }

  const agregarPago = async (e) => {
    e.preventDefault()

    const { error } = await supabase
      .from('pagos')
      .insert([
        {
          pedido_id: id,
          monto: Number(montoPago),
          metodo_pago: metodoPago,
          notas: notasPago
        }
      ])

    if (error) {
      console.log(error)
      alert('Error al agregar pago')
      return
    }

    setMontoPago('')
    setMetodoPago('')
    setNotasPago('')

    await recalcularPedido()
    cargarTodo()
  }

  const cambiarEstado = async (estado) => {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', id)

    if (error) {
      console.log(error)
      alert('Error al cambiar estado')
      return
    }

    cargarTodo()
  }

  const eliminarProducto = async (productoId) => {
    const confirmar = confirm('¿Eliminar este producto?')
    if (!confirmar) return

    const { error } = await supabase
      .from('productos_pedido')
      .delete()
      .eq('id', productoId)

    if (error) {
      console.log(error)
      alert('Error al eliminar producto')
      return
    }

    await recalcularPedido()
    cargarTodo()
  }

  const eliminarPago = async (pagoId) => {
    const confirmar = confirm('¿Eliminar este pago?')
    if (!confirmar) return

    const { error } = await supabase
      .from('pagos')
      .delete()
      .eq('id', pagoId)

    if (error) {
      console.log(error)
      alert('Error al eliminar pago')
      return
    }

    await recalcularPedido()
    cargarTodo()
  }

  if (!pedido) {
    return (
      <Layout>
        <p>Cargando pedido...</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Pedido {pedido.codigo}</h1>
        <p>Cliente: {pedido.clientes?.nombre || 'Sin cliente'}</p>
      </div>

      <div className="cards-grid">
        <div className="card">
          <span>Estado</span>
          <select
            value={pedido.estado}
            onChange={(e) => cambiarEstado(e.target.value)}
          >
            <option>Cotizado</option>
            <option>Pendiente de pago</option>
            <option>Pagado por cliente</option>
            <option>Comprado en SHEIN</option>
            <option>En camino</option>
            <option>Recibido</option>
            <option>Entregado</option>
            <option>Cancelado</option>
            <option>Devuelto</option>
          </select>
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
      </div>

      <form onSubmit={agregarProducto} className="form-card">
        <h2>Agregar producto</h2>

        <div className="form-grid">
          <input
            placeholder="Nombre producto"
            value={nombreProducto}
            onChange={(e) => setNombreProducto(e.target.value)}
            required
          />

          <input
            placeholder="Link SHEIN"
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
            placeholder="Precio SHEIN"
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

        <button className="btn btn-primary">Agregar producto</button>
      </form>

      <div className="table-card">
        <h2>Productos</h2>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Talla</th>
              <th>Color</th>
              <th>Cantidad</th>
              <th>Precio SHEIN</th>
              <th>Precio venta</th>
              <th>Link</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {productos.map((producto) => (
              <tr key={producto.id}>
                <td>{producto.nombre_producto}</td>
                <td>{producto.talla}</td>
                <td>{producto.color}</td>
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
                <td>
                  <button
                    onClick={() => eliminarProducto(producto.id)}
                    className="btn btn-danger btn-small"
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

      <form onSubmit={agregarPago} className="form-card">
        <h2>Agregar pago</h2>

        <div className="form-grid">
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

        <button className="btn btn-primary">Agregar pago</button>
      </form>

      <div className="table-card">
        <h2>Pagos</h2>

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
                <td>{pago.metodo_pago}</td>
                <td>{pago.fecha_pago}</td>
                <td>{pago.notas}</td>
                <td>
                  <button
                    onClick={() => eliminarPago(pago.id)}
                    className="btn btn-danger btn-small"
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
    </Layout>
  )
}