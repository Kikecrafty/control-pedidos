import { Link } from 'react-router-dom'

const ocultarImagenRota = (event) => {
  event.currentTarget.style.display = 'none'
  event.currentTarget.parentElement?.classList.add('ordely-logo-error')
}

export default function Landing({ session }) {
  return (
    <div className="ordely-public-page">
      <header className="ordely-public-nav">
        <Link to="/" className="ordely-public-brand" aria-label="Ordely">
          <img src="/brand/ordely-icon.png" alt="Ordely" className="ordely-public-brand-icon" onError={ocultarImagenRota} />
          <span className="ordely-logo-text-fallback">Ordely</span>
        </Link>

        <nav className="ordely-public-actions">
          {session ? (
            <Link to="/panel" className="btn btn-primary ordely-nav-btn">
              Ir al panel
            </Link>
          ) : (
            <>
              <Link to="/login" className="ordely-nav-login">
                Iniciar sesión
              </Link>
              <Link to="/login?modo=registro" className="btn btn-primary ordely-nav-btn">
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="ordely-public-main">
        <section className="ordely-hero-minimal">
          <div className="ordely-hero-logo-wrap">
            <img
              src="/brand/ordely-logo.png"
              alt="Ordely"
              className="ordely-hero-logo"
              onError={ocultarImagenRota}
            />
            <span className="ordely-logo-text-fallback ordely-hero-fallback">Ordely</span>
          </div>

          <span className="ordely-kicker">Control de pedidos, clientes y pagos</span>

          <h1>Pedidos claros, ventas en orden.</h1>

          <p>
            Ordely te ayuda a administrar pedidos de SHEIN, Temu y compras por encargo,
            además de clientes, anticipos, pagos, entregas y seguimiento desde una
            plataforma simple para celular o computadora.
          </p>

          <div className="ordely-mini-points" aria-label="Funciones principales">
            <span>Clientes</span>
            <span>Pedidos</span>
            <span>Pagos</span>
            <span>Seguimiento</span>
          </div>
        </section>
      </main>

      <footer className="ordely-public-footer">
        <span>miordely.com</span>
      </footer>
    </div>
  )
}
