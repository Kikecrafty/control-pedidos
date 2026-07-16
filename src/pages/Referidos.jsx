import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import ReferidosAcceso from '../components/ReferidosAcceso'
import Toast from '../components/Toast'
import { supabase } from '../supabaseClient'
import {
  calcularComisionReferido,
  calcularPorcentajeComision,
  calcularPremioPlan,
  crearEnlaceReferido,
  HITOS_REFERIDOS,
  obtenerNivelesPremioReferidos,
  obtenerPorcentajeRutaReferidos,
  obtenerProgresoReferidos,
  PORCENTAJE_COMISION_REFERIDOS
} from '../lib/referidos'
import '../styles/34-referidos.css'

const resumenVacio = {
  participacion_estado: 'no_solicitado',
  solicitado_en: null,
  nota_admin: null,
  codigo: '',
  totales: {
    registrados: 0,
    validando: 0,
    aprobados: 0,
    dias_disponibles: 0,
    dias_pro_disponibles: 0,
    pro_ilimitado_disponible: false,
    comision_disponible: 0
  },
  referidos: [],
  recompensas: []
}

const estadoTexto = {
  registrado: 'Cuenta registrada',
  validando: 'Compra en validación',
  aprobado: 'Referido válido',
  rechazado: 'No válido',
  cancelado: 'Cancelado',
  revision: 'En revisión',
  disponible: 'Disponible',
  solicitado: 'Pago solicitado',
  canjeado: 'Canjeado',
  pagado: 'Pagado'
}

const detalleHitos = {
  10: '30 días Premium',
  20: '20% comisión',
  30: '30% comisión',
  40: '40% comisión',
  50: '15 días Pro + 50%',
  60: '60% máximo',
  75: '30 días Pro',
  100: 'Pro ilimitado'
}

const estadoNivelTexto = {
  activo: 'Activo',
  completado: 'Completado',
  bloqueado: 'Bloqueado'
}

const describirPremioPlan = (premio) => {
  if (premio.ilimitado) return 'Pro ilimitado'
  if (!premio.plan) return 'Sin premio'
  return `${premio.dias} días ${premio.plan === 'pro' ? 'Pro' : 'Premium'}`
}

const insigniaRecompensa = (recompensa) => {
  if (recompensa.tipo === 'comision') return '$'
  if (recompensa.tipo === 'pro_ilimitado') return '∞'
  return `${recompensa.dias_premium}d`
}

const formatearDinero = (cantidad) => Number(cantidad || 0).toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN'
})

const formatearFecha = (fecha) => {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const IconoReferidos = ({ tipo }) => {
  if (tipo === 'personas') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 5.5M17 14a5 5 0 0 1 3.5 5" />
      </svg>
    )
  }

  if (tipo === 'regalo') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12V6.5A2.5 2.5 0 0 1 6.5 4H12M12 4l-3-3M12 4 9 7" />
      <path d="M20 12v5.5a2.5 2.5 0 0 1-2.5 2.5H12M12 20l3 3M12 20l3-3" />
      <path d="M8 12h8" />
    </svg>
  )
}

