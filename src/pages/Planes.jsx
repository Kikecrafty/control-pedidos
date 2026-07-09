import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import PlanLimitNotice from '../components/PlanLimitNotice'
import { supabase } from '../supabaseClient'
import { cargarEstadoPlan, nombrePlan } from '../lib/planes'

const WHATSAPP_ADMIN = '525549075616'

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
    destacado: false,
    funciones: [
      '30 pedidos gratis',
      'Clientes y pedidos',
      'Productos y pagos',
      'Seguimiento público',
      'WhatsApp automático',
      'Métricas bloqueadas con ejemplo'
    ]
  },
  {
    id: 'premium',
    etiqueta: 'Recomendado',
    nombre: 'Plan Premium',
    precio: '$149',
    periodo: 'MXN / mes',
    descripcion: 'Para vender sin límite y usar todas las funciones principales.',
    boton: 'Actualizar a Premium',
    destacado: true,
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
    precio: '$249',
    periodo: 'MXN / mes',
    descripcion: 'Para analizar ventas, ganancias y crecimiento del negocio.',
    boton: 'Actualizar a Pro',
    destacado: false,
    funciones: [
      'Todo Premium',
      'Métricas reales por fecha',
      'Filtro por plataforma',
      'Gráficas de barras y pastel',
      'Top clientes y plataformas',
      'Reportes y cortes próximamente'
    ]
  }
]

