import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../supabaseClient'

const plataformas = ['SHEIN', 'Temu', 'AliExpress', 'Catálogo', 'Otro']
const estados = [
  'Cotizado',
  'Comprado en plataforma',
  'En camino',
  'Recibido',
  'Entregado',
  'Cancelado',
  'Devuelto'
]

const pieColors = ['#0f172a', '#2563eb', '#7c3aed', '#16a34a', '#f59e0b', '#dc2626', '#64748b', '#0891b2', '#be123c']

const money = (valor) => {
  return Number(valor || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN'
  })
}

const number = (valor) => {
  return Number(valor || 0).toLocaleString('es-MX')
}

const normalizarEstado = (estado) => {
  if (estado === 'Comprado en SHEIN') return 'Comprado en plataforma'
  if (estado === 'Pendiente de pago') return 'Cotizado'
  if (estado === 'Pagado por cliente') return 'Cotizado'
  return estado || 'Cotizado'
}

const fechaPedido = (pedido) => {
  const raw = pedido?.fecha_pedido || pedido?.creado_en
  const fecha = raw ? new Date(raw) : new Date()
  return Number.isNaN(fecha.getTime()) ? new Date() : fecha
}

const pedidoCuentaComoVenta = (pedido) => {
  return !['Cancelado', 'Devuelto'].includes(normalizarEstado(pedido?.estado))
}

const inicioDia = (fecha) => {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  return d
}

const finDia = (fecha) => {
  const d = new Date(fecha)
  d.setHours(23, 59, 59, 999)
  return d
}

const inicioSemana = (fecha) => {
  const d = inicioDia(fecha)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

const finSemana = (fecha) => {
  const d = inicioSemana(fecha)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

const inicioMes = (fecha) => {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), 1)
  d.setHours(0, 0, 0, 0)
  return d
}

const finMes = (fecha) => {
  const d = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)
  d.setHours(23, 59, 59, 999)
  return d
}

