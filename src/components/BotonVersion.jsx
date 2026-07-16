import { useState } from 'react'
import NovedadesVersion from './NovedadesVersion'
import { NOVEDADES_ACTUALES, NOVEDADES_VERSION_ACTUAL } from '../lib/novedades'
import '../styles/37-version-historial-limites.css'

export default function BotonVersion() {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        className="ordely-version-button"
        onClick={() => setAbierto(true)}
        aria-label={`Ver novedades de Ordely ${NOVEDADES_VERSION_ACTUAL}`}
      >
        <span className="ordely-version-button-dot" aria-hidden="true" />
        <span>v{NOVEDADES_VERSION_ACTUAL}</span>
        <b aria-hidden="true">›</b>
      </button>

      <NovedadesVersion
        abierto={abierto}
        onClose={() => setAbierto(false)}
        novedades={NOVEDADES_ACTUALES}
        modoConsulta
      />
    </>
  )
}
