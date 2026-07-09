import { supabase } from '../supabaseClient'

export const planTexto = {
  basico: 'Plan Básico',
  premium: 'Plan Premium',
  pro: 'Plan Pro'
}

export const nombrePlan = (plan) => {
  return planTexto[plan] || 'Plan Básico'
}

export async function procesarMiPlanVencido() {
  const { data, error } = await supabase.rpc('procesar_mi_plan_vencido')

  if (error) {
    console.log('No se pudo procesar vencimiento del plan:', error)
    return null
  }

  if (Array.isArray(data)) return data[0] || null
  return data || null
}

export async function cargarEstadoPlan() {
  await procesarMiPlanVencido()

  const { data, error } = await supabase.rpc('mi_estado_plan')

  if (error) {
    console.log(error)
    return null
  }

  if (Array.isArray(data)) return data[0] || null
  return data || null
}

export function estaBloqueadoPorPlan(estadoPlan) {
  if (!estadoPlan) return false
  return estadoPlan.puede_modificar === false
}

export function puedeCrearPedido(estadoPlan) {
  if (!estadoPlan) return true
  return estadoPlan.puede_crear_pedido !== false
}

export function resumenUsoPlan(estadoPlan) {
  if (!estadoPlan) return 'Cargando plan...'

  if (estadoPlan.plan_actual === 'basico') {
    return `${Number(estadoPlan.pedidos_usados || 0)} / ${Number(estadoPlan.limite_pedidos || 30)} pedidos`
  }

  return 'Pedidos ilimitados'
}

export function diasParaVencer(estadoPlan) {
  if (!estadoPlan?.plan_expira_en) return null

  const hoy = new Date()
  const vence = new Date(estadoPlan.plan_expira_en)
  const diferencia = vence.getTime() - hoy.getTime()

  return Math.ceil(diferencia / (1000 * 60 * 60 * 24))
}
