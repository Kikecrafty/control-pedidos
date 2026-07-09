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

const obtenerPlataformaInicial = () => {
  if (typeof window === 'undefined') return 'SHEIN'
  return localStorage.getItem('plataforma_predeterminada') || 'SHEIN'
}

export default function Layout({ children }) {
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
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
    const { data } = await supabase.auth.getUser()
    const user = data?.user || null
    setUsuario(user)

    if (!user) return

    const perfilData = await cargarEstadoPlan()
    setPerfil(perfilData)

    if (perfilData?.plataforma_predeterminada) {
      setPlataformaPredeterminada(perfilData.plataforma_predeterminada)
      localStorage.setItem('plataforma_predeterminada', perfilData.plataforma_predeterminada)
    }
  }

  const datosCuenta = useMemo(() => {
    const email = perfil?.correo || usuario?.email || 'Sin correo registrado'
    const nombreDesdeCorreo = email.includes('@') ? email.split('@')[0] : 'Usuario'

    return {
      nombre: perfil?.nombre || nombreDesdeCorreo || 'Usuario',
      email,
      plan: nombrePlan(perfil?.plan_actual),
      esAdmin: perfil?.es_admin === true,
      bloqueada: perfil?.cuenta_bloqueada === true || perfil?.limite_alcanzado === true || perfil?.plan_vencido === true,
      uso: resumenUsoPlan(perfil)
    }
  }, [perfil, usuario])

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const cambiarPlataformaPredeterminada = async (valor) => {
    setPlataformaPredeterminada(valor)
    localStorage.setItem('plataforma_predeterminada', valor)

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

    setPerfil((actual) => actual ? {
      ...actual,
      plataforma_predeterminada: valor
    } : actual)
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
          <div className="brand">
            <h2>Control Pedidos</h2>
            <p>{datosCuenta.nombre} / {datosCuenta.plan}</p>
          </div>

          <CuentaPanel />

          <nav className="nav">
            <NavLink to="/" className={navClass}>Panel</NavLink>
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

        <div className="mobile-brand-account">
          <strong>Control Pedidos</strong>
          <span>{datosCuenta.nombre}</span>
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
        <div className="mobile-drawer-header">
          <div>
            <strong>Control Pedidos</strong>
            <span>Importaciones y catálogo</span>
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
          <NavLink to="/" className={navClass} onClick={cerrarDrawer}>Panel</NavLink>
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
        <NavLink to="/" className={bottomNavClass}>
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
