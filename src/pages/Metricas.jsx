import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../supabaseClient'
import { PLATAFORMAS } from '../lib/plataformas'
import EmptyState from '../components/EmptyState'
import PageHelp from '../components/PageHelp'

const ESTADOS = [
  'Cotizado',
  'Comprado en plataforma',
  'En camino',
  'Recibido',
  'Entregado',
  'Cancelado',
  'Devuelto'
]

const COLORES_GRAFICA = [
  '#3155d7',
  '#7c3aed',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#64748b',
  '#ec4899'
]

const money = (valor) => Number(valor || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2
})

const number = (valor) => Number(valor || 0).toLocaleString('es-MX')

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

const fechaCompra = (compra) => {
  const raw = compra?.fecha_compra || compra?.creado_en
  const fecha = raw ? new Date(raw) : new Date()
  return Number.isNaN(fecha.getTime()) ? new Date() : fecha
}

const inicioDia = (fecha) => {
  const nueva = new Date(fecha)
  nueva.setHours(0, 0, 0, 0)
  return nueva
}

const finDia = (fecha) => {
  const nueva = new Date(fecha)
  nueva.setHours(23, 59, 59, 999)
  return nueva
}

const inicioSemana = (fecha) => {
  const nueva = inicioDia(fecha)
  const dia = nueva.getDay()
  const diferencia = dia === 0 ? -6 : 1 - dia
  nueva.setDate(nueva.getDate() + diferencia)
  return nueva
}

const inicioMes = (fecha) => new Date(fecha.getFullYear(), fecha.getMonth(), 1)

const toInputDate = (fecha) => {
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, '0')
  const day = String(fecha.getDate()).padStart(2, '0')
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
  if (!inicio && !fin) return 'Todo el historial'
  if (inicio && fin) {
    return `${inicio.toLocaleDateString('es-MX')} al ${fin.toLocaleDateString('es-MX')}`
  }
  if (inicio) return `Desde ${inicio.toLocaleDateString('es-MX')}`
  return `Hasta ${fin.toLocaleDateString('es-MX')}`
}

const pedidoCuentaComoVenta = (pedido) => {
  return !['Cancelado', 'Devuelto'].includes(normalizarEstado(pedido?.estado))
}

const sumarCompras = (compras, campo) => {
  return compras.reduce((suma, compra) => suma + Number(compra?.[campo] || 0), 0)
}

