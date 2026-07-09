import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import { cargarEstadoPlan, estaBloqueadoPorPlan, puedeCrearPedido } from '../lib/planes'

export default function NuevoPedido() {
  const [clientes, setClientes] = useState([])
  const [estadoPlan, setEstadoPlan] = useState(null)
  const [clienteId, setClienteId] = useState('')
  const [clienteBusqueda, setClienteBusqueda] = useState('')
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [modalClienteAbierto, setModalClienteAbierto] = useState(false)
  const [guardandoCliente, setGuardandoCliente] = useState(false)
  const buscadorClienteRef = useRef(null)

  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    notas: ''
  })

  const [plataforma, setPlataforma] = useState('SHEIN')
  const [estado, setEstado] = useState('Cotizado')
  const [tracking, setTracking] = useState('')
  const [notas, setNotas] = useState('')
  const [toast, setToast] = useState(null)

  const [nombreProducto, setNombreProducto] = useState('')
  const [linkShein, setLinkShein] = useState('')
  const [talla, setTalla] = useState('')
  const [color, setColor] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [precioShein, setPrecioShein] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [anticipo, setAnticipo] = useState('')

  const plataformas = [
    'SHEIN',
    'Temu',
    'AliExpress',
    'Catálogo',
    'Otro'
  ]

  const estadosPedido = [
    'Cotizado',
    'Pendiente de pago',
    'Pagado por cliente',
    'Comprado en plataforma',
    'En camino',
    'Recibido',
    'Entregado',
    'Cancelado',
    'Devuelto'
  ]

  useEffect(() => {
    cargarClientes()
    cargarPlan()
  }, [])

  useEffect(() => {
    const cerrarSiClickAfuera = (event) => {
      if (!buscadorClienteRef.current) return

      if (!buscadorClienteRef.current.contains(event.target)) {
        setMostrarSugerencias(false)
      }
    }

    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') {
        setMostrarSugerencias(false)
      }
    }

    document.addEventListener('mousedown', cerrarSiClickAfuera)
    document.addEventListener('touchstart', cerrarSiClickAfuera)
    document.addEventListener('keydown', cerrarConEscape)

    return () => {
      document.removeEventListener('mousedown', cerrarSiClickAfuera)
      document.removeEventListener('touchstart', cerrarSiClickAfuera)
      document.removeEventListener('keydown', cerrarConEscape)
    }
  }, [])

  const mostrarToast = (mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo })
  }

  const cargarPlan = async () => {
    const estado = await cargarEstadoPlan()
    setEstadoPlan(estado)
  }

  const bloqueado = estaBloqueadoPorPlan(estadoPlan)

  const bloquearSiNoPuede = () => {
    if (!bloqueado) return false
    mostrarToast('Tu Plan Básico llegó al límite. Actualiza a Premium para modificar información.', 'error')
    return true
  }

  const limpiarTelefono = (telefono) => {
    return String(telefono || '').replace(/\D/g, '')
  }

  const normalizarTelefono = (telefono) => {
    let limpio = limpiarTelefono(telefono)

    if (limpio.startsWith('52') && limpio.length > 10) {
      limpio = limpio.slice(2)
    }

    return limpio.slice(0, 10)
  }

  const cargarClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      console.log(error)
      mostrarToast('Error al cargar clientes', 'error')
      return
    }

    setClientes(data || [])
  }

  const clientesFiltrados = useMemo(() => {
    const texto = clienteBusqueda.trim().toLowerCase()

    if (!texto) {
      return clientes.slice(0, 8)
    }

    return clientes
      .filter((cliente) => {
        const nombre = String(cliente.nombre || '').toLowerCase()
        const telefono = limpiarTelefono(cliente.telefono)
        const direccion = String(cliente.direccion || '').toLowerCase()
        const busquedaNumerica = limpiarTelefono(texto)

        return (
          nombre.includes(texto) ||
          (busquedaNumerica && telefono.includes(busquedaNumerica)) ||
          direccion.includes(texto)
        )
      })
      .slice(0, 8)
  }, [clientes, clienteBusqueda])

  const clienteSeleccionado = clientes.find((cliente) => cliente.id === clienteId)

  const seleccionarCliente = (cliente) => {
    setClienteId(cliente.id)
    setClienteBusqueda(cliente.nombre || '')
    setMostrarSugerencias(false)
  }

  const abrirModalNuevoCliente = () => {
    if (bloquearSiNoPuede()) return
    setNuevoCliente({
      nombre: clienteBusqueda || '',
      telefono: '',
      direccion: '',
      notas: ''
    })
    setMostrarSugerencias(false)
    setModalClienteAbierto(true)
  }

  const cerrarModalNuevoCliente = () => {
    if (guardandoCliente) return
    setModalClienteAbierto(false)
  }

  const guardarClienteNuevo = async (e) => {
    e.preventDefault()

    if (bloquearSiNoPuede()) return

    const nombre = nuevoCliente.nombre.trim()
    const telefono = normalizarTelefono(nuevoCliente.telefono)
    const direccion = nuevoCliente.direccion.trim()
    const notasCliente = nuevoCliente.notas.trim()

    if (!nombre) {
      mostrarToast('Escribe el nombre del cliente', 'error')
      return
    }

    if (!telefono || telefono.length < 10) {
      mostrarToast('Escribe un teléfono válido de 10 dígitos', 'error')
      return
    }

    setGuardandoCliente(true)

    const { data, error } = await supabase
      .from('clientes')
      .insert([
        {
          nombre,
          telefono,
          direccion,
          notas: notasCliente
        }
      ])
      .select()
      .single()

    setGuardandoCliente(false)

    if (error) {
      console.log(error)
      mostrarToast('Error al registrar cliente', 'error')
      return
    }

    const listaActualizada = [...clientes, data].sort((a, b) => {
      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
    })

    setClientes(listaActualizada)
    seleccionarCliente(data)
    setModalClienteAbierto(false)
    setNuevoCliente({ nombre: '', telefono: '', direccion: '', notas: '' })
    mostrarToast('Cliente registrado correctamente')
  }

  const generarCodigo = async () => {
    const { data, error } = await supabase.rpc('generar_codigo_pedido', {
      p_plataforma: plataforma
    })

    if (error) {
      console.log(error)
      throw new Error('No se pudo generar el código del pedido')
    }

    return data
  }

  const guardarPedido = async (e) => {
    e.preventDefault()

    if (!puedeCrearPedido(estadoPlan)) {
      mostrarToast('Llegaste al límite de pedidos del Plan Básico. Actualiza a Premium para crear más pedidos.', 'error')
      return
    }

    if (!clienteId) {
      mostrarToast('Selecciona un cliente o registra uno nuevo', 'error')
      setMostrarSugerencias(true)
      return
    }

    const cant = Number(cantidad)
    const sheinUnitario = Number(precioShein)
    const ventaUnitario = Number(precioVenta)
    const pagoInicial = Number(anticipo || 0)

    const totalShein = sheinUnitario * cant
    const totalCliente = ventaUnitario * cant
    const restante = totalCliente - pagoInicial
    const ganancia = totalCliente - totalShein

    let codigoGenerado = ''

    try {
      codigoGenerado = await generarCodigo()
    } catch (error) {
      mostrarToast(error.message, 'error')
      return
    }

    const { data: pedido, error: errorPedido } = await supabase
      .from('pedidos')
      .insert([
        {
          cliente_id: clienteId,
          codigo: codigoGenerado,
          plataforma,
          estado,
          total_shein: totalShein,
          total_cliente: totalCliente,
          anticipo: pagoInicial,
          restante,
          ganancia,
          tracking,
          notas
        }
      ])
      .select()
      .single()

    if (errorPedido) {
      console.log(errorPedido)
      const mensajeLimite = errorPedido.message?.includes('Límite')
        ? 'Llegaste al límite de pedidos del Plan Básico. Actualiza a Premium para crear más pedidos.'
        : 'Error al crear pedido'
      mostrarToast(mensajeLimite, 'error')
      return
    }

    const { error: errorProducto } = await supabase
      .from('productos_pedido')
      .insert([
        {
          pedido_id: pedido.id,
          nombre_producto: nombreProducto,
          link_shein: linkShein,
          talla,
          color,
          cantidad: cant,
          precio_shein: sheinUnitario,
          precio_venta: ventaUnitario
        }
      ])

    if (errorProducto) {
      console.log(errorProducto)
      mostrarToast('El pedido se creó, pero hubo error al guardar el producto', 'error')
      return
    }

    if (pagoInicial > 0) {
      await supabase
        .from('pagos')
        .insert([
          {
            pedido_id: pedido.id,
            monto: pagoInicial,
            metodo_pago: 'Anticipo',
            notas: 'Pago inicial'
          }
        ])
    }

    await cargarPlan()
    window.dispatchEvent(new CustomEvent('planActualizado'))
    mostrarToast(`Pedido ${codigoGenerado} creado correctamente`)
    setTimeout(() => {
      window.location.href = '/pedidos'
    }, 900)
  }

  const totalSheinPreview = Number(precioShein || 0) * Number(cantidad || 0)
  const totalClientePreview = Number(precioVenta || 0) * Number(cantidad || 0)
  const gananciaPreview = totalClientePreview - totalSheinPreview
  const restantePreview = totalClientePreview - Number(anticipo || 0)

  return (
    <Layout>
      <Toast
        mensaje={toast?.mensaje}
        tipo={toast?.tipo}
        onClose={() => setToast(null)}
      />

      <Modal
        abierto={modalClienteAbierto}
        titulo="Registrar nuevo cliente"
        onClose={cerrarModalNuevoCliente}
      >
        <form onSubmit={guardarClienteNuevo}>
          <div className="modal-form-grid">
            <div className="form-field">
              <label>Nombre del cliente</label>
              <input
                placeholder="Ej. María Fernanda"
                value={nuevoCliente.nombre}
                onChange={(e) =>
                  setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })
                }
                required
              />
            </div>

            <div className="form-field">
              <label>Teléfono</label>
              <div className="phone-field">
                <span>+52</span>
                <input
                  placeholder="10 dígitos"
                  value={nuevoCliente.telefono}
                  onChange={(e) =>
                    setNuevoCliente({
                      ...nuevoCliente,
                      telefono: normalizarTelefono(e.target.value)
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label>Dirección</label>
              <input
                placeholder="Ciudad o domicilio"
                value={nuevoCliente.direccion}
                onChange={(e) =>
                  setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })
                }
              />
            </div>

            <div className="form-field">
              <label>Notas</label>
              <textarea
                placeholder="Dato importante"
                value={nuevoCliente.notas}
                onChange={(e) =>
                  setNuevoCliente({ ...nuevoCliente, notas: e.target.value })
                }
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cerrarModalNuevoCliente}
              disabled={guardandoCliente}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={guardandoCliente || bloqueado}
            >
              {guardandoCliente ? 'Guardando...' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="page-header">
        <h1>Nuevo pedido</h1>
        <p>Registra un pedido nuevo de importación o catálogo</p>
      </div>

      <PlanLimitNotice estadoPlan={estadoPlan} />

      <form onSubmit={guardarPedido} className="form-card">
        <h2>Datos del pedido</h2>

        <div className="form-grid">
          <div className="form-field">
            <label>Plataforma</label>
            <select
              value={plataforma}
              onChange={(e) => setPlataforma(e.target.value)}
              required
            >
              {plataformas.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="form-field client-search" ref={buscadorClienteRef}>
            <label>Cliente</label>

            <div className="client-search-box">
              <input
                placeholder="Busca nombre, teléfono o ciudad"
                value={clienteBusqueda}
                onFocus={() => setMostrarSugerencias(true)}
                onChange={(e) => {
                  setClienteBusqueda(e.target.value)
                  setClienteId('')
                  setMostrarSugerencias(true)
                }}
                autoComplete="off"
              />

              {clienteSeleccionado && (
                <button
                  type="button"
                  className="client-clear-btn"
                  onClick={() => {
                    setClienteId('')
                    setClienteBusqueda('')
                    setMostrarSugerencias(true)
                  }}
                  aria-label="Quitar cliente"
                >
                  ×
                </button>
              )}
            </div>

            {clienteSeleccionado && (
              <div className="selected-client-pill">
                Cliente seleccionado: <strong>{clienteSeleccionado.nombre}</strong>
                {clienteSeleccionado.telefono
                  ? ` · +52 ${normalizarTelefono(clienteSeleccionado.telefono)}`
                  : ''}
              </div>
            )}

            {mostrarSugerencias && (
              <div className="client-suggestions">
                <button
                  type="button"
                  className="client-suggestion client-suggestion-add"
                  onClick={abrirModalNuevoCliente}
                  disabled={bloqueado}
                >
                  + Registrar nuevo cliente
                </button>

                {clientesFiltrados.length > 0 ? (
                  clientesFiltrados.map((cliente) => (
                    <button
                      type="button"
                      key={cliente.id}
                      className="client-suggestion"
                      onClick={() => seleccionarCliente(cliente)}
                    >
                      <strong>{cliente.nombre}</strong>
                      <span>
                        {cliente.telefono
                          ? `+52 ${normalizarTelefono(cliente.telefono)}`
                          : 'Sin teléfono'}
                        {cliente.direccion ? ` · ${cliente.direccion}` : ''}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="client-suggestion-empty">
                    No encontré clientes con esa búsqueda.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-field">
            <label>Estado del pedido</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              {estadosPedido.map((estado) => (
                <option key={estado}>{estado}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Tracking / guía</label>
            <input
              placeholder="Número de guía"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Notas del pedido</label>
            <input
              placeholder="Dato del pedido"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        </div>

        <h2>Producto</h2>

        <div className="form-grid">
          <div className="form-field">
            <label>Nombre del producto</label>
            <input
              placeholder="Ej. Blusa negra"
              value={nombreProducto}
              onChange={(e) => setNombreProducto(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label>Link del producto</label>
            <input
              placeholder="Pega el enlace"
              value={linkShein}
              onChange={(e) => setLinkShein(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Talla</label>
            <input
              placeholder="Ej. M"
              value={talla}
              onChange={(e) => setTalla(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Color</label>
            <input
              placeholder="Ej. Negro"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Cantidad</label>
            <input
              type="number"
              min="1"
              placeholder="Ej. 1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label>Costo plataforma unitario</label>
            <input
              type="number"
              step="0.01"
              placeholder="Lo que te cuesta"
              value={precioShein}
              onChange={(e) => setPrecioShein(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label>Precio venta unitario</label>
            <input
              type="number"
              step="0.01"
              placeholder="Lo que cobrarás"
              value={precioVenta}
              onChange={(e) => setPrecioVenta(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label>Anticipo</label>
            <input
              type="number"
              step="0.01"
              placeholder="Pago inicial"
              value={anticipo}
              onChange={(e) => setAnticipo(e.target.value)}
            />
          </div>
        </div>

        <div className="cards-grid">
          <div className="card">
            <span>Costo plataforma</span>
            <strong>${totalSheinPreview.toFixed(2)}</strong>
          </div>

          <div className="card">
            <span>Total cliente</span>
            <strong>${totalClientePreview.toFixed(2)}</strong>
          </div>

          <div className="card">
            <span>Ganancia</span>
            <strong>${gananciaPreview.toFixed(2)}</strong>
          </div>

          <div className="card">
            <span>Restante</span>
            <strong>${restantePreview.toFixed(2)}</strong>
          </div>
        </div>

        <button className="btn btn-primary" disabled={!puedeCrearPedido(estadoPlan)}>
          {!puedeCrearPedido(estadoPlan) ? 'Límite alcanzado' : 'Guardar pedido'}
        </button>
      </form>
    </Layout>
  )
}
