import { useState } from 'react'
import { HISTORIAL_VERSIONES, NOVEDADES_VERSION_ACTUAL } from '../lib/novedades'
import '../styles/37-version-historial-limites.css'

export default function HistorialVersiones() {
  const [versionAbierta, setVersionAbierta] = useState(NOVEDADES_VERSION_ACTUAL)

  return (
    <section className="version-history-card" aria-labelledby="version-history-title">
      <div className="version-history-heading">
        <div>
          <span>HISTORIAL DE VERSIONES</span>
          <h2 id="version-history-title">Cambios de Ordely</h2>
          <p>Consulta lo agregado, modificado y corregido en cada actualización.</p>
        </div>
        <span className="version-history-current">Actual: v{NOVEDADES_VERSION_ACTUAL}</span>
      </div>

      <div className="version-history-list">
        {HISTORIAL_VERSIONES.map((version) => {
          const abierta = versionAbierta === version.version
          const actual = version.version === NOVEDADES_VERSION_ACTUAL

          return (
            <article className={`version-history-item${abierta ? ' active' : ''}`} key={version.version}>
              <button
                type="button"
                className="version-history-toggle"
                onClick={() => setVersionAbierta(abierta ? '' : version.version)}
                aria-expanded={abierta}
              >
                <span className="version-history-number">v{version.version}</span>
                <span className="version-history-summary">
                  <strong>{actual ? 'Versión actual' : version.fecha}</strong>
                  <small>{version.resumen}</small>
                </span>
                {actual && <em>Actual</em>}
                <b aria-hidden="true">⌄</b>
              </button>

              {abierta && (
                <div className="version-history-details">
                  {version.secciones.map((seccion) => (
                    <div className={`version-history-section is-${seccion.tipo}`} key={`${version.version}-${seccion.tipo}`}>
                      <span>{seccion.etiqueta}</span>
                      <ul>
                        {seccion.items.map((item) => (
                          <li key={item.titulo}>
                            <strong>{item.titulo}</strong>
                            <p>{item.descripcion}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
