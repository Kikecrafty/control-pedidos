import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import { cargarEstadoPlan, estaBloqueadoPorPlan } from '../lib/planes'

const PAGE_SIZE_OPTIONS = [25, 50, 100]
const CLIENTES_CACHE_LIMIT = 50

const MEDIOS_CONTACTO = [
  'WhatsApp',
  'Facebook / Messenger',
  'Instagram',
  'TikTok',
  'Telegram',
  'Local / en persona',
  'Otro'
]

const requiereTelefono = (medio) => String(medio || 'WhatsApp').toLowerCase().includes('whatsapp')

const obtenerIdUsuarioCache = () => {
  if (typeof window === 'undefined') return 'sin_usuario'

  try {
    const llaves = Object.keys(localStorage)
    const llaveAuth = llaves.find((llave) => llave.startsWith('sb-') && llave.endsWith('-auth-token'))

    if (llaveAuth) {
      const valor = JSON.parse(localStorage.getItem(llaveAuth) || '{}')
      const userId = valor?.user?.id || valor?.currentSession?.user?.id
      if (userId) return userId
    }
  } catch (error) {
    console.log(error)
  }

  return localStorage.getItem('control_pedidos_usuario_cache') || 'sin_usuario'
}

const cacheKeyClientes = () => `control_pedidos_clientes_cache_${obtenerIdUsuarioCache()}`

const leerClientesCache = () => {
  if (typeof window === 'undefined') return []

  try {
    const guardado = localStorage.getItem(cacheKeyClientes())
    return guardado ? JSON.parse(guardado)?.clientes || [] : []
  } catch (error) {
    console.log(error)
    return []
  }
}

const guardarClientesCache = (clientes) => {
  if (typeof window === 'undefined') return

  try {
    const userId = obtenerIdUsuarioCache()
    localStorage.setItem('control_pedidos_usuario_cache', userId)
    localStorage.setItem(
      cacheKeyClientes(),
      JSON.stringify({
        clientes: (clientes || []).slice(0, CLIENTES_CACHE_LIMIT),
        guardado_en: new Date().toISOString()
      })
    )
  } catch (error) {
    console.log(error)
  }
}

