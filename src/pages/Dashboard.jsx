import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import PlanLimitNotice from '../components/PlanLimitNotice'
import EmptyState from '../components/EmptyState'
import PageHelp from '../components/PageHelp'
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

const obtenerNombreUsuario = () => {
  if (typeof window === 'undefined') return ''

  try {
    const perfil = JSON.parse(localStorage.getItem('control_pedidos_perfil_cache') || '{}')
    return String(perfil?.nombre || '').trim().split(' ')[0]
  } catch {
    return ''
  }
}

const cacheKeyDashboard = () => `control_pedidos_dashboard_resumen_cache_${obtenerIdUsuarioCache()}`

const resumenVacio = {
  pedidosTotal: 0,
  pedidosActivos: 0,
  lotesTotal: 0,
  enCamino: 0,
  pagoPendiente: 0,
  pagoParcial: 0,
  montoPendiente: 0,
  listosEntrega: 0,
  entregados: 0,
  posiblesLlegadas: 0,
  pedidosPorComprar: 0,
  productosPorComprar: 0
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

const normalizarEstado = (estado) => {
  if (estado === 'Comprado en SHEIN') return 'Comprado en plataforma'
  if (estado === 'Pendiente de pago') return 'Cotizado'
  if (estado === 'Pagado por cliente') return 'Cotizado'
  return estado || 'Cotizado'
}

const productoPendienteCompra = (producto) => {
  const estado = String(producto?.estado_compra || '').toLowerCase()
  const comprado = Boolean(
    producto?.fecha_comprado ||
    producto?.lote_compra_id ||
    estado.includes('comprado') ||
    estado.includes('camino') ||
    estado.includes('recibido') ||
    estado.includes('negocio') ||
    estado.includes('entregado')
  )

  const terminado = Boolean(
    producto?.entregado ||
    producto?.fecha_entregado_cliente ||
    estado.includes('entregado') ||
    estado.includes('cancelado') ||
    estado.includes('devuelto')
  )

  return !comprado && !terminado
}

const formatearDinero = (valor) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0
  }).format(Number(valor || 0))
}

