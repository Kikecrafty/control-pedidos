import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BIENVENIDA_FLUJO_ID,
  bienvenidaFueVista,
  bienvenidaRemotaFueVista,
  crearLlaveBienvenida,
  marcarBienvenidaVista
} from '../src/lib/bienvenida.js'

const crearStorage = () => {
  const datos = new Map()

  return {
    getItem: (llave) => datos.get(llave) ?? null,
    setItem: (llave, valor) => datos.set(llave, valor)
  }
}

test('la bienvenida se guarda de forma independiente para cada cuenta', () => {
  const storage = crearStorage()

  assert.equal(bienvenidaFueVista('usuario-a', storage), false)
  assert.equal(marcarBienvenidaVista('usuario-a', storage), true)
  assert.equal(bienvenidaFueVista('usuario-a', storage), true)
  assert.equal(bienvenidaFueVista('usuario-b', storage), false)
})

test('la marca permite renovar la guía en el futuro sin cambiar su llave', () => {
  const storage = crearStorage()
  const llave = crearLlaveBienvenida('usuario-a')

  storage.setItem(llave, 'flujo-anterior')
  assert.equal(bienvenidaFueVista('usuario-a', storage), false)

  marcarBienvenidaVista('usuario-a', storage)
  assert.equal(storage.getItem(llave), BIENVENIDA_FLUJO_ID)
})

test('un identificador vacío no abre ni guarda la bienvenida', () => {
  const storage = crearStorage()

  assert.equal(bienvenidaFueVista('', storage), true)
  assert.equal(marcarBienvenidaVista('', storage), false)
})

test('el estado remoto solo reconoce la versión actual de la guía', () => {
  assert.equal(bienvenidaRemotaFueVista(BIENVENIDA_FLUJO_ID), true)
  assert.equal(bienvenidaRemotaFueVista('flujo-anterior'), false)
  assert.equal(bienvenidaRemotaFueVista(null), false)
})
