import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'

export default function NuevoPedido() {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [estado, setEstado] = useState('Cotizado')
  const [tracking, setTracking] = useState('')
  const [notas, setNotas] = useState('')

  const [nombreProducto, setNombreProducto] = useState('')
  const [linkShein, setLinkShein] = useState('')
  const [talla, setTalla] = useState('')
  const [color, setColor] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [precioShein, setPrecioShein] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [anticipo, setAnticipo] = useState('')

  useEffect(() => {
    cargarClientes()
  }, [])

  const cargarClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      console.log(error)
      alert('Error al cargar clientes')
      return
    }

    setClientes(data || [])
  }

  const crearCodigo = () => {
    return `SHN-${Date.now()}`
  }

  const guardarPedido = async (e) => {
    e.preventDefault()

    const cant = Number(cantidad)
    const sheinUnitario = Number(precioShein)
    const ventaUnitario = Number(precioVenta)
    const pagoInicial = Number(anticipo || 0)

    const totalShein = sheinUnitario * cant
    const totalCliente = ventaUnitario * cant
    const restante = totalCliente - pagoInicial
    const ganancia = totalCliente - totalShein

    const { data: pedido, error: errorPedido } = await supabase
      .from('pedidos')
      .insert([
        {
          cliente_id: clienteId,
          codigo: crearCodigo(),
          estado,
          total_shein: totalShein,
          total_cliente: totalCliente,
          anticipo: pagoInicial,
          restante,
          ganancia,
          tracking,
          notas
        }
      ])
      .select()
      .single()

    if (errorPedido) {
      console.log(errorPedido)
      alert('Error al crear pedido')
      return
    }

    const { error: errorProducto } = await supabase
      .from('productos_pedido')
      .insert([
        {
          pedido_id: pedido.id,
          nombre_producto: nombreProducto,
          link_shein: linkShein,
          talla,
          color,
          cantidad: cant,
          precio_shein: sheinUnitario,
          precio_venta: ventaUnitario
        }
      ])

    if (errorProducto) {
      console.log(errorProducto)
      alert('El pedido se creó, pero hubo error al guardar el producto')
      return
    }

    if (pagoInicial > 0) {
      await supabase
        .from('pagos')
        .insert([
          {
            pedido_id: pedido.id,
            monto: pagoInicial,
            metodo_pago: 'Anticipo',
            notas: 'Pago inicial'
          }
        ])
    }

    alert('Pedido creado correctamente')
    window.location.href = '/pedidos'
  }

  const totalSheinPreview = Number(precioShein || 0) * Number(cantidad || 0)
  const totalClientePreview = Number(precioVenta || 0) * Number(cantidad || 0)
  const gananciaPreview = totalClientePreview - totalSheinPreview
  const restantePreview = totalClientePreview - Number(anticipo || 0)

  return (
    <Layout>
      <div className="page-header">
        <h1>Nuevo pedido</h1>
        <p>Registra un pedido nuevo de SHEIN</p>
      </div>

      <form onSubmit={guardarPedido} className="form-card">
        <h2>Datos del pedido</h2>

        <div className="form-grid">
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            required
          >
            <option value="">Selecciona un cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            ))}
          </select>

          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
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

          <input
            placeholder="Tracking / guía"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
          />

          <input
            placeholder="Notas del pedido"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        <h2>Producto</h2>

        <div className="form-grid">
          <input
            placeholder="Nombre del producto"
            value={nombreProducto}
            onChange={(e) => setNombreProducto(e.target.value)}
            required
          />

          <input
            placeholder="Link de SHEIN"
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
            placeholder="Precio SHEIN unitario"
            value={precioShein}
            onChange={(e) => setPrecioShein(e.target.value)}
            required
          />

          <input
            type="number"
            step="0.01"
            placeholder="Precio venta unitario"
            value={precioVenta}
            onChange={(e) => setPrecioVenta(e.target.value)}
            required
          />

          <input
            type="number"
            step="0.01"
            placeholder="Anticipo"
            value={anticipo}
            onChange={(e) => setAnticipo(e.target.value)}
          />
        </div>

        <div className="cards-grid">
          <div className="card">
            <span>Total SHEIN</span>
            <strong>${totalSheinPreview.toFixed(2)}</strong>
          </div>

          <div className="card">
            <span>Total cliente</span>
            <strong>${totalClientePreview.toFixed(2)}</strong>
          </div>

          <div className="card">
            <span>Ganancia</span>
            <strong>${gananciaPreview.toFixed(2)}</strong>
          </div>

          <div className="card">
            <span>Restante</span>
            <strong>${restantePreview.toFixed(2)}</strong>
          </div>
        </div>

        <button className="btn btn-primary">
          Guardar pedido
        </button>
      </form>
    </Layout>
  )
}