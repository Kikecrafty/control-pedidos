import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import { cargarEstadoPlan, estaBloqueadoPorPlan } from '../lib/planes'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [estadoPlan, setEstadoPlan] = useState(null)
  const [modalCliente, setModalCliente] = useState(false)
  const [clienteEditando, setClienteEditando] = useState(null)
  const [toast, setToast] = useState(null)

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    cargarClientes()
    cargarPlan()
  }, [])

  const cargarPlan = async () => {
    const estado = await cargarEstadoPlan()
    setEstadoPlan(estado)
  }

  const bloqueado = estaBloqueadoPorPlan(estadoPlan)

  const mostrarToast = (mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo })
  }

  const bloquearSiNoPuede = () => {
    if (!bloqueado) return false
    mostrarToast('Tu Plan Básico llegó al límite. Actualiza a Premium para modificar información.', 'error')
    return true
  }

  const normalizarTelefono = (valor) => {
    const limpio = String(valor || '').replace(/\D/g, '')

    if (limpio.startsWith('52') && limpio.length > 10) {
      return limpio.slice(2)
    }

    return limpio
  }

  const cargarClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('creado_en', { ascending: false })

    if (error) {
      console.log(error)
      mostrarToast('Error al cargar clientes', 'error')
      return
    }

    setClientes(data || [])
  }

  const limpiarFormulario = () => {
    setClienteEditando(null)
    setNombre('')
    setTelefono('')
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
    setTelefono(normalizarTelefono(cliente.telefono || ''))
    setDireccion(cliente.direccion || '')
    setNotas(cliente.notas || '')
    setModalCliente(true)
  }

  const cerrarModalCliente = () => {
    setModalCliente(false)
    limpiarFormulario()
  }

  const guardarCliente = async (e) => {
    e.preventDefault()

    if (bloquearSiNoPuede()) return

    const telefonoFinal = normalizarTelefono(telefono)

    if (!nombre.trim()) {
      mostrarToast('El nombre es obligatorio', 'error')
      return
    }

    if (!telefonoFinal) {
      mostrarToast('El teléfono es obligatorio', 'error')
      return
    }

    if (clienteEditando) {
      const { error } = await supabase
        .from('clientes')
        .update({
          nombre: nombre.trim(),
          telefono: telefonoFinal,
          direccion,
          notas
        })
        .eq('id', clienteEditando.id)

      if (error) {
        console.log(error)
        mostrarToast('Error al actualizar cliente', 'error')
        return
      }

      cerrarModalCliente()
      await cargarClientes()
      mostrarToast('Cliente actualizado correctamente')
      return
    }

    const { error } = await supabase
      .from('clientes')
      .insert([
        {
          nombre: nombre.trim(),
          telefono: telefonoFinal,
          direccion,
          notas
        }
      ])

    if (error) {
      console.log(error)
      mostrarToast('Error al guardar cliente', 'error')
      return
    }

    cerrarModalCliente()
    await cargarClientes()
    mostrarToast('Cliente agregado correctamente')
  }

  const eliminarCliente = async (id) => {
    if (bloquearSiNoPuede()) return

    const confirmar = confirm('¿Seguro que quieres eliminar este cliente?')

    if (!confirmar) return

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id)

    if (error) {
      console.log(error)
      mostrarToast('Error al eliminar cliente', 'error')
      return
    }

    await cargarClientes()
    mostrarToast('Cliente eliminado correctamente')
  }

  const limpiarTelefono = (telefono) => {
    return normalizarTelefono(telefono)
  }

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

        <button className="btn btn-primary" onClick={abrirAgregarCliente} disabled={bloqueado}>
          Agregar cliente
        </button>
      </div>

      <PlanLimitNotice estadoPlan={estadoPlan} compacto />

      <div className="table-card desktop-table">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Dirección</th>
              <th>Notas</th>
              <th>WhatsApp</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.nombre}</td>
                <td>+52 {cliente.telefono}</td>
                <td>{cliente.direccion || '-'}</td>
                <td>{cliente.notas || '-'}</td>
                <td>
                  {cliente.telefono && (
                    <a
                      href={`https://wa.me/52${limpiarTelefono(cliente.telefono)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Enviar mensaje
                    </a>
                  )}
                </td>
                <td className="actions">
                  <button
                    onClick={() => abrirEditarCliente(cliente)}
                    className="btn btn-light-bordered btn-small"
                    disabled={bloqueado}
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => eliminarCliente(cliente.id)}
                    className="btn btn-danger btn-small"
                    disabled={bloqueado}
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
        {clientes.map((cliente) => (
          <div className="mobile-card" key={cliente.id}>
            <div className="mobile-card-header">
              <div>
                <h3>{cliente.nombre}</h3>
                <p>+52 {cliente.telefono || 'Sin teléfono'}</p>
              </div>
            </div>

            <div className="mobile-card-info">
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
              {cliente.telefono && (
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
                disabled={bloqueado}
              >
                Editar
              </button>

              <button
                onClick={() => eliminarCliente(cliente.id)}
                className="btn btn-danger"
                disabled={bloqueado}
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

      <Modal
        abierto={modalCliente}
        titulo={clienteEditando ? 'Editar cliente' : 'Agregar cliente'}
        onClose={cerrarModalCliente}
      >
        <form onSubmit={guardarCliente}>
          <div className="modal-form-grid">
            <input
              placeholder="Nombre del cliente"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />

            <div className="phone-field">
              <span>+52</span>
              <input
                placeholder="Teléfono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                inputMode="numeric"
                required
              />
            </div>

            <input
              placeholder="Dirección"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />

            <input
              placeholder="Notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-light-bordered"
              onClick={cerrarModalCliente}
            >
              Cancelar
            </button>

            <button className="btn btn-primary" disabled={bloqueado}>
              {clienteEditando ? 'Guardar cambios' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  )
}