export default function Clientes() {
  const [clientes, setClientes] = useState(() => leerClientesCache())
  const [totalClientes, setTotalClientes] = useState(() => leerClientesCache().length)
  const [pagina, setPagina] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(25)
  const [busqueda, setBusqueda] = useState('')
  const [cargandoClientes, setCargandoClientes] = useState(false)

  const [estadoPlan, setEstadoPlan] = useState(null)
  const [modalCliente, setModalCliente] = useState(false)
  const [clienteEditando, setClienteEditando] = useState(null)
  const [toast, setToast] = useState(null)
  const accionEnProcesoRef = useRef(false)
  const [accionEnProceso, setAccionEnProceso] = useState('')

  const [nombre, setNombre] = useState('')
  const [medioContacto, setMedioContacto] = useState('WhatsApp')
  const [telefono, setTelefono] = useState('')
  const [usuarioContacto, setUsuarioContacto] = useState('')
  const [direccion, setDireccion] = useState('')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    cargarPlan()
  }, [])

  useEffect(() => {
    cargarClientes()
  }, [pagina, tamanoPagina, busqueda])

  useEffect(() => {
    setPagina(1)
  }, [busqueda, tamanoPagina])

  const totalPaginas = useMemo(() => {
    return Math.max(1, Math.ceil(totalClientes / tamanoPagina))
  }, [totalClientes, tamanoPagina])

  const cargarPlan = async () => {
    const estado = await cargarEstadoPlan()
    setEstadoPlan(estado)
  }

  const bloqueado = estaBloqueadoPorPlan(estadoPlan)

  const mostrarToast = (mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo })
  }

  const iniciarAccion = (mensaje = 'Procesando...') => {
    if (accionEnProcesoRef.current) return false
    accionEnProcesoRef.current = true
    setAccionEnProceso(mensaje)
    return true
  }

  const finalizarAccion = () => {
    accionEnProcesoRef.current = false
    setAccionEnProceso('')
  }

  const estaProcesando = Boolean(accionEnProceso)

  const bloquearSiNoPuede = () => {
    if (!bloqueado) return false
    mostrarToast('Tu Plan Básico llegó al límite. Actualiza a Premium para modificar información.', 'error')
    return true
  }

  const normalizarTelefono = (valor) => {
    const limpio = String(valor || '').replace(/\D/g, '')

    if (limpio.startsWith('52') && limpio.length > 10) {
      return limpio.slice(2, 12)
    }

    return limpio.slice(0, 10)
  }

  const obtenerContactoPrincipal = (cliente) => {
    const medio = cliente?.medio_contacto || 'WhatsApp'
    const telefonoCliente = normalizarTelefono(cliente?.telefono || '')
    const usuario = String(cliente?.usuario_contacto || '').trim()

    if (requiereTelefono(medio) && telefonoCliente) return `+52 ${telefonoCliente}`
    if (usuario) return usuario
    if (telefonoCliente) return `+52 ${telefonoCliente}`
    return 'Sin contacto directo'
  }

  const cargarClientes = async () => {
    setCargandoClientes(true)

    const desde = (pagina - 1) * tamanoPagina
    const hasta = desde + tamanoPagina - 1
    const texto = busqueda.trim()

    let consulta = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .order('creado_en', { ascending: false })
      .range(desde, hasta)

    if (texto) {
      const limpio = texto.replace(/[%_]/g, '')
      consulta = consulta.or(`nombre.ilike.%${limpio}%,telefono.ilike.%${limpio}%,medio_contacto.ilike.%${limpio}%,usuario_contacto.ilike.%${limpio}%,direccion.ilike.%${limpio}%,notas.ilike.%${limpio}%`)
    }

    const { data, error, count } = await consulta

    setCargandoClientes(false)

    if (error) {
      console.log(error)
      mostrarToast('Error al cargar clientes', 'error')
      return
    }

    const clientesFinal = data || []
    setClientes(clientesFinal)
    setTotalClientes(count || 0)
    guardarClientesCache(clientesFinal)
  }

  const limpiarFormulario = () => {
    setClienteEditando(null)
    setNombre('')
    setMedioContacto('WhatsApp')
    setTelefono('')
    setUsuarioContacto('')
    setDireccion('')
    setNotas('')
  }

  const abrirAgregarCliente = () => {
    if (bloquearSiNoPuede()) return
    limpiarFormulario()
    setModalCliente(true)
  }

  const abrirEditarCliente = (cliente) => {
    if (bloquearSiNoPuede()) return
    setClienteEditando(cliente)
    setNombre(cliente.nombre || '')
    setMedioContacto(cliente.medio_contacto || 'WhatsApp')
    setTelefono(normalizarTelefono(cliente.telefono || ''))
    setUsuarioContacto(cliente.usuario_contacto || '')
    setDireccion(cliente.direccion || '')
    setNotas(cliente.notas || '')
    setModalCliente(true)
  }

  const cerrarModalCliente = () => {
    if (estaProcesando) return
    setModalCliente(false)
    limpiarFormulario()
  }

  const guardarCliente = async (e) => {
    e.preventDefault()

    if (bloquearSiNoPuede()) return
    if (accionEnProcesoRef.current) return

    const telefonoFinal = normalizarTelefono(telefono)

    if (!nombre.trim()) {
      mostrarToast('El nombre es obligatorio', 'error')
      return
    }

    if (requiereTelefono(medioContacto) && (!telefonoFinal || telefonoFinal.length < 10)) {
      mostrarToast('Para WhatsApp escribe un teléfono válido de 10 dígitos', 'error')
      return
    }

    if (!iniciarAccion(clienteEditando ? 'Guardando cambios...' : 'Guardando cliente...')) return

    try {
      if (clienteEditando) {
        const { error } = await supabase
          .from('clientes')
          .update({
            nombre: nombre.trim(),
            medio_contacto: medioContacto,
            telefono: telefonoFinal || null,
            usuario_contacto: usuarioContacto.trim(),
            direccion,
            notas
          })
          .eq('id', clienteEditando.id)

        if (error) {
          console.log(error)
          mostrarToast('Error al actualizar cliente', 'error')
          return
        }

        setModalCliente(false)
        limpiarFormulario()
        await cargarClientes()
        mostrarToast('Cliente actualizado correctamente')
        return
      }

      const { error } = await supabase
        .from('clientes')
        .insert([
          {
            nombre: nombre.trim(),
            medio_contacto: medioContacto,
            telefono: telefonoFinal || null,
            usuario_contacto: usuarioContacto.trim(),
            direccion,
            notas
          }
        ])

      if (error) {
        console.log(error)
        mostrarToast('Error al guardar cliente', 'error')
        return
      }

      setModalCliente(false)
      limpiarFormulario()
      setBusqueda('')
      setPagina(1)
      await cargarClientes()
      mostrarToast('Cliente agregado correctamente')
    } finally {
      finalizarAccion()
    }
  }

  const eliminarCliente = async (id) => {
    if (bloquearSiNoPuede()) return
    if (accionEnProcesoRef.current) return

    const confirmar = confirm('¿Seguro que quieres eliminar este cliente?')

    if (!confirmar) return
    if (!iniciarAccion('Validando cliente...')) return

    try {
      const { count, error: errorConteo } = await supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', id)

      if (errorConteo) {
        console.log(errorConteo)
        mostrarToast('No se pudo validar si el cliente tiene pedidos', 'error')
        return
      }

      if ((count || 0) > 0) {
        mostrarToast('Este cliente ya tiene pedidos. No se elimina para proteger el historial.', 'error')
        return
      }

      setAccionEnProceso('Eliminando cliente...')

      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id)

      if (error) {
        console.log(error)
        mostrarToast('Error al eliminar cliente', 'error')
        return
      }

      const nuevaPagina = clientes.length === 1 && pagina > 1 ? pagina - 1 : pagina
      setPagina(nuevaPagina)
      await cargarClientes()
      mostrarToast('Cliente eliminado correctamente')
    } finally {
      finalizarAccion()
    }
  }

  const limpiarTelefono = (telefono) => {
    return normalizarTelefono(telefono)
  }

  const limpiarBusqueda = () => {
    setBusqueda('')
    setPagina(1)
  }

  const irPaginaAnterior = () => {
    setPagina((actual) => Math.max(1, actual - 1))
  }

  const irPaginaSiguiente = () => {
    setPagina((actual) => Math.min(totalPaginas, actual + 1))
  }

  const desdeVisible = totalClientes === 0 ? 0 : ((pagina - 1) * tamanoPagina) + 1
  const hastaVisible = Math.min(pagina * tamanoPagina, totalClientes)

  return (
    <Layout>
      <Toast
        mensaje={toast?.mensaje}
        tipo={toast?.tipo}
        onClose={() => setToast(null)}
      />

      <div className="page-header row-between">
        <div>
          <h1>Clientes</h1>
          <p>Registra y administra tus clientes</p>
        </div>

        <button className="btn btn-primary" onClick={abrirAgregarCliente} disabled={bloqueado || estaProcesando}>
          Agregar cliente
        </button>
      </div>

      <PlanLimitNotice estadoPlan={estadoPlan} compacto />

      <div className="list-toolbar-card">
        <div className="form-field">
          <label>Buscar cliente</label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, medio, usuario, teléfono o notas"
          />
        </div>

        <label className="form-field list-page-size-field">
          <span>Mostrar</span>
          <select
            value={tamanoPagina}
            onChange={(e) => setTamanoPagina(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((opcion) => (
              <option key={opcion} value={opcion}>{opcion}</option>
            ))}
          </select>
        </label>

        {busqueda && (
          <button type="button" className="btn btn-light-bordered" onClick={limpiarBusqueda}>
            Limpiar
          </button>
        )}
      </div>

      <div className="table-card desktop-table">
        <div className="row-between table-title">
          <h2>Clientes encontrados: {totalClientes}</h2>
          <span className="pagination-range">
            {cargandoClientes ? 'Actualizando...' : `${desdeVisible}-${hastaVisible} de ${totalClientes}`}
          </span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Medio</th>
              <th>Contacto</th>
              <th>Dirección</th>
              <th>Notas</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.nombre}</td>
                <td><span className="contact-medium-pill">{cliente.medio_contacto || 'WhatsApp'}</span></td>
                <td>{obtenerContactoPrincipal(cliente)}</td>
                <td>{cliente.direccion || '-'}</td>
                <td>{cliente.notas || '-'}</td>
                <td className="actions">
                  <button
                    onClick={() => abrirEditarCliente(cliente)}
                    className="btn btn-light-bordered btn-small"
                    disabled={bloqueado || estaProcesando}
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => eliminarCliente(cliente.id)}
                    className="btn btn-danger btn-small"
                    disabled={bloqueado || estaProcesando}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {clientes.length === 0 && (
              <tr>
                <td colSpan="6">Todavía no tienes clientes registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-list">
        <div className="mobile-list-title">
          <h2>Clientes encontrados: {totalClientes}</h2>
          <span className="pagination-range">
            {cargandoClientes ? 'Actualizando...' : `${desdeVisible}-${hastaVisible} de ${totalClientes}`}
          </span>
        </div>

        {clientes.map((cliente) => (
          <div className="mobile-card" key={cliente.id}>
            <div className="mobile-card-header">
              <div>
                <h3>{cliente.nombre}</h3>
                <p>{cliente.medio_contacto || 'WhatsApp'} · {obtenerContactoPrincipal(cliente)}</p>
              </div>
            </div>

            <div className="mobile-card-info">
              <div>
                <span>Medio</span>
                <strong>{cliente.medio_contacto || 'WhatsApp'}</strong>
              </div>

              <div>
                <span>Contacto</span>
                <strong>{obtenerContactoPrincipal(cliente)}</strong>
              </div>

              <div>
                <span>Dirección</span>
                <strong>{cliente.direccion || '-'}</strong>
              </div>

              <div>
                <span>Notas</span>
                <strong>{cliente.notas || '-'}</strong>
              </div>
            </div>

            <div className="mobile-card-actions multi-actions">
              {requiereTelefono(cliente.medio_contacto) && cliente.telefono && (
                <a
                  href={`https://wa.me/52${limpiarTelefono(cliente.telefono)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                >
                  WhatsApp
                </a>
              )}

              <button
                onClick={() => abrirEditarCliente(cliente)}
                className="btn btn-light-bordered"
                disabled={bloqueado || estaProcesando}
              >
                Editar
              </button>

              <button
                onClick={() => eliminarCliente(cliente.id)}
                className="btn btn-danger"
                disabled={bloqueado || estaProcesando}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        {clientes.length === 0 && (
          <div className="empty-state">
            Todavía no tienes clientes registrados.
          </div>
        )}
      </div>

      {totalClientes > tamanoPagina && (
        <div className="pagination-card">
          <button type="button" className="btn btn-light-bordered" onClick={irPaginaAnterior} disabled={pagina <= 1 || cargandoClientes}>
            Anterior
          </button>

          <div>
            <strong>Página {pagina} de {totalPaginas}</strong>
            <span>{desdeVisible}-{hastaVisible} de {totalClientes}</span>
          </div>

          <button type="button" className="btn btn-light-bordered" onClick={irPaginaSiguiente} disabled={pagina >= totalPaginas || cargandoClientes}>
            Siguiente
          </button>
        </div>
      )}

      <Modal
        abierto={modalCliente}
        titulo={clienteEditando ? 'Editar cliente' : 'Agregar cliente'}
        onClose={cerrarModalCliente}
      >
        <form onSubmit={guardarCliente}>
          <div className="modal-form-grid">
            <label className="form-field">
              <span>Nombre del cliente*</span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Medio de contacto*</span>
              <select
                value={medioContacto}
                onChange={(e) => setMedioContacto(e.target.value)}
                required
              >
                {MEDIOS_CONTACTO.map((medio) => (
                  <option key={medio} value={medio}>{medio}</option>
                ))}
              </select>
              <small className="field-help-text">Elige por dónde te escribió el cliente.</small>
            </label>

            <label className="form-field">
              <span>Teléfono{requiereTelefono(medioContacto) ? '*' : ''}</span>
              <div className="phone-field">
                <span>+52</span>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(normalizarTelefono(e.target.value))}
                  inputMode="numeric"
                  required={requiereTelefono(medioContacto)}
                />
              </div>
              <small className="field-help-text">Solo es obligatorio si el medio es WhatsApp.</small>
            </label>

            <label className="form-field">
              <span>Usuario / perfil</span>
              <input
                value={usuarioContacto}
                onChange={(e) => setUsuarioContacto(e.target.value)}
                placeholder="Ej. @cliente o nombre en Facebook"
              />
              <small className="field-help-text">Opcional para Facebook, Instagram, TikTok u otro medio.</small>
            </label>

            <label className="form-field">
              <span>Dirección</span>
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Notas</span>
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-light-bordered"
              onClick={cerrarModalCliente}
              disabled={estaProcesando}
            >
              Cancelar
            </button>

            <button className="btn btn-primary" disabled={bloqueado || estaProcesando}>
              {accionEnProceso || (clienteEditando ? 'Guardar cambios' : 'Guardar cliente')}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  )
}
