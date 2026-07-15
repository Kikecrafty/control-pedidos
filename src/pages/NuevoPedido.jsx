import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import PlanLimitNotice from '../components/PlanLimitNotice'
import PageHelp from '../components/PageHelp'
import { cargarEstadoPlan, estaBloqueadoPorPlan, puedeCrearPedido } from '../lib/planes'
import { PLATAFORMAS } from '../lib/plataformas'
import { METODOS_PAGO, METODO_PAGO_PREDETERMINADO } from '../lib/metodosPago'

const MEDIOS_CONTACTO = [
  'WhatsApp',
  'Messenger',
  'Instagram',
  'TikTok',
  'Telegram',
  'Local / en persona',
  'Otro'
]

const requiereTelefono = (medio) => String(medio || 'WhatsApp').toLowerCase().includes('whatsapp')

const crearProductoVacio = () => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  nombre_producto: '',
  link_shein: '',
  talla: '',
  color: '',
  cantidad: 1,
  precio_pagina: '',
  precio_shein: '',
  cobra_comision: false,
  comision_extra: ''
})

const obtenerFechaLocalHoy = () => {
  const ahora = new Date()
  const local = new Date(ahora.getTime() - (ahora.getTimezoneOffset() * 60000))
  return local.toISOString().slice(0, 10)
}