function agruparVentasPorRango(pedidos, inicio, fin) {
  if (!pedidos.length) return [{ label: 'Sin datos', valor: 0 }]

  const fechas = pedidos.map(fechaPedido).sort((a, b) => a - b)
  const inicioReal = inicio || inicioDia(fechas[0])
  const finReal = fin || finDia(fechas[fechas.length - 1])
  const dias = Math.max(1, Math.ceil((finReal - inicioReal) / 86400000) + 1)

  if (dias <= 31) {
    const grupos = []
    const cursor = inicioDia(inicioReal)

    while (cursor <= finReal) {
      grupos.push({
        key: toInputDate(cursor),
        label: cursor.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
        valor: 0
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    pedidos.forEach((pedido) => {
      const key = toInputDate(fechaPedido(pedido))
      const grupo = grupos.find((item) => item.key === key)
      if (grupo) grupo.valor += Number(pedido.total_cliente || 0)
    })

    return grupos
  }

  if (dias <= 120) {
    const grupos = []
    const cursor = inicioDia(inicioReal)
    let numero = 1

    while (cursor <= finReal) {
      const desde = new Date(cursor)
      const hasta = finDia(new Date(cursor))
      hasta.setDate(hasta.getDate() + 6)

      grupos.push({ desde, hasta, label: `Sem ${numero}`, valor: 0 })
      cursor.setDate(cursor.getDate() + 7)
      numero += 1
    }

    pedidos.forEach((pedido) => {
      const fecha = fechaPedido(pedido)
      const grupo = grupos.find((item) => fecha >= item.desde && fecha <= item.hasta)
      if (grupo) grupo.valor += Number(pedido.total_cliente || 0)
    })

    return grupos
  }

  const grupos = new Map()

  pedidos.forEach((pedido) => {
    const fecha = fechaPedido(pedido)
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    const actual = grupos.get(key) || {
      key,
      label: fecha.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
      valor: 0
    }
    actual.valor += Number(pedido.total_cliente || 0)
    grupos.set(key, actual)
  })

  return Array.from(grupos.values()).sort((a, b) => a.key.localeCompare(b.key))
}

function Barras({ datos, dinero = false }) {
  const maximo = Math.max(...datos.map((item) => Number(item.valor || 0)), 1)

  return (
    <div className="metrics-v58-bars">
      {datos.map((item) => (
        <div className="metrics-v58-bar-row" key={item.key || item.label}>
          <span>{item.label}</span>
          <div className="metrics-v58-bar-track">
            <i style={{ width: `${(Number(item.valor || 0) / maximo) * 100}%` }} />
          </div>
          <strong>{dinero ? money(item.valor) : number(item.valor)}</strong>
        </div>
      ))}
    </div>
  )
}

function Dona({ datos, centro = 'pedidos' }) {
  const total = datos.reduce((suma, item) => suma + Number(item.valor || 0), 0)

  if (!total) {
    return (
      <div className="metrics-v58-empty-chart">
        <strong>Aún no hay datos</strong>
        <span>La gráfica aparecerá cuando registres actividad en este periodo.</span>
      </div>
    )
  }

  let acumulado = 0
  const partes = datos.map((item, index) => {
    const inicio = acumulado
    const porcentaje = (Number(item.valor || 0) / total) * 100
    acumulado += porcentaje
    return `${COLORES_GRAFICA[index % COLORES_GRAFICA.length]} ${inicio}% ${acumulado}%`
  })

  return (
    <div className="metrics-v58-donut-wrap">
      <div className="metrics-v58-donut" style={{ background: `conic-gradient(${partes.join(', ')})` }}>
        <div>
          <strong>{number(total)}</strong>
          <span>{centro}</span>
        </div>
      </div>

      <div className="metrics-v58-legend">
        {datos.map((item, index) => (
          <div key={item.label}>
            <span>
              <i style={{ background: COLORES_GRAFICA[index % COLORES_GRAFICA.length] }} />
              {item.label}
            </span>
            <strong>{Math.round((Number(item.valor || 0) / total) * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function TarjetaPrincipal({ etiqueta, valor, detalle, tono = 'azul' }) {
  return (
    <article className={`metrics-v58-main-card is-${tono}`}>
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
      <small>{detalle}</small>
    </article>
  )
}

function DemoBloqueado() {
  const demoVentas = [
    { label: 'Lun', valor: 1200 },
    { label: 'Mar', valor: 850 },
    { label: 'Mié', valor: 2100 },
    { label: 'Jue', valor: 1600 },
    { label: 'Vie', valor: 2600 },
    { label: 'Sáb', valor: 3200 },
    { label: 'Dom', valor: 1800 }
  ]

  return (
    <Layout>
      <section className="metrics-v58-locked">
        <div>
          <span>Estadísticas Pro</span>
          <h1>Entiende cómo va tu negocio sin hacer cuentas.</h1>
          <p>
            Consulta ventas, cobros, ganancias estimadas, plataformas y clientes en un solo lugar.
          </p>
          <Link to="/planes" className="btn btn-primary">Ver Plan Pro</Link>
        </div>

        <div className="metrics-v58-locked-preview" aria-hidden="true">
          <TarjetaPrincipal etiqueta="Ventas del mes" valor="$18,450" detalle="42 pedidos" tono="azul" />
          <TarjetaPrincipal etiqueta="Ya cobrado" valor="$16,350" detalle="89% del total" tono="verde" />
          <div className="metrics-v58-locked-chart">
            <Barras datos={demoVentas} dinero />
          </div>
        </div>
      </section>
    </Layout>
  )
}

export default function Metricas() {
  const hoy = new Date()
  const [perfil, setPerfil] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [compras, setCompras] = useState([])
  const [fechaInicio, setFechaInicio] = useState(toInputDate(inicioMes(hoy)))
  const [fechaFin, setFechaFin] = useState(toInputDate(hoy))
  const [plataformaFiltro, setPlataformaFiltro] = useState('Todas')
  const [rangoActivo, setRangoActivo] = useState('mes')
  const [mostrarFechas, setMostrarFechas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    setErrorCarga('')

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user

    if (!user) {
      setErrorCarga('No pudimos identificar tu sesión. Vuelve a iniciar sesión e intenta nuevamente.')
      setCargando(false)
      return
    }

    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    setPerfil(perfilData || null)

    const tieneAcceso = perfilData?.plan_actual === 'pro' || perfilData?.es_admin

    if (tieneAcceso) {
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select('id, codigo, estado, plataforma, fecha_pedido, total_cliente, anticipo, restante, ganancia, reembolso, creado_en, clientes(nombre)')
        .order('creado_en', { ascending: false })

      if (pedidosError) {
        console.log(pedidosError)
        setErrorCarga('No pudimos cargar los pedidos para calcular tus estadísticas.')
      }
      setPedidos(pedidosData || [])

      const { data: comprasData, error: comprasError } = await supabase
        .from('lotes_compra')
        .select('id, codigo_lote, plataforma, fecha_compra, subtotal_pagina, descuento_cupon, puntos_total, descuento_total, envio, importacion, impuestos, comisiones, total_productos_con_descuento, costos_extra_total, total_pagado, ahorro_total, cupon_usado, numero_orden_plataforma, creado_en')
        .order('fecha_compra', { ascending: false })
        .limit(500)

      if (comprasError) console.log('Error cargando compras para estadísticas:', comprasError)
      setCompras(comprasData || [])
    }

    setCargando(false)
  }

  const aplicarRango = (tipo) => {
    const ahora = new Date()
    setRangoActivo(tipo)
    setMostrarFechas(tipo === 'personalizado')

    if (tipo === 'hoy') {
      setFechaInicio(toInputDate(ahora))
      setFechaFin(toInputDate(ahora))
      return
    }

    if (tipo === 'semana') {
      setFechaInicio(toInputDate(inicioSemana(ahora)))
      setFechaFin(toInputDate(ahora))
      return
    }

    if (tipo === 'mes') {
      setFechaInicio(toInputDate(inicioMes(ahora)))
      setFechaFin(toInputDate(ahora))
      return
    }

    if (tipo === 'todo') {
      setFechaInicio('')
      setFechaFin('')
    }
  }

  const resumen = useMemo(() => {
    const inicio = fromInputDateStart(fechaInicio)
    const fin = fromInputDateEnd(fechaFin)

    const pedidosFiltrados = pedidos.filter((pedido) => {
      const fecha = fechaPedido(pedido)
      const plataforma = pedido.plataforma || 'SHEIN'
      const coincidePlataforma = plataformaFiltro === 'Todas' || plataforma === plataformaFiltro
      return coincidePlataforma && (!inicio || fecha >= inicio) && (!fin || fecha <= fin)
    })

    const ventasValidas = pedidosFiltrados.filter(pedidoCuentaComoVenta)
    const totalVendido = ventasValidas.reduce((suma, pedido) => suma + Number(pedido.total_cliente || 0), 0)
    const cobrado = ventasValidas.reduce((suma, pedido) => suma + Number(pedido.anticipo || 0), 0)
    const pendiente = ventasValidas.reduce((suma, pedido) => suma + Number(pedido.restante || 0), 0)
    const gananciaBruta = ventasValidas.reduce((suma, pedido) => suma + Number(pedido.ganancia || 0), 0)
    const porcentajeCobrado = totalVendido ? Math.min((cobrado / totalVendido) * 100, 100) : 0
    const ticketPromedio = ventasValidas.length ? totalVendido / ventasValidas.length : 0

    const activos = pedidosFiltrados.filter((pedido) => !['Entregado', 'Cancelado', 'Devuelto'].includes(normalizarEstado(pedido.estado))).length
    const enCamino = pedidosFiltrados.filter((pedido) => normalizarEstado(pedido.estado) === 'En camino').length
    const listosEntrega = pedidosFiltrados.filter((pedido) => normalizarEstado(pedido.estado) === 'Recibido').length
    const porCobrar = ventasValidas.filter((pedido) => Number(pedido.restante || 0) > 0).length
    const entregados = pedidosFiltrados.filter((pedido) => normalizarEstado(pedido.estado) === 'Entregado').length
    const cancelados = pedidosFiltrados.filter((pedido) => ['Cancelado', 'Devuelto'].includes(normalizarEstado(pedido.estado))).length

    const comprasFiltradas = compras.filter((compra) => {
      const fecha = fechaCompra(compra)
      const plataforma = compra.plataforma || 'SHEIN'
      const coincidePlataforma = plataformaFiltro === 'Todas' || plataforma === plataformaFiltro
      return coincidePlataforma && (!inicio || fecha >= inicio) && (!fin || fecha <= fin)
    })

    const totalPagadoPlataforma = sumarCompras(comprasFiltradas, 'total_pagado')
    const descuentos = sumarCompras(comprasFiltradas, 'descuento_total') || sumarCompras(comprasFiltradas, 'ahorro_total')
    const envio = sumarCompras(comprasFiltradas, 'envio')
    const importacion = sumarCompras(comprasFiltradas, 'importacion')
    const impuestos = sumarCompras(comprasFiltradas, 'impuestos')
    const comisiones = sumarCompras(comprasFiltradas, 'comisiones')
    const costosExtra = sumarCompras(comprasFiltradas, 'costos_extra_total') || (envio + importacion + impuestos + comisiones)
    const gananciaEstimada = gananciaBruta - costosExtra

    const ventasPorFecha = agruparVentasPorRango(ventasValidas, inicio, fin)

    const pedidosPorPlataforma = PLATAFORMAS
      .map((plataforma) => ({
        label: plataforma,
        valor: pedidosFiltrados.filter((pedido) => (pedido.plataforma || 'SHEIN') === plataforma).length
      }))
      .filter((item) => item.valor > 0)

    const ventasPorPlataforma = PLATAFORMAS
      .map((plataforma) => ({
        label: plataforma,
        valor: ventasValidas
          .filter((pedido) => (pedido.plataforma || 'SHEIN') === plataforma)
          .reduce((suma, pedido) => suma + Number(pedido.total_cliente || 0), 0)
      }))
      .filter((item) => item.valor > 0)
      .sort((a, b) => b.valor - a.valor)

    const pedidosPorEstado = ESTADOS
      .map((estado) => ({
        label: estado,
        valor: pedidosFiltrados.filter((pedido) => normalizarEstado(pedido.estado) === estado).length
      }))
      .filter((item) => item.valor > 0)

    const clientes = new Map()

    ventasValidas.forEach((pedido) => {
      const nombre = pedido.clientes?.nombre || 'Cliente sin nombre'
      const actual = clientes.get(nombre) || { nombre, pedidos: 0, vendido: 0, pendiente: 0 }
      actual.pedidos += 1
      actual.vendido += Number(pedido.total_cliente || 0)
      actual.pendiente += Number(pedido.restante || 0)
      clientes.set(nombre, actual)
    })

    const topClientes = Array.from(clientes.values())
      .sort((a, b) => b.vendido - a.vendido)
      .slice(0, 5)

    return {
      inicio,
      fin,
      pedidosFiltrados,
      ventasValidas,
      totalVendido,
      cobrado,
      pendiente,
      gananciaEstimada,
      porcentajeCobrado,
      ticketPromedio,
      activos,
      enCamino,
      listosEntrega,
      porCobrar,
      entregados,
      cancelados,
      comprasFiltradas,
      totalPagadoPlataforma,
      descuentos,
      costosExtra,
      ventasPorFecha,
      pedidosPorPlataforma,
      ventasPorPlataforma,
      pedidosPorEstado,
      topClientes,
      mejorPlataforma: ventasPorPlataforma[0] || null,
      ultimosPedidos: pedidosFiltrados.slice(0, 6),
      ultimasCompras: comprasFiltradas.slice(0, 5)
    }
  }, [pedidos, compras, fechaInicio, fechaFin, plataformaFiltro])

  if (cargando) {
    return (
      <Layout>
        <div className="ordely-page-state-wrap">
          <EmptyState
            icon="loading"
            eyebrow="Preparando estadísticas"
            title="Estamos analizando tus pedidos y compras."
            description="En un momento verás ventas, cobros, plataformas y clientes destacados."
          />
        </div>
      </Layout>
    )
  }

  if (errorCarga) {
    return (
      <Layout>
        <div className="ordely-page-state-wrap">
          <EmptyState
            icon="error"
            tone="error"
            eyebrow="No se pudo actualizar"
            title="Las estadísticas no están disponibles por ahora."
            description={errorCarga}
            actionLabel="Intentar de nuevo"
            onAction={cargarDatos}
            secondaryLabel="Volver al inicio"
            secondaryTo="/panel"
          />
        </div>
      </Layout>
    )
  }

  const tieneAcceso = perfil?.plan_actual === 'pro' || perfil?.es_admin

  if (!tieneAcceso) return <DemoBloqueado />

  const actividad = resumen.pedidosFiltrados.length > 0
  const lecturaPrincipal = actividad
    ? `Vendiste ${money(resumen.totalVendido)} en ${number(resumen.ventasValidas.length)} pedido(s) y ya cobraste ${Math.round(resumen.porcentajeCobrado)}%.`
    : 'Todavía no hay actividad en el periodo seleccionado.'

  return (
    <Layout>
      <PageHelp page="metricas" />

      <div className="page-header metrics-v58-header">
        <div>
          <span className="metrics-v58-kicker">Vista del negocio</span>
          <h1>Estadísticas</h1>
          <p>Entiende qué vendiste, qué cobraste y qué necesita atención.</p>
        </div>
      </div>

      <section className="metrics-v58-controls">
        <div className="metrics-v58-periods" aria-label="Periodo de estadísticas">
          {[
            ['hoy', 'Hoy'],
            ['semana', 'Semana'],
            ['mes', 'Mes'],
            ['todo', 'Todo'],
            ['personalizado', 'Fechas']
          ].map(([valor, texto]) => (
            <button
              type="button"
              key={valor}
              className={rangoActivo === valor ? 'active' : ''}
              onClick={() => aplicarRango(valor)}
            >
              {texto}
            </button>
          ))}
        </div>

        <label className="metrics-v58-platform-filter">
          <span>Plataforma</span>
          <select value={plataformaFiltro} onChange={(event) => setPlataformaFiltro(event.target.value)}>
            <option value="Todas">Todas</option>
            {PLATAFORMAS.map((plataforma) => (
              <option key={plataforma} value={plataforma}>{plataforma}</option>
            ))}
          </select>
        </label>

        {mostrarFechas && (
          <div className="metrics-v58-custom-dates">
            <label>
              <span>Desde</span>
              <input
                type="date"
                value={fechaInicio}
                onChange={(event) => setFechaInicio(event.target.value)}
              />
            </label>
            <label>
              <span>Hasta</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(event) => setFechaFin(event.target.value)}
              />
            </label>
          </div>
        )}
      </section>

      <section className="metrics-v58-reading">
        <div>
          <span>{rangoLabel(resumen.inicio, resumen.fin)}</span>
          <strong>{lecturaPrincipal}</strong>
        </div>
        <div className="metrics-v58-reading-badge">
          <span>Pedidos analizados</span>
          <strong>{number(resumen.pedidosFiltrados.length)}</strong>
        </div>
      </section>

      <section className="metrics-v58-main-grid">
        <TarjetaPrincipal
          etiqueta="Ventas"
          valor={money(resumen.totalVendido)}
          detalle={`${number(resumen.ventasValidas.length)} pedido(s) válidos`}
          tono="azul"
        />
        <TarjetaPrincipal
          etiqueta="Ya cobrado"
          valor={money(resumen.cobrado)}
          detalle={`${Math.round(resumen.porcentajeCobrado)}% del total vendido`}
          tono="verde"
        />
        <TarjetaPrincipal
          etiqueta="Falta cobrar"
          valor={money(resumen.pendiente)}
          detalle={`${number(resumen.porCobrar)} pedido(s) pendientes`}
          tono="naranja"
        />
        <TarjetaPrincipal
          etiqueta="Ganancia estimada"
          valor={money(resumen.gananciaEstimada)}
          detalle="Después de costos extra registrados"
          tono="morado"
        />
      </section>

      <section className="metrics-v58-collection">
        <div>
          <span>Avance de cobro</span>
          <strong>{Math.round(resumen.porcentajeCobrado)}%</strong>
        </div>
        <div className="metrics-v58-collection-track">
          <i style={{ width: `${resumen.porcentajeCobrado}%` }} />
        </div>
        <p>
          {resumen.pendiente > 0
            ? `Todavía faltan ${money(resumen.pendiente)} por cobrar.`
            : actividad
              ? 'Todo lo vendido en este periodo ya está cubierto.'
              : 'El avance aparecerá cuando registres pedidos y pagos.'}
        </p>
      </section>

      <section className="metrics-v58-attention-grid">
        <article>
          <span>Por cobrar</span>
          <strong>{number(resumen.porCobrar)}</strong>
          <p>Pedidos que todavía tienen saldo.</p>
        </article>
        <article>
          <span>En camino</span>
          <strong>{number(resumen.enCamino)}</strong>
          <p>Pedidos esperando llegada.</p>
        </article>
        <article>
          <span>Listos para entregar</span>
          <strong>{number(resumen.listosEntrega)}</strong>
          <p>Pedidos recibidos que pueden continuar.</p>
        </article>
        <article>
          <span>Pedidos activos</span>
          <strong>{number(resumen.activos)}</strong>
          <p>Sin contar entregados o cancelados.</p>
        </article>
      </section>

      <section className="metrics-v58-section-heading">
        <div>
          <span>Ventas</span>
          <h2>Cómo se movió tu negocio</h2>
        </div>
        <p>La información principal del periodo, sin métricas innecesarias.</p>
      </section>

      <section className="metrics-v58-two-columns">
        <article className="metrics-v58-panel">
          <div className="metrics-v58-panel-title">
            <div>
              <span>Ventas por fecha</span>
              <h3>{money(resumen.totalVendido)}</h3>
            </div>
            <small>{rangoLabel(resumen.inicio, resumen.fin)}</small>
          </div>
          <Barras datos={resumen.ventasPorFecha} dinero />
        </article>

        <article className="metrics-v58-panel">
          <div className="metrics-v58-panel-title">
            <div>
              <span>Pedidos por plataforma</span>
              <h3>{number(resumen.pedidosFiltrados.length)}</h3>
            </div>
            <small>Distribución del periodo</small>
          </div>
          <Dona datos={resumen.pedidosPorPlataforma} />
        </article>
      </section>

      <section className="metrics-v58-two-columns">
        <article className="metrics-v58-panel">
          <div className="metrics-v58-panel-title">
            <div>
              <span>Lo más importante</span>
              <h3>Lectura rápida</h3>
            </div>
          </div>

          <div className="metrics-v58-insights">
            <div>
              <span>Mejor plataforma</span>
              <strong>{resumen.mejorPlataforma?.label || 'Sin datos'}</strong>
              <small>{resumen.mejorPlataforma ? money(resumen.mejorPlataforma.valor) : 'Aún no hay ventas'}</small>
            </div>
            <div>
              <span>Venta promedio</span>
              <strong>{money(resumen.ticketPromedio)}</strong>
              <small>Promedio por pedido válido</small>
            </div>
            <div>
              <span>Pedidos entregados</span>
              <strong>{number(resumen.entregados)}</strong>
              <small>{number(resumen.cancelados)} cancelado(s) o devuelto(s)</small>
            </div>
          </div>
        </article>

        <article className="metrics-v58-panel">
          <div className="metrics-v58-panel-title">
            <div>
              <span>Pedidos por estado</span>
              <h3>Situación actual</h3>
            </div>
          </div>
          <Dona datos={resumen.pedidosPorEstado} />
        </article>
      </section>

      <section className="metrics-v58-section-heading">
        <div>
          <span>Compras en plataforma</span>
          <h2>Costos y descuentos</h2>
        </div>
        <p>Solo se consideran las compras agrupadas registradas en el periodo.</p>
      </section>

      <section className="metrics-v58-purchase-grid">
        <article>
          <span>Compras registradas</span>
          <strong>{number(resumen.comprasFiltradas.length)}</strong>
        </article>
        <article>
          <span>Pagado en plataforma</span>
          <strong>{money(resumen.totalPagadoPlataforma)}</strong>
        </article>
        <article>
          <span>Descuentos obtenidos</span>
          <strong>{money(resumen.descuentos)}</strong>
        </article>
        <article>
          <span>Costos extra</span>
          <strong>{money(resumen.costosExtra)}</strong>
        </article>
      </section>

      <section className="metrics-v58-two-columns metrics-v58-lists-row">
        <article className="metrics-v58-panel">
          <div className="metrics-v58-panel-title">
            <div>
              <span>Clientes</span>
              <h3>Quienes más compraron</h3>
            </div>
          </div>

          {resumen.topClientes.length > 0 ? (
            <div className="metrics-v58-client-list">
              {resumen.topClientes.map((cliente, index) => (
                <div key={cliente.nombre}>
                  <b>{index + 1}</b>
                  <span>
                    <strong>{cliente.nombre}</strong>
                    <small>{cliente.pedidos} pedido(s)</small>
                  </span>
                  <em>{money(cliente.vendido)}</em>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="clients"
              eyebrow="Sin clientes en el periodo"
              title="Todavía no hay ventas para comparar."
              description="Cuando registres pedidos en este rango, aquí aparecerán tus clientes principales."
              compact
              className="metrics-v58-empty-list"
            />
          )}
        </article>

        <article className="metrics-v58-panel">
          <div className="metrics-v58-panel-title">
            <div>
              <span>Actividad reciente</span>
              <h3>Últimos pedidos</h3>
            </div>
            <Link to="/pedidos">Ver todos</Link>
          </div>

          {resumen.ultimosPedidos.length > 0 ? (
            <div className="metrics-v58-orders-list">
              {resumen.ultimosPedidos.map((pedido) => (
                <Link to={`/pedidos/${pedido.id}`} key={pedido.id}>
                  <span>
                    <strong>{pedido.codigo || 'Pedido'}</strong>
                    <small>{pedido.clientes?.nombre || 'Cliente sin nombre'}</small>
                  </span>
                  <span>
                    <small>{normalizarEstado(pedido.estado)}</small>
                    <b>{money(pedido.total_cliente)}</b>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="search"
              eyebrow="Sin pedidos en el periodo"
              title="No encontramos actividad con estos filtros."
              description="Prueba con otro rango de fechas o selecciona todas las plataformas."
              actionLabel="Ver todo el historial"
              onAction={() => aplicarRango('todo')}
              compact
              className="metrics-v58-empty-list"
            />
          )}
        </article>
      </section>
    </Layout>
  )
}
