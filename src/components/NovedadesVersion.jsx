import Modal from './Modal'
import { NOVEDADES_ACTUALES } from '../lib/novedades'
import '../styles/35-novedades-version.css'

const ICONOS = {
  agregado: '+',
  cambio: '↻',
  removido: '−',
  correccion: '✓'
}

export default function NovedadesVersion({
  abierto,
  onClose,
  novedades = NOVEDADES_ACTUALES,
  modoConsulta = false
}) {

  return (
    <Modal
      abierto={abierto}
      titulo={`Novedades de Ordely ${novedades.version}`}
      onClose={onClose}
      className="ordely-release-modal"
    >
      <div className="ordely-release-content">
        <header className="ordely-release-hero">
          <div className="ordely-release-version" aria-label={`Versión ${novedades.version}`}>
            <img src="/brand/ordely-icon.png" alt="" />
            <span>Versión</span>
            <strong>{novedades.version}</strong>
          </div>
          <div>
            <span className="ordely-release-eyebrow">Actualización disponible · {novedades.fecha}</span>
            <h3>Ordely tiene novedades para ti</h3>
            <p>{novedades.resumen}</p>
          </div>
        </header>

        <div className="ordely-release-summary" aria-label="Contenido de la actualización">
          {novedades.secciones.map((seccion) => (
            <span className={`is-${seccion.tipo}`} key={seccion.tipo}>
              <i aria-hidden="true">{ICONOS[seccion.tipo]}</i>
              {seccion.etiqueta}
            </span>
          ))}
        </div>

        <section className="ordely-release-sections">
          {novedades.secciones.map((seccion) => (
            <article className={`ordely-release-section is-${seccion.tipo}`} key={seccion.tipo}>
              <div className="ordely-release-section-title">
                <span aria-hidden="true">{ICONOS[seccion.tipo]}</span>
                <div>
                  <small>{seccion.etiqueta}</small>
                  <h4>{seccion.titulo}</h4>
                </div>
              </div>

              <ul>
                {seccion.items.map((item) => (
                  <li key={item.titulo}>
                    <strong>{item.titulo}</strong>
                    <p>{item.descripcion}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <footer className="ordely-release-actions">
          <p>
            {modoConsulta
              ? 'Puedes consultar esta información cuando quieras desde Inicio o Ayuda y soporte.'
              : 'Este aviso se mostrará una sola vez en tu cuenta para esta versión.'}
          </p>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {modoConsulta ? 'Cerrar novedades' : 'Entendido, continuar'}
          </button>
        </footer>
      </div>
    </Modal>
  )
}
