import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { cargarEstadoPlan, nombrePlan, resumenUsoPlan } from '../lib/planes'

const plataformas = [
  'SHEIN',
  'Temu',
  'AliExpress',
  'Catálogo',
  'Otro'
]

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
      esAdmin: perfil?.es_admin === true,
      bloqueada: perfil?.cuenta_bloqueada === true || perfil?.limite_alcanzado === true || perfil?.plan_vencido === true,
      uso: hayPerfil ? resumenUsoPlan(perfil) : 'Cargando plan...',
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

  const CuentaPanel = ({ compacto = false }) => (
    <div className={compacto ? 'account-panel account-panel-compact' : 'account-panel'}>
      <span className="account-kicker">Cuenta</span>

      <strong className="account-name">{datosCuenta.nombre}</strong>
      <span className="account-email">{datosCuenta.email}</span>

      <div className="account-plan-row">
        <span>Tipo de plan</span>
        <strong>{datosCuenta.plan}</strong>
      </div>

      <div className="account-plan-row">
        <span>Uso</span>
        <strong>{datosCuenta.uso}</strong>
      </div>

      {datosCuenta.bloqueada && (
        <div className="account-limit-warning">
          Límite alcanzado
        </div>
      )}

      <label className="default-platform-field">
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
    </div>
  )

  return (
    <div className="app-layout">
      <aside className="sidebar desktop-sidebar">
        <div>
          <div className="brand ordely-sidebar-brand">
            <div className="ordely-sidebar-brand-main">
              <img src="/brand/ordely-icon.png" alt="" className="ordely-sidebar-icon" onError={ocultarImagenRota} />
              <div>
                <strong>Ordely</strong>
                <span>Pedidos claros</span>
              </div>
            </div>
            <p>{datosCuenta.nombre} / {datosCuenta.plan}</p>
          </div>

          <CuentaPanel />

          <nav className="nav">
            <NavLink to="/panel" className={navClass}>Panel</NavLink>
            <NavLink to="/clientes" className={navClass}>Clientes</NavLink>
            <NavLink to="/pedidos" className={navClass}>Pedidos</NavLink>
            <NavLink to="/nuevo-pedido" className={navClass}>Nuevo pedido</NavLink>
            <NavLink to="/metricas" className={navClass}>Métricas</NavLink>
            <NavLink to="/planes" className={navClass}>Planes</NavLink>

            {datosCuenta.esAdmin && (
              <NavLink to="/admin-control" className={navClass}>Admin</NavLink>
            )}
          </nav>
        </div>

        <button type="button" onClick={cerrarSesion} className="btn btn-light">
          Cerrar sesión
        </button>
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
              <span>Importaciones y catálogo</span>
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

        <CuentaPanel compacto />

        <nav className="drawer-nav">
          <NavLink to="/panel" className={navClass} onClick={cerrarDrawer}>Panel</NavLink>
          <NavLink to="/clientes" className={navClass} onClick={cerrarDrawer}>Clientes</NavLink>
          <NavLink to="/pedidos" className={navClass} onClick={cerrarDrawer}>Pedidos</NavLink>
          <NavLink to="/nuevo-pedido" className={navClass} onClick={cerrarDrawer}>Nuevo pedido</NavLink>
          <NavLink to="/metricas" className={navClass} onClick={cerrarDrawer}>Métricas</NavLink>
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

      <nav className="bottom-nav bottom-nav-five">
        <NavLink to="/panel" className={bottomNavClass}>
          <span>Panel</span>
        </NavLink>

        <NavLink to="/pedidos" className={bottomNavClass}>
          <span>Pedidos</span>
        </NavLink>

        <NavLink to="/metricas" className={bottomNavClass}>
          <span>Métricas</span>
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