export default function Dashboard() {
  const cacheInicial = leerDashboardCache()
  const [resumen, setResumen] = useState(() => cacheInicial?.resumen || resumenVacio)
  const [paquetes, setPaquetes] = useState(() => cacheInicial?.paquetes || [])
  const [pedidosRecientes, setPedidosRecientes] = useState(() => cacheInicial?.pedidosRecientes || [])
  const [estadoPlan, setEstadoPlan] = useState(() => cacheInicial?.estadoPlan || null)
  const [cargandoPaquetes, setCargandoPaquetes] = useState(false)
  const [errorCarga, setErrorCarga] = useState('')
  const nombreUsuario = useMemo(() => obtenerNombreUsuario(), [])

  useEffect(() => {
    cargarDatos()
  }, [])

  const esPedidoActivo = (pedido) => {
    const estado = normalizarEstado(pedido.estado)
    return !['Cancelado', 'Devuelto'].includes(estado)
  }

  const calcularResumen = (pedidos, lotesTotal, posiblesLlegadas = 0) => {
    const pedidosActivos = pedidos.filter(esPedidoActivo)
    const pendientesCobro = pedidosActivos.filter((pedido) => Number(pedido.restante || 0) > 0)
    const pedidosPendientesCompra = pedidosActivos.filter((pedido) =>
      normalizarEstado(pedido.estado) !== 'Entregado' &&
      (pedido.productos_pedido || []).some(productoPendienteCompra)
    )
    const productosPendientesCompra = pedidosPendientesCompra.reduce(
      (total, pedido) => total + (pedido.productos_pedido || []).filter(productoPendienteCompra).length,
      0
    )

    return {
      pedidosTotal: pedidos.length,
      pedidosActivos: pedidosActivos.length,
      lotesTotal,
      enCamino: pedidosActivos.filter((pedido) => normalizarEstado(pedido.estado) === 'En camino').length,
      pagoPendiente: pedidosActivos.filter((pedido) => Number(pedido.anticipo || 0) <= 0 && Number(pedido.restante || 0) > 0).length,
      pagoParcial: pedidosActivos.filter((pedido) => Number(pedido.anticipo || 0) > 0 && Number(pedido.restante || 0) > 0).length,
      montoPendiente: pendientesCobro.reduce((total, pedido) => total + Number(pedido.restante || 0), 0),
      listosEntrega: pedidosActivos.filter((pedido) => ['Recibido', 'Dejado en negocio'].includes(normalizarEstado(pedido.estado))).length,
      entregados: pedidos.filter((pedido) => normalizarEstado(pedido.estado) === 'Entregado').length,
      posiblesLlegadas,
      pedidosPorComprar: pedidosPendientesCompra.length,
      productosPorComprar: productosPendientesCompra
    }
  }

  const cargarDatos = async () => {
    setErrorCarga('')
    const estado = await cargarEstadoPlan()
    setEstadoPlan(estado)
    setCargandoPaquetes(true)

    const { data: pedidosData, error: errorPedidos } = await supabase
      .from('pedidos')
      .select('id, codigo, creado_en, fecha_pedido, estado, plataforma, total_cliente, anticipo, restante, clientes(nombre), productos_pedido(id, estado_compra, fecha_comprado, lote_compra_id, entregado, fecha_entregado_cliente)')
      .order('creado_en', { ascending: false })

    if (errorPedidos) {
      console.log(errorPedidos)
      setErrorCarga('No pudimos actualizar el panel. Tus datos siguen seguros; revisa tu conexión e intenta nuevamente.')
      setCargandoPaquetes(false)
      return
    }

    const { count: lotesCount, error: errorLotes } = await supabase
      .from('lotes_compra')
      .select('id', { count: 'exact', head: true })

    if (errorLotes) console.log(errorLotes)

    const paquetesEnProceso = await cargarPaquetesEnProceso()
    const posiblesLlegadas = paquetesEnProceso.filter((producto) => {
      const avance = calcularAvance(producto)
      return avance.estadoVisual === 'warning' || ['Recibido', 'Dejado en negocio'].includes(producto.estado_compra)
    }).length

    const resumenFinal = calcularResumen(pedidosData || [], lotesCount || 0, posiblesLlegadas)
    const recientes = (pedidosData || []).slice(0, 5)

    setResumen(resumenFinal)
    setPaquetes(paquetesEnProceso)
    setPedidosRecientes(recientes)
    setCargandoPaquetes(false)

    guardarDashboardCache({
      resumen: resumenFinal,
      paquetes: paquetesEnProceso,
      pedidosRecientes: recientes,
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
      .order('fecha_estimada_llegada', { ascending: true, nullsFirst: false })

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
      .sort((a, b) => {
        const avanceA = calcularAvance(a)
        const avanceB = calcularAvance(b)
        const estadoA = String(a.estado_compra || '')
        const estadoB = String(b.estado_compra || '')
        const prioridadA = ['Recibido', 'Dejado en negocio'].includes(estadoA) ? 0 : avanceA.estadoVisual === 'warning' ? 1 : 2
        const prioridadB = ['Recibido', 'Dejado en negocio'].includes(estadoB) ? 0 : avanceB.estadoVisual === 'warning' ? 1 : 2

        if (prioridadA !== prioridadB) return prioridadA - prioridadB

        const fechaA = parseFechaLocal(a.fecha_estimada_llegada)?.getTime() || Number.MAX_SAFE_INTEGER
        const fechaB = parseFechaLocal(b.fecha_estimada_llegada)?.getTime() || Number.MAX_SAFE_INTEGER
        return fechaA - fechaB
      })
  }

  const calcularAvance = (producto) => {
    const estado = producto.estado_compra || 'En camino'
    const hoy = inicioDeDia(new Date())
    const fechaCompra = parseFechaLocal(producto.fecha_comprado || producto.lotes_compra?.fecha_compra)
    const fechaEstimada = parseFechaLocal(producto.fecha_estimada_llegada)

    if (estado === 'Dejado en negocio') {
      return {
        porcentaje: 100,
        etiqueta: 'Listo para recoger',
        detalle: 'El cliente ya puede pasar por el producto.',
        estadoVisual: 'ok'
      }
    }

    if (estado === 'Recibido') {
      return {
        porcentaje: 100,
        etiqueta: 'Ya llegó',
        detalle: 'Falta dejarlo en negocio o entregarlo.',
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
      <PageHelp page="dashboard" />

      <div className="dashboard-priority-header">
        <div>
          <span className="dashboard-priority-kicker">Inicio</span>
          <h1>{nombreUsuario ? `Hola, ${nombreUsuario}` : 'Hola'}</h1>
          <p>Esto necesita tu atención hoy.</p>
        </div>

        {puedeCrearPedido(estadoPlan) ? (
          <Link to="/nuevo-pedido" className="btn btn-primary dashboard-new-order">
            ＋ Nuevo pedido
          </Link>
        ) : (
          <Link to="/planes" className="btn btn-light-bordered">
            Actualizar plan
          </Link>
        )}
      </div>

      <PlanLimitNotice estadoPlan={estadoPlan} compacto />

      {errorCarga && (
        <EmptyState
          icon="error"
          tone="error"
          eyebrow="No se pudo actualizar"
          title="El resumen no está disponible por ahora."
          description={errorCarga}
          actionLabel="Intentar de nuevo"
          onAction={cargarDatos}
          compact
          className="dashboard-load-error"
        />
      )}

      <section className="dashboard-priority-grid" aria-label="Pendientes principales">
        <Link to="/pedidos" className="dashboard-priority-card dashboard-priority-card-payment">
          <span className="dashboard-priority-icon">＋</span>
          <div>
            <span>Pedidos por comprar</span>
            <strong>{resumen.pedidosPorComprar} pedidos</strong>
            <p>{resumen.productosPorComprar} producto{resumen.productosPorComprar === 1 ? '' : 's'} pendiente{resumen.productosPorComprar === 1 ? '' : 's'} en plataforma</p>
          </div>
          <em>Ver por comprar →</em>
        </Link>

        <a href="#llegadas" className="dashboard-priority-card dashboard-priority-card-arrival">
          <span className="dashboard-priority-icon">⌄</span>
          <div>
            <span>Posiblemente ya llegaron</span>
            <strong>{resumen.posiblesLlegadas} productos</strong>
            <p>Revisa las fechas estimadas.</p>
          </div>
          <em>Revisar llegadas →</em>
        </a>

        <Link to="/pedidos" className="dashboard-priority-card dashboard-priority-card-delivery">
          <span className="dashboard-priority-icon">✓</span>
          <div>
            <span>Listos para entregar</span>
            <strong>{resumen.listosEntrega} pedidos</strong>
            <p>Confirma entrega y saldo.</p>
          </div>
          <em>Confirmar entregas →</em>
        </Link>
      </section>

      <section className="dashboard-summary-strip" aria-label="Resumen del negocio">
        <div><span>Pedidos activos</span><strong>{resumen.pedidosActivos}</strong></div>
        <div><span>En camino</span><strong>{resumen.enCamino}</strong></div>
        <div><span>Entregados</span><strong>{resumen.entregados}</strong></div>
        <div><span>Compras agrupadas</span><strong>{resumen.lotesTotal}</strong></div>
      </section>

      <div className="dashboard-content-grid">
        <section id="llegadas" className="dashboard-arrivals-card dashboard-arrivals-card-priority">
          <div className="dashboard-arrivals-header">
            <div>
              <span className="dashboard-arrivals-kicker">Llegadas y paquetes</span>
              <h2>Todos los productos en proceso</h2>
              <p>Primero aparecen los que ya llegaron o posiblemente ya llegaron; después, todo lo que sigue en camino.</p>
            </div>

            <Link to="/pedidos" className="btn btn-small btn-light-bordered dashboard-arrivals-button">
              Ver todos los pedidos
            </Link>
          </div>

          <div className="dashboard-arrivals-list">
            {paquetes.map((producto) => {
              const avance = calcularAvance(producto)
              const plataforma = producto.lotes_compra?.plataforma || producto.pedidos?.plataforma || 'Plataforma'
              const cliente = producto.pedidos?.clientes?.nombre || 'Sin cliente'

              return (
                <article className={`dashboard-arrival-item dashboard-arrival-item-${avance.estadoVisual}`} key={producto.id}>
                  <div className="dashboard-arrival-order-meta">
                    <div>
                      <span>Cliente</span>
                      <strong>{cliente}</strong>
                    </div>
                    <div>
                      <span>Pedido</span>
                      <strong>{producto.pedidos?.codigo || 'Sin código'}</strong>
                    </div>
                    <div>
                      <span>Paquete</span>
                      <strong>{producto.lotes_compra?.codigo_lote || 'Sin paquete'}</strong>
                    </div>
                  </div>

                  <div className="dashboard-arrival-product-row">
                    <div className="dashboard-arrival-main">
                      <div className="dashboard-arrival-icon">□</div>
                      <div className="dashboard-arrival-info">
                        <strong>{producto.nombre_producto || 'Producto sin nombre'}</strong>
                        <span>{plataforma} · Cantidad {Number(producto.cantidad || 1)}</span>
                        <small>{avance.detalle}</small>
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
                    </div>

                    <Link
                      to={`/pedidos/${producto.pedido_id}?seccion=productos&producto=${producto.id}`}
                      className="btn btn-small btn-primary dashboard-arrival-open-order"
                    >
                      Abrir y marcar llegada
                    </Link>
                  </div>
                </article>
              )
            })}

            {!cargandoPaquetes && paquetes.length === 0 && (
              <EmptyState
                icon="purchases"
                eyebrow="Todo al día"
                title="No tienes productos pendientes de llegada."
                description="Cuando confirmes una compra agrupada, aquí aparecerá su avance."
                actionLabel="Ir a compras"
                actionTo="/compras"
                compact
                className="dashboard-arrivals-empty"
              />
            )}

            {cargandoPaquetes && paquetes.length === 0 && (
              <EmptyState
                icon="loading"
                eyebrow="Actualizando"
                title="Estamos revisando tus compras."
                description="En un momento verás los productos que siguen en proceso."
                compact
                className="dashboard-arrivals-empty"
              />
            )}
          </div>
        </section>

        <section className="dashboard-recent-card">
          <div className="dashboard-recent-header">
            <div>
              <span>Actividad reciente</span>
              <h2>Últimos pedidos</h2>
            </div>
            <Link to="/pedidos">Ver todos</Link>
          </div>

          <div className="dashboard-recent-list">
            {pedidosRecientes.map((pedido) => (
              <Link to={`/pedidos/${pedido.id}`} key={pedido.id} className="dashboard-recent-item">
                <div>
                  <strong>{pedido.codigo || 'Sin código'}</strong>
                  <span>{pedido.clientes?.nombre || 'Sin cliente'} · {pedido.plataforma || 'SHEIN'}</span>
                </div>
                <div>
                  <strong>{formatearDinero(pedido.restante)}</strong>
                  <span>{normalizarEstado(pedido.estado)}</span>
                </div>
              </Link>
            ))}

            {!cargandoPaquetes && pedidosRecientes.length === 0 && (
              <EmptyState
                icon="orders"
                eyebrow="Empieza aquí"
                title="Todavía no tienes pedidos."
                description="Crea el primero para empezar a organizar pagos, compras y entregas."
                actionLabel="Crear primer pedido"
                actionTo="/nuevo-pedido"
                compact
                className="dashboard-recent-empty"
              />
            )}
          </div>
        </section>
      </div>
    </Layout>
  )
}