export default function Referidos() {
  const [resumen, setResumen] = useState(resumenVacio)
  const [cargando, setCargando] = useState(true)
  const [migracionActiva, setMigracionActiva] = useState(true)
  const [procesando, setProcesando] = useState('')
  const [toast, setToast] = useState(null)

  const cargarDatos = async () => {
    setCargando(true)
    const { data, error } = await supabase.rpc('mi_resumen_referidos_v1')

    if (error) {
      console.log('Programa de referidos pendiente de activar:', error)
      setMigracionActiva(false)
      setResumen(resumenVacio)
    } else {
      setMigracionActiva(true)
      setResumen({
        ...resumenVacio,
        ...(data || {}),
        totales: { ...resumenVacio.totales, ...(data?.totales || {}) },
        referidos: data?.referidos || [],
        recompensas: data?.recompensas || []
      })
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const enlace = useMemo(() => {
    if (!resumen.codigo || typeof window === 'undefined') return ''
    return crearEnlaceReferido(window.location.origin, resumen.codigo)
  }, [resumen.codigo])

  const progreso = useMemo(
    () => obtenerProgresoReferidos(resumen.totales?.aprobados),
    [resumen.totales?.aprobados]
  )

  const siguienteReferido = Math.max(Number(resumen.totales?.aprobados || 0) + 1, 1)
  const premioSiguiente = calcularPremioPlan(siguienteReferido)
  const porcentajeSiguiente = calcularPorcentajeComision(siguienteReferido)
  const avanceRuta = obtenerPorcentajeRutaReferidos(resumen.totales?.aprobados)
  const nivelesPremio = obtenerNivelesPremioReferidos(resumen.totales?.aprobados)

  const copiar = async (valor, mensaje) => {
    if (!valor) {
      setToast({ tipo: 'info', mensaje: 'El enlace personal se activará al aplicar la migración de referidos.' })
      return
    }

    try {
      await navigator.clipboard.writeText(valor)
      setToast({ tipo: 'success', mensaje })
    } catch {
      setToast({ tipo: 'error', mensaje: 'No se pudo copiar automáticamente.' })
    }
  }

  const compartir = async () => {
    if (!enlace) return copiar('', '')

    const texto = 'Te invito a probar Ordely para organizar clientes, pedidos, compras y pagos.'
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Conoce Ordely', text: texto, url: enlace })
        return
      } catch (error) {
        if (error?.name === 'AbortError') return
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(`${texto}\n${enlace}`)}`, '_blank', 'noopener,noreferrer')
  }

  const canjearDias = async (recompensaId) => {
    setProcesando(`dias:${recompensaId}`)
    const { error } = await supabase.rpc('canjear_mis_dias_referidos_v1', {
      p_recompensa_id: recompensaId
    })

    if (error) {
      setToast({ tipo: 'error', mensaje: error.message || 'No se pudo reclamar la recompensa.' })
    } else {
      setToast({ tipo: 'success', mensaje: 'Tu recompensa de plan se activó correctamente.' })
      window.dispatchEvent(new Event('planActualizado'))
      await cargarDatos()
    }
    setProcesando('')
  }

  const solicitarPago = async () => {
    setProcesando('retiro')
    const { data, error } = await supabase.rpc('solicitar_pago_referidos_v1')

    if (error) {
      setToast({ tipo: 'error', mensaje: error.message || 'No se pudo solicitar el pago.' })
    } else {
      setToast({ tipo: 'success', mensaje: `Solicitud registrada por ${formatearDinero(data?.monto_mxn)}.` })
      await cargarDatos()
    }
    setProcesando('')
  }

  const solicitarAcceso = async () => {
    setProcesando('solicitud')
    const { data, error } = await supabase.rpc('solicitar_programa_referidos_v1')

    if (error) {
      setToast({
        tipo: migracionActiva ? 'error' : 'info',
        mensaje: migracionActiva
          ? error.message || 'No se pudo enviar la solicitud.'
          : 'El envío real se activará cuando se aplique la migración de referidos.'
      })
    } else {
      setResumen({
        ...resumenVacio,
        participacion_estado: data?.estado || 'solicitado',
        solicitado_en: data?.solicitado_en || new Date().toISOString()
      })
      setToast({ tipo: 'success', mensaje: 'Solicitud enviada. La administración podrá revisarla.' })
    }
    setProcesando('')
  }

  const recompensaPremiumDisponible = resumen.recompensas.find((item) => item.tipo === 'dias_premium' && item.estado === 'disponible')
  const recompensaProDisponible = resumen.recompensas.find((item) => item.tipo === 'pro_ilimitado' && item.estado === 'disponible')
    || resumen.recompensas.find((item) => item.tipo === 'dias_pro' && item.estado === 'disponible')

  if (cargando && !resumen.codigo && resumen.participacion_estado === 'no_solicitado') {
    return (
      <Layout>
        <div className="referral-access-loading">Cargando programa de referidos...</div>
      </Layout>
    )
  }

  if (resumen.participacion_estado !== 'activo') {
    return (
      <Layout>
        <Toast mensaje={toast?.mensaje} tipo={toast?.tipo} onClose={() => setToast(null)} />
        <ReferidosAcceso
          estado={resumen.participacion_estado}
          solicitadoEn={resumen.solicitado_en}
          notaAdmin={resumen.nota_admin}
          procesando={procesando === 'solicitud'}
          migracionActiva={migracionActiva}
          onSolicitar={solicitarAcceso}
        />
      </Layout>
    )
  }

  return (
    <Layout>
      <Toast mensaje={toast?.mensaje} tipo={toast?.tipo} onClose={() => setToast(null)} />

      <div className="referrals-page">
        <section className="referrals-hero">
          <div className="referrals-hero-copy">
            <span className="referrals-eyebrow">Programa de referidos</span>
            <h1>Recomienda Ordely y gana</h1>
            <p>Comparte tu enlace. Cuando una cuenta invitada compre Premium o Pro y complete 30 días de validación, recibirás tu recompensa.</p>
          </div>

          <div className="referrals-hero-badge">
            <small>Comisión máxima</small>
            <span>{PORCENTAJE_COMISION_REFERIDOS}%</span>
            <small>sobre el precio regular</small>
          </div>
        </section>

        {!migracionActiva && (
          <div className="referrals-activation-note">
            <span />
            <div>
              <strong>Diseño listo para probar</strong>
              <p>Los enlaces, contadores y recompensas reales se activarán cuando autorices aplicar la migración de referidos en Supabase.</p>
            </div>
          </div>
        )}

        <section className="referrals-share-card">
          <div className="referrals-share-heading">
            <span className="referrals-icon"><IconoReferidos tipo="compartir" /></span>
            <div>
              <small>Tu invitación personal</small>
              <h2>Comparte tu enlace</h2>
              <p>El código queda vinculado a la cuenta nueva y no puede cambiarse después.</p>
            </div>
          </div>

          <div className="referrals-link-row">
            <div className="referrals-link-value">
              <span>Enlace</span>
              <strong>{enlace || 'Se activará con la migración'}</strong>
            </div>
            <button type="button" className="btn btn-light-bordered" onClick={() => copiar(enlace, 'Enlace copiado.')}>Copiar</button>
            <button type="button" className="btn btn-primary" onClick={compartir}>Compartir</button>
          </div>

          <button type="button" className="referrals-code" onClick={() => copiar(resumen.codigo, 'Código copiado.')}>
            <span>Código personal</span>
            <strong>{resumen.codigo || 'ORD-PENDIENTE'}</strong>
            <small>Copiar código</small>
          </button>
        </section>

        <section className="referrals-stats-grid">
          <article>
            <span className="referrals-stat-icon is-blue"><IconoReferidos tipo="personas" /></span>
            <div><small>Registrados</small><strong>{resumen.totales.registrados}</strong><p>Usaron tu enlace</p></div>
          </article>
          <article>
            <span className="referrals-stat-icon is-amber"><IconoReferidos tipo="regalo" /></span>
            <div><small>En validación</small><strong>{resumen.totales.validando}</strong><p>Esperando 30 días</p></div>
          </article>
          <article>
            <span className="referrals-stat-icon is-green"><IconoReferidos tipo="personas" /></span>
            <div><small>Referidos válidos</small><strong>{resumen.totales.aprobados}</strong><p>Compras aprobadas</p></div>
          </article>
        </section>

        <section className="referrals-level-card">
          <div className="referrals-level-heading">
            <div>
              <span>Tu progreso</span>
              <h2>{progreso.total >= 100 ? 'Nivel máximo alcanzado' : `Siguiente meta: ${progreso.siguiente} referidos`}</h2>
              <p>{progreso.faltan > 0 ? `Faltan ${progreso.faltan} compras válidas.` : 'Ya tienes Pro ilimitado y la comisión máxima.'}</p>
            </div>
            <strong>{progreso.total}<small> válidos</small></strong>
          </div>

          <div className="referrals-level-route" style={{ '--route-progress': `${avanceRuta}%` }} aria-label={`Progreso: ${progreso.total} referidos válidos`}>
            <div className="referrals-level-line"><i /></div>
            {HITOS_REFERIDOS.map((hito) => {
              const completado = progreso.total >= hito
              const siguiente = progreso.total < 100 && progreso.siguiente === hito
              return (
                <article key={hito} className={`${completado ? 'is-complete' : ''} ${siguiente ? 'is-next' : ''}`}>
                  <b>{completado ? '✓' : hito}</b>
                  <strong>{hito} referidos</strong>
                  <span>{detalleHitos[hito]}</span>
                </article>
              )
            })}
          </div>

          <div className="referrals-reward-levels">
            <div className="referrals-reward-levels-heading">
              <div>
                <span>Premio por cada referido</span>
                <h3>Cada etapa mejora lo que ganas</h3>
              </div>
              <p>El nivel activo indica el premio de tu siguiente referido válido.</p>
            </div>
            <div className="referrals-reward-levels-grid">
              {nivelesPremio.map((nivel) => (
                <article key={nivel.id} className={`is-${nivel.estado}`}>
                  <div>
                    <small>{nivel.desde === nivel.hasta ? `Referido ${nivel.desde}` : `Referidos ${nivel.desde}–${nivel.hasta}`}</small>
                    <em><i />{estadoNivelTexto[nivel.estado]}</em>
                  </div>
                  <strong>{nivel.premio}</strong>
                  <p>{nivel.detalle}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="referrals-current-reward">
            <div>
              <span>{progreso.total >= 100 ? 'Tu beneficio de plan' : `Con tu referido #${siguienteReferido} ganas`}</span>
              <strong>{progreso.total >= 100 ? 'Pro ilimitado activo' : describirPremioPlan(premioSiguiente)}</strong>
            </div>
            <div>
              <span>Comisión</span>
              <strong>{porcentajeSiguiente > 0 ? `${porcentajeSiguiente}%` : 'Se activa en 20'}</strong>
            </div>
            {porcentajeSiguiente > 0 && (
              <div>
                <span>Según el plan comprado</span>
                <strong>{formatearDinero(calcularComisionReferido('premium', siguienteReferido))} o {formatearDinero(calcularComisionReferido('pro', siguienteReferido))}</strong>
              </div>
            )}
          </div>
        </section>

        <section className="referrals-wallet-card">
          <div className="referrals-wallet-heading">
            <div><span>Tus recompensas</span><h2>Saldo disponible</h2></div>
            <p>Elige si quieres activar tiempo de plan o solicitar tus ganancias.</p>
          </div>

          <div className="referrals-wallet-grid">
            <article className="is-premium">
              <div><span>Premium disponible</span><em>{recompensaPremiumDisponible ? 'Listo' : 'Sin saldo'}</em></div>
              <strong>{resumen.totales.dias_disponibles}<small> días</small></strong>
              <p>Se agrega a tu vigencia Premium.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => recompensaPremiumDisponible && canjearDias(recompensaPremiumDisponible.id)}
                disabled={!recompensaPremiumDisponible || Boolean(procesando)}
              >
                {procesando === `dias:${recompensaPremiumDisponible?.id}` ? 'Reclamando...' : 'Reclamar Premium'}
              </button>
            </article>

            <article className="is-pro">
              <div><span>Pro disponible</span><em>{recompensaProDisponible ? 'Listo' : 'Sin saldo'}</em></div>
              <strong>{resumen.totales.pro_ilimitado_disponible ? 'Ilimitado' : resumen.totales.dias_pro_disponibles}<small>{resumen.totales.pro_ilimitado_disponible ? '' : ' días'}</small></strong>
              <p>Activa el beneficio Pro que hayas ganado.</p>
              <button
                type="button"
                className="btn btn-light-bordered"
                onClick={() => recompensaProDisponible && canjearDias(recompensaProDisponible.id)}
                disabled={!recompensaProDisponible || Boolean(procesando)}
              >
                {procesando === `dias:${recompensaProDisponible?.id}` ? 'Reclamando...' : 'Reclamar Pro'}
              </button>
            </article>

            <article className="is-money">
              <div><span>Dinero disponible</span><em>{resumen.totales.comision_disponible > 0 ? 'Listo' : 'Sin saldo'}</em></div>
              <strong>{formatearDinero(resumen.totales.comision_disponible)}</strong>
              <p>La administración confirmará el pago.</p>
              <button type="button" className="btn btn-light-bordered" onClick={solicitarPago} disabled={Boolean(procesando) || resumen.totales.comision_disponible <= 0}>
                {procesando === 'retiro' ? 'Solicitando...' : 'Solicitar pago'}
              </button>
            </article>
          </div>

          <small className="referrals-wallet-note">Los premios de plan se reclaman uno por uno; el saldo se actualiza después de cada canje.</small>
        </section>

        <section className="referrals-history-grid">
          <div className="referrals-history-card">
            <div className="referrals-section-heading compact"><div><span>Actividad</span><h2>Tus referidos</h2></div></div>
            <div className="referrals-history-list">
              {resumen.referidos.map((referido, index) => (
                <article key={referido.id}>
                  <b>{resumen.referidos.length - index}</b>
                  <div><strong>Cuenta invitada</strong><span>{formatearFecha(referido.registrado_en)}{referido.plan_comprado ? ` · ${referido.plan_comprado}` : ''}</span></div>
                  <em className={`is-${referido.estado}`}>{estadoTexto[referido.estado] || referido.estado}</em>
                </article>
              ))}
              {resumen.referidos.length === 0 && <p className="referrals-empty">Cuando alguien use tu enlace aparecerá aquí.</p>}
            </div>
          </div>

          <div className="referrals-history-card">
            <div className="referrals-section-heading compact"><div><span>Premios</span><h2>Recompensas</h2></div></div>
            <div className="referrals-history-list">
              {resumen.recompensas.map((recompensa) => (
                <article key={recompensa.id}>
                  <b>{insigniaRecompensa(recompensa)}</b>
                  <div><strong>{recompensa.concepto}</strong><span>{formatearFecha(recompensa.creado_en)}</span></div>
                  <em className={`is-${recompensa.estado}`}>{recompensa.tipo === 'comision' && recompensa.monto_mxn ? formatearDinero(recompensa.monto_mxn) : estadoTexto[recompensa.estado]}</em>
                </article>
              ))}
              {resumen.recompensas.length === 0 && <p className="referrals-empty">Aún no tienes recompensas aprobadas.</p>}
            </div>
          </div>
        </section>

        <section className="referrals-conditions">
          <strong>Reglas para proteger el programa</strong>
          <p>Solo cuenta la primera compra confirmada de una cuenta nueva. No se aceptan autorreferidos, cuentas duplicadas, pagos cancelados ni reembolsados. Cada compra espera 30 días antes de generar una recompensa.</p>
        </section>

        {cargando && <div className="referrals-loading">Actualizando tu programa...</div>}
      </div>
    </Layout>
  )
}
