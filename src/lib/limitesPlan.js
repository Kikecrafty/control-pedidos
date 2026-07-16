export function pedidosRestantesPlanBasico(estadoPlan) {
  if (!estadoPlan || estadoPlan.plan_actual !== 'basico') return null

  const limite = Number(estadoPlan.limite_pedidos ?? 30)
  const usados = Number(estadoPlan.pedidos_usados ?? 0)

  if (!Number.isFinite(limite) || !Number.isFinite(usados)) return null
  return Math.max(0, limite - usados)
}

export function estaCercaDelLimiteBasico(estadoPlan, umbral = 5) {
  const restantes = pedidosRestantesPlanBasico(estadoPlan)
  const limiteAviso = Math.max(1, Number(umbral) || 5)

  return restantes !== null && restantes > 0 && restantes <= limiteAviso
}