const toInputDate = (fecha) => {
  if (!fecha) return ''
  const d = new Date(fecha)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fromInputDateStart = (valor) => {
  if (!valor) return null
  const [year, month, day] = valor.split('-').map(Number)
  return inicioDia(new Date(year, month - 1, day))
}

const fromInputDateEnd = (valor) => {
  if (!valor) return null
  const [year, month, day] = valor.split('-').map(Number)
  return finDia(new Date(year, month - 1, day))
}

const rangoLabel = (inicio, fin) => {
  if (!inicio && !fin) return 'Todos los pedidos'
  if (inicio && fin) return `${inicio.toLocaleDateString('es-MX')} - ${fin.toLocaleDateString('es-MX')}`
  if (inicio) return `Desde ${inicio.toLocaleDateString('es-MX')}`
  return `Hasta ${fin.toLocaleDateString('es-MX')}`
}

function agruparVentasPorRango(pedidosFiltrados, inicio, fin) {
  if (!pedidosFiltrados.length) {
    return [{ label: 'Sin datos', valor: 0, texto: money(0) }]
  }

  const fechas = pedidosFiltrados.map(fechaPedido).sort((a, b) => a - b)
  const inicioReal = inicio || inicioDia(fechas[0])
  const finReal = fin || finDia(fechas[fechas.length - 1])
  const dias = Math.max(1, Math.ceil((finReal - inicioReal) / 86400000) + 1)

  if (dias <= 1) {
    const grupos = [
      { label: '00-05', valor: 0 },
      { label: '06-11', valor: 0 },
      { label: '12-17', valor: 0 },
      { label: '18-23', valor: 0 }
    ]

    pedidosFiltrados.forEach((pedido) => {
      const hora = fechaPedido(pedido).getHours()
      const index = hora < 6 ? 0 : hora < 12 ? 1 : hora < 18 ? 2 : 3
      grupos[index].valor += Number(pedido.total_cliente || 0)
    })

    return grupos.map((item) => ({ ...item, texto: money(item.valor) }))
  }

  if (dias <= 31) {
    const grupos = []
    const cursor = inicioDia(inicioReal)

    while (cursor <= finReal) {
      grupos.push({
        key: toInputDate(cursor),
        label: cursor.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }),
        valor: 0
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    pedidosFiltrados.forEach((pedido) => {
      const key = toInputDate(fechaPedido(pedido))
      const grupo = grupos.find((item) => item.key === key)
      if (grupo) grupo.valor += Number(pedido.total_cliente || 0)
    })

    return grupos.map((item) => ({ ...item, texto: money(item.valor) }))
  }

  if (dias <= 120) {
    const grupos = []
    let numero = 1
    const cursor = inicioDia(inicioReal)

    while (cursor <= finReal) {
      const desde = new Date(cursor)
      const hasta = new Date(cursor)
      hasta.setDate(hasta.getDate() + 6)
      hasta.setHours(23, 59, 59, 999)

      grupos.push({
        desde,
        hasta,
        label: `Sem ${numero}`,
        valor: 0
      })

      cursor.setDate(cursor.getDate() + 7)
      numero += 1
    }

    pedidosFiltrados.forEach((pedido) => {
      const fecha = fechaPedido(pedido)
      const grupo = grupos.find((item) => fecha >= item.desde && fecha <= item.hasta)
      if (grupo) grupo.valor += Number(pedido.total_cliente || 0)
    })

    return grupos.map((item) => ({ ...item, texto: money(item.valor) }))
  }

  const gruposMap = new Map()

  pedidosFiltrados.forEach((pedido) => {
    const fecha = fechaPedido(pedido)
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    const label = fecha.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
    const actual = gruposMap.get(key) || { key, label, valor: 0 }
    actual.valor += Number(pedido.total_cliente || 0)
    gruposMap.set(key, actual)
  })

  return Array.from(gruposMap.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item) => ({ ...item, texto: money(item.valor) }))
}

function GraficaBarras({ datos, formato = 'numero' }) {
  const max = Math.max(...datos.map((item) => Number(item.valor || 0)), 1)

  return (
    <div className="metrics-bar-chart">
      {datos.map((item) => (
        <div className="metrics-bar-row" key={item.key || item.label}>
          <span>{item.label}</span>
          <div className="metrics-bar-track">
            <i style={{ width: `${(Number(item.valor || 0) / max) * 100}%` }} />
          </div>
          <strong>{item.texto || (formato === 'dinero' ? money(item.valor) : number(item.valor))}</strong>
        </div>
      ))}
    </div>
  )
}

function GraficaPastel({ datos, titulo }) {
  const total = datos.reduce((sum, item) => sum + Number(item.valor || 0), 0)

  if (!total) {
    return (
      <div className="metrics-empty-chart">
        <strong>Sin datos suficientes</strong>
        <span>Cuando tengas pedidos en este rango, aquí aparecerá la gráfica.</span>
      </div>
    )
  }

  let acumulado = 0
  const partes = datos.map((item, index) => {
    const inicio = acumulado
    const porcentaje = (Number(item.valor || 0) / total) * 100
    acumulado += porcentaje
    return `${pieColors[index % pieColors.length]} ${inicio}% ${acumulado}%`
  })

  return (
    <div className="metrics-pie-wrap">
      <div className="metrics-pie" style={{ background: `conic-gradient(${partes.join(', ')})` }}>
        <div>
          <strong>{number(total)}</strong>
          <span>{titulo}</span>
        </div>
      </div>

      <div className="metrics-pie-legend">
        {datos.map((item, index) => {
          const porcentaje = total ? Math.round((Number(item.valor || 0) / total) * 100) : 0
          return (
            <div key={item.label}>
              <span>
                <i style={{ background: pieColors[index % pieColors.length] }} />
                {item.label}
              </span>
              <strong>{porcentaje}%</strong>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DemoBloqueado() {
  const demoVentas = [
    { label: 'Lun', valor: 1200, texto: '$1,200' },
    { label: 'Mar', valor: 850, texto: '$850' },
    { label: 'Mié', valor: 2100, texto: '$2,100' },
    { label: 'Jue', valor: 1600, texto: '$1,600' },
    { label: 'Vie', valor: 2600, texto: '$2,600' },
    { label: 'Sáb', valor: 3200, texto: '$3,200' },
    { label: 'Dom', valor: 1800, texto: '$1,800' }
  ]

  const demoPlataformas = [
    { label: 'SHEIN', valor: 18 },
    { label: 'Temu', valor: 9 },
    { label: 'AliExpress', valor: 6 },
    { label: 'Catálogo', valor: 4 }
  ]

  return (
    <Layout>
      <div className="metrics-locked-hero">
        <span className="lock-pill">🔒 Solo Plan Pro</span>
        <h1>Métricas avanzadas</h1>
        <p>
          Esta sección está disponible para usuarios Pro. Aquí podrás elegir plataforma,
          seleccionar fechas exactas, ver ganancias, ventas, clientes frecuentes y gráficas.
        </p>
        <div className="locked-actions">
          <a href="/planes" className="btn btn-primary">Actualizar a Pro</a>
          <a href="/planes" className="btn btn-light-bordered">Canjear código</a>
        </div>
      </div>

      <div className="locked-preview metrics-blur-preview">
        <div className="locked-preview-cover">
          <strong>Ejemplo de Métricas Pro</strong>
          <span>Desbloquea Pro para ver tus datos reales por plataforma y fechas.</span>
        </div>

        <div className="cards-grid">
          <div className="card"><span>Ventas del mes</span><strong>$18,450</strong></div>
          <div className="card"><span>Ganancia estimada</span><strong>$5,320</strong></div>
          <div className="card"><span>Pedidos completados</span><strong>42</strong></div>
          <div className="card"><span>Pendiente por cobrar</span><strong>$2,100</strong></div>
        </div>

        <div className="metrics-grid-two">
          <div className="table-card">
            <h2>Ventas por día</h2>
            <GraficaBarras datos={demoVentas} formato="dinero" />
          </div>

          <div className="table-card">
            <h2>Pedidos por plataforma</h2>
            <GraficaPastel datos={demoPlataformas} titulo="pedidos" />
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default function Metricas() {
  const [perfil, setPerfil] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [fechaInicio, setFechaInicio] = useState(toInputDate(inicioMes(new Date())))
  const [fechaFin, setFechaFin] = useState(toInputDate(new Date()))
  const [plataformaFiltro, setPlataformaFiltro] = useState('SHEIN')
  const [rangoActivo, setRangoActivo] = useState('mes')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user

    if (!user) {
      setCargando(false)
      return
    }

    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    setPerfil(perfilData || null)
    setPlataformaFiltro(perfilData?.plataforma_predeterminada || 'SHEIN')

    if (perfilData?.plan_actual === 'pro' || perfilData?.es_admin) {
      const { data: pedidosData, error } = await supabase
        .from('pedidos')
        .select('id, codigo, estado, plataforma, fecha_pedido, total_cliente, anticipo, restante, ganancia, reembolso, creado_en, clientes(nombre)')
        .order('creado_en', { ascending: false })

      if (error) {
        console.log(error)
      }

      setPedidos(pedidosData || [])
    }

    setCargando(false)
  }

  const aplicarRangoRapido = (tipo) => {
    const hoy = new Date()
    setRangoActivo(tipo)

    if (tipo === 'hoy') {
      setFechaInicio(toInputDate(hoy))
      setFechaFin(toInputDate(hoy))
      return
    }

    if (tipo === 'semana') {
      setFechaInicio(toInputDate(inicioSemana(hoy)))
      setFechaFin(toInputDate(finSemana(hoy)))
      return
    }

    if (tipo === 'mes') {
      setFechaInicio(toInputDate(inicioMes(hoy)))
      setFechaFin(toInputDate(finMes(hoy)))
      return
    }

    setFechaInicio('')
    setFechaFin('')
  }

  const resumen = useMemo(() => {
    const inicio = fromInputDateStart(fechaInicio)
    const fin = fromInputDateEnd(fechaFin)

    const filtrados = pedidos.filter((pedido) => {
      const fecha = fechaPedido(pedido)
      const plataformaPedido = pedido.plataforma || 'SHEIN'
      const coincidePlataforma = plataformaFiltro === 'Todas' || plataformaPedido === plataformaFiltro
      const coincideInicio = !inicio || fecha >= inicio
      const coincideFin = !fin || fecha <= fin

      return coincidePlataforma && coincideInicio && coincideFin
    })

    const pedidosVenta = filtrados.filter(pedidoCuentaComoVenta)
    const totalVendido = pedidosVenta.reduce((sum, pedido) => sum + Number(pedido.total_cliente || 0), 0)
    const ganancia = pedidosVenta.reduce((sum, pedido) => sum + Number(pedido.ganancia || 0), 0)
    const pendiente = pedidosVenta.reduce((sum, pedido) => sum + Number(pedido.restante || 0), 0)
    const pagado = pedidosVenta.reduce((sum, pedido) => sum + Number(pedido.anticipo || 0), 0)
    const entregados = filtrados.filter((pedido) => normalizarEstado(pedido.estado) === 'Entregado').length
    const cancelados = filtrados.filter((pedido) => ['Cancelado', 'Devuelto'].includes(normalizarEstado(pedido.estado))).length
    const activos = filtrados.filter((pedido) => !['Entregado', 'Cancelado', 'Devuelto'].includes(normalizarEstado(pedido.estado))).length
    const ticketPromedio = pedidosVenta.length ? totalVendido / pedidosVenta.length : 0
    const margen = totalVendido ? (ganancia / totalVendido) * 100 : 0

    const ventasPorPeriodo = agruparVentasPorRango(pedidosVenta, inicio, fin)

    const porPlataforma = plataformas
      .map((plataforma) => ({
        label: plataforma,
        valor: filtrados.filter((pedido) => (pedido.plataforma || 'SHEIN') === plataforma).length
      }))
      .filter((item) => item.valor > 0)

    const porEstado = estados
      .map((estado) => ({
        label: estado,
        valor: filtrados.filter((pedido) => normalizarEstado(pedido.estado) === estado).length
      }))
      .filter((item) => item.valor > 0)

    const ventasPorPlataforma = plataformas
      .map((plataforma) => ({
        label: plataforma,
        valor: pedidosVenta
          .filter((pedido) => (pedido.plataforma || 'SHEIN') === plataforma)
          .reduce((sum, pedido) => sum + Number(pedido.total_cliente || 0), 0)
      }))
      .filter((item) => item.valor > 0)
      .map((item) => ({ ...item, texto: money(item.valor) }))

    const clientesMap = new Map()

    pedidosVenta.forEach((pedido) => {
      const nombre = pedido.clientes?.nombre || 'Cliente sin nombre'
      const actual = clientesMap.get(nombre) || { nombre, pedidos: 0, vendido: 0, ganancia: 0 }
      actual.pedidos += 1
      actual.vendido += Number(pedido.total_cliente || 0)
      actual.ganancia += Number(pedido.ganancia || 0)
      clientesMap.set(nombre, actual)
    })

    const topClientes = Array.from(clientesMap.values())
      .sort((a, b) => b.vendido - a.vendido)
      .slice(0, 5)

    const plataformaTop = ventasPorPlataforma.length
      ? [...ventasPorPlataforma].sort((a, b) => b.valor - a.valor)[0]
      : null

    const ultimos = filtrados.slice(0, 6)

    return {
      inicio,
      fin,
      filtrados,
      totalVendido,
      ganancia,
      pendiente,
      pagado,
      entregados,
      cancelados,
      activos,
      ticketPromedio,
      margen,
      ventasPorPeriodo,
      porPlataforma,
      porEstado,
      ventasPorPlataforma,
      topClientes,
      plataformaTop,
      ultimos
    }
  }, [pedidos, fechaInicio, fechaFin, plataformaFiltro])

  if (cargando) {
    return (
      <Layout>
        <div className="loading">Cargando métricas...</div>
      </Layout>
    )
  }

  const esPro = perfil?.plan_actual === 'pro' || perfil?.es_admin

  if (!esPro) {
    return <DemoBloqueado />
  }

  return (
    <Layout>
      <div className="page-header metrics-header-pro metrics-header-with-filters">
        <div>
          <h1>Métricas Pro</h1>
          <p>
            Primero se muestran los datos de tu plataforma predeterminada:
            {' '}<strong>{perfil?.plataforma_predeterminada || 'SHEIN'}</strong>.
          </p>
        </div>
      </div>

      <div className="metrics-filter-card">
        <div className="metrics-filter-top">
          <div>
            <span>Filtros de métricas</span>
            <strong>{plataformaFiltro === 'Todas' ? 'Todas las plataformas' : plataformaFiltro}</strong>
          </div>
          <button type="button" className="btn btn-light-bordered" onClick={() => {
            setPlataformaFiltro(perfil?.plataforma_predeterminada || 'SHEIN')
            aplicarRangoRapido('mes')
          }}>
            Restablecer
          </button>
        </div>

        <div className="metrics-filter-grid">
          <label className="form-field">
            <span>Plataforma</span>
            <select value={plataformaFiltro} onChange={(e) => setPlataformaFiltro(e.target.value)}>
              <option value={perfil?.plataforma_predeterminada || 'SHEIN'}>
                Predeterminada: {perfil?.plataforma_predeterminada || 'SHEIN'}
              </option>
              <option value="Todas">Todas las plataformas</option>
              {plataformas
                .filter((plataforma) => plataforma !== (perfil?.plataforma_predeterminada || 'SHEIN'))
                .map((plataforma) => (
                  <option key={plataforma} value={plataforma}>{plataforma}</option>
                ))}
            </select>
          </label>

          <label className="form-field">
            <span>Desde</span>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => {
                setFechaInicio(e.target.value)
                setRangoActivo('personalizado')
              }}
            />
          </label>

          <label className="form-field">
            <span>Hasta</span>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => {
                setFechaFin(e.target.value)
                setRangoActivo('personalizado')
              }}
            />
          </label>
        </div>

        <div className="metrics-quick-ranges">
          <button type="button" className={rangoActivo === 'hoy' ? 'active' : ''} onClick={() => aplicarRangoRapido('hoy')}>Hoy</button>
          <button type="button" className={rangoActivo === 'semana' ? 'active' : ''} onClick={() => aplicarRangoRapido('semana')}>Esta semana</button>
          <button type="button" className={rangoActivo === 'mes' ? 'active' : ''} onClick={() => aplicarRangoRapido('mes')}>Este mes</button>
          <button type="button" className={rangoActivo === 'todo' ? 'active' : ''} onClick={() => aplicarRangoRapido('todo')}>Todo</button>
        </div>
      </div>

      <div className="metrics-period-card metrics-period-card-light">
        <span>Rango actual</span>
        <strong>{rangoLabel(resumen.inicio, resumen.fin)}</strong>
      </div>

      <div className="cards-grid metrics-main-cards">
        <div className="card"><span>Ventas</span><strong>{money(resumen.totalVendido)}</strong></div>
        <div className="card"><span>Ganancia</span><strong>{money(resumen.ganancia)}</strong></div>
        <div className="card"><span>Pagado</span><strong>{money(resumen.pagado)}</strong></div>
        <div className="card"><span>Pendiente</span><strong>{money(resumen.pendiente)}</strong></div>
        <div className="card"><span>Pedidos</span><strong>{number(resumen.filtrados.length)}</strong></div>
        <div className="card"><span>Activos</span><strong>{number(resumen.activos)}</strong></div>
        <div className="card"><span>Ticket promedio</span><strong>{money(resumen.ticketPromedio)}</strong></div>
        <div className="card"><span>Margen</span><strong>{Math.round(resumen.margen)}%</strong></div>
        <div className="card"><span>Entregados</span><strong>{number(resumen.entregados)}</strong></div>
        <div className="card"><span>Cancelados / devueltos</span><strong>{number(resumen.cancelados)}</strong></div>
        <div className="card"><span>Top plataforma</span><strong>{resumen.plataformaTop?.label || '-'}</strong></div>
        <div className="card"><span>Filtro</span><strong>{plataformaFiltro === 'Todas' ? 'Todas' : plataformaFiltro}</strong></div>
      </div>

      <div className="metrics-grid-two">
        <div className="table-card">
          <div className="metrics-card-title">
            <h2>Ventas por fecha</h2>
            <span>Gráfica de barras</span>
          </div>
          <GraficaBarras datos={resumen.ventasPorPeriodo} formato="dinero" />
        </div>

        <div className="table-card">
          <div className="metrics-card-title">
            <h2>Pedidos por plataforma</h2>
            <span>Gráfica de pastel</span>
          </div>
          <GraficaPastel datos={resumen.porPlataforma} titulo="pedidos" />
        </div>
      </div>

      <div className="metrics-grid-two">
        <div className="table-card">
          <div className="metrics-card-title">
            <h2>Ventas por plataforma</h2>
            <span>Comparación por dinero vendido</span>
          </div>
          <GraficaBarras datos={resumen.ventasPorPlataforma.length ? resumen.ventasPorPlataforma : [{ label: 'Sin datos', valor: 0, texto: money(0) }]} formato="dinero" />
        </div>

        <div className="table-card">
          <div className="metrics-card-title">
            <h2>Pedidos por estado</h2>
            <span>Distribución del rango</span>
          </div>
          <GraficaPastel datos={resumen.porEstado} titulo="pedidos" />
        </div>
      </div>

      <div className="metrics-grid-two">
        <div className="table-card">
          <div className="metrics-card-title">
            <h2>Top clientes</h2>
            <span>Mayor venta del rango</span>
          </div>

          {resumen.topClientes.length > 0 ? (
            <div className="metrics-top-list">
              {resumen.topClientes.map((cliente, index) => (
                <div key={cliente.nombre}>
                  <span>#{index + 1}</span>
                  <strong>{cliente.nombre}</strong>
                  <small>{cliente.pedidos} pedido(s)</small>
                  <b>{money(cliente.vendido)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Todavía no hay clientes en este rango.</p>
          )}
        </div>

        <div className="table-card">
          <div className="metrics-card-title">
            <h2>Resumen rápido</h2>
            <span>Lectura del negocio</span>
          </div>

          <div className="metrics-insights-list">
            <div>
              <span>Plataforma analizada</span>
              <strong>{plataformaFiltro === 'Todas' ? 'Todas las plataformas' : plataformaFiltro}</strong>
            </div>
            <div>
              <span>Mejor plataforma</span>
              <strong>{resumen.plataformaTop ? `${resumen.plataformaTop.label} (${money(resumen.plataformaTop.valor)})` : '-'}</strong>
            </div>
            <div>
              <span>Margen aproximado</span>
              <strong>{Math.round(resumen.margen)}%</strong>
            </div>
            <div>
              <span>Estado del rango</span>
              <strong>{resumen.filtrados.length ? 'Con actividad' : 'Sin actividad'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="metrics-card-title">
          <h2>Últimos pedidos del rango</h2>
          <span>Resumen rápido</span>
        </div>

        {resumen.ultimos.length > 0 ? (
          <div className="metrics-orders-list">
            {resumen.ultimos.map((pedido) => (
              <div key={pedido.id}>
                <strong>{pedido.codigo}</strong>
                <span>{pedido.clientes?.nombre || 'Sin cliente'}</span>
                <span>{pedido.plataforma || 'SHEIN'}</span>
                <span>{normalizarEstado(pedido.estado)}</span>
                <b>{money(pedido.total_cliente)}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No hay pedidos en este rango.</p>
        )}
      </div>
    </Layout>
  )
}
