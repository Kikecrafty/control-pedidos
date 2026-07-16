import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularComisionReferido,
  calcularPorcentajeComision,
  calcularPremioPlan,
  calcularRecompensasConversion,
  crearEnlaceReferido,
  normalizarCodigoReferido,
  obtenerNivelesPremioReferidos,
  obtenerPorcentajeRutaReferidos,
  obtenerProgresoReferidos
} from '../src/lib/referidos.js'

test('la comisión usa precios regulares y aumenta de diez en diez hasta 60%', () => {
  assert.equal(calcularPorcentajeComision(19), 0)
  assert.equal(calcularPorcentajeComision(20), 20)
  assert.equal(calcularPorcentajeComision(37), 30)
  assert.equal(calcularPorcentajeComision(60), 60)
  assert.equal(calcularPorcentajeComision(100), 60)
  assert.equal(calcularComisionReferido('premium', 20), 15.8)
  assert.equal(calcularComisionReferido('premium', 60), 47.4)
  assert.equal(calcularComisionReferido('pro', 60), 77.4)
  assert.equal(calcularComisionReferido('basico'), 0)
})

test('los primeros nueve reciben 15 días y desde el décimo reciben 30 días Premium', () => {
  assert.deepEqual(calcularRecompensasConversion(9, 'premium'), {
    premioPlan: { plan: 'premium', dias: 15, ilimitado: false },
    porcentajeComision: 0,
    comision: 0,
  })
  assert.deepEqual(calcularRecompensasConversion(10, 'premium'), {
    premioPlan: { plan: 'premium', dias: 30, ilimitado: false },
    porcentajeComision: 0,
    comision: 0
  })
})

test('los niveles 50, 75 y 100 mejoran las recompensas Pro', () => {
  assert.deepEqual(calcularPremioPlan(49), { plan: 'premium', dias: 30, ilimitado: false })
  assert.deepEqual(calcularPremioPlan(50), { plan: 'pro', dias: 15, ilimitado: false })
  assert.deepEqual(calcularPremioPlan(75), { plan: 'pro', dias: 30, ilimitado: false })
  assert.deepEqual(calcularPremioPlan(100), { plan: 'pro', dias: 0, ilimitado: true })
})

test('solo el premio correspondiente al siguiente referido aparece activo', () => {
  assert.deepEqual(obtenerNivelesPremioReferidos(0).map((nivel) => nivel.estado), [
    'activo', 'bloqueado', 'bloqueado', 'bloqueado', 'bloqueado'
  ])
  assert.deepEqual(obtenerNivelesPremioReferidos(9).map((nivel) => nivel.estado), [
    'completado', 'activo', 'bloqueado', 'bloqueado', 'bloqueado'
  ])
  assert.deepEqual(obtenerNivelesPremioReferidos(74).map((nivel) => nivel.estado), [
    'completado', 'completado', 'completado', 'activo', 'bloqueado'
  ])
  assert.deepEqual(obtenerNivelesPremioReferidos(100).map((nivel) => nivel.estado), [
    'completado', 'completado', 'completado', 'completado', 'activo'
  ])
})

test('el progreso avanza por bloques de diez conversiones aprobadas', () => {
  assert.deepEqual(obtenerProgresoReferidos(7), {
    total: 7,
    anterior: 0,
    siguiente: 10,
    faltan: 3,
    porcentaje: 70
  })
  assert.equal(obtenerProgresoReferidos(24).siguiente, 30)
  assert.equal(obtenerProgresoReferidos(24).porcentaje, 40)
  assert.equal(obtenerProgresoReferidos(70).siguiente, 75)
  assert.equal(obtenerProgresoReferidos(100).faltan, 0)
  assert.equal(obtenerPorcentajeRutaReferidos(9), 0)
  assert.equal(obtenerPorcentajeRutaReferidos(10), 0)
  assert.equal(obtenerPorcentajeRutaReferidos(15), 7)
  assert.equal(obtenerPorcentajeRutaReferidos(75), 86)
  assert.equal(obtenerPorcentajeRutaReferidos(100), 100)
})

test('solo se aceptan códigos Ordely válidos y el enlace conserva el código', () => {
  assert.equal(normalizarCodigoReferido(' ord-ab12cd34 '), 'ORD-AB12CD34')
  assert.equal(normalizarCodigoReferido('código inválido'), '')
  assert.equal(
    crearEnlaceReferido('https://miordely.com/', 'ord-ab12cd34'),
    'https://miordely.com/login?modo=registro&ref=ORD-AB12CD34'
  )
})
