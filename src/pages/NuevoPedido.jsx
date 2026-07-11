import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import { cargarEstadoPlan, estaBloqueadoPorPlan, puedeCrearPedido } from '../lib/planes'

const crearProductoVacio = () => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  nombre_producto: '',
  link_shein: '',
  talla: '',
  color: '',
  cantidad: 1,
  precio_pagina: '',
  precio_shein: '',
  precio_venta: ''
})

const obtenerFechaLocalHoy = () => {
  const ahora = new Date()
  const local = new Date(ahora.getTime() - (ahora.getTimezoneOffset() * 60000))
  return local.toISOString().slice(0, 10)
}

export default function NuevoPedido() {
  const [clientes, setClientes] = useState([])
  const [estadoPlan, setEstadoPlan] = useState(null)
  const [clienteId, setClienteId] = useState('')
  const [clienteBusqueda, setClienteBusqueda] = useState('')
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [modalClienteAbierto, setModalClienteAbierto] = useState(false)
  const [guardandoCliente, setGuardandoCliente] = useState(false)
  const [guardandoPedido, setGuardandoPedido] = useState(false)
  const guardandoPedidoRef = useRef(false)
  const buscadorClienteRef = useRef(null)

  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    notas: ''
  })

  const [plataforma, setPlataforma] = useState('SHEIN')
  const [fechaCreacion, setFechaCreacion] = useState(() => obtenerFechaLocalHoy())
  const [estado, setEstado] = useState('Cotizado')
  const [tracking, setTracking] = useState('')
  const [notas, setNotas] = useState('')
  const [toast, setToast] = useState(null)
  const [productos, setProductos] = useState(() => [crearProductoVacio()])
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
      'En camino',
    'Recibido',
    'Dejado en negocio',
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

  const actualizarProducto = (id, campo, valor) => {
    setProductos((actuales) =>
      actuales.map((producto) =>
        producto.id === id
          ? { ...producto, [campo]: valor }
          : producto
      )
    )
  }

  const agregarProducto = () => {
    if (bloquearSiNoPuede()) return
    setProductos((actuales) => [...actuales, crearProductoVacio()])
  }

  const eliminarProducto = (id) => {
    setProductos((actuales) => {
      if (actuales.length <= 1) return actuales
      return actuales.filter((producto) => producto.id !== id)
    })
  }

  const obtenerProductosParaGuardar = () => {
    const productosListos = []

    for (let index = 0; index < productos.length; index += 1) {
      const producto = productos[index]
      const numeroProducto = index + 1
      const nombreProducto = producto.nombre_producto.trim()
      const cantidadTexto = String(producto.cantidad ?? '').trim()
      const paginaTexto = String(producto.precio_pagina ?? '').trim()
      const costoTexto = String(producto.precio_shein ?? '').trim()
      const cant = Number(cantidadTexto)
      const precioPagina = Number(paginaTexto)
      const costoUnitario = costoTexto === '' ? precioPagina : Number(costoTexto)
      const ventaUnitario = precioPagina

      if (!nombreProducto) {
        throw new Error(`Escribe el nombre del producto ${numeroProducto}`)
      }

      if (!cantidadTexto || !Number.isFinite(cant) || cant <= 0) {
        throw new Error(`Escribe una cantidad válida en el producto ${numeroProducto}`)
      }

      if (!paginaTexto || !Number.isFinite(precioPagina) || precioPagina < 0) {
        throw new Error(`Escribe el precio de página del producto ${numeroProducto}`)
      }

      if (costoTexto !== '' && (!Number.isFinite(costoUnitario) || costoUnitario < 0)) {
        throw new Error(`Escribe un costo real válido en el producto ${numeroProducto}`)
      }

      productosListos.push({
        nombre_producto: nombreProducto,
        link_shein: producto.link_shein.trim(),
        talla: producto.talla.trim(),
        color: producto.color.trim(),
        cantidad: cant,
        precio_pagina: precioPagina,
        precio_shein: costoUnitario,
        precio_venta: ventaUnitario
      })
    }

    return productosListos
  }

  const limpiarPedidoIncompleto = async (pedidoId) => {
    if (!pedidoId) return

    try {
      await supabase.from('pagos').delete().eq('pedido_id', pedidoId)
      await supabase.from('productos_pedido').delete().eq('pedido_id', pedidoId)
      await supabase.from('pedidos').delete().eq('id', pedidoId)
    } catch (error) {
      console.log(error)
    }
  }

  const guardarPedido = async (e) => {
    e.preventDefault()

    if (guardandoPedidoRef.current) return

    if (!puedeCrearPedido(estadoPlan)) {
      mostrarToast('Llegaste al límite de pedidos del Plan Básico. Actualiza a Premium para crear más pedidos.', 'error')
      return
    }

    if (!clienteId) {
      mostrarToast('Selecciona un cliente o registra uno nuevo', 'error')
      setMostrarSugerencias(true)
      return
    }

    let productosParaGuardar = []

    try {
      productosParaGuardar = obtenerProductosParaGuardar()
    } catch (error) {
      mostrarToast(error.message, 'error')
      return
    }

    const totalShein = productosParaGuardar.reduce((total, producto) => {
      return total + (Number(producto.precio_shein || producto.precio_pagina || 0) * Number(producto.cantidad || 0))
    }, 0)

    const totalCliente = productosParaGuardar.reduce((total, producto) => {
      return total + (Number(producto.precio_venta || producto.precio_pagina || 0) * Number(producto.cantidad || 0))
    }, 0)

    const pagoInicial = Number(anticipo || 0)

    if (!Number.isFinite(pagoInicial) || pagoInicial < 0) {
      mostrarToast('Escribe un anticipo válido', 'error')
      return
    }

    if (pagoInicial > totalCliente) {
      mostrarToast('El anticipo no puede ser mayor al total del cliente', 'error')
      return
    }

    if (!fechaCreacion) {
      mostrarToast('Selecciona la fecha del pedido', 'error')
      return
    }

    guardandoPedidoRef.current = true
    setGuardandoPedido(true)

    try {
      const { data: pedidoCreado, error: errorPedidoCompleto } = await supabase.rpc('crear_pedido_completo', {
        p_cliente_id: clienteId,
        p_plataforma: plataforma,
        p_estado: estado,
        p_tracking: tracking.trim(),
        p_notas: notas.trim(),
        p_productos: productosParaGuardar,
        p_anticipo: pagoInicial,
        p_fecha_creacion: fechaCreacion || obtenerFechaLocalHoy()
      })

      if (errorPedidoCompleto) {
        console.log(errorPedidoCompleto)
        const mensaje = errorPedidoCompleto.message?.includes('function crear_pedido_completo')
          ? 'Primero ejecuta el SQL de la Parte 2 en Supabase.'
          : errorPedidoCompleto.message || 'No se pudo crear el pedido completo'
        mostrarToast(mensaje, 'error')
        return
      }

      await cargarPlan()
      window.dispatchEvent(new CustomEvent('planActualizado'))
      mostrarToast(`Pedido ${pedidoCreado?.codigo || ''} creado correctamente`)
      setTimeout(() => {
        window.location.href = '/pedidos'
      }, 900)
    } catch (error) {
      console.log(error)
      mostrarToast(error.message || 'No se pudo crear el pedido', 'error')
    } finally {
      guardandoPedidoRef.current = false
      setGuardandoPedido(false)
    }
  }

  const totalSheinPreview = productos.reduce((total, producto) => {
    return total + (Number(producto.precio_shein || producto.precio_pagina || 0) * Number(producto.cantidad || 0))
  }, 0)

  const totalClientePreview = productos.reduce((total, producto) => {
    return total + (Number(producto.precio_venta || producto.precio_pagina || 0) * Number(producto.cantidad || 0))
  }, 0)

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
              <label>Nombre del cliente*</label>
              <input
                value={nuevoCliente.nombre}
                onChange={(e) =>
                  setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })
                }
                required
              />
            </div>

            <div className="form-field">
              <label>Teléfono*</label>
              <div className="phone-field">
                <span>+52</span>
                <input
                  value={nuevoCliente.telefono}
                  onChange={(e) =>
                    setNuevoCliente({
                      ...nuevoCliente,
                      telefono: normalizarTelefono(e.target.value)
                    })
                  }
                  inputMode="numeric"
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label>Dirección</label>
              <input
                value={nuevoCliente.direccion}
                onChange={(e) =>
                  setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })
                }
              />
            </div>

            <div className="form-field">
              <label>Notas</label>
              <textarea
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
            <label>Plataforma*</label>
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
            <label>Cliente*</label>

            <div className="client-search-box">
              <input
                value={clienteBusqueda}
                onFocus={() => setMostrarSugerencias(true)}
                onChange={(e) => {
                  setClienteBusqueda(e.target.value)
                  setClienteId('')
                  setMostrarSugerencias(true)
                }}
                autoComplete="off"
                required
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
                  disabled={bloqueado || guardandoPedido}
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
            <label>Estado del pedido*</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              required
            >
              {estadosPedido.map((estado) => (
                <option key={estado}>{estado}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Fecha del pedido*</label>
            <input
              type="date"
              value={fechaCreacion}
              onChange={(e) => setFechaCreacion(e.target.value)}
              required
            />
            <small className="field-help-text">Por defecto usa la fecha de hoy. Puedes cambiarla si registras un pedido atrasado.</small>
          </div>

          <div className="form-field">
            <label>Tracking / guía</label>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Notas del pedido</label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        </div>

        <div className="products-section-header">
          <div>
            <h2>Productos</h2>
            <p>Agrega uno o varios productos dentro de la misma orden.</p>
          </div>

          <button
            type="button"
            className="btn btn-light-bordered btn-add-product"
            onClick={agregarProducto}
            disabled={bloqueado || guardandoPedido}
          >
            + Agregar otro producto
          </button>
        </div>

        <div className="order-products-list">
          {productos.map((producto, index) => (
            <div className="product-order-card" key={producto.id}>
              <div className="product-order-card-header">
                <h3>Producto {index + 1}</h3>

                {productos.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => eliminarProducto(producto.id)}
                  >
                    Quitar
                  </button>
                )}
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label>Nombre del producto*</label>
                  <input
                    value={producto.nombre_producto}
                    onChange={(e) => actualizarProducto(producto.id, 'nombre_producto', e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Link del producto</label>
                  <input
                    value={producto.link_shein}
                    onChange={(e) => actualizarProducto(producto.id, 'link_shein', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Talla</label>
                  <input
                    value={producto.talla}
                    onChange={(e) => actualizarProducto(producto.id, 'talla', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Color</label>
                  <input
                    value={producto.color}
                    onChange={(e) => actualizarProducto(producto.id, 'color', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Cantidad*</label>
                  <input
                    type="number"
                    min="1"
                    value={producto.cantidad}
                    onChange={(e) => actualizarProducto(producto.id, 'cantidad', e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Precio página unitario*</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={producto.precio_pagina}
                    onChange={(e) => actualizarProducto(producto.id, 'precio_pagina', e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Costo real unitario</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={producto.precio_shein}
                    onChange={(e) => actualizarProducto(producto.id, 'precio_shein', e.target.value)}
                    placeholder="Se calcula al crear lote"
                  />
                  <small className="field-help-text">Déjalo vacío si todavía no compras. Ordely usará el precio de página como estimado.</small>
                </div>

              </div>
            </div>
          ))}
        </div>

        <div className="form-grid order-payment-grid">
          <div className="form-field">
            <label>Anticipo</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={anticipo}
              onChange={(e) => setAnticipo(e.target.value)}
            />
          </div>
        </div>

        <div className="cards-grid">
          <div className="card">
            <span>Costo estimado</span>
            <strong>${totalSheinPreview.toFixed(2)}</strong>
          </div>

          <div className="card">
            <span>Total cliente</span>
            <strong>${totalClientePreview.toFixed(2)}</strong>
          </div>

          <div className="card">
            <span>Ganancia estimada</span>
            <strong>${gananciaPreview.toFixed(2)}</strong>
          </div>

          <div className="card">
            <span>Restante</span>
            <strong>${restantePreview.toFixed(2)}</strong>
          </div>
        </div>

        <button className="btn btn-primary" disabled={guardandoPedido || !puedeCrearPedido(estadoPlan)}>
          {guardandoPedido ? 'Guardando pedido...' : (!puedeCrearPedido(estadoPlan) ? 'Límite alcanzado' : 'Guardar pedido')}
        </button>
      </form>
    </Layout>
  )
}