export default function NuevoPedido() {
  const [searchParams] = useSearchParams()
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
    medio_contacto: 'WhatsApp',
    telefono: '',
    usuario_contacto: '',
    notas: ''
  })

  const [plataforma, setPlataforma] = useState('SHEIN')
  const [fechaPedido, setFechaPedido] = useState(() => obtenerFechaLocalHoy())
  const [tracking, setTracking] = useState('')
  const [notas, setNotas] = useState('')
  const [toast, setToast] = useState(null)
  const [productos, setProductos] = useState(() => [crearProductoVacio()])
  const [anticipo, setAnticipo] = useState('')
  const [metodoAnticipo, setMetodoAnticipo] = useState(METODO_PAGO_PREDETERMINADO)
  const [fechaAnticipo, setFechaAnticipo] = useState(() => obtenerFechaLocalHoy())

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

  const mostrarToast = useCallback((mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo })
  }, [])

  const cargarPlan = useCallback(async () => {
    const estado = await cargarEstadoPlan()
    setEstadoPlan(estado)
  }, [])

  const bloqueado = estaBloqueadoPorPlan(estadoPlan)

  const bloquearSiNoPuede = () => {
    if (!bloqueado) return false
    mostrarToast('Tu cuenta no permite modificaciones en este momento.', 'error')
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

  const obtenerContactoCliente = (cliente) => {
    const medio = cliente?.medio_contacto || 'WhatsApp'
    const telefono = normalizarTelefono(cliente?.telefono || '')
    const usuario = String(cliente?.usuario_contacto || '').trim()

    if (requiereTelefono(medio) && telefono) return `+52 ${telefono}`
    if (usuario) return usuario
    if (telefono) return `+52 ${telefono}`
    return 'Sin contacto directo'
  }

  const cargarClientes = useCallback(async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      console.log(error)
      mostrarToast('Error al cargar clientes', 'error')
      return
    }

    const clientesFinal = data || []
    setClientes(clientesFinal)

    const clienteSolicitadoId = searchParams.get('cliente')
    const clienteSolicitado = clientesFinal.find((cliente) => String(cliente.id) === String(clienteSolicitadoId || ''))

    if (clienteSolicitado) {
      setClienteId(clienteSolicitado.id)
      setClienteBusqueda(clienteSolicitado.nombre || '')
      setMostrarSugerencias(false)
    }
  }, [mostrarToast, searchParams])

  useEffect(() => {
    cargarClientes()
    cargarPlan()
  }, [cargarClientes, cargarPlan])

  const clientesFiltrados = useMemo(() => {
    const texto = clienteBusqueda.trim().toLowerCase()

    if (!texto) {
      return clientes.slice(0, 8)
    }

    return clientes
      .filter((cliente) => {
        const nombre = String(cliente.nombre || '').toLowerCase()
        const telefono = limpiarTelefono(cliente.telefono)
        const medio = String(cliente.medio_contacto || '').toLowerCase()
        const usuario = String(cliente.usuario_contacto || '').toLowerCase()
        const direccion = String(cliente.direccion || '').toLowerCase()
        const busquedaNumerica = limpiarTelefono(texto)

        return (
          nombre.includes(texto) ||
          medio.includes(texto) ||
          usuario.includes(texto) ||
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
      medio_contacto: 'WhatsApp',
      telefono: '',
      usuario_contacto: '',
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
    const medioContacto = nuevoCliente.medio_contacto || 'WhatsApp'
    const telefono = normalizarTelefono(nuevoCliente.telefono)
    const usuarioContacto = String(nuevoCliente.usuario_contacto || '').trim()
    const notasCliente = nuevoCliente.notas.trim()

    if (!nombre) {
      mostrarToast('Escribe el nombre del cliente', 'error')
      return
    }

    if (requiereTelefono(medioContacto) && (!telefono || telefono.length < 10)) {
      mostrarToast('Para WhatsApp escribe un teléfono válido de 10 dígitos', 'error')
      return
    }

    setGuardandoCliente(true)

    const { data, error } = await supabase
      .from('clientes')
      .insert([
        {
          nombre,
          medio_contacto: medioContacto,
          telefono: telefono || null,
          usuario_contacto: usuarioContacto,
          direccion: '',
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
    setNuevoCliente({ nombre: '', medio_contacto: 'WhatsApp', telefono: '', usuario_contacto: '', notas: '' })
    mostrarToast('Cliente registrado correctamente')
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
      const comisionTexto = String(producto.comision_extra ?? '').trim()
      const cant = Number(cantidadTexto)
      const precioPagina = Number(paginaTexto)
      const costoUnitario = costoTexto === '' ? precioPagina : Number(costoTexto)
      const cobraComision = producto.cobra_comision === true
      const comisionUnitario = cobraComision ? Number(comisionTexto) : 0
      const ventaUnitario = precioPagina + comisionUnitario

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

      if (cobraComision && (!comisionTexto || !Number.isFinite(comisionUnitario) || comisionUnitario < 0)) {
        throw new Error(`Escribe una comisión válida en el producto ${numeroProducto}`)
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

    if (pagoInicial > 0 && !metodoAnticipo) {
      mostrarToast('Selecciona el método con el que recibiste el anticipo', 'error')
      return
    }

    if (pagoInicial > 0 && !fechaAnticipo) {
      mostrarToast('Selecciona la fecha en que recibiste el anticipo', 'error')
      return
    }

    if (!fechaPedido) {
      mostrarToast('Selecciona la fecha en que se hizo el pedido', 'error')
      return
    }

    guardandoPedidoRef.current = true
    setGuardandoPedido(true)

    try {
      const { data: pedidoCreado, error: errorPedidoCompleto } = await supabase.rpc('crear_pedido_completo', {
        p_cliente_id: clienteId,
        p_plataforma: plataforma,
        p_estado: 'Cotizado',
        p_tracking: tracking.trim(),
        p_notas: notas.trim(),
        p_productos: productosParaGuardar,
        p_anticipo: pagoInicial,
        p_fecha_creacion: fechaPedido || obtenerFechaLocalHoy(),
        p_metodo_anticipo: metodoAnticipo,
        p_fecha_anticipo: fechaAnticipo || fechaPedido || obtenerFechaLocalHoy()
      })

      if (errorPedidoCompleto) {
        console.log(errorPedidoCompleto)
        const mensaje = errorPedidoCompleto.message?.includes('function crear_pedido_completo')
          ? 'La actualización de integridad de Supabase aún no está aplicada.'
          : errorPedidoCompleto.message || 'No se pudo crear el pedido completo'
        mostrarToast(mensaje, 'error')
        return
      }

      const pedidoResultado = Array.isArray(pedidoCreado) ? pedidoCreado[0] : pedidoCreado

      await cargarPlan()
      window.dispatchEvent(new CustomEvent('planActualizado'))
      mostrarToast(`Pedido ${pedidoResultado?.codigo || ''} creado correctamente`)
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

  const obtenerPrecioClienteProducto = (producto) => {
    const precioBase = Number(producto.precio_pagina || 0)
    const comision = producto.cobra_comision ? Number(producto.comision_extra || 0) : 0
    return precioBase + comision
  }

  const totalClientePreview = productos.reduce((total, producto) => {
    return total + (obtenerPrecioClienteProducto(producto) * Number(producto.cantidad || 0))
  }, 0)

  const totalComisionesPreview = productos.reduce((total, producto) => {
    const comision = producto.cobra_comision ? Number(producto.comision_extra || 0) : 0
    return total + (comision * Number(producto.cantidad || 0))
  }, 0)

  const restantePreview = totalClientePreview - Number(anticipo || 0)

  return (
    <Layout>
      <PageHelp page="nuevoPedido" />

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
              <label>Medio de contacto*</label>
              <select
                value={nuevoCliente.medio_contacto}
                onChange={(e) =>
                  setNuevoCliente({ ...nuevoCliente, medio_contacto: e.target.value })
                }
                required
              >
                {MEDIOS_CONTACTO.map((medio) => (
                  <option key={medio} value={medio}>{medio}</option>
                ))}
              </select>
              <small className="field-help-text">Selecciona por dónde te habla el cliente.</small>
            </div>

            <div className="form-field">
              <label>Teléfono{requiereTelefono(nuevoCliente.medio_contacto) ? '*' : ''}</label>
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
                  required={requiereTelefono(nuevoCliente.medio_contacto)}
                />
              </div>
              <small className="field-help-text">Solo obligatorio para WhatsApp.</small>
            </div>

            <div className="form-field">
              <label>Usuario / perfil</label>
              <input
                value={nuevoCliente.usuario_contacto}
                onChange={(e) =>
                  setNuevoCliente({ ...nuevoCliente, usuario_contacto: e.target.value })
                }
                placeholder="Ej. @cliente o nombre en Facebook"
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

      <div className="page-header row-between new-order-page-header">
        <div>
          <span className="page-kicker">Nuevo pedido</span>
          <h1>Crea el pedido paso a paso</h1>
          <p>Cliente, productos y pago en un solo flujo sencillo.</p>
        </div>

        <div className="new-order-flow-mini" aria-label="Pasos del pedido">
          <span>1 Cliente</span>
          <span>2 Productos</span>
          <span>3 Pago</span>
          <span>4 Revisar</span>
        </div>
      </div>

      <PlanLimitNotice estadoPlan={estadoPlan} />

      <form onSubmit={guardarPedido} className="new-order-form-simple">
        <section className="new-order-step-card">
          <div className="new-order-step-heading">
            <span>1</span>
            <div>
              <h2>Cliente y plataforma</h2>
              <p>Indica para quién es el pedido y dónde se comprará.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Plataforma*</label>
              <select value={plataforma} onChange={(e) => setPlataforma(e.target.value)} required>
                {PLATAFORMAS.map((item) => (
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
                  placeholder="Busca por nombre o contacto"
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
                  <strong>{clienteSeleccionado.nombre}</strong>
                  {` · ${clienteSeleccionado.medio_contacto || 'WhatsApp'} · ${obtenerContactoCliente(clienteSeleccionado)}`}
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
                          {cliente.medio_contacto || 'WhatsApp'} · {obtenerContactoCliente(cliente)}
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
              <label>Fecha del pedido*</label>
              <input type="date" value={fechaPedido} onChange={(e) => setFechaPedido(e.target.value)} required />
              <small className="field-help-text">Usa la fecha en que el cliente confirmó el pedido.</small>
            </div>
          </div>

          <details className="new-order-optional-details">
            <summary>Agregar notas o guía</summary>
            <div className="form-grid">
              <div className="form-field">
                <label>Tracking / guía</label>
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Opcional" />
              </div>

              <div className="form-field">
                <label>Notas del pedido</label>
                <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Indicaciones especiales" />
              </div>
            </div>
          </details>

          <div className="automatic-order-state-note">
            <span>Estado automático</span>
            <p>El pedido empezará como pendiente de compra y Ordely actualizará su avance cuando registres la compra, la llegada y la entrega.</p>
          </div>
        </section>

        <section className="new-order-step-card">
          <div className="new-order-step-heading new-order-step-heading-actions">
            <span>2</span>
            <div>
              <h2>Productos</h2>
              <p>Agrega lo que pidió el cliente y cuánto le cobrarás.</p>
            </div>

          </div>

          <div className="order-products-list order-products-list-simple">
            {productos.map((producto, index) => (
              <div className="product-order-card product-order-card-simple" key={producto.id}>
                <div className="product-order-card-header">
                  <div>
                    <span>Producto</span>
                    <h3>{index + 1}</h3>
                  </div>

                  {productos.length > 1 && (
                    <button type="button" className="product-remove-link" onClick={() => eliminarProducto(producto.id)}>
                      Quitar
                    </button>
                  )}
                </div>

                <div className="form-grid product-simple-grid">
                  <div className="form-field product-name-field">
                    <label>Nombre del producto*</label>
                    <input
                      value={producto.nombre_producto}
                      onChange={(e) => actualizarProducto(producto.id, 'nombre_producto', e.target.value)}
                      placeholder="Ej. Vestido azul"
                      required
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
                    <label>Talla / variante</label>
                    <input value={producto.talla} onChange={(e) => actualizarProducto(producto.id, 'talla', e.target.value)} />
                  </div>

                  <div className="form-field">
                    <label>Color</label>
                    <input value={producto.color} onChange={(e) => actualizarProducto(producto.id, 'color', e.target.value)} />
                  </div>

                  <div className="form-field">
                    <label>Precio en plataforma*</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={producto.precio_pagina}
                      onChange={(e) => actualizarProducto(producto.id, 'precio_pagina', e.target.value)}
                      placeholder="0.00"
                      required
                    />
                    <small className="field-help-text">Precio visible antes de cupones o descuentos.</small>
                  </div>

                  <div className="product-commission-field">
                    <label className="product-commission-toggle">
                      <input
                        type="checkbox"
                        checked={producto.cobra_comision === true}
                        onChange={(e) => actualizarProducto(producto.id, 'cobra_comision', e.target.checked)}
                      />
                      <span>
                        <strong>Cobrar comisión extra</strong>
                        <small>Actívalo solo si este producto lleva un cargo adicional.</small>
                      </span>
                    </label>

                    {producto.cobra_comision && (
                      <label className="form-field product-commission-amount">
                        <span>Comisión por unidad*</span>
                        <div className="money-input-with-prefix">
                          <i>$</i>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={producto.comision_extra}
                            onChange={(e) => actualizarProducto(producto.id, 'comision_extra', e.target.value)}
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <small className="field-help-text">El cliente pagará ${obtenerPrecioClienteProducto(producto).toFixed(2)} por unidad.</small>
                      </label>
                    )}
                  </div>

                  <div className="form-field product-link-field">
                    <label>Link del producto</label>
                    <input
                      value={producto.link_shein}
                      onChange={(e) => actualizarProducto(producto.id, 'link_shein', e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="new-order-add-product-bottom">
            <button
              type="button"
              className="btn btn-light-bordered btn-add-product"
              onClick={agregarProducto}
              disabled={bloqueado || guardandoPedido}
            >
              + Agregar otro producto
            </button>
          </div>

          <p className="new-order-cost-note">
            El costo real se calculará después en <strong>Compras</strong>, cuando registres cupones, envío, impuestos y el total pagado.
          </p>
        </section>

        <section className="new-order-step-card">
          <div className="new-order-step-heading">
            <span>3</span>
            <div>
              <h2>Pago</h2>
              <p>Registra lo que ya recibiste. Ordely calculará lo que falta.</p>
            </div>
          </div>

          <div className="new-order-payment-layout">
            <div className="new-order-payment-fields">
              <label className="form-field">
                <span>Anticipo recibido</span>
                <input type="number" step="0.01" min="0" value={anticipo} onChange={(e) => setAnticipo(e.target.value)} placeholder="0.00" />
              </label>

              {Number(anticipo || 0) > 0 && (
                <>
                  <label className="form-field">
                    <span>Método de pago*</span>
                    <select value={metodoAnticipo} onChange={(e) => setMetodoAnticipo(e.target.value)} required>
                      {METODOS_PAGO.map((metodo) => (
                        <option value={metodo} key={metodo}>{metodo}</option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Fecha del anticipo*</span>
                    <input type="date" value={fechaAnticipo} onChange={(e) => setFechaAnticipo(e.target.value)} required />
                    <small className="field-help-text">Hoy aparece seleccionado, pero puedes cambiarlo.</small>
                  </label>
                </>
              )}
            </div>

            <div className="new-order-money-summary">
              <div>
                <span>Total del cliente</span>
                <strong>${totalClientePreview.toFixed(2)}</strong>
              </div>
              <div>
                <span>Anticipo</span>
                <strong>${Number(anticipo || 0).toFixed(2)}</strong>
              </div>
              <div className="new-order-money-highlight">
                <span>Restante</span>
                <strong>${Math.max(restantePreview, 0).toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="new-order-step-card new-order-review-card">
          <div className="new-order-step-heading">
            <span>4</span>
            <div>
              <h2>Revisa y guarda</h2>
              <p>Confirma los datos principales antes de crear el pedido.</p>
            </div>
          </div>

          <div className="new-order-review-grid">
            <div><span>Cliente</span><strong>{clienteSeleccionado?.nombre || 'Selecciona un cliente'}</strong></div>
            <div><span>Plataforma</span><strong>{plataforma}</strong></div>
            <div><span>Productos</span><strong>{productos.length}</strong></div>
            <div><span>Total cliente</span><strong>${totalClientePreview.toFixed(2)}</strong></div>
            <div><span>Comisiones</span><strong>${totalComisionesPreview.toFixed(2)}</strong></div>
            <div><span>Anticipo</span><strong>${Number(anticipo || 0).toFixed(2)}</strong></div>
            {Number(anticipo || 0) > 0 && <div><span>Método del anticipo</span><strong>{metodoAnticipo}</strong></div>}
            {Number(anticipo || 0) > 0 && <div><span>Fecha anticipo</span><strong>{fechaAnticipo}</strong></div>}
            <div><span>Restante</span><strong>${Math.max(restantePreview, 0).toFixed(2)}</strong></div>
          </div>

          <div className="new-order-final-actions">
            <span>Costo inicial estimado en plataforma: <strong>${totalSheinPreview.toFixed(2)}</strong></span>
            <button className="btn btn-primary" disabled={guardandoPedido || !puedeCrearPedido(estadoPlan)}>
              {guardandoPedido ? 'Creando pedido...' : (!puedeCrearPedido(estadoPlan) ? 'Límite alcanzado' : 'Crear pedido')}
            </button>
          </div>
        </section>
      </form>
    </Layout>
  )
}
