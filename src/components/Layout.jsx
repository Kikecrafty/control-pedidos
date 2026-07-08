import { NavLink } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Layout({ children }) {
  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div>
          <h2>Control Pedidos</h2>
          <p>SHEIN / Importaciones</p>

          <nav className="nav">
            <NavLink to="/" className="nav-link">Panel</NavLink>
            <NavLink to="/clientes" className="nav-link">Clientes</NavLink>
            <NavLink to="/pedidos" className="nav-link">Pedidos</NavLink>
            <NavLink to="/nuevo-pedido" className="nav-link">Nuevo pedido</NavLink>
          </nav>
        </div>

        <button onClick={cerrarSesion} className="btn btn-light">
          Cerrar sesión
        </button>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  )
}