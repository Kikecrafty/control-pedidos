import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  HISTORIAL_VERSIONES,
  NOVEDADES_ACTUALES,
  NOVEDADES_VERSION_ACTUAL,
  crearLlaveNovedades,
  marcarNovedadesVistas,
  novedadesFueronVistas,
  novedadesRemotasFueronVistas
} from '../src/lib/novedades.js'

const crearStorage = () => {
  const datos = new Map()

  return {
    getItem: (llave) => datos.get(llave) ?? null,
    setItem: (llave, valor) => datos.set(llave, valor)
  }
}

test('las novedades se guardan una sola vez por versión y cuenta', () => {
  const storage = crearStorage()

  assert.equal(novedadesFueronVistas('usuario-a', storage), false)
  assert.equal(marcarNovedadesVistas('usuario-a', storage), true)
  assert.equal(novedadesFueronVistas('usuario-a', storage), true)
  assert.equal(novedadesFueronVistas('usuario-b', storage), false)
})

test('una versión anterior vuelve a abrir las novedades', () => {
  const storage = crearStorage()
  const llave = crearLlaveNovedades('usuario-a')

  storage.setItem(llave, '1.0.2')
  assert.equal(novedadesFueronVistas('usuario-a', storage), false)

  marcarNovedadesVistas('usuario-a', storage)
  assert.equal(storage.getItem(llave), NOVEDADES_VERSION_ACTUAL)
})

test('el estado remoto solo reconoce la versión pública actual', () => {
  assert.equal(novedadesRemotasFueronVistas(NOVEDADES_VERSION_ACTUAL), true)
  assert.equal(novedadesRemotasFueronVistas('1.0.2'), false)
  assert.equal(novedadesRemotasFueronVistas(null), false)
})

test('el contenido público no incluye apartados administrativos', () => {
  const texto = JSON.stringify(NOVEDADES_ACTUALES).toLowerCase()

  assert.equal(texto.includes('administrador'), false)
  assert.equal(texto.includes('admin control'), false)
  assert.equal(NOVEDADES_ACTUALES.secciones.length, 4)
})

test('las novedades corresponden a la versión actual del programa', () => {
  const packageJson = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  )

  assert.equal(NOVEDADES_VERSION_ACTUAL, packageJson.version)
  assert.equal(NOVEDADES_ACTUALES.version, packageJson.version)
  assert.equal(HISTORIAL_VERSIONES[0].version, packageJson.version)
})

test('el historial conserva versiones únicas de la más reciente a la inicial', () => {
  const versiones = HISTORIAL_VERSIONES.map((item) => item.version)

  assert.deepEqual(versiones, ['1.1.0', '1.0.2', '1.0.1', '1.0.0'])
  assert.equal(new Set(versiones).size, versiones.length)
  assert.equal(HISTORIAL_VERSIONES.every((item) => item.secciones.length > 0), true)
})

test('un identificador vacío no abre ni guarda novedades', () => {
  const storage = crearStorage()

  assert.equal(novedadesFueronVistas('', storage), true)
  assert.equal(marcarNovedadesVistas('', storage), false)
})
