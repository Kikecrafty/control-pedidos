import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todos')

  useEffect(() => {
    cargarPedidos()
  }, [])

  const cargarPedidos = async () => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, clientes(nombre, telefono)')
      .order('creado_en', { ascending: false })

    if (error) {
      console.log(error)
      alert('Error al cargar pedidos')
      return
    }

    setPedidos(data || [])
  }

  const cambiarEstado = async (id, estado) => {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', id)

    if (error) {
      console.log(error)
      alert('Error al cambiar estado')
      return
    }

    cargarPedidos()
  }

  const eliminarPedido = async (id) => {
    const confirmar = confirm('¿Seguro que quieres eliminar este pedido?')
    if (!confirmar) return

    const { error } = await supabase
      .from('pedidos')
      .delete()
      .eq('id', id)

    if (error) {
      console.log(error)
      alert('Error al eliminar pedido')
      return
    }

    cargarPedidos()
  }

  const pedidosFiltrados = pedidos.filter((pedido) => {
    const texto = busqueda.toLowerCase()

    const coincideBusqueda =
      pedido.codigo?.toLowerCase().includes(texto) ||
      pedido.clientes?.nombre?.toLowerCase().includes(texto) ||
      pedido.clientes?.telefono?.toLowerCase().includes(texto) ||
      pedido.estado?.toLowerCase().includes(texto)

    const coincideEstado =
      filtroEstado === 'Todos' || pedido.estado === filtroEstado

    return coincideBusqueda && coincideEstado
  })

  const escaparHTML = (valor) => {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  const exportarExcel = () => {
    const filas = pedidosFiltrados.map((pedido) => `
      <tr>
        <td>${escaparHTML(pedido.codigo)}</td>
        <td>${escaparHTML(pedido.clientes?.nombre || '')}</td>
        <td>${escaparHTML(pedido.clientes?.telefono || '')}</td>
        <td>${escaparHTML(pedido.estado || '')}</td>
        <td>${Number(pedido.total_cliente || 0).toFixed(2)}</td>
        <td>${Number(pedido.anticipo || 0).toFixed(2)}</td>
        <td>${Number(pedido.restante || 0).toFixed(2)}</td>
        <td>${Number(pedido.ganancia || 0).toFixed(2)}</td>
        <td>${escaparHTML(pedido.tracking || '')}</td>
      </tr>
    `).join('')

    const contenido = `
      <html>
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <table border="1">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Total cliente</th>
                <th>Anticipo</th>
                <th>Restante</th>
                <th>Ganancia</th>
                <th>Tracking</th>
              </tr>
            </thead>
            <tbody>
              ${filas}
            </tbody>
          </table>
        </body>
      </html>
    `

    const blob = new Blob(['\ufeff' + contenido], {
      type: 'application/vnd.ms-excel;charset=utf-8;'
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const fecha = new Date().toISOString().slice(0, 10)

    link.href = url
    link.download = `pedidos_${fecha}.xls`
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <Layout>
      <div className="page-header row-between">
        <div>
          <h1>Pedidos</h1>
          <p>Lista de pedidos registrados</p>
        </div>

        <div className="actions">
          <button
            type="button"
            onClick={exportarExcel}
            className="btn btn-light-bordered"
          >
            Exportar Excel
          </button>

          <Link to="/nuevo-pedido" className="btn btn-primary">
            Nuevo pedido
          </Link>
        </div>
      </div>

      <div className="form-card">
        <div className="filters-grid">
          <input
            placeholder="Buscar por código, cliente, teléfono o estado"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option>Todos</option>
            <option>Cotizado</option>
            <option>Pendiente de pago</option>
            <option>Pagado por cliente</option>
            <option>Comprado en SHEIN</option>
            <option>En camino</option>
            <option>Recibido</option>
            <option>Entregado</option>
            <option>Cancelado</option>
            <option>Devuelto</option>
          </select>

          <button
            type="button"
            className="btn btn-light-bordered"
            onClick={() => {
              setBusqueda('')
              setFiltroEstado('Todos')
            }}
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="row-between table-title">
          <h2>Pedidos encontrados: {pedidosFiltrados.length}</h2>
        </div>

        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Total cliente</th>
              <th>Anticipo</th>
              <th>Restante</th>
              <th>Ganancia</th>
              <th>Tracking</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {pedidosFiltrados.map((pedido) => (
              <tr key={pedido.id}>
                <td>{pedido.codigo}</td>
                <td>{pedido.clientes?.nombre || 'Sin cliente'}</td>
                <td>{pedido.clientes?.telefono || '-'}</td>
                <td>
                  <select
                    value={pedido.estado}
                    onChange={(e) => cambiarEstado(pedido.id, e.target.value)}
                  >
                    <option>Cotizado</option>
                    <option>Pendiente de pago</option>
                    <option>Pagado por cliente</option>
                    <option>Comprado en SHEIN</option>
                    <option>En camino</option>
                    <option>Recibido</option>
                    <option>Entregado</option>
                    <option>Cancelado</option>
                    <option>Devuelto</option>
                  </select>
                </td>
                <td>${Number(pedido.total_cliente || 0).toFixed(2)}</td>
                <td>${Number(pedido.anticipo || 0).toFixed(2)}</td>
                <td>${Number(pedido.restante || 0).toFixed(2)}</td>
                <td>${Number(pedido.ganancia || 0).toFixed(2)}</td>
                <td>{pedido.tracking || '-'}</td>
                <td className="actions">
                  <Link
                    to={`/pedidos/${pedido.id}`}
                    className="btn btn-small"
                  >
                    Ver
                  </Link>

                  <button
                    onClick={() => eliminarPedido(pedido.id)}
                    className="btn btn-danger btn-small"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {pedidosFiltrados.length === 0 && (
              <tr>
                <td colSpan="10">No se encontraron pedidos.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}