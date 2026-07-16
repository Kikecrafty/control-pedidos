import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import AdminSoporte from '../components/AdminSoporte'
import AdminReferidos from '../components/AdminReferidos'
import { supabase } from '../supabaseClient'
import '../styles/32-admin-registro-real.css'
import {
  calcularVencimientoConDias,
  crearCsvPagos,
  fechaContablePago,
  filtrarPagosPorPeriodo,
  resumirPagos
} from '../lib/adminControl'

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

const formatearFechaHora = (fecha) => {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
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
  const [auditoria, setAuditoria] = useState([])
  const [canjes, setCanjes] = useState([])
  const [alertasGestion, setAlertasGestion] = useState([])
  const [estadoSistema, setEstadoSistema] = useState([])
  const [adminV2, setAdminV2] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroPlan, setFiltroPlan] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busquedaPago, setBusquedaPago] = useState('')
  const [filtroPagoEstado, setFiltroPagoEstado] = useState('todos')
  const [periodoPagos, setPeriodoPagos] = useState('mes')
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
  const [usuarioDias, setUsuarioDias] = useState(null)
  const [diasAgregar, setDiasAgregar] = useState('30')
  const [guardandoDias, setGuardandoDias] = useState(false)
  const [usuarioNota, setUsuarioNota] = useState(null)
  const [notaAdmin, setNotaAdmin] = useState('')
  const [guardandoNota, setGuardandoNota] = useState(false)
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [pagoManual, setPagoManual] = useState({
    plan: 'premium',
    monto: '59.99',
    metodo_pago: 'transferencia',
    duracion_dias: '30',
    sin_vencimiento: false,
    pagado_en: new Date().toISOString().slice(0, 10),
    referencia_pago: '',
    comision: '0',
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
      const [
        usuariosV2,
        codigosResultado,
        suscripcionesV2,
        auditoriaResultado,
        canjesResultado,
        alertasGestionResultado,
        sistemaResultado,
        catalogoResultado
      ] = await Promise.all([
        supabase.rpc('admin_usuarios_resumen_v2'),
        supabase.rpc('admin_listar_codigos'),
        supabase.rpc('admin_listar_suscripciones_v2'),
        supabase.rpc('admin_listar_auditoria', { p_limite: 250, p_user_id: null }),
        supabase.rpc('admin_listar_canjes'),
        supabase.rpc('admin_listar_alertas_gestion'),
        supabase.rpc('admin_estado_sistema'),
        supabase.from('catalogo_planes').select('*').order('precio_mxn')
      ])

      let usuariosData = usuariosV2.data
      let suscripcionesData = suscripcionesV2.data
      let usuariosError = usuariosV2.error
      let suscripcionesError = suscripcionesV2.error
      const tieneV2 = !usuariosV2.error && !suscripcionesV2.error

      if (!tieneV2) {
        const [usuariosAnteriores, suscripcionesAnteriores] = await Promise.all([
          supabase.rpc('admin_usuarios_resumen'),
          supabase.rpc('admin_listar_suscripciones')
        ])
        usuariosData = usuariosAnteriores.data
        usuariosError = usuariosAnteriores.error
        suscripcionesData = suscripcionesAnteriores.data
        suscripcionesError = suscripcionesAnteriores.error
      }

      if (usuariosError) {
        console.log(usuariosError)
        setMensaje('No se pudo cargar el resumen admin. Revisa que hayas ejecutado el SQL de planes y bloqueo.')
      }

      if (codigosResultado.error) {
        console.log(codigosResultado.error)
        setMensaje('No se pudieron cargar los códigos. Revisa que hayas ejecutado el SQL de códigos canjeables.')
      }

      if (suscripcionesError) {
        console.log(suscripcionesError)
        setMensaje('No se pudieron cargar los pagos manuales. Revisa que hayas ejecutado el SQL de suscripciones.')
      }

      setUsuarios(usuariosData || [])
      setCodigos(codigosResultado.data || [])
      setSuscripciones(suscripcionesData || [])
      setAdminV2(tieneV2)
      setAuditoria(auditoriaResultado.data || [])
      setCanjes(canjesResultado.data || [])
      setAlertasGestion(alertasGestionResultado.data || [])
      setEstadoSistema(sistemaResultado.data || [])

      if (!catalogoResultado.error && catalogoResultado.data?.length) {
        const catalogoPorPlan = Object.fromEntries(catalogoResultado.data.map((item) => [item.plan, item]))
        setPrecios({
          premium: String(catalogoPorPlan.premium?.precio_mxn ?? '59.99'),
          pro: String(catalogoPorPlan.pro?.precio_mxn ?? '99.99')
        })
      }
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
    const pagosMes = pagosPagados.filter((s) => new Date(fechaContablePago(s)) >= inicioMes)
    const pagosHoy = pagosPagados.filter((s) => new Date(fechaContablePago(s)) >= hoy)
    const pagos7 = pagosPagados.filter((s) => new Date(fechaContablePago(s)) >= hace7)
    const contabilidadPeriodo = resumirPagos(filtrarPagosPorPeriodo(suscripciones, periodoPagos))

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
      suscripcionesVencidas: suscripciones.filter((s) => s.estado_pago === 'vencido').length,
      contabilidadPeriodo
    }
  }, [usuarios, codigos, suscripciones, precios, periodoPagos])

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

  const pagosFiltrados = useMemo(() => {
    const texto = busquedaPago.trim().toLowerCase()
    const porPeriodo = filtrarPagosPorPeriodo(suscripciones, periodoPagos)

    return porPeriodo.filter((pago) => {
      const coincideEstado = filtroPagoEstado === 'todos' || pago.estado_pago === filtroPagoEstado
      const coincideTexto = !texto || [
        pago.nombre,
        pago.correo,
        pago.folio_pago,
        pago.referencia_pago,
        pago.metodo_pago
      ].some((valor) => String(valor || '').toLowerCase().includes(texto))

      return coincideEstado && coincideTexto
    })
  }, [suscripciones, periodoPagos, busquedaPago, filtroPagoEstado])

  const alertas = useMemo(() => {
    return [
      ...usuarios.filter((u) => u.limite_alcanzado).map((u) => ({
        clave: `limite:${u.user_id}`,
        tipo: 'Límite alcanzado',
        detalle: `${u.nombre || u.correo} llegó a ${u.pedidos_usados || 0}/${u.limite_pedidos || 30} pedidos.`,
        nivel: 'alto'
      })),
      ...usuarios.filter((u) => u.plan_actual === 'basico' && Number(u.pedidos_usados || 0) >= 25 && !u.limite_alcanzado).map((u) => ({
        clave: `cerca-limite:${u.user_id}`,
        tipo: 'Cerca del límite',
        detalle: `${u.nombre || u.correo} va en ${u.pedidos_usados || 0}/${u.limite_pedidos || 30} pedidos.`,
        nivel: 'medio'
      })),
      ...usuarios.filter((u) => estaPorVencer(u.plan_expira_en, 7)).map((u) => ({
        clave: `plan-por-vencer:${u.user_id}`,
        tipo: 'Plan por vencer',
        detalle: `${u.nombre || u.correo} vence el ${formatearFechaCorta(u.plan_expira_en)}.`,
        nivel: 'medio'
      })),
      ...usuarios.filter((u) => u.plan_vencido).map((u) => ({
        clave: `plan-vencido:${u.user_id}`,
        tipo: 'Plan vencido',
        detalle: `${u.nombre || u.correo} tiene un plan vencido.`,
        nivel: 'alto'
      })),
      ...suscripciones.filter((s) => s.estado_pago === 'pendiente').map((s) => ({
        clave: `pago-pendiente:${s.id}`,
        tipo: 'Pago pendiente',
        detalle: `${s.nombre || s.correo} tiene un pago pendiente por ${formatearDinero(s.monto)}.`,
        nivel: 'medio'
      })),
      ...suscripciones.filter((s) => s.estado_pago === 'vencido').map((s) => ({
        clave: `suscripcion-vencida:${s.id}`,
        tipo: 'Suscripción vencida',
        detalle: `${s.nombre || s.correo} tenía ${planTexto[s.plan] || s.plan} y venció el ${formatearFechaCorta(s.fecha_fin)}.`,
        nivel: 'alto'
      })),
      ...codigos.filter((c) => c.usos_maximos && Number(c.usos_actuales || 0) >= Number(c.usos_maximos)).map((c) => ({
        clave: `codigo-agotado:${c.id}`,
        tipo: 'Código agotado',
        detalle: `${c.codigo} ya llegó a sus usos máximos.`,
        nivel: 'bajo'
      }))
    ]
  }, [usuarios, codigos, suscripciones])

  const gestionAlertasPorClave = useMemo(() => new Map(
    alertasGestion.map((gestion) => [gestion.alerta_clave, gestion])
  ), [alertasGestion])

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
      pagado_en: new Date().toISOString().slice(0, 10),
      referencia_pago: '',
      comision: '0',
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

    const comision = Number(pagoManual.comision || 0)
    if (comision < 0 || comision > monto) {
      setGuardandoPago(false)
      setMensaje('La comisión debe estar entre $0 y el monto pagado.')
      return
    }

    const parametrosBase = {
      p_user_id: usuarioPago.user_id,
      p_plan: pagoManual.plan,
      p_monto: monto,
      p_metodo_pago: pagoManual.metodo_pago,
      p_duracion_dias: duracion,
      p_sin_vencimiento: Boolean(pagoManual.sin_vencimiento),
      p_notas: pagoManual.notas.trim() || null
    }

    const { data, error } = adminV2
      ? await supabase.rpc('admin_registrar_pago_manual_v2', {
        ...parametrosBase,
        p_pagado_en: new Date(`${pagoManual.pagado_en}T12:00:00`).toISOString(),
        p_referencia_pago: pagoManual.referencia_pago.trim() || null,
        p_comision: comision
      })
      : await supabase.rpc('admin_registrar_pago_manual', parametrosBase)

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
    const { error } = adminV2
      ? await supabase.rpc('admin_actualizar_estado_suscripcion_v2', {
        p_suscripcion_id: suscripcion.id,
        p_estado_pago: estado,
        p_motivo: estado === 'reembolsado' ? 'Marcado manualmente desde Admin Control' : null
      })
      : await supabase.rpc('admin_actualizar_estado_suscripcion', {
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

  const abrirSumarDias = (usuario) => {
    setUsuarioDias(usuario)
    setDiasAgregar('30')
  }

  const sumarDiasUsuario = async (event) => {
    event.preventDefault()
    if (!usuarioDias || guardandoDias) return

    const dias = Number(diasAgregar)
    if (!Number.isInteger(dias) || dias < 1 || dias > 3650) {
      setMensaje('Escribe una cantidad de días entre 1 y 3650.')
      return
    }

    setGuardandoDias(true)
    const { data, error } = await supabase.rpc('admin_agregar_dias_usuario', {
      p_user_id: usuarioDias.user_id,
      p_dias: dias
    })
    setGuardandoDias(false)

    if (error) {
      console.log(error)
      setMensaje(error.message || 'No se pudieron agregar los días.')
      return
    }

    const resultado = Array.isArray(data) ? data[0] : data
    setMensaje(`${resultado?.mensaje || `Se agregaron ${dias} días.`} Nuevo vencimiento: ${formatearFecha(resultado?.vence_en)}.`)
    setUsuarioDias(null)
    window.dispatchEvent(new CustomEvent('planActualizado'))
    cargarDatos()
  }

  const abrirNotaUsuario = (usuario) => {
    setUsuarioNota(usuario)
    setNotaAdmin(usuario.nota_admin || '')
  }

  const guardarNotaUsuario = async (event) => {
    event.preventDefault()
    if (!usuarioNota || guardandoNota || !adminV2) return

    setGuardandoNota(true)
    const { error } = await supabase.rpc('admin_actualizar_nota_usuario', {
      p_user_id: usuarioNota.user_id,
      p_nota: notaAdmin.trim() || null
    })
    setGuardandoNota(false)

    if (error) {
      console.log(error)
      setMensaje('No se pudo guardar la nota administrativa.')
      return
    }

    setMensaje('Nota administrativa guardada.')
    setUsuarioNota(null)
    cargarDatos()
  }

  const guardarCatalogoPlanes = async () => {
    if (!adminV2) {
      setMensaje('La migración de registro administrativo debe aplicarse antes de guardar los precios.')
      return
    }

    const resultados = await Promise.all(['premium', 'pro'].map((plan) => supabase.rpc('admin_actualizar_catalogo_plan', {
      p_plan: plan,
      p_precio_mxn: Number(precios[plan] || 0),
      p_duracion_dias: 30,
      p_activo: true
    })))
    const error = resultados.find((resultado) => resultado.error)?.error

    if (error) {
      console.log(error)
      setMensaje('No se pudieron guardar los precios de los planes.')
      return
    }

    setMensaje('Precios de planes guardados en la base de datos.')
    cargarDatos()
  }

  const exportarPagos = () => {
    const csv = crearCsvPagos(pagosFiltrados)
    const archivo = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(archivo)
    enlace.download = `ordely-pagos-${new Date().toISOString().slice(0, 10)}.csv`
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  }

  const cambiarGestionAlerta = async (alerta) => {
    if (!adminV2) return
    const gestionActual = gestionAlertasPorClave.get(alerta.clave)
    const nuevoEstado = gestionActual?.estado === 'atendida' ? 'abierta' : 'atendida'
    const { error } = await supabase.rpc('admin_gestionar_alerta', {
      p_alerta_clave: alerta.clave,
      p_estado: nuevoEstado,
      p_notas: null
    })

    if (error) {
      console.log(error)
      setMensaje('No se pudo actualizar la alerta.')
      return
    }

    setMensaje(nuevoEstado === 'atendida' ? 'Alerta marcada como atendida.' : 'Alerta reabierta.')
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

      <div className={`admin-data-status ${adminV2 ? 'is-ready' : 'is-pending'}`}>
        <span aria-hidden="true" />
        <div>
          <strong>{adminV2 ? 'Registro administrativo completo activo' : 'Registro administrativo preparado en local'}</strong>
          <p>{adminV2
            ? 'Bitácora, pagos contables, catálogo y actividad están conectados a la base de datos.'
            : 'Sumar días ya funciona. Los folios, auditoría y datos contables se activarán cuando autorices aplicar la migración en Supabase.'}</p>
        </div>
      </div>

      <div className="admin-tabs">
        <button type="button" className={tab === 'resumen' ? 'active' : ''} onClick={() => setTab('resumen')}>Resumen</button>
        <button type="button" className={tab === 'usuarios' ? 'active' : ''} onClick={() => setTab('usuarios')}>Usuarios</button>
        <button type="button" className={tab === 'pagos' ? 'active' : ''} onClick={() => setTab('pagos')}>Pagos</button>
        <button type="button" className={tab === 'suscripciones' ? 'active' : ''} onClick={() => setTab('suscripciones')}>Suscripciones</button>
        <button type="button" className={tab === 'codigos' ? 'active' : ''} onClick={() => setTab('codigos')}>Códigos</button>
        <button type="button" className={tab === 'referidos' ? 'active' : ''} onClick={() => setTab('referidos')}>Referidos</button>
        <button type="button" className={tab === 'alertas' ? 'active' : ''} onClick={() => setTab('alertas')}>Alertas</button>
        <button type="button" className={tab === 'soporte' ? 'active' : ''} onClick={() => setTab('soporte')}>Soporte</button>
        <button type="button" className={tab === 'auditoria' ? 'active' : ''} onClick={() => setTab('auditoria')}>Auditoría</button>
        <button type="button" className={tab === 'sistema' ? 'active' : ''} onClick={() => setTab('sistema')}>Sistema</button>
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

          <div className="table-card admin-accounting-card">
            <div className="table-title row-between admin-accounting-title">
              <div>
                <h2>Registro contable</h2>
                <p className="muted">Separa dinero cobrado, comisiones, neto y reembolsos usando la fecha real de pago.</p>
              </div>
              <select value={periodoPagos} onChange={(event) => setPeriodoPagos(event.target.value)} aria-label="Periodo contable">
                <option value="hoy">Hoy</option>
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 90 días</option>
                <option value="mes">Mes actual</option>
                <option value="anio">Año actual</option>
                <option value="todo">Todo</option>
              </select>
            </div>
            <div className="admin-accounting-grid">
              <div><span>Cobrado bruto</span><strong>{formatearDinero(resumen.contabilidadPeriodo.bruto)}</strong></div>
              <div><span>Comisiones</span><strong>{formatearDinero(resumen.contabilidadPeriodo.comisiones)}</strong></div>
              <div className="is-net"><span>Ingreso neto</span><strong>{formatearDinero(resumen.contabilidadPeriodo.neto)}</strong></div>
              <div className="is-refund"><span>Reembolsos</span><strong>{formatearDinero(resumen.contabilidadPeriodo.reembolsos)}</strong></div>
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
                  {usuario.ultimo_acceso_en && <span>Último acceso: <b>{formatearFechaHora(usuario.ultimo_acceso_en)}</b></span>}
                  {usuario.ultima_actividad_en && <span>Última actividad: <b>{formatearFechaHora(usuario.ultima_actividad_en)}</b></span>}
                  {usuario.estado_suscripcion && <span>Suscripción: <b>{usuario.estado_suscripcion}</b></span>}
                  <span>Estado: <b>{usuario.cuenta_bloqueada ? 'Bloqueada manual' : usuario.limite_alcanzado ? 'Límite alcanzado' : 'Activa'}</b></span>
                  {usuario.nota_admin && <span className="admin-user-note">Nota: <b>{usuario.nota_admin}</b></span>}
                </div>

                <div className="admin-user-actions admin-user-actions-expanded">
                  <button type="button" className="btn btn-primary btn-small" onClick={() => abrirPagoManual(usuario, 'premium')}>Registrar pago</button>
                  {['premium', 'pro'].includes(usuario.plan_actual) && usuario.plan_expira_en && (
                    <button type="button" className="btn btn-add-days btn-small" onClick={() => abrirSumarDias(usuario)}>+ Sumar días</button>
                  )}
                  {adminV2 && <button type="button" className="btn btn-light-bordered btn-small" onClick={() => abrirNotaUsuario(usuario)}>Nota interna</button>}
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
              <h2>Registro de pagos</h2>
              <p className="muted">Pagos confirmados con folio, fecha contable, referencia, comisión, monto neto y estado.</p>
            </div>
            <button type="button" className="btn btn-light-bordered" onClick={exportarPagos} disabled={pagosFiltrados.length === 0}>Exportar CSV</button>
          </div>

          <div className="cards-grid admin-payments-summary">
            <div className="card"><span>Cobrado bruto</span><strong>{formatearDinero(resumen.contabilidadPeriodo.bruto)}</strong></div>
            <div className="card"><span>Comisiones</span><strong>{formatearDinero(resumen.contabilidadPeriodo.comisiones)}</strong></div>
            <div className="card"><span>Ingreso neto</span><strong>{formatearDinero(resumen.contabilidadPeriodo.neto)}</strong></div>
            <div className="card"><span>Reembolsos</span><strong>{formatearDinero(resumen.contabilidadPeriodo.reembolsos)}</strong></div>
          </div>

          <div className="admin-payment-filters">
            <div className="form-field">
              <label>Buscar</label>
              <input value={busquedaPago} onChange={(event) => setBusquedaPago(event.target.value)} placeholder="Usuario, correo, folio o referencia" />
            </div>
            <div className="form-field">
              <label>Periodo</label>
              <select value={periodoPagos} onChange={(event) => setPeriodoPagos(event.target.value)}>
                <option value="hoy">Hoy</option>
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 90 días</option>
                <option value="mes">Mes actual</option>
                <option value="anio">Año actual</option>
                <option value="todo">Todo</option>
              </select>
            </div>
            <div className="form-field">
              <label>Estado</label>
              <select value={filtroPagoEstado} onChange={(event) => setFiltroPagoEstado(event.target.value)}>
                <option value="todos">Todos</option>
                {Object.entries(estadoPagoTexto).map(([valor, etiqueta]) => <option value={valor} key={valor}>{etiqueta}</option>)}
              </select>
            </div>
          </div>

          <div className="admin-subscriptions-list">
            {pagosFiltrados.map((suscripcion) => (
              <div className="admin-subscription-card" key={suscripcion.id}>
                <div>
                  <strong>{suscripcion.nombre || 'Usuario'}</strong>
                  <span>{suscripcion.correo}</span>
                  <span className="admin-payment-folio">{suscripcion.folio_pago || `ID ${suscripcion.id.slice(0, 8).toUpperCase()}`}</span>
                  <div className="admin-user-badges">
                    <b className={`admin-chip admin-chip-${suscripcion.plan}`}>{planTexto[suscripcion.plan] || suscripcion.plan}</b>
                    <b className={`admin-chip admin-payment-${suscripcion.estado_pago}`}>{estadoPagoTexto[suscripcion.estado_pago] || suscripcion.estado_pago}</b>
                  </div>
                </div>

                <div className="admin-user-meta">
                  <span>Monto bruto: <b>{formatearDinero(suscripcion.monto)}</b></span>
                  <span>Comisión: <b>{formatearDinero(suscripcion.comision)}</b></span>
                  <span>Monto neto: <b>{formatearDinero(suscripcion.monto_neto ?? (Number(suscripcion.monto || 0) - Number(suscripcion.comision || 0)))}</b></span>
                  <span>Método: <b>{suscripcion.metodo_pago}</b></span>
                  {suscripcion.referencia_pago && <span>Referencia: <b>{suscripcion.referencia_pago}</b></span>}
                  <span>Pagado: <b>{formatearFechaCorta(fechaContablePago(suscripcion))}</b></span>
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
                  <button type="button" className="btn btn-light-bordered btn-small" onClick={() => actualizarEstadoSuscripcion(suscripcion, 'reembolsado')}>Reembolsado</button>
                  <button type="button" className="btn btn-danger btn-small" onClick={() => actualizarEstadoSuscripcion(suscripcion, 'cancelado')}>Cancelar</button>
                </div>
              </div>
            ))}

            {pagosFiltrados.length === 0 && <div className="empty-state">No hay pagos que coincidan con este periodo y filtros.</div>}
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
            <button type="button" className="btn btn-primary admin-save-prices" onClick={guardarCatalogoPlanes} disabled={!adminV2}>Guardar precios</button>
            {!adminV2 && <p className="admin-inline-warning">Estos precios solo se guardarán de forma permanente después de aplicar la migración preparada.</p>}
            <div className="admin-revenue-box">
              <span>Ingreso manual del mes</span>
              <strong>{formatearDinero(resumen.ingresosMes)}</strong>
              <p>Estimado recurrente: {formatearDinero(resumen.ingresoEstimado)} con {resumen.premiumActivos} Premium y {resumen.proActivos} Pro activos.</p>
            </div>
          </div>

          <div className="table-card admin-active-access-card">
            <div className="table-title">
              <h2>Accesos vigentes</h2>
              <p className="muted">La suscripción actual se controla por usuario; un pago es un movimiento contable separado.</p>
            </div>
            <div className="admin-access-list">
              {usuarios.filter((usuario) => ['premium', 'pro'].includes(usuario.plan_actual)).map((usuario) => (
                <div key={usuario.user_id}>
                  <span><strong>{usuario.nombre || usuario.correo}</strong><small>{usuario.correo}</small></span>
                  <b className={`admin-chip admin-chip-${usuario.plan_actual}`}>{planTexto[usuario.plan_actual]}</b>
                  <span>{formatearFecha(usuario.plan_expira_en)}</span>
                  <span>{origenTexto[usuario.plan_origen] || usuario.plan_origen || '-'}</span>
                </div>
              ))}
              {usuarios.every((usuario) => !['premium', 'pro'].includes(usuario.plan_actual)) && <div className="empty-state">No hay accesos Premium o Pro vigentes.</div>}
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

          <div className="admin-redemptions-section">
            <div className="table-title">
              <h3>Historial de canjes</h3>
              <p className="muted">Quién utilizó cada código, cuándo lo hizo y qué acceso recibió.</p>
            </div>
            <div className="admin-redemptions-list">
              {canjes.map((canje) => (
                <div key={canje.id}>
                  <strong>{canje.codigo}</strong>
                  <span>{canje.nombre || canje.correo || 'Usuario'}</span>
                  <span>{planTexto[canje.plan_otorgado] || canje.plan_otorgado}</span>
                  <span>{formatearFechaHora(canje.canjeado_en)}</span>
                  <span>Vence: {formatearFecha(canje.plan_expira_en)}</span>
                </div>
              ))}
              {canjes.length === 0 && <div className="empty-state">{adminV2 ? 'Todavía no hay canjes registrados.' : 'El detalle de canjes se activará con la migración administrativa.'}</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'referidos' && <AdminReferidos />}

      {tab === 'alertas' && (
        <div className="table-card">
          <div className="table-title">
            <h2>Alertas</h2>
            <p className="muted">Aquí aparecen usuarios cerca del límite, planes vencidos, planes por vencer, pagos pendientes y códigos agotados.</p>
          </div>
          <div className="admin-alerts-list">
            {alertas.map((alerta) => {
              const gestion = gestionAlertasPorClave.get(alerta.clave)
              const atendida = gestion?.estado === 'atendida'
              return (
                <div className={`admin-alert-card admin-alert-${alerta.nivel} ${atendida ? 'is-attended' : ''}`} key={alerta.clave}>
                  <div>
                    <strong>{alerta.tipo}</strong>
                    <span>{alerta.detalle}</span>
                    {atendida && <small>Atendida por {gestion.asignado_correo || 'administrador'} · {formatearFechaHora(gestion.atendida_en)}</small>}
                  </div>
                  {adminV2 && (
                    <button type="button" className="btn btn-light-bordered btn-small" onClick={() => cambiarGestionAlerta(alerta)}>
                      {atendida ? 'Reabrir' : 'Marcar atendida'}
                    </button>
                  )}
                </div>
              )
            })}
            {alertas.length === 0 && <div className="empty-state">No hay alertas importantes por ahora.</div>}
          </div>
        </div>
      )}

      {tab === 'soporte' && <AdminSoporte />}

      {tab === 'auditoria' && (
        <div className="table-card admin-audit-card">
          <div className="table-title row-between">
            <div>
              <h2>Bitácora administrativa</h2>
              <p className="muted">Historial inmutable de cambios de usuarios, pagos, códigos, soporte y precios.</p>
            </div>
            <button type="button" className="btn btn-light-bordered" onClick={cargarDatos}>Actualizar</button>
          </div>
          <div className="admin-audit-list">
            {auditoria.map((registro) => (
              <article key={registro.id}>
                <div>
                  <strong>{String(registro.accion || 'acción').replaceAll('_', ' ')}</strong>
                  <span>{formatearFechaHora(registro.creado_en)}</span>
                </div>
                <p>Realizó: <b>{registro.actor_correo || 'Administrador'}</b></p>
                {registro.usuario_afectado_correo && <p>Usuario: <b>{registro.usuario_afectado_correo}</b></p>}
                <small>{registro.entidad}{registro.entidad_id ? ` · ${registro.entidad_id}` : ''}</small>
              </article>
            ))}
            {auditoria.length === 0 && (
              <div className="empty-state">{adminV2
                ? 'Aún no hay acciones administrativas registradas.'
                : 'La bitácora comenzará a guardar acciones cuando se aplique la migración administrativa.'}</div>
            )}
          </div>
        </div>
      )}

      {tab === 'sistema' && (
        <div className="table-card admin-system-card">
          <div className="table-title row-between">
            <div>
              <h2>Estado e integridad del sistema</h2>
              <p className="muted">Comprobaciones para detectar pagos huérfanos, contadores desfasados, vencimientos pendientes y soporte abierto.</p>
            </div>
            <button type="button" className="btn btn-light-bordered" onClick={cargarDatos}>Comprobar ahora</button>
          </div>
          <div className="admin-system-grid">
            {estadoSistema.map((item) => (
              <article className={`is-${item.estado}`} key={item.clave}>
                <span>{String(item.clave).replaceAll('_', ' ')}</span>
                <strong>{item.valor}</strong>
                <p>{item.detalle}</p>
                <b>{item.estado}</b>
              </article>
            ))}
            {estadoSistema.length === 0 && (
              <div className="empty-state">{adminV2
                ? 'No se recibieron comprobaciones del sistema.'
                : 'Las comprobaciones automáticas se activarán al aplicar la migración administrativa.'}</div>
            )}
          </div>
        </div>
      )}

      <Modal abierto={Boolean(usuarioDias)} titulo="Sumar días a la vigencia" onClose={() => !guardandoDias && setUsuarioDias(null)}>
        {usuarioDias && (
          <form className="modal-form-grid admin-add-days-form" onSubmit={sumarDiasUsuario}>
            <div className="admin-period-preview">
              <span>Usuario</span>
              <strong>{usuarioDias.nombre || usuarioDias.correo}</strong>
              <p>Vencimiento actual: <b>{formatearFecha(usuarioDias.plan_expira_en)}</b></p>
              <p>Pedidos usados: <b>{usuarioDias.pedidos_usados || 0}</b> — este número no se reiniciará.</p>
            </div>
            <div className="form-field">
              <label>Días que quieres agregar</label>
              <input type="number" min="1" max="3650" step="1" value={diasAgregar} onChange={(event) => setDiasAgregar(event.target.value)} autoFocus />
            </div>
            <div className="admin-new-expiration">
              <span>Nuevo vencimiento estimado</span>
              <strong>{formatearFecha(calcularVencimientoConDias(usuarioDias.plan_expira_en, Number(diasAgregar)))}</strong>
              <p>Los días se cuentan desde la vigencia actual, no desde hoy.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-light-bordered" onClick={() => setUsuarioDias(null)} disabled={guardandoDias}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={guardandoDias}>{guardandoDias ? 'Agregando...' : `Agregar ${diasAgregar || 0} días`}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal abierto={Boolean(usuarioNota)} titulo="Nota administrativa" onClose={() => !guardandoNota && setUsuarioNota(null)}>
        {usuarioNota && (
          <form className="modal-form-grid" onSubmit={guardarNotaUsuario}>
            <div className="manual-payment-user">
              <span>Usuario</span>
              <strong>{usuarioNota.nombre || 'Usuario'}</strong>
              <p>{usuarioNota.correo}</p>
            </div>
            <div className="form-field">
              <label>Nota interna</label>
              <textarea rows="5" maxLength="2000" value={notaAdmin} onChange={(event) => setNotaAdmin(event.target.value)} placeholder="Seguimiento comercial, acuerdo, excepción o dato importante..." />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-light-bordered" onClick={() => setUsuarioNota(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={guardandoNota}>{guardandoNota ? 'Guardando...' : 'Guardar nota'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal abierto={Boolean(usuarioPago)} titulo="Registrar pago manual" onClose={cerrarPagoManual}>
        {usuarioPago && (
          <form className="modal-form-grid manual-payment-form" onSubmit={registrarPagoManual}>
            <div className="manual-payment-user">
              <span>Usuario</span>
              <strong>{usuarioPago.nombre || 'Usuario'}</strong>
              <p>{usuarioPago.correo}</p>
            </div>

            {adminV2 && usuarioPago.plan_actual === pagoManual.plan && usuarioPago.plan_expira_en && !pagoManual.sin_vencimiento && (
              <div className="admin-payment-extension-note">
                Este usuario ya tiene {planTexto[pagoManual.plan]}. Los días del nuevo pago se agregarán después de su vencimiento actual: <b>{formatearFecha(usuarioPago.plan_expira_en)}</b>.
              </div>
            )}

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

            {adminV2 && (
              <>
                <div className="form-field">
                  <label>Fecha real del pago</label>
                  <input type="date" value={pagoManual.pagado_en} onChange={(event) => setPagoManual({ ...pagoManual, pagado_en: event.target.value })} required />
                </div>
                <div className="form-field">
                  <label>Referencia o folio bancario</label>
                  <input value={pagoManual.referencia_pago} onChange={(event) => setPagoManual({ ...pagoManual, referencia_pago: event.target.value })} placeholder="Ej. BBVA-849201" maxLength="160" />
                </div>
                <div className="form-field">
                  <label>Comisión cobrada</label>
                  <input type="number" min="0" step="0.01" value={pagoManual.comision} onChange={(event) => setPagoManual({ ...pagoManual, comision: event.target.value })} />
                </div>
                <div className="admin-payment-net-preview">
                  <span>Ingreso neto</span>
                  <strong>{formatearDinero(Math.max(Number(pagoManual.monto || 0) - Number(pagoManual.comision || 0), 0))}</strong>
                </div>
              </>
            )}

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
