import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Modal from './Modal'
import { supabase } from '../supabaseClient'
import { cargarEstadoPlan, nombrePlan, resumenUsoPlan } from '../lib/planes'
import { PLATAFORMAS, PLATAFORMA_PREDETERMINADA } from '../lib/plataformas'


const formatosFecha = [
  { valor: 'dd/mm/yyyy', texto: 'dd/mm/aaaa' },
  { valor: 'yyyy/mm/dd', texto: 'aaaa/mm/dd' },
  { valor: 'mm/dd/yyyy', texto: 'mm/dd/aaaa' },
  { valor: 'dd-mm-yyyy', texto: 'dd-mm-aaaa' }
]

const FORMATOS_FECHA_VALIDOS = new Set(formatosFecha.map((formato) => formato.valor))

const normalizarFormatoFecha = (valor) => {
  return FORMATOS_FECHA_VALIDOS.has(valor) ? valor : 'dd/mm/yyyy'
}

const SECCIONES_CUENTA = [
  { id: 'perfil', titulo: 'Perfil', descripcion: 'Nombre y acceso', icono: 'user' },
  { id: 'negocio', titulo: 'Negocio y entregas', descripcion: 'Punto de entrega y tiempos', icono: 'store' },
  { id: 'preferencias', titulo: 'Preferencias', descripcion: 'Plataforma, fechas y organización', icono: 'settings' },
  { id: 'plan', titulo: 'Plan', descripcion: 'Vigencia y opciones', icono: 'diamond' }
]

function NavIcon({ name, className = '' }) {
  const commonProps = {
    className: `ordely-nav-icon ${className}`.trim(),
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  }

  if (name === 'home') {
    return (
      <svg {...commonProps}>
        <path d="M3.5 10.8 12 3.8l8.5 7" />
        <path d="M5.5 9.8V20h13V9.8" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    )
  }

  if (name === 'orders') {
    return (
      <svg {...commonProps}>
        <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    )
  }

  if (name === 'shopping') {
    return (
      <svg {...commonProps}>
        <path d="M5 8.5h14l-1 11H6l-1-11Z" />
        <path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" />
      </svg>
    )
  }

  if (name === 'users') {
    return (
      <svg {...commonProps}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.8 19a5.2 5.2 0 0 1 10.4 0" />
        <path d="M15.2 6.2a3 3 0 0 1 0 5.6M16.5 14.2A5 5 0 0 1 20.2 19" />
      </svg>
    )
  }

  if (name === 'chart') {
    return (
      <svg {...commonProps}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7 15 4-4 3 2 5-6" />
        <path d="M16 7h3v3" />
      </svg>
    )
  }

  if (name === 'shield') {
    return (
      <svg {...commonProps}>
        <path d="M12 3.5 19 6v5.2c0 4.3-2.7 7.4-7 9.3-4.3-1.9-7-5-7-9.3V6l7-2.5Z" />
        <path d="m9.2 12 1.8 1.8 3.8-4" />
      </svg>
    )
  }

  if (name === 'help') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2" />
        <path d="M12 17h.01" />
      </svg>
    )
  }

  if (name === 'plus') {
    return (
      <svg {...commonProps}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  }

  if (name === 'more') {
    return (
      <svg {...commonProps}>
        <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (name === 'user') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    )
  }

  if (name === 'store') {
    return (
      <svg {...commonProps}>
        <path d="M4 9h16l-1.2-4.5H5.2L4 9Z" />
        <path d="M5 9v10h14V9" />
        <path d="M9 19v-5h6v5" />
        <path d="M4 9a3 3 0 0 0 5 2 3 3 0 0 0 6 0 3 3 0 0 0 5-2" />
      </svg>
    )
  }

  if (name === 'settings') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </svg>
    )
  }

  if (name === 'diamond') {
    return (
      <svg {...commonProps}>
        <path d="m12 3 8 9-8 9-8-9 8-9Z" />
        <path d="m8.5 8.5 3.5 8 3.5-8M4.8 12h14.4" />
      </svg>
    )
  }

  return null
}

const PLATAFORMAS_ACTIVAS_KEY = 'ordely_plataformas_activas'
const TIEMPOS_EXTRA_KEY = 'ordely_tiempos_plataformas_extra'

const CAMPOS_TIEMPO_PLATAFORMA = {
  SHEIN: 'tiempo_shein_dias',
  Temu: 'tiempo_temu_dias',
  AliExpress: 'tiempo_aliexpress_dias',
  'TikTok Shop': 'tiempo_tiktok_shop_dias',
  'Mercado Libre': 'tiempo_mercado_libre_dias',
  Amazon: 'tiempo_amazon_dias',
  Catálogo: 'tiempo_catalogo_dias',
  Otro: 'tiempo_otro_dias'
}

const TIEMPOS_PREDETERMINADOS = {
  SHEIN: 10,
  Temu: 14,
  AliExpress: 25,
  'TikTok Shop': 12,
  'Mercado Libre': 5,
  Amazon: 7,
  Catálogo: 7,
  Otro: 15
}

const leerJsonLocal = (llave, respaldo) => {
  if (typeof window === 'undefined') return respaldo

  try {
    const valor = localStorage.getItem(llave)
    return valor ? JSON.parse(valor) : respaldo
  } catch {
    return respaldo
  }
}

const leerPlataformasActivas = (metadata = null) => {
  const desdeCuenta = metadata?.ordely_plataformas_activas

  if (Array.isArray(desdeCuenta)) {
    const validasCuenta = desdeCuenta.filter((item) => PLATAFORMAS.includes(item))
    if (validasCuenta.length > 0) return validasCuenta
  }

  const guardadas = leerJsonLocal(PLATAFORMAS_ACTIVAS_KEY, null)

  if (Array.isArray(guardadas)) {
    const validas = guardadas.filter((item) => PLATAFORMAS.includes(item))
    if (validas.length > 0) return validas
  }

  return ['SHEIN', 'Temu', 'AliExpress', 'Catálogo']
}

const leerTiemposExtra = (metadata = null) => {
  const guardadosCuenta = metadata?.ordely_tiempos_extra || {}
  const guardadosLocales = leerJsonLocal(TIEMPOS_EXTRA_KEY, {})
  const guardados = { ...guardadosLocales, ...guardadosCuenta }

  return {
    tiempo_tiktok_shop_dias: Number(guardados?.tiempo_tiktok_shop_dias || TIEMPOS_PREDETERMINADOS['TikTok Shop']),
    tiempo_mercado_libre_dias: Number(guardados?.tiempo_mercado_libre_dias || TIEMPOS_PREDETERMINADOS['Mercado Libre']),
    tiempo_amazon_dias: Number(guardados?.tiempo_amazon_dias || TIEMPOS_PREDETERMINADOS.Amazon)
  }
}