const comparacion = [
  { funcion: 'Pedidos', basico: '30 pedidos', premium: 'Ilimitados', pro: 'Ilimitados' },
  { funcion: 'Clientes', basico: 'Sí', premium: 'Ilimitados', pro: 'Ilimitados' },
  { funcion: 'Productos y pagos', basico: 'Sí', premium: 'Sí', pro: 'Sí' },
  { funcion: 'Seguimiento público', basico: 'Sí', premium: 'Sí', pro: 'Sí' },
  { funcion: 'WhatsApp por estado', basico: 'Sí', premium: 'Sí', pro: 'Sí' },
  { funcion: 'Métricas avanzadas', basico: 'Ejemplo bloqueado', premium: 'Ejemplo bloqueado', pro: 'Sí' },
  { funcion: 'Gráficas', basico: 'No', premium: 'No', pro: 'Sí' },
  { funcion: 'Filtros por fecha/plataforma', basico: 'No', premium: 'No', pro: 'Sí' }
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
  const porcentaje = esBasico ? Math.min((pedidosUsados / Math.max(limite, 1)) * 100, 100) : 100
  const cercaLimite = esBasico && restante > 0 && restante <= 5
  const limiteAlcanzado = Boolean(estadoPlan?.limite_alcanzado)

  const mensajeEstado = useMemo(() => {
    if (planActual === 'pro') return 'Tienes acceso completo a pedidos, métricas y funciones avanzadas.'
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
      <div className="page-header plans-header">
        <div>
          <h1>Planes</h1>
          <p>Elige cómo quieres usar Control Pedidos y desbloquea más funciones.</p>
        </div>
      </div>

      <PlanLimitNotice
        estadoPlan={estadoPlan}
        titulo="Has llegado al límite del Plan Básico"
        descripcion="Puedes seguir viendo tu información, pero para crear, editar o eliminar necesitas actualizar a Premium o Pro."
      />

      <section className="plans-hero-card">
        <div className="plans-hero-main">
          <span className="plan-kicker">Tu cuenta</span>
          <h2>{estadoPlan?.nombre || 'Usuario'}</h2>
          <p>{estadoPlan?.correo}</p>

          <div className="plan-current-badges">
            <span>{nombrePlan(planActual)}</span>
            <span>{estadoPlan?.plan_expira_en ? `Vence: ${formatearFecha(estadoPlan.plan_expira_en)}` : 'Sin vencimiento'}</span>
          </div>
        </div>

        <div className="plans-usage-panel">
          <span>Uso del plan</span>
          <strong>{esBasico ? `${pedidosUsados} / ${limite}` : 'Ilimitado'}</strong>
          <p>{mensajeEstado}</p>

          <div className="plan-progress-bar plan-progress-bar-large">
            <span style={{ width: `${porcentaje}%` }} />
          </div>
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

      <section className="plans-grid plans-grid-commercial">
        {planes.map((plan) => {
          const activo = planActual === plan.id
          const esUpgrade = plan.id !== 'basico' && !activo

          return (
            <article
              key={plan.id}
              className={`plan-card ${plan.destacado ? 'plan-card-featured' : ''} ${activo ? 'plan-card-active' : ''}`}
            >
              <span className="plan-kicker">{plan.etiqueta}</span>
              <h2>{plan.nombre}</h2>

              <div className="commercial-price">
                <strong>{plan.precio}</strong>
                <span>{plan.periodo}</span>
              </div>

              <p>{plan.descripcion}</p>

              <ul>
                {plan.funciones.map((funcion) => (
                  <li key={funcion}>{funcion}</li>
                ))}
              </ul>

              {activo ? (
                <button type="button" className="btn btn-light-bordered" disabled>
                  Plan actual
                </button>
              ) : esUpgrade ? (
                <button type="button" className="btn btn-primary" onClick={() => solicitarPlan(plan)}>
                  {plan.boton}
                </button>
              ) : (
                <button type="button" className="btn btn-light-bordered" disabled>
                  Incluido
                </button>
              )}
            </article>
          )
        })}
      </section>

      <section className="plans-two-columns">
        <div className="redeem-card redeem-card-active">
          <div>
            <span className="plan-kicker">Acceso especial</span>
            <h2>Canjear código</h2>
            <p>Ingresa un código para activar Premium o Pro. Algunos códigos pueden no vencer.</p>
          </div>

          <form className="redeem-form" onSubmit={canjearCodigo}>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ejemplo: PREMIUM30, PRO90 o VIP-PRO"
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary" disabled={canjeando}>
              {canjeando ? 'Canjeando...' : 'Canjear código'}
            </button>
          </form>

          {mensaje && (
            <div className={tipoMensaje === 'success' ? 'redeem-message redeem-message-success' : 'redeem-message redeem-message-error'}>
              {mensaje}
            </div>
          )}
        </div>

        <div className="plan-upgrade-info-card">
          <span className="plan-kicker">Cómo funciona</span>
          <h2>Actualización manual por ahora</h2>
          <p>
            Los botones de actualización abren WhatsApp con tu correo y plan solicitado.
            Cuando confirmes tu pago, el administrador lo registra y tu plan queda activado con fecha de vencimiento.
          </p>
          <div className="upgrade-mini-grid">
            <div>
              <strong>1</strong>
              <span>Solicitas plan</span>
            </div>
            <div>
              <strong>2</strong>
              <span>Pagas o canjeas código</span>
            </div>
            <div>
              <strong>3</strong>
              <span>Se desbloquea</span>
            </div>
          </div>
        </div>
      </section>


      <section className="subscription-history-card">
        <div className="table-title">
          <h2>Pagos y activaciones recientes</h2>
          <p className="muted">Aquí aparecen los últimos pagos manuales, códigos o activaciones registradas en tu cuenta.</p>
        </div>

        <div className="subscription-history-list">
          {suscripciones.map((suscripcion) => (
            <div className="subscription-history-item" key={suscripcion.id}>
              <div>
                <strong>{planNombreCorto[suscripcion.plan] || suscripcion.plan}</strong>
                <span>{suscripcion.origen === 'manual' ? 'Pago manual' : suscripcion.origen}</span>
              </div>
              <div>
                <span>Monto</span>
                <strong>{formatearDinero(suscripcion.monto)}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{suscripcion.estado_pago}</strong>
              </div>
              <div>
                <span>Vence</span>
                <strong>{formatearFecha(suscripcion.fecha_fin)}</strong>
              </div>
            </div>
          ))}

          {suscripciones.length === 0 && (
            <div className="empty-state">Aún no hay pagos o activaciones registradas en esta cuenta.</div>
          )}
        </div>
      </section>

      <section className="comparison-card">
        <div className="table-title">
          <h2>Comparación de planes</h2>
          <p className="muted">Así el usuario entiende qué desbloquea cada nivel.</p>
        </div>

        <div className="comparison-table-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Función</th>
                <th>Básico</th>
                <th>Premium</th>
                <th>Pro</th>
              </tr>
            </thead>
            <tbody>
              {comparacion.map((fila) => (
                <tr key={fila.funcion}>
                  <td>{fila.funcion}</td>
                  <td>{fila.basico}</td>
                  <td>{fila.premium}</td>
                  <td>{fila.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pro-preview-card">
        <div>
          <span className="plan-kicker">Vista Pro</span>
          <h2>Qué desbloquean las métricas</h2>
          <p>Los usuarios Básico y Premium ven este tipo de ejemplo bloqueado. Los Pro ven datos reales.</p>
        </div>

        <div className="pro-preview-grid">
          <div>
            <span>Ventas del mes</span>
            <strong>{formatearDinero(18450)}</strong>
          </div>
          <div>
            <span>Ganancia estimada</span>
            <strong>{formatearDinero(5320)}</strong>
          </div>
          <div>
            <span>Pedidos completados</span>
            <strong>42</strong>
          </div>
          <div>
            <span>Top plataforma</span>
            <strong>SHEIN</strong>
          </div>
        </div>
      </section>
    </Layout>
  )
}
