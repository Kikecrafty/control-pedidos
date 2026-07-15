import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import PlanLimitNotice from '../components/PlanLimitNotice'
import PageHelp from '../components/PageHelp'
import { supabase } from '../supabaseClient'
import { cargarEstadoPlan, nombrePlan } from '../lib/planes'
import '../styles/33-precios-lanzamiento.css'

const WHATSAPP_ADMIN = '527122460748'

const formatearFecha = (fecha) => {
  if (!fecha) return 'Sin vencimiento'
  return new Date(fecha).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const formatearDinero = (cantidad) => {
  return Number(cantidad || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN'
  })
}

const planNombreCorto = {
  basico: 'Básico',
  premium: 'Premium',
  pro: 'Pro'
}

const planes = [
  {
    id: 'basico',
    etiqueta: 'Inicial',
    nombre: 'Plan Básico',
    precio: 'Gratis',
    periodo: '30 pedidos',
    descripcion: 'Para probar el sistema completo antes de actualizar.',
    boton: 'Plan actual',
    icono: '✓',
    funciones: [
      '30 pedidos gratis',
      'Clientes y pedidos',
      'Productos y pagos',
      'Seguimiento público',
      'WhatsApp automático',
      'Estadísticas bloqueadas con ejemplo'
    ]
  },
  {
    id: 'premium',
    etiqueta: 'Recomendado',
    nombre: 'Plan Premium',
    precioAnterior: '$79.99',
    precio: '$59.99',
    periodo: 'MXN / mes',
    descripcion: 'Para vender sin límite y usar todas las funciones principales.',
    boton: 'Actualizar a Premium',
    icono: '♕',
    funciones: [
      'Pedidos ilimitados',
      'Clientes ilimitados',
      'Productos y pagos ilimitados',
      'Seguimiento público',
      'WhatsApp automático por estado',
      'Códigos de seguimiento para clientes'
    ]
  },
  {
    id: 'pro',
    etiqueta: 'Avanzado',
    nombre: 'Plan Pro',
    precioAnterior: '$129.00',
    precio: '$99.99',
    periodo: 'MXN / mes',
    descripcion: 'Para analizar ventas, ganancias y crecimiento del negocio.',
    boton: 'Actualizar a Pro',
    icono: '✦',
    funciones: [
      'Todo Premium',
      'Estadísticas reales por fecha',
      'Filtro por plataforma',
      'Gráficas de barras y pastel',
      'Top clientes y plataformas',
      'Reportes y cortes próximamente'
    ]
  }
]

const construirMensajeUpgrade = (plan, estadoPlan) => {
  const planActual = nombrePlan(estadoPlan?.plan_actual || 'basico')
  const correo = estadoPlan?.correo || 'sin correo'
  const nombre = estadoPlan?.nombre || 'Usuario'

  return [
    `Hola, quiero actualizar mi cuenta a ${plan.nombre}.`,
    '',
    `Nombre: ${nombre}`,
    `Correo: ${correo}`,
    `Plan actual: ${planActual}`,
    `Plan solicitado: ${plan.nombre}`,
    '',
    'Me puedes mandar las instrucciones de pago.'
  ].join('\n')
}

