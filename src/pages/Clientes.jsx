import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    cargarClientes()
  }, [])

  const cargarClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('creado_en', { ascending: false })

    if (error) {
      console.log(error)
      alert('Error al cargar clientes')
      return
    }

    setClientes(data || [])
  }

  const guardarCliente = async (e) => {
    e.preventDefault()

    const { error } = await supabase
      .from('clientes')
      .insert([
        {
          nombre,
          telefono,
          direccion,
          notas
        }
      ])

    if (error) {
      console.log(error)
      alert('Error al guardar cliente')
      return
    }

    setNombre('')
    setTelefono('')
    setDireccion('')
    setNotas('')

    cargarClientes()
  }

  const eliminarCliente = async (id) => {
    const confirmar = confirm('¿Seguro que quieres eliminar este cliente?')

    if (!confirmar) return

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id)

    if (error) {
      console.log(error)
      alert('Error al eliminar cliente')
      return
    }

    cargarClientes()
  }

  const limpiarTelefono = (telefono) => {
    return telefono.replace(/\D/g, '')
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Clientes</h1>
        <p>Registra y administra tus clientes</p>
      </div>

      <form onSubmit={guardarCliente} className="form-card">
        <div className="form-grid">
          <input
            placeholder="Nombre del cliente"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />

          <input
            placeholder="Teléfono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />

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

        <button className="btn btn-primary">
          Guardar cliente
        </button>
      </form>

      <div className="table-card">
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
                <td>{cliente.telefono}</td>
                <td>{cliente.direccion}</td>
                <td>{cliente.notas}</td>
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
                <td>
                  <button
                    onClick={() => eliminarCliente(cliente.id)}
                    className="btn btn-danger btn-small"
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
    </Layout>
  )
}