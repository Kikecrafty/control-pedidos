import { Link } from 'react-router-dom'
import {
  estaCercaDelLimiteBasico,
  pedidosRestantesPlanBasico,
  resumenUsoPlan
} from '../lib/planes'
import '../styles/37-version-historial-limites.css'

export default function PlanLimitNotice({
  estadoPlan,
  titulo,
  descripcion,
  compacto = false,
  avisarCercaDelLimite = false
}) {
  if (!estadoPlan) return null

  const cuentaBloqueada = estadoPlan.cuenta_bloqueada === true
  const limiteAlcanzado = estadoPlan.limite_alcanzado === true
  const planVencido = estadoPlan.plan_vencido === true
  const esBasico = estadoPlan.plan_actual === 'basico'
  const cercaDelLimite = (
    avisarCercaDelLimite &&
    !cuentaBloqueada &&
    !limiteAlcanzado &&
    !planVencido &&
    estaCercaDelLimiteBasico(estadoPlan)
  )
  const pedidosRestantes = pedidosRestantesPlanBasico(estadoPlan)

  if (!cuentaBloqueada && !limiteAlcanzado && !planVencido && !cercaDelLimite) return null

  const kicker = cuentaBloqueada
    ? 'Cuenta bloqueada'
    : planVencido
      ? 'Plan vencido'
      : limiteAlcanzado
        ? 'Límite alcanzado'
        : 'Aviso del Plan Básico'

  const tituloFinal = titulo || (
    cuentaBloqueada
      ? 'Tu cuenta está bloqueada temporalmente'
      : planVencido
        ? 'Tu plan venció'
        : limiteAlcanzado
          ? 'Has llegado al límite del Plan Básico'
          : `Te ${pedidosRestantes === 1 ? 'queda' : 'quedan'} ${pedidosRestantes} ${pedidosRestantes === 1 ? 'pedido' : 'pedidos'}`
  )

  const descripcionFinal = descripcion || (
    cuentaBloqueada
      ? 'Puedes revisar tu información, pero no modificarla hasta que tu cuenta sea desbloqueada.'
      : planVencido
        ? 'Puedes seguir viendo tu información, pero para crear, editar o eliminar necesitas renovar tu plan.'
        : limiteAlcanzado && esBasico
          ? `Has usado ${resumenUsoPlan(estadoPlan)}. Para crear, editar o eliminar información necesitas actualizar a Premium o Pro.`
          : cercaDelLimite
            ? `Has usado ${resumenUsoPlan(estadoPlan)}. Al llegar al límite no podrás crear otro pedido, pero tus pedidos actuales seguirán disponibles.`
            : 'Tu plan no permite modificar información en este momento.'
  )

  const claseEstado = cercaDelLimite
    ? ' plan-limit-card-warning'
    : limiteAlcanzado
      ? ' plan-limit-card-danger'
      : ''

  return (
    <div
      className={`${compacto ? 'plan-limit-card plan-limit-card-compact' : 'plan-limit-card'}${claseEstado}`}
      role="status"
      aria-live="polite"
    >
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
