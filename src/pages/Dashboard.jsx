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

const cacheKeyDashboard = () => `control_pedidos_dashboard_resumen_cache_${obtenerIdUsuarioCache()}`

const resumenVacio = {
  pedidosTotal: 0,
  pedidosActivos: 0,
  lotesTotal: 0,
  enCamino: 0,
  pagoPendiente: 0,
  pagoParcial: 0
}

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

const parseFechaLocal = (valor) => {
  if (!valor) return null

  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [year, month, day] = valor.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

const inicioDeDia = (fecha) => {
  const copia = new Date(fecha)
  copia.setHours(0, 0, 0, 0)
  return copia
}

const diasEntre = (a, b) => {
  const uno = inicioDeDia(a)
  const dos = inicioDeDia(b)
  return Math.ceil((dos.getTime() - uno.getTime()) / 86400000)
}

export default function Dashboard() {
  const cacheInicial = leerDashboardCache()
  const [resumen, setResumen] = useState(() => cacheInicial?.resumen || resumenVacio)
  const [paquetes, setPaquetes] = useState(() => cacheInicial?.paquetes || [])
  const [estadoPlan, setEstadoPlan] = useState(() => cacheInicial?.estadoPlan || null)
  const [cargandoPaquetes, setCargandoPaquetes] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  const normalizarEstado = (estado) => {
    if (estado === 'Comprado en SHEIN') return 'Comprado en plataforma'
    if (estado === 'Pendiente de pago') return 'Cotizado'
    if (estado === 'Pagado por cliente') return 'Cotizado'
    return estado || 'Cotizado'
  }

  const esPedidoActivo = (pedido) => {
    const estado = normalizarEstado(pedido.estado)
    return estado !== 'Cancelado' && estado !== 'Devuelto'
  }

  const calcularResumen = (pedidos, lotesTotal) => {
    const pedidosActivos = pedidos.filter(esPedidoActivo)

    return {
      pedidosTotal: pedidos.length,
      pedidosActivos: pedidosActivos.length,
      lotesTotal,
      enCamino: pedidosActivos.filter((pedido) => normalizarEstado(pedido.estado) === 'En camino').length,
      pagoPendiente: pedidosActivos.filter((pedido) => Number(pedido.anticipo || 0) <= 0 && Number(pedido.restante || 0) > 0).length,
      pagoParcial: pedidosActivos.filter((pedido) => Number(pedido.anticipo || 0) > 0 && Number(pedido.restante || 0) > 0).length
    }
  }

  const cargarDatos = async () => {
    const estado = await cargarEstadoPlan()
    setEstadoPlan(estado)
    setCargandoPaquetes(true)

    const { data: pedidosData, error: errorPedidos } = await supabase
      .from('pedidos')
      .select('id, estado, total_cliente, anticipo, restante')
      .order('creado_en', { ascending: false })

    if (errorPedidos) {
      console.log(errorPedidos)
      setCargandoPaquetes(false)
      return
    }

    const { count: lotesCount, error: errorLotes } = await supabase
      .from('lotes_compra')
      .select('id', { count: 'exact', head: true })

    if (errorLotes) {
      console.log(errorLotes)
    }

    const paquetesEnProceso = await cargarPaquetesEnProceso()
    const resumenFinal = calcularResumen(pedidosData || [], lotesCount || 0)

    setResumen(resumenFinal)
    setPaquetes(paquetesEnProceso)
    setCargandoPaquetes(false)

    guardarDashboardCache({
      resumen: resumenFinal,
      paquetes: paquetesEnProceso,
      estadoPlan: estado
    })
  }

  const cargarPaquetesEnProceso = async () => {
    const selectCompleto = `
      id,
      pedido_id,
      lote_compra_id,
      nombre_producto,
      cantidad,
      precio_pagina,
      estado_compra,
      fecha_comprado,
      fecha_estimada_llegada,
      fecha_recibido,
      fecha_dejado_negocio,
      fecha_entregado_cliente,
      pedidos(
        codigo,
        estado,
        plataforma,
        clientes(nombre)
      ),
      lotes_compra(
        codigo_lote,
        plataforma,
        fecha_compra
      )
    `

    const { data, error } = await supabase
      .from('productos_pedido')
      .select(selectCompleto)
      .neq('estado_compra', 'Entregado')
      .order('fecha_estimada_llegada', { ascending: true })
      .limit(30)

    if (error) {
      console.log(error)
      return []
    }

    return (data || [])
      .filter((producto) => {
        const estadoProducto = producto.estado_compra || 'Pendiente de compra'
        const estadoPedido = producto.pedidos?.estado || ''
        const comprado = Boolean(producto.fecha_comprado || producto.lote_compra_id)

        return comprado &&
          !['Entregado', 'Cancelado', 'Devuelto'].includes(estadoProducto) &&
          !['Entregado', 'Cancelado', 'Devuelto'].includes(estadoPedido)
      })
      .slice(0, 10)
  }

  const calcularAvance = (producto) => {
    const estado = producto.estado_compra || 'En camino'
    const hoy = inicioDeDia(new Date())
    const fechaCompra = parseFechaLocal(producto.fecha_comprado || producto.lotes_compra?.fecha_compra)
    const fechaEstimada = parseFechaLocal(producto.fecha_estimada_llegada)

    if (estado === 'Dejado en negocio') {
      return {
        porcentaje: 100,
        etiqueta: 'Listo en negocio',
        detalle: 'El cliente ya puede pasar por el producto.',
        estadoVisual: 'ok'
      }
    }

    if (estado === 'Recibido') {
      return {
        porcentaje: 100,
        etiqueta: 'Recibido',
        detalle: 'Ya llegó. Falta dejarlo en negocio o entregarlo.',
        estadoVisual: 'ok'
      }
    }

    if (!fechaEstimada) {
      return {
        porcentaje: 35,
        etiqueta: 'En proceso',
        detalle: 'Aún no hay fecha estimada de llegada.',
        estadoVisual: 'normal'
      }
    }

    const diasRestantes = diasEntre(hoy, fechaEstimada)

    if (!fechaCompra) {
      return {
        porcentaje: diasRestantes <= 0 ? 100 : 50,
        etiqueta: diasRestantes <= 0 ? 'Posiblemente ya llegó' : `Faltan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`,
        detalle: `Llegada estimada: ${formatearFecha(fechaEstimada)}`,
        estadoVisual: diasRestantes <= 0 ? 'warning' : 'normal'
      }
    }

    const diasTotales = Math.max(diasEntre(fechaCompra, fechaEstimada), 1)
    const diasTranscurridos = Math.max(diasEntre(fechaCompra, hoy), 0)
    const porcentaje = Math.min(Math.max(Math.round((diasTranscurridos / diasTotales) * 100), 8), 100)

    if (diasRestantes < 0) {
      const atraso = Math.abs(diasRestantes)
      return {
        porcentaje: 100,
        etiqueta: 'Posiblemente ya llegó',
        detalle: `Pasó la fecha estimada hace ${atraso} día${atraso === 1 ? '' : 's'}.`,
        estadoVisual: 'warning'
      }
    }

    if (diasRestantes === 0) {
      return {
        porcentaje: 100,
        etiqueta: 'Puede llegar hoy',
        detalle: `Llegada estimada: ${formatearFecha(fechaEstimada)}`,
        estadoVisual: 'warning'
      }
    }

    return {
      porcentaje,
      etiqueta: `Faltan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`,
      detalle: `Llegada estimada: ${formatearFecha(fechaEstimada)}`,
      estadoVisual: 'normal'
    }
  }

  const formatearFecha = (valor) => {
    const fecha = valor instanceof Date ? valor : parseFechaLocal(valor)
    if (!fecha) return 'Sin fecha'

    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
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

      <div className="cards-grid dashboard-only-grid dashboard-main-stats-grid">
        <div className="card dashboard-only-card">
          <span>Pedidos activos</span>
          <strong>{resumen.pedidosActivos}</strong>
        </div>

        <div className="card dashboard-only-card">
          <span>En camino</span>
          <strong>{resumen.enCamino}</strong>
        </div>
      </div>

      <div className="dashboard-payment-mini-grid dashboard-mini-grid-v2">
        <div>
          <span>Pago pendiente</span>
          <strong>{resumen.pagoPendiente}</strong>
        </div>
        <div>
          <span>Pagado parcialmente</span>
          <strong>{resumen.pagoParcial}</strong>
        </div>
        <div>
          <span>Órdenes registradas</span>
          <strong>{resumen.pedidosTotal}</strong>
        </div>
        <div>
          <span>Compras de lote registradas</span>
          <strong>{resumen.lotesTotal}</strong>
        </div>
      </div>

      <section className="dashboard-arrivals-card">
        <div className="dashboard-arrivals-header">
          <div>
            <span className="dashboard-arrivals-kicker">Seguimiento de llegadas</span>
            <h2>Paquetes en proceso</h2>
            <p>Productos comprados que todavía no están marcados como entregados.</p>
          </div>

          <Link to="/compras" className="btn btn-small btn-light-bordered dashboard-arrivals-button">
            Ver compras
          </Link>
        </div>

        <div className="dashboard-arrivals-list">
          {paquetes.map((producto) => {
            const avance = calcularAvance(producto)
            const plataforma = producto.lotes_compra?.plataforma || producto.pedidos?.plataforma || 'Plataforma'
            const codigo = producto.lotes_compra?.codigo_lote || producto.pedidos?.codigo || 'Sin código'
            const cliente = producto.pedidos?.clientes?.nombre || 'Sin cliente'

            return (
              <article className="dashboard-arrival-item" key={producto.id}>
                <div className="dashboard-arrival-main">
                  <div className="dashboard-arrival-icon">📦</div>
                  <div className="dashboard-arrival-info">
                    <strong>{producto.nombre_producto || 'Producto sin nombre'}</strong>
                    <span>{cliente} · {plataforma} · {codigo}</span>
                    <small>Cantidad: {Number(producto.cantidad || 1)}</small>
                  </div>
                </div>

                <div className="dashboard-arrival-progress-area">
                  <div className="dashboard-arrival-progress-top">
                    <span className={`dashboard-arrival-status dashboard-arrival-status-${avance.estadoVisual}`}>
                      {avance.etiqueta}
                    </span>
                    <strong>{avance.porcentaje}%</strong>
                  </div>
                  <div className="dashboard-arrival-bar">
                    <span style={{ width: `${avance.porcentaje}%` }} />
                  </div>
                  <p>{avance.detalle}</p>
                </div>
              </article>
            )
          })}

          {!cargandoPaquetes && paquetes.length === 0 && (
            <div className="dashboard-arrivals-empty">
              <strong>No tienes paquetes pendientes de llegada.</strong>
              <span>Cuando crees lotes de compra, aquí aparecerá el avance de cada producto.</span>
            </div>
          )}

          {cargandoPaquetes && paquetes.length === 0 && (
            <div className="dashboard-arrivals-empty">
              <strong>Cargando paquetes...</strong>
              <span>Estamos revisando tus productos comprados.</span>
            </div>
          )}
        </div>
      </section>
    </Layout>
  )
}
