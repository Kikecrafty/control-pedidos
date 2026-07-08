import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'

export default function Dashboard() {
  const [clientes, setClientes] = useState([])
  const [pedidos, setPedidos] = useState([])

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    const { data: clientesData, error: errorClientes } = await supabase
      .from('clientes')
      .select('*')

    if (errorClientes) {
      console.log(errorClientes)
      alert('Error al cargar clientes')
      return
    }

    const { data: pedidosData, error: errorPedidos } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, telefono)')
      .order('creado_en', { ascending: false })

    if (errorPedidos) {
      console.log(errorPedidos)
      alert('Error al cargar pedidos')
      return
    }

    setClientes(clientesData || [])
    setPedidos(pedidosData || [])
  }

  const contarEstado = (estado) => {
    return pedidos.filter((pedido) => pedido.estado === estado).length
  }

  const dineroPendiente = pedidos.reduce(
    (sum, pedido) => sum + Number(pedido.restante || 0),
    0
  )

  const gananciaTotal = pedidos.reduce(
    (sum, pedido) => sum + Number(pedido.ganancia || 0),
    0
  )

  const totalVentas = pedidos.reduce(
    (sum, pedido) => sum + Number(pedido.total_cliente || 0),
    0
  )

  const ultimosPedidos = pedidos.slice(0, 5)

  return (
    <Layout>
      <div className="page-header row-between">
        <div>
          <h1>Panel principal</h1>
          <p>Resumen general de tus pedidos</p>
        </div>

        <Link to="/nuevo-pedido" className="btn btn-primary">
          Nuevo pedido
        </Link>
      </div>

      <div className="cards-grid">
        <div className="card">
          <span>Clientes</span>
          <strong>{clientes.length}</strong>
        </div>

        <div className="card">
          <span>Total pedidos</span>
          <strong>{pedidos.length}</strong>
        </div>

        <div className="card">
          <span>Pendientes de pago</span>
          <strong>{contarEstado('Pendiente de pago')}</strong>
        </div>

        <div className="card">
          <span>En camino</span>
          <strong>{contarEstado('En camino')}</strong>
        </div>

        <div className="card">
          <span>Entregados</span>
          <strong>{contarEstado('Entregado')}</strong>
        </div>

        <div className="card">
          <span>Total vendido</span>
          <strong>${totalVentas.toFixed(2)}</strong>
        </div>

        <div className="card">
          <span>Dinero pendiente</span>
          <strong>${dineroPendiente.toFixed(2)}</strong>
        </div>

        <div className="card">
          <span>Ganancia total</span>
          <strong>${gananciaTotal.toFixed(2)}</strong>
        </div>
      </div>

      <div className="table-card">
        <div className="row-between">
          <div>
            <h2>Últimos pedidos</h2>
            <p className="muted">Pedidos registrados recientemente</p>
          </div>

          <Link to="/pedidos" className="btn btn-small">
            Ver todos
          </Link>
        </div>

        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Restante</th>
              <th>Ganancia</th>
              <th>Acción</th>
            </tr>
          </thead>

          <tbody>
            {ultimosPedidos.map((pedido) => (
              <tr key={pedido.id}>
                <td>{pedido.codigo}</td>
                <td>{pedido.clientes?.nombre || 'Sin cliente'}</td>
                <td>
                  <span className="badge">
                    {pedido.estado}
                  </span>
                </td>
                <td>${Number(pedido.total_cliente || 0).toFixed(2)}</td>
                <td>${Number(pedido.restante || 0).toFixed(2)}</td>
                <td>${Number(pedido.ganancia || 0).toFixed(2)}</td>
                <td>
                  <Link
                    to={`/pedidos/${pedido.id}`}
                    className="btn btn-small"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}

            {ultimosPedidos.length === 0 && (
              <tr>
                <td colSpan="7">Todavía no tienes pedidos registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}