const serializarCuenta = ({ nombre, plataforma, configuracion, plataformasActivas = [] }) => JSON.stringify({
  nombre: String(nombre || '').trim(),
  plataforma: plataforma || PLATAFORMA_PREDETERMINADA,
  configuracion: {
    tiempo_shein_dias: Number(configuracion?.tiempo_shein_dias || 10),
    tiempo_temu_dias: Number(configuracion?.tiempo_temu_dias || 14),
    tiempo_aliexpress_dias: Number(configuracion?.tiempo_aliexpress_dias || 25),
    tiempo_catalogo_dias: Number(configuracion?.tiempo_catalogo_dias || 7),
    tiempo_tiktok_shop_dias: Number(configuracion?.tiempo_tiktok_shop_dias || TIEMPOS_PREDETERMINADOS['TikTok Shop']),
    tiempo_mercado_libre_dias: Number(configuracion?.tiempo_mercado_libre_dias || TIEMPOS_PREDETERMINADOS['Mercado Libre']),
    tiempo_amazon_dias: Number(configuracion?.tiempo_amazon_dias || TIEMPOS_PREDETERMINADOS.Amazon),
    tiempo_otro_dias: Number(configuracion?.tiempo_otro_dias || 15),
    plataformas_activas: [...plataformasActivas].sort(),
    negocio_nombre: String(configuracion?.negocio_nombre || '').trim(),
    negocio_direccion: String(configuracion?.negocio_direccion || '').trim(),
    negocio_horario: String(configuracion?.negocio_horario || '').trim(),
    fecha_formato: normalizarFormatoFecha(configuracion?.fecha_formato),
    fecha_mostrar_anio: valorBooleanoConfig(configuracion?.fecha_mostrar_anio, true),
    pedidos_separar_por_fecha: valorBooleanoConfig(configuracion?.pedidos_separar_por_fecha, true)
  }
})

const guardarPreferenciasFechaLocal = ({ formato, mostrarAnio, separarPorFecha }) => {
  if (typeof window === 'undefined') return
  if (formato) localStorage.setItem('ordely_fecha_formato', normalizarFormatoFecha(formato))
  if (typeof mostrarAnio === 'boolean') localStorage.setItem('ordely_fecha_mostrar_anio', String(mostrarAnio))
  if (typeof separarPorFecha === 'boolean') localStorage.setItem('ordely_pedidos_separar_fecha', String(separarPorFecha))
}

const leerBooleanoPreferencia = (valor, predeterminado = true) => {
  if (valor === true || valor === 'true') return true
  if (valor === false || valor === 'false') return false
  return predeterminado
}

const leerPreferenciaLocal = (llave) => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(llave)
}

const valorBooleanoConfig = (valor, predeterminado = true) => {
  return leerBooleanoPreferencia(valor, predeterminado)
}

const PERFIL_CACHE_KEY = 'control_pedidos_perfil_cache'

const leerPerfilCache = () => {
  if (typeof window === 'undefined') return null

  try {
    const guardado = localStorage.getItem(PERFIL_CACHE_KEY)
    return guardado ? JSON.parse(guardado) : null
  } catch {
    return null
  }
}

const guardarPerfilCache = (perfil) => {
  if (typeof window === 'undefined' || !perfil) return

  try {
    localStorage.setItem(PERFIL_CACHE_KEY, JSON.stringify(perfil))
  } catch {
    // Si el navegador no permite guardar, simplemente seguimos sin cache.
  }
}

const ocultarImagenRota = (event) => {
  event.currentTarget.style.display = 'none'
}

const borrarPerfilCache = () => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PERFIL_CACHE_KEY)
}


const normalizarPlanKey = (plan) => {
  const valor = String(plan || 'basico').toLowerCase()

  if (valor.includes('pro')) return 'pro'
  if (valor.includes('premium')) return 'premium'

  return 'basico'
}

const formatearFechaCorta = (valor) => {
  if (!valor) return ''

  const fecha = new Date(valor)

  if (Number.isNaN(fecha.getTime())) return ''

  return fecha.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const calcularVigenciaPlan = (perfil) => {
  if (!perfil) return 'Sincronizando...'

  const planKey = normalizarPlanKey(perfil.plan_actual)
  const limite = Number(perfil.limite_pedidos || 0)
  const usados = Number(perfil.pedidos_usados || perfil.pedidos_creados || 0)

  if (perfil.plan_expira_en) {
    const expira = new Date(perfil.plan_expira_en)

    if (!Number.isNaN(expira.getTime())) {
      const ahora = new Date()
      const diferencia = expira.getTime() - ahora.getTime()
      const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24))
      const fechaTexto = formatearFechaCorta(perfil.plan_expira_en)

      if (dias < 0) return 'Plan vencido'
      if (dias === 0) return `Vence hoy${fechaTexto ? ` · ${fechaTexto}` : ''}`
      if (dias === 1) return `Vence mañana${fechaTexto ? ` · ${fechaTexto}` : ''}`

      return `Vence en ${dias} días${fechaTexto ? ` · ${fechaTexto}` : ''}`
    }
  }

  if (planKey === 'basico' && limite > 0) {
    const restantes = Math.max(limite - usados, 0)
    return `${restantes} pedidos disponibles`
  }

  return 'Sin vencimiento'
}

const obtenerPlataformaInicial = () => {
  if (typeof window === 'undefined') return PLATAFORMA_PREDETERMINADA

  const perfilCache = leerPerfilCache()

  return (
    perfilCache?.plataforma_predeterminada ||
    localStorage.getItem('plataforma_predeterminada') ||
    PLATAFORMA_PREDETERMINADA
  )
}

