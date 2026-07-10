import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import PlanLimitNotice from '../components/PlanLimitNotice'
import { cargarEstadoPlan, puedeCrearPedido } from '../lib/planes'

const obtenerIdUsuarioCache = () => {
  if (typeof window === 'undefined') return 'sin_usuario'

  try {
    const llaves = Object.keys(localStorage)
    const llaveAuth = llaves.find((llave) => llave.startsWith('sb-') && llave.endsWith('-auth-token'))

    if (llaveAuth) {
      const valor = JSON.parse(localStorage.getItem(llaveAuth) || '{}')
      const userId = valor?.user?.id || valor?.currentSession?.user?.id
      if (userId) return userId
    }
  } catch (error) {
    console.log(error)
  }

  return localStorage.getItem('control_pedidos_usuario_cache') || 'sin_usuario'
}

const cacheKeyDashboard = () => `control_pedidos_dashboard_cache_${obtenerIdUsuarioCache()}`

const leerDashboardCache = () => {
  if (typeof window === 'undefined') return null

  try {
    const guardado = localStorage.getItem(cacheKeyDashboard())
    return guardado ? JSON.parse(guardado) : null
  } catch (error) {
    console.log(error)
    return null
  }
}

const guardarDashboardCache = (datos) => {
  if (typeof window === 'undefined') return

  try {
    const userId = obtenerIdUsuarioCache()
    localStorage.setItem('control_pedidos_usuario_cache', userId)
    localStorage.setItem(
      cacheKeyDashboard(),
      JSON.stringify({
        ...datos,
        guardado_en: new Date().toISOString()
      })
    )
  } catch (error) {
    console.log(error)
  }
}

export default function Dashboard() {
  const cacheInicial = leerDashboardCache()
  const [clientes, setClientes] = useState(() => cacheInicial?.clientes || [])
  const [pedidos, setPedidos] = useState(() => cacheInicial?.pedidos || [])
  const [estadoPlan, setEstadoPlan] = useState(() => cacheInicial?.estadoPlan || null)

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

    const clientesFinal = clientesData || []
    const pedidosFinal = pedidosData || []

    setClientes(clientesFinal)
    setPedidos(pedidosFinal)

    guardarDashboardCache({
      clientes: clientesFinal,
      pedidos: pedidosFinal,
      estadoPlan: estado
    })
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
