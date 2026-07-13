import { Link } from 'react-router-dom'
import { resumenUsoPlan } from '../lib/planes'

export default function PlanLimitNotice({ estadoPlan, titulo, descripcion, compacto = false }) {
  if (!estadoPlan) return null

  const cuentaBloqueada = estadoPlan.cuenta_bloqueada === true
  const limiteAlcanzado = estadoPlan.limite_alcanzado === true
  const planVencido = estadoPlan.plan_vencido === true
  const esBasico = estadoPlan.plan_actual === 'basico'

  if (!cuentaBloqueada && !limiteAlcanzado && !planVencido) return null

  const kicker = cuentaBloqueada
    ? 'Cuenta bloqueada'
    : planVencido
      ? 'Plan vencido'
      : 'Límite alcanzado'

  const tituloFinal = titulo || (
    cuentaBloqueada
      ? 'Tu cuenta está bloqueada temporalmente'
      : planVencido
        ? 'Tu plan venció'
        : 'Has llegado al límite del Plan Básico'
  )

  const descripcionFinal = descripcion || (
    cuentaBloqueada
      ? 'Puedes revisar tu información, pero no modificarla hasta que tu cuenta sea desbloqueada.'
      : planVencido
        ? 'Puedes seguir viendo tu información, pero para crear, editar o eliminar necesitas renovar tu plan.'
        : esBasico
          ? `Has usado ${resumenUsoPlan(estadoPlan)}. Para crear, editar o eliminar información necesitas actualizar a Premium o Pro.`
          : 'Tu plan no permite modificar información en este momento.'
  )

  return (
    <div className={compacto ? 'plan-limit-card plan-limit-card-compact' : 'plan-limit-card'}>
      <div>
        <span className="plan-limit-kicker">{kicker}</span>
        <h2>{tituloFinal}</h2>
        <p>{descripcionFinal}</p>
      </div>

      <div className="plan-limit-actions">
        <Link to="/planes" className="btn btn-primary">
          Ver planes
        </Link>
      </div>
    </div>
  )
}