export default function Layout({ children }) {
  const location = useLocation()
  const perfilCacheInicial = useMemo(() => leerPerfilCache(), [])

  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [usuario, setUsuario] = useState(() => {
    if (!perfilCacheInicial?.correo) return null
    return { id: perfilCacheInicial.user_id, email: perfilCacheInicial.correo }
  })
  const [perfil, setPerfil] = useState(perfilCacheInicial)
  const [perfilCargando, setPerfilCargando] = useState(!perfilCacheInicial)
  const [plataformaPredeterminada, setPlataformaPredeterminada] = useState(obtenerPlataformaInicial)
  const [modalCuenta, setModalCuenta] = useState(false)
  const [confirmacionCerrarCuenta, setConfirmacionCerrarCuenta] = useState(false)
  const [nombreCuenta, setNombreCuenta] = useState('')
  const [guardandoCuenta, setGuardandoCuenta] = useState(false)
  const [mensajeCuenta, setMensajeCuenta] = useState(null)
  const [seccionCuenta, setSeccionCuenta] = useState('perfil')
  const [snapshotCuenta, setSnapshotCuenta] = useState('')
  const [plataformasActivas, setPlataformasActivas] = useState(leerPlataformasActivas)
  const [configEntrega, setConfigEntrega] = useState(() => ({
    tiempo_shein_dias: 10,
    tiempo_temu_dias: 14,
    tiempo_aliexpress_dias: 25,
    tiempo_catalogo_dias: 7,
    ...leerTiemposExtra(),
    tiempo_otro_dias: 15,
    negocio_nombre: '',
    negocio_direccion: '',
    negocio_horario: '',
    fecha_formato: typeof window !== 'undefined' ? normalizarFormatoFecha(localStorage.getItem('ordely_fecha_formato')) : 'dd/mm/yyyy',
    fecha_mostrar_anio: typeof window !== 'undefined' ? leerBooleanoPreferencia(localStorage.getItem('ordely_fecha_mostrar_anio'), true) : true,
    pedidos_separar_por_fecha: typeof window !== 'undefined' ? leerBooleanoPreferencia(localStorage.getItem('ordely_pedidos_separar_fecha'), true) : true
  }))

  useEffect(() => {
    cargarCuenta()

    const { data } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        cargarCuenta()
      }, 0)
    })

    const actualizarPlan = () => cargarCuenta()
    window.addEventListener('planActualizado', actualizarPlan)

    return () => {
      data.subscription.unsubscribe()
      window.removeEventListener('planActualizado', actualizarPlan)
    }
  }, [])

  useEffect(() => {
    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') {
        setDrawerAbierto(false)
      }
    }

    document.addEventListener('keydown', cerrarConEscape)

    return () => {
      document.removeEventListener('keydown', cerrarConEscape)
    }
  }, [])

  useEffect(() => {
    if (!modalCuenta) return

    const nombreInicial = perfil?.nombre || datosCuenta.nombre || ''
    const tiemposExtra = leerTiemposExtra(usuario?.user_metadata)
    const plataformasActivasIniciales = leerPlataformasActivas(usuario?.user_metadata)
    const configuracionInicial = {
      tiempo_shein_dias: Number(perfil?.tiempo_shein_dias || 10),
      tiempo_temu_dias: Number(perfil?.tiempo_temu_dias || 14),
      tiempo_aliexpress_dias: Number(perfil?.tiempo_aliexpress_dias || 25),
      tiempo_catalogo_dias: Number(perfil?.tiempo_catalogo_dias || 7),
      ...tiemposExtra,
      tiempo_otro_dias: Number(perfil?.tiempo_otro_dias || 15),
      negocio_nombre: perfil?.negocio_nombre || '',
      negocio_direccion: perfil?.negocio_direccion || '',
      negocio_horario: perfil?.negocio_horario || '',
      fecha_formato: normalizarFormatoFecha(leerPreferenciaLocal('ordely_fecha_formato') || perfil?.fecha_formato),
      fecha_mostrar_anio: leerPreferenciaLocal('ordely_fecha_mostrar_anio') !== null
        ? leerBooleanoPreferencia(leerPreferenciaLocal('ordely_fecha_mostrar_anio'), true)
        : (typeof perfil?.fecha_mostrar_anio === 'boolean' ? perfil.fecha_mostrar_anio : true),
      pedidos_separar_por_fecha: leerPreferenciaLocal('ordely_pedidos_separar_fecha') !== null
        ? leerBooleanoPreferencia(leerPreferenciaLocal('ordely_pedidos_separar_fecha'), true)
        : (typeof perfil?.pedidos_separar_por_fecha === 'boolean' ? perfil.pedidos_separar_por_fecha : true)
    }

    setNombreCuenta(nombreInicial)
    setConfigEntrega(configuracionInicial)
    setPlataformasActivas(plataformasActivasIniciales)
    setConfirmacionCerrarCuenta(false)
    setSeccionCuenta('perfil')
    setSnapshotCuenta(serializarCuenta({
      nombre: nombreInicial,
      plataforma: plataformaPredeterminada,
      configuracion: configuracionInicial,
      plataformasActivas: plataformasActivasIniciales
    }))

    guardarPreferenciasFechaLocal({
      formato: configuracionInicial.fecha_formato,
      mostrarAnio: configuracionInicial.fecha_mostrar_anio,
      separarPorFecha: configuracionInicial.pedidos_separar_por_fecha
    })
    setMensajeCuenta(null)
    // Se reinicia únicamente al abrir o cerrar el modal para no sobrescribir cambios en edición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalCuenta])

  const cargarCuenta = async () => {
    const cacheActual = leerPerfilCache()

    if (cacheActual) {
      setPerfil(cacheActual)
      setUsuario((actual) => actual || { id: cacheActual.user_id, email: cacheActual.correo })
      setPlataformaPredeterminada(cacheActual.plataforma_predeterminada || PLATAFORMA_PREDETERMINADA)
    } else {
      setPerfilCargando(true)
    }

    const { data } = await supabase.auth.getUser()
    const user = data?.user || null
    setUsuario(user)

    if (!user) {
      setPerfil(null)
      setPerfilCargando(false)
      borrarPerfilCache()
      return
    }

    // Si el cache pertenece a otra cuenta, no lo usamos.
    if (cacheActual?.user_id && cacheActual.user_id !== user.id) {
      setPerfil(null)
      setPerfilCargando(true)
    }

    const perfilData = await cargarEstadoPlan()

    if (perfilData) {
      setPerfil(perfilData)
      guardarPerfilCache(perfilData)

      if (perfilData.plataforma_predeterminada) {
        setPlataformaPredeterminada(perfilData.plataforma_predeterminada)
        localStorage.setItem('plataforma_predeterminada', perfilData.plataforma_predeterminada)
      }

      guardarPreferenciasFechaLocal({
        formato: normalizarFormatoFecha(perfilData.fecha_formato || leerPreferenciaLocal('ordely_fecha_formato')),
        mostrarAnio: typeof perfilData.fecha_mostrar_anio === 'boolean'
          ? perfilData.fecha_mostrar_anio
          : leerBooleanoPreferencia(leerPreferenciaLocal('ordely_fecha_mostrar_anio'), true),
        separarPorFecha: typeof perfilData.pedidos_separar_por_fecha === 'boolean'
          ? perfilData.pedidos_separar_por_fecha
          : leerBooleanoPreferencia(leerPreferenciaLocal('ordely_pedidos_separar_fecha'), true)
      })
    }

    setPerfilCargando(false)
  }

  const datosCuenta = useMemo(() => {
    const email = perfil?.correo || usuario?.email || 'Sin correo registrado'
    const nombreDesdeCorreo = email.includes('@') ? email.split('@')[0] : 'Usuario'

    const hayPerfil = Boolean(perfil)

    return {
      nombre: hayPerfil ? (perfil?.nombre || nombreDesdeCorreo || 'Usuario') : 'Cargando cuenta...',
      email: hayPerfil ? email : 'Sincronizando datos...',
      plan: hayPerfil ? nombrePlan(perfil?.plan_actual) : 'Cargando...',
      planKey: hayPerfil ? normalizarPlanKey(perfil?.plan_actual) : 'basico',
      esAdmin: perfil?.es_admin === true,
      bloqueada: perfil?.cuenta_bloqueada === true || (perfil?.puede_modificar === false && perfil?.limite_alcanzado !== true),
      uso: hayPerfil ? resumenUsoPlan(perfil) : 'Cargando plan...',
      vigencia: hayPerfil ? calcularVigenciaPlan(perfil) : 'Sincronizando...',
      fechaExpira: hayPerfil ? formatearFechaCorta(perfil?.plan_expira_en) : '',
      cargandoSinCache: perfilCargando && !hayPerfil
    }
  }, [perfil, usuario, perfilCargando])

  const cerrarSesion = async () => {
    borrarPerfilCache()
    localStorage.removeItem('plataforma_predeterminada')
    Object.keys(localStorage)
      .filter((key) => key.startsWith('control_pedidos_'))
      .forEach((key) => localStorage.removeItem(key))
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const cambiarPlataformaPredeterminada = async (valor) => {
    const valorAnterior = plataformaPredeterminada
    const perfilAnterior = perfil
    setPlataformaPredeterminada(valor)
    localStorage.setItem('plataforma_predeterminada', valor)

    const perfilActualizado = perfil ? {
      ...perfil,
      plataforma_predeterminada: valor
    } : perfil

    if (perfilActualizado) {
      setPerfil(perfilActualizado)
      guardarPerfilCache(perfilActualizado)
    }

    window.dispatchEvent(
      new CustomEvent('plataformaPredeterminadaCambiada', {
        detail: valor
      })
    )

    const { error } = await supabase.rpc('actualizar_mi_plataforma', {
      p_plataforma: valor
    })

    if (error) {
      console.log(error)
      setPlataformaPredeterminada(valorAnterior)
      localStorage.setItem('plataforma_predeterminada', valorAnterior)
      if (perfilAnterior) {
        setPerfil(perfilAnterior)
        guardarPerfilCache(perfilAnterior)
      }
      window.dispatchEvent(
        new CustomEvent('plataformaPredeterminadaCambiada', {
          detail: valorAnterior
        })
      )
      return
    }
  }

  const navClass = ({ isActive }) => {
    return isActive ? 'nav-link active' : 'nav-link'
  }

  const bottomNavClass = ({ isActive }) => {
    return isActive ? 'bottom-nav-link active' : 'bottom-nav-link'
  }

  const rutasDentroDeMas = ['/clientes', '/estadisticas', '/planes', '/ayuda-soporte', '/admin-control']
  const masSeleccionado = drawerAbierto || rutasDentroDeMas.some((ruta) => location.pathname.startsWith(ruta))

  const cerrarDrawer = () => setDrawerAbierto(false)

  const estadoCuentaActual = useMemo(() => serializarCuenta({
    nombre: nombreCuenta,
    plataforma: plataformaPredeterminada,
    configuracion: configEntrega,
    plataformasActivas
  }), [nombreCuenta, plataformaPredeterminada, configEntrega, plataformasActivas])

  const hayCambiosCuenta = Boolean(snapshotCuenta && estadoCuentaActual !== snapshotCuenta)

  const cerrarCuenta = () => {
    if (guardandoCuenta) return

    if (hayCambiosCuenta) {
      setConfirmacionCerrarCuenta(true)
      return
    }

    setModalCuenta(false)
  }

  const cerrarCuentaSinGuardar = () => {
    setConfirmacionCerrarCuenta(false)
    setModalCuenta(false)
  }

  const textoMejoraPlan = datosCuenta.planKey === 'basico'
    ? 'Mejorar a Premium'
    : datosCuenta.planKey === 'premium'
      ? 'Mejorar a Pro'
      : ''

  const abrirCuenta = () => {
    setNombreCuenta(perfil?.nombre || datosCuenta.nombre || '')
    setMensajeCuenta(null)
    setSeccionCuenta('perfil')
    setModalCuenta(true)
  }

  const actualizarConfigEntrega = (campo, valor) => {
    const esBooleano = campo === 'fecha_mostrar_anio' || campo === 'pedidos_separar_por_fecha'
    const valorNormalizado = esBooleano ? valorBooleanoConfig(valor, true) : valor

    setConfigEntrega((actual) => {
      const siguiente = { ...actual, [campo]: valorNormalizado }

      if (campo === 'fecha_formato' || campo === 'fecha_mostrar_anio' || campo === 'pedidos_separar_por_fecha') {
        guardarPreferenciasFechaLocal({
          formato: normalizarFormatoFecha(siguiente.fecha_formato),
          mostrarAnio: valorBooleanoConfig(siguiente.fecha_mostrar_anio, true),
          separarPorFecha: valorBooleanoConfig(siguiente.pedidos_separar_por_fecha, true)
        })

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ordelyConfigFechasActualizada'))
        }
      }

      return siguiente
    })
  }

  const alternarPlataformaActiva = (plataforma) => {
    setPlataformasActivas((actuales) => {
      if (actuales.includes(plataforma)) {
        return actuales.filter((item) => item !== plataforma)
      }

      return [...actuales, plataforma]
    })
  }

  const obtenerCampoTiempo = (plataforma) => CAMPOS_TIEMPO_PLATAFORMA[plataforma] || 'tiempo_otro_dias'

  const obtenerTiempoPlataforma = (plataforma) => {
    const campo = obtenerCampoTiempo(plataforma)
    return configEntrega[campo] ?? TIEMPOS_PREDETERMINADOS[plataforma] ?? 15
  }

  const normalizarDiasConfig = (valor, respaldo) => {
    const numero = Number(valor)
    if (!Number.isFinite(numero) || numero <= 0) return respaldo
    return Math.min(Math.round(numero), 120)
  }

  const guardarNombreCuenta = async (event) => {
    event.preventDefault()

    if (guardandoCuenta) return

    const nombreLimpio = nombreCuenta.trim()

    if (!nombreLimpio) {
      setMensajeCuenta({ tipo: 'error', texto: 'Escribe un nombre válido.' })
      return
    }

    if (!usuario?.id && !perfil?.user_id) {
      setMensajeCuenta({ tipo: 'error', texto: 'No se pudo identificar la cuenta.' })
      return
    }

    setGuardandoCuenta(true)
    setMensajeCuenta(null)

    const userId = usuario?.id || perfil?.user_id
    const tiemposExtraNormalizados = {
      tiempo_tiktok_shop_dias: normalizarDiasConfig(configEntrega.tiempo_tiktok_shop_dias, TIEMPOS_PREDETERMINADOS['TikTok Shop']),
      tiempo_mercado_libre_dias: normalizarDiasConfig(configEntrega.tiempo_mercado_libre_dias, TIEMPOS_PREDETERMINADOS['Mercado Libre']),
      tiempo_amazon_dias: normalizarDiasConfig(configEntrega.tiempo_amazon_dias, TIEMPOS_PREDETERMINADOS.Amazon)
    }

    const { error } = await supabase
      .from('perfiles')
      .update({
        nombre: nombreLimpio,
        tiempo_shein_dias: normalizarDiasConfig(configEntrega.tiempo_shein_dias, 10),
        tiempo_temu_dias: normalizarDiasConfig(configEntrega.tiempo_temu_dias, 14),
        tiempo_aliexpress_dias: normalizarDiasConfig(configEntrega.tiempo_aliexpress_dias, 25),
        tiempo_catalogo_dias: normalizarDiasConfig(configEntrega.tiempo_catalogo_dias, 7),
        tiempo_otro_dias: normalizarDiasConfig(configEntrega.tiempo_otro_dias, 15),
        negocio_nombre: String(configEntrega.negocio_nombre || '').trim(),
        negocio_direccion: String(configEntrega.negocio_direccion || '').trim(),
        negocio_horario: String(configEntrega.negocio_horario || '').trim(),
        fecha_formato: normalizarFormatoFecha(configEntrega.fecha_formato),
        fecha_mostrar_anio: valorBooleanoConfig(configEntrega.fecha_mostrar_anio, true),
        pedidos_separar_por_fecha: valorBooleanoConfig(configEntrega.pedidos_separar_por_fecha, true),
        actualizado_en: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) {
      console.log(error)
      setMensajeCuenta({ tipo: 'error', texto: 'No se pudo guardar el nombre.' })
      setGuardandoCuenta(false)
      return
    }

    const perfilActualizado = perfil ? {
      ...perfil,
      nombre: nombreLimpio,
      tiempo_shein_dias: normalizarDiasConfig(configEntrega.tiempo_shein_dias, 10),
      tiempo_temu_dias: normalizarDiasConfig(configEntrega.tiempo_temu_dias, 14),
      tiempo_aliexpress_dias: normalizarDiasConfig(configEntrega.tiempo_aliexpress_dias, 25),
      tiempo_catalogo_dias: normalizarDiasConfig(configEntrega.tiempo_catalogo_dias, 7),
      tiempo_otro_dias: normalizarDiasConfig(configEntrega.tiempo_otro_dias, 15),
      negocio_nombre: String(configEntrega.negocio_nombre || '').trim(),
      negocio_direccion: String(configEntrega.negocio_direccion || '').trim(),
      negocio_horario: String(configEntrega.negocio_horario || '').trim(),
      fecha_formato: normalizarFormatoFecha(configEntrega.fecha_formato),
      fecha_mostrar_anio: valorBooleanoConfig(configEntrega.fecha_mostrar_anio, true),
      pedidos_separar_por_fecha: valorBooleanoConfig(configEntrega.pedidos_separar_por_fecha, true),
      actualizado_en: new Date().toISOString()
    } : perfil

    if (perfilActualizado) {
      setPerfil(perfilActualizado)
      guardarPerfilCache(perfilActualizado)
    }

    guardarPreferenciasFechaLocal({
      formato: normalizarFormatoFecha(configEntrega.fecha_formato),
      mostrarAnio: valorBooleanoConfig(configEntrega.fecha_mostrar_anio, true),
      separarPorFecha: valorBooleanoConfig(configEntrega.pedidos_separar_por_fecha, true)
    })

    if (typeof window !== 'undefined') {
      localStorage.setItem(PLATAFORMAS_ACTIVAS_KEY, JSON.stringify(plataformasActivas))
      localStorage.setItem(TIEMPOS_EXTRA_KEY, JSON.stringify(tiemposExtraNormalizados))
      window.dispatchEvent(new CustomEvent('ordelyPlataformasConfiguradas', {
        detail: {
          plataformasActivas,
          tiempos: tiemposExtraNormalizados
        }
      }))
      window.dispatchEvent(new Event('ordelyConfigFechasActualizada'))
    }

    const { data: usuarioActualizado, error: errorMetadata } = await supabase.auth.updateUser({
      data: {
        ordely_plataformas_activas: plataformasActivas,
        ordely_tiempos_extra: tiemposExtraNormalizados
      }
    })

    if (errorMetadata) {
      console.log('No se pudo sincronizar la configuración adicional de plataformas:', errorMetadata)
    } else if (usuarioActualizado?.user) {
      setUsuario(usuarioActualizado.user)
    }

    setSnapshotCuenta(serializarCuenta({
      nombre: nombreLimpio,
      plataforma: plataformaPredeterminada,
      configuracion: {
        ...configEntrega,
        tiempo_shein_dias: normalizarDiasConfig(configEntrega.tiempo_shein_dias, 10),
        tiempo_temu_dias: normalizarDiasConfig(configEntrega.tiempo_temu_dias, 14),
        tiempo_aliexpress_dias: normalizarDiasConfig(configEntrega.tiempo_aliexpress_dias, 25),
        tiempo_catalogo_dias: normalizarDiasConfig(configEntrega.tiempo_catalogo_dias, 7),
        ...tiemposExtraNormalizados,
        tiempo_otro_dias: normalizarDiasConfig(configEntrega.tiempo_otro_dias, 15)
      },
      plataformasActivas
    }))
    setMensajeCuenta({ tipo: 'success', texto: 'Cambios guardados correctamente.' })
    setGuardandoCuenta(false)
  }

  const MobilePlanPanel = () => (
    <div className={`drawer-plan-card drawer-plan-card-${datosCuenta.planKey}`}>
      <div className="drawer-plan-card-top">
        <span>Plan actual</span>
        <strong>{datosCuenta.plan}</strong>
      </div>

      <div className="drawer-plan-card-grid">
        <div>
          <span>Uso</span>
          <strong>{datosCuenta.uso}</strong>
        </div>

        <div>
          <span>Vigencia</span>
          <strong>{datosCuenta.vigencia}</strong>
        </div>
      </div>

      {datosCuenta.bloqueada && (
        <div className="drawer-plan-warning">
          Límite alcanzado
        </div>
      )}

      {textoMejoraPlan && (
        <Link to="/planes" className="account-plan-upgrade-button drawer-plan-upgrade-button" onClick={cerrarDrawer}>
          {textoMejoraPlan}
        </Link>
      )}
    </div>
  )



  const renderCuentaModal = () => {
    const limitePedidos = Number(perfil?.limite_pedidos || 0)
    const pedidosUsados = Number(perfil?.pedidos_usados || perfil?.pedidos_creados || 0)
    const porcentajeUso = limitePedidos > 0
      ? Math.min(Math.round((pedidosUsados / limitePedidos) * 100), 100)
      : 0
    const mostrarAvisoPlan = datosCuenta.bloqueada || (limitePedidos > 0 && porcentajeUso >= 80)

    return (
      <Modal
        abierto={modalCuenta}
        titulo="Mi cuenta y configuración"
        onClose={cerrarCuenta}
        className="account-settings-modal-v59"
      >
        <form className="account-details-modal account-settings-v59" onSubmit={guardarNombreCuenta}>
          <header className="account-v59-identity">
            <div className="account-v59-avatar">
              <img src="/brand/ordely-icon.png" alt="" onError={ocultarImagenRota} />
            </div>
            <div className="account-v59-identity-copy">
              <span>Cuenta de Ordely</span>
              <strong>{datosCuenta.nombre}</strong>
              <small>{datosCuenta.email}</small>
            </div>
            <span className={`account-settings-plan-chip account-settings-plan-${datosCuenta.planKey}`}>
              {datosCuenta.plan}
            </span>
          </header>

          <div className="account-v59-layout">
            <nav className="account-v59-nav" aria-label="Secciones de configuración">
              {SECCIONES_CUENTA.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={seccionCuenta === item.id ? 'account-v59-nav-button active' : 'account-v59-nav-button'}
                  onClick={() => {
                    setSeccionCuenta(item.id)
                    setMensajeCuenta(null)
                  }}
                >
                  <span className="account-v59-nav-icon"><NavIcon name={item.icono} /></span>
                  <span>
                    <strong>{item.titulo}</strong>
                    <small>{item.descripcion}</small>
                  </span>
                </button>
              ))}
            </nav>

            <section className="account-v59-content">
              {seccionCuenta === 'perfil' && (
                <div className="account-v59-section" key="perfil">
                  <div className="account-v59-section-heading">
                    <span>Perfil</span>
                    <h3>Tu información de acceso</h3>
                    <p>Actualiza el nombre que se muestra dentro de Ordely. El correo permanece vinculado a tu cuenta.</p>
                  </div>

                  <label className="form-field account-v59-wide-field">
                    <span>Nombre de usuario</span>
                    <input
                      type="text"
                      value={nombreCuenta}
                      onChange={(e) => setNombreCuenta(e.target.value)}
                      maxLength={80}
                      disabled={guardandoCuenta}
                      required
                    />
                  </label>

                  <div className="account-v59-info-grid">
                    <article>
                      <span>Correo</span>
                      <strong>{datosCuenta.email}</strong>
                      <small>Se utiliza para iniciar sesión y recuperar tu cuenta.</small>
                    </article>
                    <article>
                      <span>Rol</span>
                      <strong>{datosCuenta.esAdmin ? 'Administrador' : 'Usuario'}</strong>
                      <small>{datosCuenta.esAdmin ? 'Acceso a controles administrativos.' : 'Acceso normal al panel de Ordely.'}</small>
                    </article>
                  </div>
                </div>
              )}

              {seccionCuenta === 'negocio' && (
                <div className="account-v59-section" key="negocio">
                  <div className="account-v59-section-heading">
                    <span>Negocio y entregas</span>
                    <h3>Datos que facilitan tus entregas</h3>
                    <p>Configura el punto de entrega y los tiempos estimados que usa Ordely al calcular fechas.</p>
                  </div>

                  <div className="account-v59-subsection">
                    <div className="account-v59-subsection-heading">
                      <strong>Punto de entrega</strong>
                      <span>Opcional. Se muestra cuando un pedido queda listo para recoger.</span>
                    </div>
                    <div className="account-business-grid account-v59-business-grid">
                      <label className="form-field">
                        <span>Nombre del negocio</span>
                        <input value={configEntrega.negocio_nombre} onChange={(e) => actualizarConfigEntrega('negocio_nombre', e.target.value)} disabled={guardandoCuenta} placeholder="Ej. Kike Pedidos" />
                      </label>
                      <label className="form-field">
                        <span>Dirección o referencia</span>
                        <input value={configEntrega.negocio_direccion} onChange={(e) => actualizarConfigEntrega('negocio_direccion', e.target.value)} disabled={guardandoCuenta} placeholder="Calle, colonia o punto de referencia" />
                      </label>
                      <label className="form-field account-v59-wide-field">
                        <span>Horario</span>
                        <input value={configEntrega.negocio_horario} onChange={(e) => actualizarConfigEntrega('negocio_horario', e.target.value)} disabled={guardandoCuenta} placeholder="Ej. Lunes a sábado, 10:00 a 19:00" />
                      </label>
                    </div>
                  </div>

                  <div className="account-v59-subsection account-v59-platform-settings">
                    <div className="account-v59-subsection-heading">
                      <strong>¿Dónde haces tus pedidos?</strong>
                      <span>Activa únicamente las plataformas que utilizas. Ordely mostrará los tiempos solo de las seleccionadas.</span>
                    </div>

                    <div className="account-v59-platform-picker">
                      {PLATAFORMAS.map((plataforma) => {
                        const activa = plataformasActivas.includes(plataforma)

                        return (
                          <button
                            key={plataforma}
                            type="button"
                            className={activa ? 'account-v59-platform-option active' : 'account-v59-platform-option'}
                            onClick={() => alternarPlataformaActiva(plataforma)}
                            disabled={guardandoCuenta}
                            aria-pressed={activa}
                          >
                            <span className="account-v59-platform-check">{activa ? '✓' : '+'}</span>
                            <span>
                              <strong>{plataforma === 'Otro' ? 'Otra plataforma' : plataforma}</strong>
                              <small>{activa ? 'Activa para tus pedidos' : 'Toca para activar'}</small>
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="account-v59-time-config">
                      <div className="account-v59-time-config-heading">
                        <strong>Tiempo promedio de llegada</strong>
                        <span>¿En promedio cuántos días tarda cada plataforma desde que haces la compra?</span>
                      </div>

                      {plataformasActivas.length > 0 ? (
                        <div className="account-config-grid account-v59-time-grid">
                          {plataformasActivas.map((plataforma) => {
                            const campo = obtenerCampoTiempo(plataforma)

                            return (
                              <label className="form-field account-v59-platform-time" key={plataforma}>
                                <span>{plataforma === 'Otro' ? 'Otra plataforma' : plataforma}</span>
                                <div className="account-v59-days-input">
                                  <input
                                    type="number"
                                    min="1"
                                    max="120"
                                    step="1"
                                    inputMode="numeric"
                                    aria-label={`Días promedio de ${plataforma}`}
                                    value={String(obtenerTiempoPlataforma(plataforma) || TIEMPOS_PREDETERMINADOS[plataforma] || 15)}
                                    onChange={(e) => actualizarConfigEntrega(campo, e.target.value)}
                                    onBlur={(e) => {
                                      if (!e.target.value) {
                                        actualizarConfigEntrega(campo, TIEMPOS_PREDETERMINADOS[plataforma] || 15)
                                      }
                                    }}
                                    disabled={guardandoCuenta}
                                  />
                                  <em>días</em>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="account-v59-platform-empty">
                          <strong>Selecciona al menos una plataforma</strong>
                          <span>Cuando actives una, aquí aparecerá el campo para indicar sus días promedio.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {seccionCuenta === 'preferencias' && (
                <div className="account-v59-section" key="preferencias">
                  <div className="account-v59-section-heading">
                    <span>Preferencias</span>
                    <h3>Adapta Ordely a tu forma de trabajar</h3>
                    <p>Elige la plataforma que usas más y cómo quieres ver las fechas y la lista de pedidos.</p>
                  </div>

                  <label className="form-field account-v59-wide-field">
                    <span>Plataforma predeterminada</span>
                    <select
                      value={plataformaPredeterminada}
                      onChange={(e) => cambiarPlataformaPredeterminada(e.target.value)}
                      disabled={guardandoCuenta || datosCuenta.cargandoSinCache}
                    >
                      {PLATAFORMAS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                    <small className="account-v59-field-help">Aparecerá seleccionada automáticamente al crear un pedido.</small>
                  </label>

                  <div className="account-v59-preferences-grid">
                    <label className="form-field">
                      <span>Formato de fecha</span>
                      <select
                        value={configEntrega.fecha_formato}
                        onChange={(e) => actualizarConfigEntrega('fecha_formato', e.target.value)}
                        disabled={guardandoCuenta}
                      >
                        {formatosFecha.map((formato) => (
                          <option key={formato.valor} value={formato.valor}>{formato.texto}</option>
                        ))}
                      </select>
                    </label>

                    <label className="account-v59-toggle-card">
                      <div>
                        <strong>Mostrar año</strong>
                        <span>Incluye el año en todas las fechas.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={valorBooleanoConfig(configEntrega.fecha_mostrar_anio, true)}
                        onChange={(e) => actualizarConfigEntrega('fecha_mostrar_anio', e.target.checked)}
                        disabled={guardandoCuenta}
                      />
                    </label>

                    <label className="account-v59-toggle-card">
                      <div>
                        <strong>Agrupar pedidos por fecha</strong>
                        <span>Separa la lista por día de registro.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={valorBooleanoConfig(configEntrega.pedidos_separar_por_fecha, true)}
                        onChange={(e) => actualizarConfigEntrega('pedidos_separar_por_fecha', e.target.checked)}
                        disabled={guardandoCuenta}
                      />
                    </label>
                  </div>
                </div>
              )}

              {seccionCuenta === 'plan' && (
                <div className="account-v59-section" key="plan">
                  <div className="account-v59-section-heading">
                    <span>Plan</span>
                    <h3>Tu plan de Ordely</h3>
                    <p>Consulta la vigencia de tu plan y las opciones disponibles.</p>
                  </div>

                  <div className={`account-v59-plan-card account-v59-plan-${datosCuenta.planKey}`}>
                    <div className="account-v59-plan-head">
                      <div>
                        <span>Plan actual</span>
                        <strong>{datosCuenta.plan}</strong>
                      </div>
                      <span className="account-v59-plan-vigencia">{datosCuenta.vigencia}</span>
                    </div>

                    {mostrarAvisoPlan && (
                      <div className={datosCuenta.bloqueada ? 'account-v59-plan-notice danger' : 'account-v59-plan-notice'}>
                        <strong>{datosCuenta.bloqueada ? 'Alcanzaste el límite de tu plan' : 'Estás cerca del límite'}</strong>
                        <span>{datosCuenta.bloqueada ? 'Actualiza tu plan para continuar creando pedidos.' : 'Te avisamos con anticipación para que no se interrumpa tu trabajo.'}</span>
                      </div>
                    )}
                  </div>

                  <div className="account-v59-plan-actions">
                    {textoMejoraPlan && (
                      <Link to="/planes" className="btn btn-primary" onClick={() => setModalCuenta(false)}>
                        {textoMejoraPlan}
                      </Link>
                    )}
                    <Link to="/planes" className="btn btn-light-bordered" onClick={() => setModalCuenta(false)}>
                      Ver planes y precios
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>

          {mensajeCuenta && (
            <p className={mensajeCuenta.tipo === 'success' ? 'account-modal-message account-modal-message-success' : 'account-modal-message account-modal-message-error'}>
              {mensajeCuenta.texto}
            </p>
          )}

          <footer className="account-v59-footer">
            <div className={hayCambiosCuenta ? 'account-v59-save-state pending' : 'account-v59-save-state'}>
              <span />
              {hayCambiosCuenta ? 'Tienes cambios sin guardar' : 'Todo está guardado'}
            </div>
            <div className="modal-actions account-modal-actions">
              <button type="button" className="btn btn-light-bordered" onClick={cerrarCuenta} disabled={guardandoCuenta}>
                Cerrar
              </button>
              <button type="submit" className="btn btn-primary" disabled={guardandoCuenta || !hayCambiosCuenta}>
                {guardandoCuenta ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </footer>
        </form>

        {confirmacionCerrarCuenta && (
          <div className="account-v59-confirm-overlay" role="presentation" onClick={() => setConfirmacionCerrarCuenta(false)}>
            <div
              className="account-v59-confirm-card"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="account-v59-confirm-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="account-v59-confirm-icon">!</div>
              <div className="account-v59-confirm-copy">
                <span>Cambios sin guardar</span>
                <h3 id="account-v59-confirm-title">¿Salir sin guardar los cambios?</h3>
                <p>Los datos que modificaste en esta ventana se perderán.</p>
              </div>
              <div className="account-v59-confirm-actions">
                <button
                  type="button"
                  className="btn btn-light-bordered"
                  onClick={() => setConfirmacionCerrarCuenta(false)}
                >
                  Seguir editando
                </button>
                <button
                  type="button"
                  className="btn account-v59-discard-button"
                  onClick={cerrarCuentaSinGuardar}
                >
                  Cerrar sin guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    )
  }

  return (
    <div className="app-layout">
      {renderCuentaModal()}

      <aside className="sidebar desktop-sidebar">
        <div className="sidebar-main-area">
          <div className="brand ordely-sidebar-brand">
            <div className="ordely-sidebar-brand-main">
              <img src="/brand/ordely-icon.png" alt="" className="ordely-sidebar-icon" onError={ocultarImagenRota} />
              <div>
                <strong>Ordely</strong>
              </div>
            </div>
            <p>{datosCuenta.nombre}</p>
          </div>

          <Link to="/nuevo-pedido" className="sidebar-primary-action">
            <span className="sidebar-primary-icon"><NavIcon name="plus" /></span>
            Nuevo pedido
          </Link>

          <nav className="nav nav-simple">
            <NavLink to="/panel" className={navClass}><span className="nav-symbol"><NavIcon name="home" /></span>Inicio</NavLink>
            <NavLink to="/pedidos" className={navClass}><span className="nav-symbol"><NavIcon name="orders" /></span>Pedidos</NavLink>
            <NavLink to="/compras" className={navClass}><span className="nav-symbol"><NavIcon name="shopping" /></span>Compras</NavLink>
            <NavLink to="/clientes" className={navClass}><span className="nav-symbol"><NavIcon name="users" /></span>Clientes</NavLink>
            <NavLink to="/estadisticas" className={navClass}><span className="nav-symbol"><NavIcon name="chart" /></span>Estadísticas</NavLink>
            <NavLink to="/ayuda-soporte" className={navClass}><span className="nav-symbol"><NavIcon name="help" /></span>Ayuda y soporte</NavLink>

            {datosCuenta.esAdmin && (
              <NavLink to="/admin-control" className={navClass}><span className="nav-symbol"><NavIcon name="shield" /></span>Admin</NavLink>
            )}
          </nav>
        </div>

        <div className="sidebar-footer sidebar-footer-simple">
          <button type="button" className="sidebar-account-summary" onClick={abrirCuenta}>
            <span className={`sidebar-plan-dot sidebar-plan-dot-${datosCuenta.planKey}`} />
            <span>
              <strong>{datosCuenta.plan}</strong>
              <small>Mi cuenta y configuración</small>
            </span>
          </button>

          <button type="button" onClick={cerrarSesion} className="sidebar-logout-link">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="mobile-topbar account-mobile-topbar">
        <button
          type="button"
          className="hamburger-mobile"
          onClick={() => setDrawerAbierto(true)}
          aria-label="Abrir menú"
        >
          ☰
        </button>

        <div className="mobile-brand-account ordely-mobile-brand-account">
          <img src="/brand/ordely-icon.png" alt="" className="ordely-mobile-icon" onError={ocultarImagenRota} />
          <div>
            <strong>Ordely</strong>
            <span>{datosCuenta.nombre}</span>
          </div>
        </div>

        <span className={datosCuenta.bloqueada ? 'mobile-plan-chip mobile-plan-chip-warning' : 'mobile-plan-chip'}>
          {datosCuenta.plan}
        </span>
      </header>

      {drawerAbierto && (
        <button
          type="button"
          className="mobile-drawer-overlay"
          onClick={cerrarDrawer}
          aria-label="Cerrar menú"
        />
      )}

      <aside className={`mobile-drawer ${drawerAbierto ? 'mobile-drawer-open' : ''}`}>
        <div className="mobile-drawer-header ordely-drawer-brand">
          <div>
            <img src="/brand/ordely-icon.png" alt="" className="ordely-drawer-icon" onError={ocultarImagenRota} />
            <div>
              <strong>Ordely</strong>
              <p className="drawer-account-line">{datosCuenta.nombre}</p>
            </div>
          </div>

          <button
            type="button"
            className="drawer-close"
            onClick={cerrarDrawer}
            aria-label="Cerrar menú"
          >
            ×
          </button>
        </div>

        <Link to="/nuevo-pedido" className="drawer-primary-action" onClick={cerrarDrawer}>
          <NavIcon name="plus" /> Nuevo pedido
        </Link>

        <nav className="drawer-nav drawer-nav-simple">
          <NavLink to="/panel" className={navClass} onClick={cerrarDrawer}><span className="drawer-nav-icon"><NavIcon name="home" /></span>Inicio</NavLink>
          <NavLink to="/pedidos" className={navClass} onClick={cerrarDrawer}><span className="drawer-nav-icon"><NavIcon name="orders" /></span>Pedidos</NavLink>
          <NavLink to="/compras" className={navClass} onClick={cerrarDrawer}><span className="drawer-nav-icon"><NavIcon name="shopping" /></span>Compras</NavLink>
          <NavLink to="/clientes" className={navClass} onClick={cerrarDrawer}><span className="drawer-nav-icon"><NavIcon name="users" /></span>Clientes</NavLink>
          <NavLink to="/estadisticas" className={navClass} onClick={cerrarDrawer}><span className="drawer-nav-icon"><NavIcon name="chart" /></span>Estadísticas</NavLink>
          <NavLink to="/planes" className={navClass} onClick={cerrarDrawer}><span className="drawer-nav-icon"><NavIcon name="diamond" /></span>Plan y precios</NavLink>
          <NavLink to="/ayuda-soporte" className={navClass} onClick={cerrarDrawer}><span className="drawer-nav-icon"><NavIcon name="help" /></span>Ayuda y soporte</NavLink>

          {datosCuenta.esAdmin && (
            <NavLink to="/admin-control" className={navClass} onClick={cerrarDrawer}><span className="drawer-nav-icon"><NavIcon name="shield" /></span>Admin</NavLink>
          )}
        </nav>

        <button type="button" className="drawer-settings-button" onClick={() => { cerrarDrawer(); abrirCuenta() }}>
          <NavIcon name="settings" /> Mi cuenta y configuración
        </button>

        <MobilePlanPanel />

        <button type="button" onClick={cerrarSesion} className="btn btn-light drawer-logout">
          Cerrar sesión
        </button>
      </aside>

      <main className="main-content">
        {children}
      </main>

      <nav className="bottom-nav bottom-nav-five" aria-label="Navegación principal">
        <NavLink to="/panel" className={bottomNavClass}>
          <span className="bottom-nav-symbol"><NavIcon name="home" /></span>
          <span>Inicio</span>
        </NavLink>

        <NavLink to="/pedidos" className={bottomNavClass}>
          <span className="bottom-nav-symbol"><NavIcon name="orders" /></span>
          <span>Pedidos</span>
        </NavLink>

        <NavLink to="/nuevo-pedido" className={({ isActive }) => isActive ? 'bottom-nav-link bottom-nav-create active' : 'bottom-nav-link bottom-nav-create'}>
          <span className="bottom-nav-create-circle"><NavIcon name="plus" /></span>
          <span>Nuevo</span>
        </NavLink>

        <NavLink to="/compras" className={bottomNavClass}>
          <span className="bottom-nav-symbol"><NavIcon name="shopping" /></span>
          <span>Compras</span>
        </NavLink>

        <button type="button" className={`bottom-nav-link bottom-nav-more${masSeleccionado ? ' active' : ''}`} onClick={() => setDrawerAbierto(true)} aria-current={masSeleccionado ? 'page' : undefined}>
          <span className="bottom-nav-symbol"><NavIcon name="more" /></span>
          <span>Más</span>
        </button>
      </nav>
    </div>
  )
}