export default function Planes() {
  const [estadoPlan, setEstadoPlan] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [codigo, setCodigo] = useState('')
  const [canjeando, setCanjeando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [tipoMensaje, setTipoMensaje] = useState('')
  const [suscripciones, setSuscripciones] = useState([])

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    const estado = await cargarEstadoPlan()
    setEstadoPlan(estado)

    const { data: suscripcionesData, error: suscripcionesError } = await supabase.rpc('mis_suscripciones_recientes')

    if (suscripcionesError) {
      console.log(suscripcionesError)
      setSuscripciones([])
    } else {
      setSuscripciones(suscripcionesData || [])
    }

    setCargando(false)
  }

  const canjearCodigo = async (event) => {
    event.preventDefault()

    const codigoLimpio = codigo.trim().toUpperCase()

    if (!codigoLimpio) {
      setTipoMensaje('error')
      setMensaje('Escribe un código para canjear.')
      return
    }

    setCanjeando(true)
    setMensaje('')
    setTipoMensaje('')

    const { data, error } = await supabase.rpc('canjear_codigo', {
      p_codigo: codigoLimpio
    })

    setCanjeando(false)

    if (error) {
      console.log(error)
      setTipoMensaje('error')
      setMensaje('No se pudo canjear el código. Revisa que el código esté activo o consulta con soporte.')
      return
    }

    const resultado = Array.isArray(data) ? data[0] : data

    if (!resultado?.exito) {
      setTipoMensaje('error')
      setMensaje(resultado?.mensaje || 'El código no se pudo aplicar.')
      return
    }

    setTipoMensaje('success')
    setMensaje(
      `${resultado.mensaje} Plan: ${planNombreCorto[resultado.nuevo_plan] || resultado.nuevo_plan}. Vence: ${formatearFecha(resultado.vence_en)}.`
    )
    setCodigo('')
    window.dispatchEvent(new CustomEvent('planActualizado'))
    cargarDatos()
  }

  const solicitarPlan = (plan) => {
    const mensajeWhatsApp = construirMensajeUpgrade(plan, estadoPlan)
    const url = `https://wa.me/${WHATSAPP_ADMIN}?text=${encodeURIComponent(mensajeWhatsApp)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const planActual = estadoPlan?.plan_actual || 'basico'
  const limite = Number(estadoPlan?.limite_pedidos || 30)
  const pedidosUsados = Number(estadoPlan?.pedidos_usados || 0)
  const esBasico = planActual === 'basico'
  const restante = Math.max(limite - pedidosUsados, 0)
  const cercaLimite = esBasico && restante > 0 && restante <= 5
  const limiteAlcanzado = Boolean(estadoPlan?.limite_alcanzado)

  const mensajeEstado = useMemo(() => {
    if (planActual === 'pro') return 'Tienes acceso completo a pedidos, estadísticas y funciones avanzadas.'
    if (planActual === 'premium') return 'Tienes pedidos ilimitados y funciones principales desbloqueadas.'
    if (limiteAlcanzado) return 'Tu Plan Básico llegó al límite. Actualiza para seguir creando y editando.'
    if (cercaLimite) return `Te quedan ${restante} pedidos gratis. Actualiza antes de llegar al límite.`
    return `Has usado ${pedidosUsados} de ${limite} pedidos gratis.`
  }, [planActual, limiteAlcanzado, cercaLimite, restante, pedidosUsados, limite])

  if (cargando) {
    return (
      <Layout>
        <div className="loading">Cargando planes...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageHelp page="planes" />

      <div className="page-header plans-header ordely-plans-header-v4">
        <div className="ordely-plans-title-row">
          <span className="ordely-plans-title-icon">♕</span>
          <div>
            <h1>Planes y precios</h1>
            <p>Elige el plan que mejor se adapte al crecimiento de tu negocio.</p>
          </div>
        </div>
      </div>

      <PlanLimitNotice
        estadoPlan={estadoPlan}
        titulo="Has llegado al límite del Plan Básico"
        descripcion="Puedes seguir viendo tu información, pero para crear, editar o eliminar necesitas actualizar a Premium o Pro."
      />

      <section className="ordely-plan-status-v4">
        <div>
          <span>Tu cuenta</span>
          <strong>{estadoPlan?.nombre || 'Usuario'}</strong>
          <p>{estadoPlan?.correo}</p>
        </div>

        <div>
          <span>Plan actual</span>
          <strong>{nombrePlan(planActual)}</strong>
          <p>{estadoPlan?.plan_expira_en ? `Vence: ${formatearFecha(estadoPlan.plan_expira_en)}` : 'Sin vencimiento'}</p>
        </div>

        <div>
          <span>Uso</span>
          <strong>{esBasico ? `${pedidosUsados} / ${limite}` : 'Ilimitado'}</strong>
          <p>{mensajeEstado}</p>
        </div>

      </section>

      {(cercaLimite || limiteAlcanzado) && esBasico && (
        <section className={limiteAlcanzado ? 'plan-warning-card plan-warning-danger' : 'plan-warning-card'}>
          <div>
            <strong>{limiteAlcanzado ? 'Límite alcanzado' : 'Estás cerca del límite'}</strong>
            <p>
              {limiteAlcanzado
                ? 'Actualiza a Premium para desbloquear nuevamente crear, editar y cambiar estados.'
                : `Te quedan ${restante} pedidos gratis. Premium desbloquea pedidos ilimitados.`}
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => solicitarPlan(planes[1])}>
            Actualizar a Premium
          </button>
        </section>
      )}

      <section className="ordely-launch-price-banner">
        <span className="ordely-launch-price-icon" aria-hidden="true">✦</span>
        <div className="ordely-launch-price-copy">
          <span>Oferta especial de lanzamiento</span>
          <strong>Ordely inicia con precios especiales</strong>
          <p>Aprovecha estas tarifas mientras se mantenga vigente el lanzamiento del programa.</p>
        </div>
      </section>

      <section className="ordely-pricing-grid-v4">
        {planes.map((plan) => {
          const activo = planActual === plan.id
          const esUpgrade = plan.id !== 'basico' && !activo
          const incluido = plan.id === 'basico' && planActual !== 'basico'

          return (
            <article
              key={plan.id}
              className={`ordely-plan-card-v4 ordely-plan-card-${plan.id}-v4 ${activo ? 'ordely-plan-card-current-v4' : ''}`}
            >
              <div className="ordely-card-glow-v4" />

              <div className="ordely-plan-card-content-v4">
                <span className="ordely-plan-badge-v4">
                  <i>{plan.icono}</i>
                  {plan.etiqueta}
                </span>

                <h2>{plan.nombre}</h2>

                <div className="ordely-plan-divider-v4" />

                <div className="ordely-plan-price-v4">
                  <div className="ordely-plan-price-numbers">
                    {plan.precioAnterior && (
                      <div className="ordely-plan-old-price">
                        <small>Precio regular</small>
                        <del>{plan.precioAnterior}</del>
                      </div>
                    )}
                    <strong>{plan.precio}</strong>
                  </div>
                  <span>{plan.periodo}</span>
                </div>

                <p>{plan.descripcion}</p>

                <ul className="ordely-plan-features-v4">
                  {plan.funciones.map((funcion) => (
                    <li key={funcion}>
                      <span>✓</span>
                      <strong>{funcion}</strong>
                    </li>
                  ))}
                </ul>

                {activo ? (
                  <button type="button" className="btn ordely-plan-button-v4 ordely-plan-button-current-v4" disabled>
                    Plan actual
                  </button>
                ) : esUpgrade ? (
                  <button type="button" className="btn ordely-plan-button-v4" onClick={() => solicitarPlan(plan)}>
                    {plan.boton}
                  </button>
                ) : incluido ? (
                  <button type="button" className="btn ordely-plan-button-v4 ordely-plan-button-included-v4" disabled>
                    Incluido
                  </button>
                ) : (
                  <button type="button" className="btn ordely-plan-button-v4 ordely-plan-button-current-v4" disabled>
                    Plan actual
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </section>

      <p className="ordely-plans-footnote-v4">🔒 Todos los planes incluyen actualizaciones y soporte.</p>

      <section className="ordely-plan-tools-compact">
        <div className="ordely-plan-tools-head">
          <div>
            <span>Gestiona tu plan</span>
            <h2>Actualiza, canjea y consulta</h2>
          </div>
          <p>Solicita un plan por WhatsApp o usa un código especial. La activación se refleja en tu cuenta.</p>
        </div>

        <div className="ordely-plan-tools-grid">
          <div className="ordely-compact-redeem">
            <strong>Canjear código</strong>
            <form onSubmit={canjearCodigo}>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="PREMIUM30, PRO90 o VIP-PRO"
                autoComplete="off"
              />
              <button type="submit" className="btn btn-primary" disabled={canjeando}>
                {canjeando ? 'Canjeando...' : 'Canjear'}
              </button>
            </form>
            {mensaje && (
              <div className={tipoMensaje === 'success' ? 'redeem-message redeem-message-success' : 'redeem-message redeem-message-error'}>
                {mensaje}
              </div>
            )}
          </div>

          <div className="ordely-compact-process">
            <strong>Cómo se activa</strong>
            <div><span>1</span> Solicitas</div>
            <i>→</i>
            <div><span>2</span> Pagas o canjeas</div>
            <i>→</i>
            <div><span>3</span> Se desbloquea</div>
          </div>

          <div className="ordely-compact-history">
            <strong>Última activación</strong>
            {suscripciones[0] ? (
              <div>
                <span>{planNombreCorto[suscripciones[0].plan] || suscripciones[0].plan}</span>
                <b>{formatearDinero(suscripciones[0].monto)}</b>
                <small>{suscripciones[0].estado_pago} · Vence {formatearFecha(suscripciones[0].fecha_fin)}</small>
              </div>
            ) : <p>Sin activaciones registradas.</p>}
          </div>
        </div>

        <div className="ordely-plan-summary-strip">
          <span><b>Básico</b> 30 pedidos</span>
          <span><b>Premium</b> Pedidos ilimitados</span>
          <span><b>Pro</b> Estadísticas, gráficas y filtros</span>
        </div>
      </section>
    </Layout>
  )
}
