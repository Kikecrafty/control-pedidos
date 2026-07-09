import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import PlanLimitNotice from '../components/PlanLimitNotice'
import { cargarEstadoPlan, puedeCrearPedido } from '../lib/planes'

export default function Dashboard() {
  const [clientes, setClientes] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [estadoPlan, setEstadoPlan] = useState(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  const normalizarEstado = (estado) => {
    if (estado === 'Comprado en SHEIN') return 'Comprado en plataforma'
    return estado || 'Cotizado'
  }

  const cargarDatos = async () => {
    const estado = await cargarEstadoPlan()
    setEstadoPlan(estado)

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
    return pedidos.filter((pedido) => normalizarEstado(pedido.estado) === estado).length
  }

  return (
    <Layout>
      <div className="page-header row-between dashboard-clean-header">
        <div>
          <h1>Panel principal</h1>
          <p>Resumen general de tus pedidos</p>
        </div>

        {puedeCrearPedido(estadoPlan) ? (
          <Link to="/nuevo-pedido" className="btn btn-primary">
            Nuevo pedido
          </Link>
        ) : (
          <Link to="/planes" className="btn btn-light-bordered">
            Actualizar plan
          </Link>
        )}
      </div>

      <PlanLimitNotice estadoPlan={estadoPlan} compacto />

      <div className="cards-grid dashboard-only-grid">
        <div className="card dashboard-only-card">
          <span>Clientes</span>
          <strong>{clientes.length}</strong>
        </div>

        <div className="card dashboard-only-card">
          <span>Total pedidos</span>
          <strong>{pedidos.length}</strong>
        </div>

        <div className="card dashboard-only-card">
          <span>Pendientes</span>
          <strong>{contarEstado('Pendiente de pago')}</strong>
        </div>

        <div className="card dashboard-only-card">
          <span>En camino</span>
          <strong>{contarEstado('En camino')}</strong>
        </div>
      </div>
    </Layout>
  )
}
