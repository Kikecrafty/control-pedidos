import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { supabase } from '../supabaseClient'

const planTexto = {
  basico: 'Básico',
  premium: 'Premium',
  pro: 'Pro'
}

const origenTexto = {
  sistema: 'Sistema',
  manual: 'Manual',
  codigo: 'Código',
  pago: 'Pago',
  regalo: 'Regalo',
  stripe: 'Stripe',
  mercado_pago: 'Mercado Pago'
}

const estadoPagoTexto = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  cancelado: 'Cancelado',
  vencido: 'Vencido',
  reembolsado: 'Reembolsado'
}

const formatearFecha = (fecha) => {
  if (!fecha) return 'Sin vencimiento'
  return new Date(fecha).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const formatearFechaCorta = (fecha) => {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const formatearDinero = (cantidad) => {
  return Number(cantidad || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN'
  })
}

const planDuracionTexto = (dias) => {
  if (!dias) return 'Sin vencimiento'
  return `${dias} días`
}

const fechaInicioDia = (fecha = new Date()) => {
  const copia = new Date(fecha)
  copia.setHours(0, 0, 0, 0)
  return copia
}

const inicioMesActual = () => {
  const fecha = new Date()
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
}

const estaPorVencer = (fecha, dias = 7) => {
  if (!fecha) return false
  const ahora = new Date()
  const limite = new Date()
  limite.setDate(limite.getDate() + dias)
  const vencimiento = new Date(fecha)
  return vencimiento >= ahora && vencimiento <= limite
}

const esCuentaActiva = (usuario) => {
  return !usuario.cuenta_bloqueada && !usuario.plan_vencido
}

export default function AdminControl() {
  const [perfilActual, setPerfilActual] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [codigos, setCodigos] = useState([])
  const [suscripciones, setSuscripciones] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroPlan, setFiltroPlan] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [tab, setTab] = useState('resumen')
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [precios, setPrecios] = useState({ premium: '59.99', pro: '99.99' })
  const [nuevoCodigo, setNuevoCodigo] = useState({
    codigo: '',
    plan: 'premium',
    duracion_dias: '30',
    usos_maximos: '1',
    codigo_expira_en: '',
    notas: ''
  })
  const [usuarioPago, setUsuarioPago] = useState(null)
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [pagoManual, setPagoManual] = useState({
    plan: 'premium',
    monto: '59.99',
    metodo_pago: 'transferencia',
    duracion_dias: '30',
    sin_vencimiento: false,
    notas: ''
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    setMensaje('')

    const { data: estadoPlan, error: estadoError } = await supabase.rpc('mi_estado_plan')

    if (estadoError) {
      console.log(estadoError)
    }

    const perfilData = Array.isArray(estadoPlan) ? estadoPlan[0] : estadoPlan
    setPerfilActual(perfilData || null)

    if (perfilData?.es_admin) {
      const { data: usuariosData, error: usuariosError } = await supabase.rpc('admin_usuarios_resumen')

      if (usuariosError) {
        console.log(usuariosError)
        setMensaje('No se pudo cargar el resumen admin. Revisa que hayas ejecutado el SQL de planes y bloqueo.')
      }

      const { data: codigosData, error: codigosError } = await supabase.rpc('admin_listar_codigos')

      if (codigosError) {
        console.log(codigosError)
        setMensaje('No se pudieron cargar los códigos. Revisa que hayas ejecutado el SQL de códigos canjeables.')
      }

      const { data: suscripcionesData, error: suscripcionesError } = await supabase.rpc('admin_listar_suscripciones')

      if (suscripcionesError) {
        console.log(suscripcionesError)
        setMensaje('No se pudieron cargar los pagos manuales. Revisa que hayas ejecutado el SQL de suscripciones.')
      }

      setUsuarios(usuariosData || [])
      setCodigos(codigosData || [])
      setSuscripciones(suscripcionesData || [])
    }

    setCargando(false)
  }

  const resumen = useMemo(() => {
    const hoy = fechaInicioDia()
    const hace7 = new Date()
    hace7.setDate(hace7.getDate() - 7)
    const hace30 = new Date()
    hace30.setDate(hace30.getDate() - 30)
    const inicioMes = inicioMesActual()

    const cuentasActivas = usuarios.filter(esCuentaActiva)
    const premiumActivos = cuentasActivas.filter((u) => u.plan_actual === 'premium')
    const proActivos = cuentasActivas.filter((u) => u.plan_actual === 'pro')
    const basicoActivos = cuentasActivas.filter((u) => u.plan_actual === 'basico')

    const precioPremium = Number(precios.premium || 0)
    const precioPro = Number(precios.pro || 0)

    const pagosPagados = suscripciones.filter((s) => s.estado_pago === 'pagado')
    const pagosMes = pagosPagados.filter((s) => new Date(s.creado_en) >= inicioMes)
    const pagosHoy = pagosPagados.filter((s) => new Date(s.creado_en) >= hoy)
    const pagos7 = pagosPagados.filter((s) => new Date(s.creado_en) >= hace7)

    return {
      total: usuarios.length,
      activos: cuentasActivas.length,
      basico: usuarios.filter((u) => u.plan_actual === 'basico').length,
      premium: usuarios.filter((u) => u.plan_actual === 'premium').length,
      pro: usuarios.filter((u) => u.plan_actual === 'pro').length,
      basicoActivos: basicoActivos.length,
      premiumActivos: premiumActivos.length,
      proActivos: proActivos.length,
      admins: usuarios.filter((u) => u.es_admin).length,
      bloqueadas: usuarios.filter((u) => u.cuenta_bloqueada).length,
      limite: usuarios.filter((u) => u.limite_alcanzado).length,
      cercaLimite: usuarios.filter((u) => u.plan_actual === 'basico' && Number(u.pedidos_usados || 0) >= 25 && !u.limite_alcanzado).length,
      vencidos: usuarios.filter((u) => u.plan_vencido).length,
      porVencer: usuarios.filter((u) => estaPorVencer(u.plan_expira_en, 7)).length,
      sinVencimiento: usuarios.filter((u) => u.plan_actual !== 'basico' && !u.plan_expira_en).length,
      nuevosHoy: usuarios.filter((u) => new Date(u.creado_en) >= hoy).length,
      nuevos7: usuarios.filter((u) => new Date(u.creado_en) >= hace7).length,
      nuevos30: usuarios.filter((u) => new Date(u.creado_en) >= hace30).length,
      pedidosUsados: usuarios.reduce((total, u) => total + Number(u.pedidos_usados || 0), 0),
      codigosActivos: codigos.filter((c) => c.activo).length,
      codigosUsados: codigos.reduce((total, codigo) => total + Number(codigo.usos_actuales || 0), 0),
      codigosAgotados: codigos.filter((c) => c.usos_maximos && Number(c.usos_actuales || 0) >= Number(c.usos_maximos)).length,
      ingresoEstimado: (premiumActivos.length * precioPremium) + (proActivos.length * precioPro),
      pagosRegistrados: suscripciones.length,
      ingresosHoy: pagosHoy.reduce((total, pago) => total + Number(pago.monto || 0), 0),
      ingresos7: pagos7.reduce((total, pago) => total + Number(pago.monto || 0), 0),
      ingresosMes: pagosMes.reduce((total, pago) => total + Number(pago.monto || 0), 0),
      pagosPendientes: suscripciones.filter((s) => s.estado_pago === 'pendiente').length,
      pagosCancelados: suscripciones.filter((s) => ['cancelado', 'reembolsado'].includes(s.estado_pago)).length,
      suscripcionesVencidas: suscripciones.filter((s) => s.estado_pago === 'vencido').length
    }
  }, [usuarios, codigos, suscripciones, precios])

  const usuariosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return usuarios.filter((usuario) => {
      const nombre = String(usuario.nombre || '').toLowerCase()
      const correo = String(usuario.correo || '').toLowerCase()
      const coincideTexto = !texto || nombre.includes(texto) || correo.includes(texto)
      const coincidePlan = filtroPlan === 'todos' || usuario.plan_actual === filtroPlan

      let coincideEstado = true
      if (filtroEstado === 'activos') coincideEstado = esCuentaActiva(usuario)
      if (filtroEstado === 'bloqueados') coincideEstado = usuario.cuenta_bloqueada
      if (filtroEstado === 'limite') coincideEstado = usuario.limite_alcanzado
      if (filtroEstado === 'vencidos') coincideEstado = usuario.plan_vencido
      if (filtroEstado === 'por_vencer') coincideEstado = estaPorVencer(usuario.plan_expira_en, 7)
      if (filtroEstado === 'cerca_limite') coincideEstado = usuario.plan_actual === 'basico' && Number(usuario.pedidos_usados || 0) >= 25 && !usuario.limite_alcanzado

      return coincideTexto && coincidePlan && coincideEstado
    })
  }, [usuarios, busqueda, filtroPlan, filtroEstado])

  const alertas = useMemo(() => {
    return [
      ...usuarios.filter((u) => u.limite_alcanzado).map((u) => ({
        tipo: 'Límite alcanzado',
        detalle: `${u.nombre || u.correo} llegó a ${u.pedidos_usados || 0}/${u.limite_pedidos || 30} pedidos.`,
        nivel: 'alto'
      })),
      ...usuarios.filter((u) => u.plan_actual === 'basico' && Number(u.pedidos_usados || 0) >= 25 && !u.limite_alcanzado).map((u) => ({
        tipo: 'Cerca del límite',
        detalle: `${u.nombre || u.correo} va en ${u.pedidos_usados || 0}/${u.limite_pedidos || 30} pedidos.`,
        nivel: 'medio'
      })),
      ...usuarios.filter((u) => estaPorVencer(u.plan_expira_en, 7)).map((u) => ({
        tipo: 'Plan por vencer',
        detalle: `${u.nombre || u.correo} vence el ${formatearFechaCorta(u.plan_expira_en)}.`,
        nivel: 'medio'
      })),
      ...usuarios.filter((u) => u.plan_vencido).map((u) => ({
        tipo: 'Plan vencido',
        detalle: `${u.nombre || u.correo} tiene un plan vencido.`,
        nivel: 'alto'
      })),
      ...suscripciones.filter((s) => s.estado_pago === 'pendiente').map((s) => ({
        tipo: 'Pago pendiente',
        detalle: `${s.nombre || s.correo} tiene un pago pendiente por ${formatearDinero(s.monto)}.`,
        nivel: 'medio'
      })),
      ...suscripciones.filter((s) => s.estado_pago === 'vencido').map((s) => ({
        tipo: 'Suscripción vencida',
        detalle: `${s.nombre || s.correo} tenía ${planTexto[s.plan] || s.plan} y venció el ${formatearFechaCorta(s.fecha_fin)}.`,
        nivel: 'alto'
      })),
      ...codigos.filter((c) => c.usos_maximos && Number(c.usos_actuales || 0) >= Number(c.usos_maximos)).map((c) => ({
        tipo: 'Código agotado',
        detalle: `${c.codigo} ya llegó a sus usos máximos.`,
        nivel: 'bajo'
      }))
    ]
  }, [usuarios, codigos, suscripciones])

  const cambiarPlan = async (usuario, plan, dias = null) => {
    const { error } = await supabase.rpc('admin_cambiar_plan_usuario', {
      p_user_id: usuario.user_id,
      p_plan: plan,
      p_duracion_dias: dias
    })

    if (error) {
      console.log(error)
      setMensaje('No se pudo cambiar el plan.')
      return
    }

    const duracion = plan === 'basico'
      ? ''
      : dias
        ? ` por ${dias} días`
        : ' sin vencimiento'

    setMensaje(`Plan cambiado a ${planTexto[plan]}${duracion}.`)
    window.dispatchEvent(new CustomEvent('planActualizado'))
    cargarDatos()
  }

  const cambiarBloqueo = async (usuario) => {
    const { error } = await supabase.rpc('admin_bloquear_usuario', {
      p_user_id: usuario.user_id,
      p_bloqueada: !usuario.cuenta_bloqueada
    })

    if (error) {
      console.log(error)
      setMensaje('No se pudo actualizar el bloqueo.')
      return
    }

    setMensaje(usuario.cuenta_bloqueada ? 'Cuenta desbloqueada.' : 'Cuenta bloqueada.')
    window.dispatchEvent(new CustomEvent('planActualizado'))
    cargarDatos()
  }

  const abrirPagoManual = (usuario, plan = 'premium') => {
    setUsuarioPago(usuario)
    setPagoManual({
      plan,
      monto: plan === 'pro' ? '99.99' : '59.99',
      metodo_pago: 'transferencia',
      duracion_dias: '30',
      sin_vencimiento: false,
      notas: ''
    })
  }

  const cerrarPagoManual = () => {
    setUsuarioPago(null)
    setGuardandoPago(false)
  }

  const registrarPagoManual = async (event) => {
    event.preventDefault()

    if (!usuarioPago) return

    const monto = Number(pagoManual.monto || 0)
    const duracion = pagoManual.sin_vencimiento || pagoManual.duracion_dias === ''
      ? null
      : Number(pagoManual.duracion_dias)

    if (monto < 0) {
      setMensaje('El monto no puede ser negativo.')
      return
    }

    setGuardandoPago(true)

    const { data, error } = await supabase.rpc('admin_registrar_pago_manual', {
      p_user_id: usuarioPago.user_id,
      p_plan: pagoManual.plan,
      p_monto: monto,
      p_metodo_pago: pagoManual.metodo_pago,
      p_duracion_dias: duracion,
      p_sin_vencimiento: Boolean(pagoManual.sin_vencimiento),
      p_notas: pagoManual.notas.trim() || null
    })

    setGuardandoPago(false)

    if (error) {
      console.log(error)
      setMensaje('No se pudo registrar el pago manual.')
      return
    }

    const resultado = Array.isArray(data) ? data[0] : data
    setMensaje(resultado?.mensaje || 'Pago registrado y plan activado.')
    window.dispatchEvent(new CustomEvent('planActualizado'))
    cerrarPagoManual()
    cargarDatos()
  }

  const actualizarEstadoSuscripcion = async (suscripcion, estado) => {
    const { error } = await supabase.rpc('admin_actualizar_estado_suscripcion', {
      p_suscripcion_id: suscripcion.id,
      p_estado_pago: estado
    })

    if (error) {
      console.log(error)
      setMensaje('No se pudo actualizar el estado del pago.')
      return
    }

    setMensaje(`Pago marcado como ${estadoPagoTexto[estado] || estado}.`)
    cargarDatos()
  }

  const crearCodigo = async (event) => {
    event.preventDefault()

    const codigoLimpio = nuevoCodigo.codigo.trim().toUpperCase()

    if (!codigoLimpio) {
      setMensaje('Escribe el código que quieres crear.')
      return
    }

    const duracion = nuevoCodigo.duracion_dias === '' ? null : Number(nuevoCodigo.duracion_dias)
    const usos = nuevoCodigo.usos_maximos === '' ? null : Number(nuevoCodigo.usos_maximos)
    const expira = nuevoCodigo.codigo_expira_en
      ? new Date(`${nuevoCodigo.codigo_expira_en}T23:59:59`).toISOString()
      : null

    const { error } = await supabase.rpc('admin_crear_codigo', {
      p_codigo: codigoLimpio,
      p_plan: nuevoCodigo.plan,
      p_duracion_dias: duracion,
      p_usos_maximos: usos,
      p_codigo_expira_en: expira,
      p_notas: nuevoCodigo.notas.trim() || null
    })

    if (error) {
      console.log(error)
      setMensaje('No se pudo crear el código. Puede que ya exista.')
      return
    }

    setMensaje(`Código ${codigoLimpio} creado correctamente.`)
    setNuevoCodigo({
      codigo: '',
      plan: 'premium',
      duracion_dias: '30',
      usos_maximos: '1',
      codigo_expira_en: '',
      notas: ''
    })
    cargarDatos()
  }

  const cambiarEstadoCodigo = async (codigo) => {
    const { error } = await supabase.rpc('admin_cambiar_estado_codigo', {
      p_codigo_id: codigo.id,
      p_activo: !codigo.activo
    })

    if (error) {
      console.log(error)
      setMensaje('No se pudo cambiar el estado del código.')
      return
    }

    setMensaje(codigo.activo ? 'Código desactivado.' : 'Código activado.')
    cargarDatos()
  }

  const procesarVencimientos = async () => {
    const { data, error } = await supabase.rpc('admin_procesar_planes_vencidos')

    if (error) {
      console.log(error)
      setMensaje('No se pudieron procesar los vencimientos.')
      return
    }

    const resultado = Array.isArray(data) ? data[0] : data
    const perfiles = Number(resultado?.perfiles_actualizados || 0)
    const subs = Number(resultado?.suscripciones_vencidas || 0)

    setMensaje(`Vencimientos procesados. Cuentas regresadas a Básico: ${perfiles}. Suscripciones marcadas como vencidas: ${subs}.`)
    window.dispatchEvent(new CustomEvent('planActualizado'))
    cargarDatos()
  }

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroPlan('todos')
    setFiltroEstado('todos')
  }

  if (cargando) {
    return (
      <Layout>
        <div className="loading">Cargando admin...</div>
      </Layout>
    )
  }

  if (!perfilActual?.es_admin) {
    return (
      <Layout>
        <div className="access-denied-card">
          <h1>Acceso no permitido</h1>
          <p>Esta sección solo está disponible para administradores.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page-header admin-main-header">
        <div>
          <h1>Admin Control</h1>
          <p>Control general de usuarios, planes, pagos manuales, códigos y actividad sin ver datos sensibles de clientes finales.</p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="btn btn-light-bordered" onClick={procesarVencimientos}>Procesar vencimientos</button>
          <button type="button" className="btn btn-light-bordered" onClick={cargarDatos}>Actualizar</button>
        </div>
      </div>

      {mensaje && <div className="admin-message">{mensaje}</div>}

      <div className="admin-tabs">
        <button type="button" className={tab === 'resumen' ? 'active' : ''} onClick={() => setTab('resumen')}>Resumen</button>
        <button type="button" className={tab === 'usuarios' ? 'active' : ''} onClick={() => setTab('usuarios')}>Usuarios</button>
        <button type="button" className={tab === 'pagos' ? 'active' : ''} onClick={() => setTab('pagos')}>Pagos</button>
        <button type="button" className={tab === 'suscripciones' ? 'active' : ''} onClick={() => setTab('suscripciones')}>Suscripciones</button>
        <button type="button" className={tab === 'codigos' ? 'active' : ''} onClick={() => setTab('codigos')}>Códigos</button>
        <button type="button" className={tab === 'alertas' ? 'active' : ''} onClick={() => setTab('alertas')}>Alertas</button>
      </div>

      {tab === 'resumen' && (
        <>
          <div className="cards-grid admin-summary-grid admin-summary-grid-wide">
            <div className="card"><span>Cuentas registradas</span><strong>{resumen.total}</strong></div>
            <div className="card"><span>Cuentas activas</span><strong>{resumen.activos}</strong></div>
            <div className="card"><span>Básico</span><strong>{resumen.basico}</strong></div>
            <div className="card"><span>Premium</span><strong>{resumen.premium}</strong></div>
            <div className="card"><span>Pro</span><strong>{resumen.pro}</strong></div>
            <div className="card"><span>Bloqueadas</span><strong>{resumen.bloqueadas}</strong></div>
            <div className="card"><span>Ingresos del mes</span><strong>{formatearDinero(resumen.ingresosMes)}</strong></div>
            <div className="card"><span>Pagos registrados</span><strong>{resumen.pagosRegistrados}</strong></div>
            <div className="card"><span>Suscripciones vencidas</span><strong>{resumen.suscripcionesVencidas}</strong></div>
          </div>

          <div className="admin-two-columns">
            <div className="table-card">
              <div className="table-title">
                <h2>Actividad de cuentas</h2>
                <p className="muted">Estos datos son del uso del sistema, no muestran clientes finales, teléfonos, direcciones ni productos.</p>
              </div>
              <div className="admin-mini-stats">
                <div><span>Nuevas hoy</span><strong>{resumen.nuevosHoy}</strong></div>
                <div><span>Nuevas 7 días</span><strong>{resumen.nuevos7}</strong></div>
                <div><span>Nuevas 30 días</span><strong>{resumen.nuevos30}</strong></div>
                <div><span>Pedidos usados total</span><strong>{resumen.pedidosUsados}</strong></div>
              </div>
            </div>

            <div className="table-card">
              <div className="table-title">
                <h2>Ventas manuales</h2>
                <p className="muted">Esto sí sale de pagos registrados en Admin. Después se conectará a Stripe o Mercado Pago.</p>
              </div>
              <div className="admin-mini-stats">
                <div><span>Hoy</span><strong>{formatearDinero(resumen.ingresosHoy)}</strong></div>
                <div><span>7 días</span><strong>{formatearDinero(resumen.ingresos7)}</strong></div>
                <div><span>Mes</span><strong>{formatearDinero(resumen.ingresosMes)}</strong></div>
                <div><span>Pendientes</span><strong>{resumen.pagosPendientes}</strong></div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'usuarios' && (
        <div className="table-card admin-users-card">
          <div className="table-title row-between">
            <div>
              <h2>Usuarios</h2>
              <p className="muted">Cambia planes manualmente, regala acceso, registra pagos y bloquea o desbloquea cuentas.</p>
            </div>
          </div>

          <div className="admin-filter-grid">
            <div className="form-field">
              <label>Buscar usuario</label>
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o correo" />
            </div>
            <div className="form-field">
              <label>Plan</label>
              <select value={filtroPlan} onChange={(e) => setFiltroPlan(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="basico">Básico</option>
                <option value="premium">Premium</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div className="form-field">
              <label>Estado</label>
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="bloqueados">Bloqueados</option>
                <option value="limite">Límite alcanzado</option>
                <option value="cerca_limite">Cerca del límite</option>
                <option value="por_vencer">Por vencer</option>
                <option value="vencidos">Vencidos</option>
              </select>
            </div>
            <button type="button" className="btn btn-light-bordered" onClick={limpiarFiltros}>Limpiar</button>
          </div>

          <div className="admin-users-list">
            {usuariosFiltrados.map((usuario) => (
              <div className="admin-user-card admin-user-card-improved" key={usuario.user_id}>
                <div>
                  <strong>{usuario.nombre || 'Usuario'}</strong>
                  <span>{usuario.correo}</span>
                  <div className="admin-user-badges">
                    <b className={`admin-chip admin-chip-${usuario.plan_actual}`}>{planTexto[usuario.plan_actual] || usuario.plan_actual}</b>
                    {usuario.es_admin && <b className="admin-chip admin-chip-admin">Admin</b>}
                    {usuario.cuenta_bloqueada && <b className="admin-chip admin-chip-danger">Bloqueada</b>}
                    {usuario.limite_alcanzado && <b className="admin-chip admin-chip-warning">Límite</b>}
                    {usuario.plan_vencido && <b className="admin-chip admin-chip-danger">Vencido</b>}
                  </div>
                </div>

                <div className="admin-user-meta">
                  <span>Origen: <b>{origenTexto[usuario.plan_origen] || usuario.plan_origen || '-'}</b></span>
                  <span>Vence: <b>{formatearFecha(usuario.plan_expira_en)}</b></span>
                  <span>Pedidos: <b>{usuario.pedidos_usados || 0}</b>{usuario.plan_actual === 'basico' ? ` / ${usuario.limite_pedidos || 30}` : ''}</span>
                  <span>Plataforma: <b>{usuario.plataforma_predeterminada || '-'}</b></span>
                  <span>Registro: <b>{formatearFechaCorta(usuario.creado_en)}</b></span>
                  <span>Estado: <b>{usuario.cuenta_bloqueada ? 'Bloqueada manual' : usuario.limite_alcanzado ? 'Límite alcanzado' : 'Activa'}</b></span>
                </div>

                <div className="admin-user-actions admin-user-actions-expanded">
                  <button type="button" className="btn btn-primary btn-small" onClick={() => abrirPagoManual(usuario, 'premium')}>Registrar pago</button>
                  <button type="button" className="btn btn-light-bordered btn-small" onClick={() => cambiarPlan(usuario, 'basico')}>Básico</button>
                  <button type="button" className="btn btn-light-bordered btn-small" onClick={() => cambiarPlan(usuario, 'premium')}>Premium sin vencer</button>
                  <button type="button" className="btn btn-light-bordered btn-small" onClick={() => cambiarPlan(usuario, 'premium', 30)}>Premium 30d</button>
                  <button type="button" className="btn btn-light-bordered btn-small" onClick={() => cambiarPlan(usuario, 'pro')}>Pro sin vencer</button>
                  <button type="button" className="btn btn-light-bordered btn-small" onClick={() => cambiarPlan(usuario, 'pro', 30)}>Pro 30d</button>
                  <button type="button" className={usuario.cuenta_bloqueada ? 'btn btn-primary btn-small' : 'btn btn-danger btn-small'} onClick={() => cambiarBloqueo(usuario)}>
                    {usuario.cuenta_bloqueada ? 'Desbloquear' : 'Bloquear'}
                  </button>
                </div>
              </div>
            ))}

            {usuariosFiltrados.length === 0 && <div className="empty-state">No se encontraron usuarios.</div>}
          </div>
        </div>
      )}

      {tab === 'pagos' && (
        <div className="table-card admin-payments-card">
          <div className="table-title row-between">
            <div>
              <h2>Pagos manuales</h2>
              <p className="muted">Registra pagos confirmados por transferencia, efectivo, depósito u otro método. Para registrar uno nuevo, ve a Usuarios y presiona “Registrar pago”.</p>
            </div>
          </div>

          <div className="cards-grid admin-payments-summary">
            <div className="card"><span>Ingresos hoy</span><strong>{formatearDinero(resumen.ingresosHoy)}</strong></div>
            <div className="card"><span>Ingresos 7 días</span><strong>{formatearDinero(resumen.ingresos7)}</strong></div>
            <div className="card"><span>Ingresos del mes</span><strong>{formatearDinero(resumen.ingresosMes)}</strong></div>
            <div className="card"><span>Pagos pendientes</span><strong>{resumen.pagosPendientes}</strong></div>
          </div>

          <div className="admin-subscriptions-list">
            {suscripciones.map((suscripcion) => (
              <div className="admin-subscription-card" key={suscripcion.id}>
                <div>
                  <strong>{suscripcion.nombre || 'Usuario'}</strong>
                  <span>{suscripcion.correo}</span>
                  <div className="admin-user-badges">
                    <b className={`admin-chip admin-chip-${suscripcion.plan}`}>{planTexto[suscripcion.plan] || suscripcion.plan}</b>
                    <b className={`admin-chip admin-payment-${suscripcion.estado_pago}`}>{estadoPagoTexto[suscripcion.estado_pago] || suscripcion.estado_pago}</b>
                  </div>
                </div>

                <div className="admin-user-meta">
                  <span>Monto: <b>{formatearDinero(suscripcion.monto)}</b></span>
                  <span>Método: <b>{suscripcion.metodo_pago}</b></span>
                  <span>Inicio: <b>{formatearFechaCorta(suscripcion.fecha_inicio)}</b></span>
                  <span>Vence: <b>{formatearFecha(suscripcion.fecha_fin)}</b></span>
                  <span>Origen: <b>{origenTexto[suscripcion.origen] || suscripcion.origen}</b></span>
                  <span>Creado: <b>{formatearFechaCorta(suscripcion.creado_en)}</b></span>
                </div>

                {suscripcion.notas && <p className="admin-payment-notes">{suscripcion.notas}</p>}

                <div className="admin-user-actions admin-payment-actions">
                  <button type="button" className="btn btn-light-bordered btn-small" onClick={() => actualizarEstadoSuscripcion(suscripcion, 'pagado')}>Pagado</button>
                  <button type="button" className="btn btn-light-bordered btn-small" onClick={() => actualizarEstadoSuscripcion(suscripcion, 'pendiente')}>Pendiente</button>
                  <button type="button" className="btn btn-light-bordered btn-small" onClick={() => actualizarEstadoSuscripcion(suscripcion, 'vencido')}>Vencido</button>
                  <button type="button" className="btn btn-danger btn-small" onClick={() => actualizarEstadoSuscripcion(suscripcion, 'cancelado')}>Cancelar</button>
                </div>
              </div>
            ))}

            {suscripciones.length === 0 && <div className="empty-state">Todavía no hay pagos manuales registrados.</div>}
          </div>
        </div>
      )}

      {tab === 'suscripciones' && (
        <div className="admin-two-columns">
          <div className="table-card">
            <div className="table-title">
              <h2>Suscripciones y accesos</h2>
              <p className="muted">Resumen de planes activos, vencimientos, accesos regalados, códigos y pagos manuales.</p>
            </div>
            <div className="admin-mini-stats">
              <div><span>Premium activos</span><strong>{resumen.premiumActivos}</strong></div>
              <div><span>Pro activos</span><strong>{resumen.proActivos}</strong></div>
              <div><span>Sin vencimiento</span><strong>{resumen.sinVencimiento}</strong></div>
              <div><span>Por vencer</span><strong>{resumen.porVencer}</strong></div>
              <div><span>Vencidos</span><strong>{resumen.vencidos}</strong></div>
              <div><span>Bloqueadas</span><strong>{resumen.bloqueadas}</strong></div>
            </div>
          </div>

          <div className="table-card">
            <div className="table-title">
              <h2>Ingresos</h2>
              <p className="muted">Ingresos reales registrados manualmente y cálculo aproximado de suscripciones activas.</p>
            </div>
            <div className="admin-price-row">
              <div className="form-field"><label>Precio Premium</label><input value={precios.premium} onChange={(e) => setPrecios({ ...precios, premium: e.target.value })} /></div>
              <div className="form-field"><label>Precio Pro</label><input value={precios.pro} onChange={(e) => setPrecios({ ...precios, pro: e.target.value })} /></div>
            </div>
            <div className="admin-revenue-box">
              <span>Ingreso manual del mes</span>
              <strong>{formatearDinero(resumen.ingresosMes)}</strong>
              <p>Estimado recurrente: {formatearDinero(resumen.ingresoEstimado)} con {resumen.premiumActivos} Premium y {resumen.proActivos} Pro activos.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'codigos' && (
        <div className="table-card admin-codes-card">
          <div className="table-title">
            <h2>Códigos canjeables</h2>
            <p className="muted">Crea códigos para desbloquear Premium o Pro por días, meses o sin vencimiento.</p>
          </div>

          <form className="admin-code-form" onSubmit={crearCodigo}>
            <div className="form-field"><label>Código</label><input value={nuevoCodigo.codigo} onChange={(e) => setNuevoCodigo({ ...nuevoCodigo, codigo: e.target.value.toUpperCase() })} placeholder="PREMIUM30 o VIP-PRO" /></div>
            <div className="form-field"><label>Plan</label><select value={nuevoCodigo.plan} onChange={(e) => setNuevoCodigo({ ...nuevoCodigo, plan: e.target.value })}><option value="premium">Premium</option><option value="pro">Pro</option></select></div>
            <div className="form-field"><label>Duración</label><input type="number" min="1" value={nuevoCodigo.duracion_dias} onChange={(e) => setNuevoCodigo({ ...nuevoCodigo, duracion_dias: e.target.value })} placeholder="Vacío = no vence" /></div>
            <div className="form-field"><label>Usos máximos</label><input type="number" min="1" value={nuevoCodigo.usos_maximos} onChange={(e) => setNuevoCodigo({ ...nuevoCodigo, usos_maximos: e.target.value })} placeholder="Vacío = ilimitado" /></div>
            <div className="form-field"><label>Vence código</label><input type="date" value={nuevoCodigo.codigo_expira_en} onChange={(e) => setNuevoCodigo({ ...nuevoCodigo, codigo_expira_en: e.target.value })} /></div>
            <div className="form-field admin-code-notes"><label>Notas internas</label><input value={nuevoCodigo.notas} onChange={(e) => setNuevoCodigo({ ...nuevoCodigo, notas: e.target.value })} placeholder="Regalo, campaña, cliente VIP..." /></div>
            <button type="submit" className="btn btn-primary">Crear código</button>
          </form>

          <div className="admin-codes-list">
            {codigos.map((codigo) => (
              <div className="admin-code-card" key={codigo.id}>
                <div><strong>{codigo.codigo}</strong><span>{planTexto[codigo.plan]} · {planDuracionTexto(codigo.duracion_dias)}</span></div>
                <div className="admin-code-meta">
                  <span>Usos: <b>{codigo.usos_actuales || 0} / {codigo.usos_maximos || 'Ilimitado'}</b></span>
                  <span>Vence código: <b>{formatearFecha(codigo.codigo_expira_en)}</b></span>
                  <span>Estado: <b>{codigo.activo ? 'Activo' : 'Inactivo'}</b></span>
                  {codigo.notas && <span>Notas: <b>{codigo.notas}</b></span>}
                </div>
                <button type="button" className={codigo.activo ? 'btn btn-danger btn-small' : 'btn btn-primary btn-small'} onClick={() => cambiarEstadoCodigo(codigo)}>{codigo.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            ))}
            {codigos.length === 0 && <div className="empty-state">Aún no has creado códigos.</div>}
          </div>
        </div>
      )}

      {tab === 'alertas' && (
        <div className="table-card">
          <div className="table-title">
            <h2>Alertas</h2>
            <p className="muted">Aquí aparecen usuarios cerca del límite, planes vencidos, planes por vencer, pagos pendientes y códigos agotados.</p>
          </div>
          <div className="admin-alerts-list">
            {alertas.map((alerta, index) => (
              <div className={`admin-alert-card admin-alert-${alerta.nivel}`} key={`${alerta.tipo}-${index}`}>
                <strong>{alerta.tipo}</strong>
                <span>{alerta.detalle}</span>
              </div>
            ))}
            {alertas.length === 0 && <div className="empty-state">No hay alertas importantes por ahora.</div>}
          </div>
        </div>
      )}

      <Modal abierto={Boolean(usuarioPago)} titulo="Registrar pago manual" onClose={cerrarPagoManual}>
        {usuarioPago && (
          <form className="modal-form-grid manual-payment-form" onSubmit={registrarPagoManual}>
            <div className="manual-payment-user">
              <span>Usuario</span>
              <strong>{usuarioPago.nombre || 'Usuario'}</strong>
              <p>{usuarioPago.correo}</p>
            </div>

            <div className="form-field">
              <label>Plan a activar</label>
              <select
                value={pagoManual.plan}
                onChange={(e) => setPagoManual({
                  ...pagoManual,
                  plan: e.target.value,
                  monto: e.target.value === 'pro' ? '99.99' : '59.99'
                })}
              >
                <option value="premium">Premium</option>
                <option value="pro">Pro</option>
              </select>
            </div>

            <div className="form-field">
              <label>Monto pagado</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={pagoManual.monto}
                onChange={(e) => setPagoManual({ ...pagoManual, monto: e.target.value })}
                placeholder="Ej. 59.99"
              />
            </div>

            <div className="form-field">
              <label>Método de pago</label>
              <select value={pagoManual.metodo_pago} onChange={(e) => setPagoManual({ ...pagoManual, metodo_pago: e.target.value })}>
                <option value="transferencia">Transferencia</option>
                <option value="deposito">Depósito</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta_externa">Tarjeta externa</option>
                <option value="mercado_pago_manual">Mercado Pago manual</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div className="form-field">
              <label>Duración en días</label>
              <input
                type="number"
                min="1"
                value={pagoManual.duracion_dias}
                onChange={(e) => setPagoManual({ ...pagoManual, duracion_dias: e.target.value })}
                placeholder="30, 90, 365..."
                disabled={pagoManual.sin_vencimiento}
              />
            </div>

            <label className="manual-check-row">
              <input
                type="checkbox"
                checked={pagoManual.sin_vencimiento}
                onChange={(e) => setPagoManual({ ...pagoManual, sin_vencimiento: e.target.checked })}
              />
              <span>Sin vencimiento</span>
            </label>

            <div className="form-field">
              <label>Notas internas</label>
              <textarea
                value={pagoManual.notas}
                onChange={(e) => setPagoManual({ ...pagoManual, notas: e.target.value })}
                placeholder="Ej. Pago confirmado por WhatsApp, transferencia BBVA, promoción..."
                rows="3"
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-light-bordered" onClick={cerrarPagoManual}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={guardandoPago}>
                {guardandoPago ? 'Guardando...' : 'Registrar y activar'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  )
}
