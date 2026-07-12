import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Modal from './Modal'
import { supabase } from '../supabaseClient'
import { cargarEstadoPlan, nombrePlan, resumenUsoPlan } from '../lib/planes'

const plataformas = [
  'SHEIN',
  'Temu',
  'AliExpress',
  'Catálogo',
  'Otro'
]


const formatosFecha = [
  { valor: 'dd/mm/yyyy', texto: 'dd/mm/aaaa' },
  { valor: 'yyyy/mm/dd', texto: 'aaaa/mm/dd' },
  { valor: 'mm/dd/yyyy', texto: 'mm/dd/aaaa' },
  { valor: 'dd-mm-yyyy', texto: 'dd-mm-aaaa' },
  { valor: 'texto', texto: '10 de julio del 2026' }
]

const guardarPreferenciasFechaLocal = ({ formato, mostrarAnio, separarPorFecha }) => {
  if (typeof window === 'undefined') return
  if (formato) localStorage.setItem('ordely_fecha_formato', formato)
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
  if (typeof window === 'undefined') return 'SHEIN'

  const perfilCache = leerPerfilCache()

  return (
    perfilCache?.plataforma_predeterminada ||
    localStorage.getItem('plataforma_predeterminada') ||
    'SHEIN'
  )
}

export default function Layout({ children }) {
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
  const [nombreCuenta, setNombreCuenta] = useState('')
  const [guardandoCuenta, setGuardandoCuenta] = useState(false)
  const [mensajeCuenta, setMensajeCuenta] = useState(null)
  const [configEntrega, setConfigEntrega] = useState({
    tiempo_shein_dias: 10,
    tiempo_temu_dias: 14,
    tiempo_aliexpress_dias: 25,
    tiempo_catalogo_dias: 7,
    tiempo_otro_dias: 15,
    negocio_nombre: '',
    negocio_direccion: '',
    negocio_horario: '',
    fecha_formato: typeof window !== 'undefined' ? (localStorage.getItem('ordely_fecha_formato') || 'dd/mm/yyyy') : 'dd/mm/yyyy',
    fecha_mostrar_anio: typeof window !== 'undefined' ? leerBooleanoPreferencia(localStorage.getItem('ordely_fecha_mostrar_anio'), true) : true,
    pedidos_separar_por_fecha: typeof window !== 'undefined' ? leerBooleanoPreferencia(localStorage.getItem('ordely_pedidos_separar_fecha'), true) : true
  })

  useEffect(() => {
    cargarCuenta()

    const { data } = supabase.auth.onAuthStateChange(() => {
      cargarCuenta()
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

    setNombreCuenta(perfil?.nombre || datosCuenta.nombre || '')
    setConfigEntrega({
      tiempo_shein_dias: Number(perfil?.tiempo_shein_dias || 10),
      tiempo_temu_dias: Number(perfil?.tiempo_temu_dias || 14),
      tiempo_aliexpress_dias: Number(perfil?.tiempo_aliexpress_dias || 25),
      tiempo_catalogo_dias: Number(perfil?.tiempo_catalogo_dias || 7),
      tiempo_otro_dias: Number(perfil?.tiempo_otro_dias || 15),
      negocio_nombre: perfil?.negocio_nombre || '',
      negocio_direccion: perfil?.negocio_direccion || '',
      negocio_horario: perfil?.negocio_horario || '',
      fecha_formato: leerPreferenciaLocal('ordely_fecha_formato') || perfil?.fecha_formato || 'dd/mm/yyyy',
      fecha_mostrar_anio: leerPreferenciaLocal('ordely_fecha_mostrar_anio') !== null
        ? leerBooleanoPreferencia(leerPreferenciaLocal('ordely_fecha_mostrar_anio'), true)
        : (typeof perfil?.fecha_mostrar_anio === 'boolean' ? perfil.fecha_mostrar_anio : true),
      pedidos_separar_por_fecha: leerPreferenciaLocal('ordely_pedidos_separar_fecha') !== null
        ? leerBooleanoPreferencia(leerPreferenciaLocal('ordely_pedidos_separar_fecha'), true)
        : (typeof perfil?.pedidos_separar_por_fecha === 'boolean' ? perfil.pedidos_separar_por_fecha : true)
    })

    guardarPreferenciasFechaLocal({
      formato: leerPreferenciaLocal('ordely_fecha_formato') || perfil?.fecha_formato || 'dd/mm/yyyy',
      mostrarAnio: leerPreferenciaLocal('ordely_fecha_mostrar_anio') !== null
        ? leerBooleanoPreferencia(leerPreferenciaLocal('ordely_fecha_mostrar_anio'), true)
        : (typeof perfil?.fecha_mostrar_anio === 'boolean' ? perfil.fecha_mostrar_anio : true),
      separarPorFecha: leerPreferenciaLocal('ordely_pedidos_separar_fecha') !== null
        ? leerBooleanoPreferencia(leerPreferenciaLocal('ordely_pedidos_separar_fecha'), true)
        : (typeof perfil?.pedidos_separar_por_fecha === 'boolean' ? perfil.pedidos_separar_por_fecha : true)
    })
    setMensajeCuenta(null)
  }, [modalCuenta])

  const cargarCuenta = async () => {
    const cacheActual = leerPerfilCache()

    if (cacheActual) {
      setPerfil(cacheActual)
      setUsuario((actual) => actual || { id: cacheActual.user_id, email: cacheActual.correo })
      setPlataformaPredeterminada(cacheActual.plataforma_predeterminada || 'SHEIN')
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
        formato: perfilData.fecha_formato || leerPreferenciaLocal('ordely_fecha_formato') || 'dd/mm/yyyy',
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
      bloqueada: perfil?.cuenta_bloqueada === true || perfil?.limite_alcanzado === true || perfil?.plan_vencido === true,
      uso: hayPerfil ? resumenUsoPlan(perfil) : 'Cargando plan...',
      vigencia: hayPerfil ? calcularVigenciaPlan(perfil) : 'Sincronizando...',
      fechaExpira: hayPerfil ? formatearFechaCorta(perfil?.plan_expira_en) : '',
      cargandoSinCache: perfilCargando && !hayPerfil
    }
  }, [perfil, usuario, perfilCargando])

  const cerrarSesion = async () => {
    borrarPerfilCache()
    localStorage.removeItem('plataforma_predeterminada')
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const cambiarPlataformaPredeterminada = async (valor) => {
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
      return
    }
  }

  const navClass = ({ isActive }) => {
    return isActive ? 'nav-link active' : 'nav-link'
  }

  const bottomNavClass = ({ isActive }) => {
    return isActive ? 'bottom-nav-link active' : 'bottom-nav-link'
  }

  const cerrarDrawer = () => setDrawerAbierto(false)

  const textoMejoraPlan = datosCuenta.planKey === 'basico'
    ? 'Mejorar a Premium'
    : datosCuenta.planKey === 'premium'
      ? 'Mejorar a Pro'
      : ''

  const abrirCuenta = () => {
    setNombreCuenta(perfil?.nombre || datosCuenta.nombre || '')
    setMensajeCuenta(null)
    setModalCuenta(true)
  }

  const actualizarConfigEntrega = (campo, valor) => {
    const esBooleano = campo === 'fecha_mostrar_anio' || campo === 'pedidos_separar_por_fecha'
    const valorNormalizado = esBooleano ? valorBooleanoConfig(valor, true) : valor

    setConfigEntrega((actual) => {
      const siguiente = { ...actual, [campo]: valorNormalizado }

      if (campo === 'fecha_formato' || campo === 'fecha_mostrar_anio' || campo === 'pedidos_separar_por_fecha') {
        guardarPreferenciasFechaLocal({
          formato: siguiente.fecha_formato || 'dd/mm/yyyy',
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
        fecha_formato: configEntrega.fecha_formato || 'dd/mm/yyyy',
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
      fecha_formato: configEntrega.fecha_formato || 'dd/mm/yyyy',
      fecha_mostrar_anio: valorBooleanoConfig(configEntrega.fecha_mostrar_anio, true),
      pedidos_separar_por_fecha: valorBooleanoConfig(configEntrega.pedidos_separar_por_fecha, true),
      actualizado_en: new Date().toISOString()
    } : perfil

    if (perfilActualizado) {
      setPerfil(perfilActualizado)
      guardarPerfilCache(perfilActualizado)
    }

    guardarPreferenciasFechaLocal({
      formato: configEntrega.fecha_formato || 'dd/mm/yyyy',
      mostrarAnio: valorBooleanoConfig(configEntrega.fecha_mostrar_anio, true),
      separarPorFecha: valorBooleanoConfig(configEntrega.pedidos_separar_por_fecha, true)
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ordelyConfigFechasActualizada'))
    }

    setMensajeCuenta({ tipo: 'success', texto: 'Cuenta actualizada.' })
    setGuardandoCuenta(false)
  }

  const PlanPanel = ({ compacto = false }) => (
    <div className={`account-panel account-plan-card account-plan-card-${datosCuenta.planKey} ${compacto ? 'account-plan-card-compact' : ''}`}>
      <span className="account-plan-label">Plan actual</span>

      <div className="account-plan-head account-plan-head-simple">
        <strong>{datosCuenta.plan}</strong>
      </div>

      <div className="account-plan-summary">
        <span>Uso</span>
        <strong>{datosCuenta.uso}</strong>
      </div>

      <div className="account-plan-summary">
        <span>Vigencia</span>
        <strong>{datosCuenta.vigencia}</strong>
      </div>

      {datosCuenta.bloqueada && (
        <div className="account-limit-warning">
          Límite alcanzado
        </div>
      )}

      {textoMejoraPlan && (
        <Link to="/planes" className="account-plan-upgrade-button">
          {textoMejoraPlan}
        </Link>
      )}
    </div>
  )

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

  const PlataformaPanel = () => (
    <label className="sidebar-platform-panel">
      <span>Plataforma predeterminada</span>
      <select
        value={plataformaPredeterminada}
        onChange={(e) => cambiarPlataformaPredeterminada(e.target.value)}
        disabled={datosCuenta.cargandoSinCache}
      >
        {plataformas.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  )

  const renderCuentaModal = () => (
    <Modal
      abierto={modalCuenta}
      titulo="Mi cuenta"
      onClose={() => setModalCuenta(false)}
    >
      <form className="account-details-modal account-details-modal-edit" onSubmit={guardarNombreCuenta}>
        <div className="account-details-user">
          <img src="/brand/ordely-icon.png" alt="" onError={ocultarImagenRota} />
          <div>
            <strong>{datosCuenta.nombre}</strong>
            <span>{datosCuenta.email}</span>
          </div>
        </div>

        <label className="form-field account-name-edit-field">
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

        <div className="account-details-grid">
          <div>
            <span>Correo</span>
            <strong>{datosCuenta.email}</strong>
          </div>

          <div>
            <span>Plan</span>
            <strong>{datosCuenta.plan}</strong>
          </div>

          <div>
            <span>Uso</span>
            <strong>{datosCuenta.uso}</strong>
          </div>

          <div>
            <span>Vigencia</span>
            <strong>{datosCuenta.vigencia}</strong>
          </div>

          <div>
            <span>Plataforma predeterminada</span>
            <strong>{plataformaPredeterminada}</strong>
          </div>

          <div>
            <span>Rol</span>
            <strong>{datosCuenta.esAdmin ? 'Administrador' : 'Usuario'}</strong>
          </div>
        </div>


        <div className="account-config-section">
          <div className="account-config-heading">
            <strong>Tiempos de llegada</strong>
            <span>Ordely usa estos días para calcular si un producto posiblemente ya llegó.</span>
          </div>

          <div className="account-config-grid">
            <label className="form-field">
              <span>SHEIN</span>
              <input
                type="number"
                min="1"
                max="120"
                value={configEntrega.tiempo_shein_dias}
                onChange={(e) => actualizarConfigEntrega('tiempo_shein_dias', e.target.value)}
                disabled={guardandoCuenta}
              />
            </label>

            <label className="form-field">
              <span>Temu</span>
              <input
                type="number"
                min="1"
                max="120"
                value={configEntrega.tiempo_temu_dias}
                onChange={(e) => actualizarConfigEntrega('tiempo_temu_dias', e.target.value)}
                disabled={guardandoCuenta}
              />
            </label>

            <label className="form-field">
              <span>AliExpress</span>
              <input
                type="number"
                min="1"
                max="120"
                value={configEntrega.tiempo_aliexpress_dias}
                onChange={(e) => actualizarConfigEntrega('tiempo_aliexpress_dias', e.target.value)}
                disabled={guardandoCuenta}
              />
            </label>

            <label className="form-field">
              <span>Catálogo</span>
              <input
                type="number"
                min="1"
                max="120"
                value={configEntrega.tiempo_catalogo_dias}
                onChange={(e) => actualizarConfigEntrega('tiempo_catalogo_dias', e.target.value)}
                disabled={guardandoCuenta}
              />
            </label>

            <label className="form-field">
              <span>Otro</span>
              <input
                type="number"
                min="1"
                max="120"
                value={configEntrega.tiempo_otro_dias}
                onChange={(e) => actualizarConfigEntrega('tiempo_otro_dias', e.target.value)}
                disabled={guardandoCuenta}
              />
            </label>
          </div>
        </div>

        <div className="account-config-section account-date-config-section">
          <div className="account-config-heading">
            <strong>Fechas y agrupación</strong>
            <span>Controla el formato de fecha, el año y la separación de pedidos por día.</span>
          </div>

          <div className="account-date-config-grid">
            <label className="form-field">
              <span>Formato</span>
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

            <label className="config-switch-row">
              <div>
                <strong>Mostrar año</strong>
                <span>Quita o muestra el año en pedidos y separadores.</span>
              </div>
              <input
                type="checkbox"
                checked={valorBooleanoConfig(configEntrega.fecha_mostrar_anio, true)}
                onChange={(e) => actualizarConfigEntrega('fecha_mostrar_anio', e.target.checked)}
                disabled={guardandoCuenta}
              />
            </label>

            <label className="config-switch-row">
              <div>
                <strong>Separar pedidos por fecha</strong>
                <span>Agrupa la lista por día de creación.</span>
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

        <div className="account-config-section">
          <div className="account-config-heading">
            <strong>Punto de entrega</strong>
            <span>Opcional. Sirve para avisar cuando un pedido queda dejado en negocio.</span>
          </div>

          <div className="account-business-grid">
            <label className="form-field">
              <span>Nombre del negocio</span>
              <input
                value={configEntrega.negocio_nombre}
                onChange={(e) => actualizarConfigEntrega('negocio_nombre', e.target.value)}
                disabled={guardandoCuenta}
              />
            </label>

            <label className="form-field">
              <span>Dirección</span>
              <input
                value={configEntrega.negocio_direccion}
                onChange={(e) => actualizarConfigEntrega('negocio_direccion', e.target.value)}
                disabled={guardandoCuenta}
              />
            </label>

            <label className="form-field">
              <span>Horario</span>
              <input
                value={configEntrega.negocio_horario}
                onChange={(e) => actualizarConfigEntrega('negocio_horario', e.target.value)}
                disabled={guardandoCuenta}
              />
            </label>
          </div>
        </div>

        {mensajeCuenta && (
          <p className={mensajeCuenta.tipo === 'success' ? 'account-modal-message account-modal-message-success' : 'account-modal-message account-modal-message-error'}>
            {mensajeCuenta.texto}
          </p>
        )}

        <div className="modal-actions account-modal-actions">
          <button
            type="button"
            className="btn btn-light-bordered"
            onClick={() => setModalCuenta(false)}
            disabled={guardandoCuenta}
          >
            Cerrar
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={guardandoCuenta}
          >
            {guardandoCuenta ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  )

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

          <button type="button" className="sidebar-account-button" onClick={abrirCuenta}>
            Mi cuenta
          </button>

          <PlanPanel />
          <PlataformaPanel />

          <nav className="nav">
            <NavLink to="/panel" className={navClass}>Panel</NavLink>
            <NavLink to="/clientes" className={navClass}>Clientes</NavLink>
            <NavLink to="/pedidos" className={navClass}>Pedidos</NavLink>
            <NavLink to="/nuevo-pedido" className={navClass}>Nuevo pedido</NavLink>
            <NavLink to="/compras" className={navClass}>Compras</NavLink>
            <NavLink to="/estadisticas" className={navClass}>Estadísticas</NavLink>
            <NavLink to="/planes" className={navClass}>Planes</NavLink>

            {datosCuenta.esAdmin && (
              <NavLink to="/admin-control" className={navClass}>Admin</NavLink>
            )}
          </nav>
        </div>

        <div className="sidebar-footer">
          <button type="button" onClick={cerrarSesion} className="btn btn-light">
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

        <button type="button" className="sidebar-account-button sidebar-account-button-drawer" onClick={abrirCuenta}>
          Mi cuenta
        </button>

        <MobilePlanPanel />
        <PlataformaPanel />

        <nav className="drawer-nav">
          <NavLink to="/panel" className={navClass} onClick={cerrarDrawer}>Panel</NavLink>
          <NavLink to="/clientes" className={navClass} onClick={cerrarDrawer}>Clientes</NavLink>
          <NavLink to="/pedidos" className={navClass} onClick={cerrarDrawer}>Pedidos</NavLink>
          <NavLink to="/nuevo-pedido" className={navClass} onClick={cerrarDrawer}>Nuevo pedido</NavLink>
          <NavLink to="/compras" className={navClass} onClick={cerrarDrawer}>Compras</NavLink>
          <NavLink to="/estadisticas" className={navClass} onClick={cerrarDrawer}>Estadísticas</NavLink>
          <NavLink to="/planes" className={navClass} onClick={cerrarDrawer}>Planes</NavLink>

          {datosCuenta.esAdmin && (
            <NavLink to="/admin-control" className={navClass} onClick={cerrarDrawer}>Admin</NavLink>
          )}
        </nav>

        <button type="button" onClick={cerrarSesion} className="btn btn-light drawer-logout">
          Cerrar sesión
        </button>
      </aside>

      <main className="main-content">
        {children}
      </main>

      <nav className="bottom-nav bottom-nav-six">
        <NavLink to="/panel" className={bottomNavClass}>
          <span>Panel</span>
        </NavLink>

        <NavLink to="/pedidos" className={bottomNavClass}>
          <span>Pedidos</span>
        </NavLink>

        <NavLink to="/compras" className={bottomNavClass}>
          <span>Compras</span>
        </NavLink>

        <NavLink to="/estadisticas" className={bottomNavClass}>
          <span>Estadísticas</span>
        </NavLink>

        <NavLink to="/planes" className={bottomNavClass}>
          <span>Planes</span>
        </NavLink>

        <NavLink to="/nuevo-pedido" className={bottomNavClass}>
          <span>Nuevo</span>
        </NavLink>
      </nav>
    </div>
  )
}
