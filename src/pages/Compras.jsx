import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Toast from '../components/Toast'

const hoyISO = () => new Date().toISOString().slice(0, 10)

const plataformas = ['SHEIN', 'Temu', 'AliExpress', 'Catálogo', 'Otro']

const prefijosPlataforma = {
  SHEIN: 'SHE',
  Temu: 'TEM',
  AliExpress: 'ALI',
  Catálogo: 'CAT',
  Otro: 'OTR'
}

const formatearDinero = (valor) => `$${Number(valor || 0).toFixed(2)}`
const normalizarEstadoCompra = (estado) => estado || 'Pendiente de compra'

export default function Compras() {
  const [productos, setProductos] = useState([])
  const [lotes, setLotes] = useState([])
  const [seleccionados, setSeleccionados] = useState([])
  const [tab, setTab] = useState('pendientes')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const guardandoRef = useRef(false)
  const plataformaInicializadaRef = useRef(false)
  const [toast, setToast] = useState(null)
  const [lotesAbiertos, setLotesAbiertos] = useState({})
  const [plataformaPredeterminada, setPlataformaPredeterminada] = useState('SHEIN')
  const [plataformaSeleccionada, setPlataformaSeleccionada] = useState('SHEIN')
  const [resumenActivo, setResumenActivo] = useState(false)
  const [guiaAbierta, setGuiaAbierta] = useState(false)

  const [form, setForm] = useState({
    plataforma: 'SHEIN',
    cupon: '',
    descuento: '',
    descuentoTipo: 'valor',
    usarPuntos: false,
    puntos: '',
    envio: '',
    importacion: '',
    impuestos: '',
    comisiones: '',
    totalPagado: '',
    fechaCompra: hoyISO()
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  const mostrarToast = (mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo })
  }

  const cargarDatos = async () => {
    setCargando(true)

    if (!plataformaInicializadaRef.current) {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData?.user?.id

        if (userId) {
          const { data: perfilData } = await supabase
            .from('perfiles')
            .select('plataforma_predeterminada')
            .eq('user_id', userId)
            .maybeSingle()

          const plataformaPerfil = plataformas.includes(perfilData?.plataforma_predeterminada)
            ? perfilData.plataforma_predeterminada
            : 'SHEIN'

          setPlataformaPredeterminada(plataformaPerfil)
          setPlataformaSeleccionada(plataformaPerfil)
          setForm((actual) => ({ ...actual, plataforma: plataformaPerfil }))
        }
      } catch (error) {
        console.log(error)
      } finally {
        plataformaInicializadaRef.current = true
      }
    }

    let productosData = []
    let errorProductos = null

    const consultaProductos = () => supabase
      .from('productos_pedido')
      .select('*, pedidos(id, codigo, plataforma, estado, creado_en, clientes(nombre, telefono, medio_contacto, usuario_contacto))')
      .is('lote_compra_id', null)
      .order('fecha_agregado', { ascending: false, nullsFirst: false })

    const respuestaProductos = await consultaProductos()
    productosData = respuestaProductos.data
    errorProductos = respuestaProductos.error

    // Respaldo para bases donde todavía no se recargó el cache de columnas nuevas.
    if (errorProductos) {
      console.log('Error cargando productos pendientes:', errorProductos)

      const respaldoProductos = await supabase
        .from('productos_pedido')
        .select('*, pedidos(id, codigo, plataforma, estado, creado_en, clientes(nombre, telefono))')
        .is('lote_compra_id', null)

      productosData = respaldoProductos.data
      errorProductos = respaldoProductos.error
    }

    if (errorProductos) {
      console.log('Error final productos pendientes:', errorProductos)
      mostrarToast('No se pudieron cargar productos pendientes. Revisa que el SQL de lotes esté ejecutado.', 'error')
    } else {
      setProductos(productosData || [])
    }

    const respuestaLotes = await supabase
      .from('lotes_compra')
      .select(`
        *,
        lote_productos(
          *,
          productos_pedido(
            id,
            nombre_producto,
            talla,
            color,
            cantidad,
            precio_venta,
            precio_pagina,
            precio_shein,
            pedidos(
              id,
              codigo,
              clientes(nombre)
            )
          )
        )
      `)
      .order('fecha_compra', { ascending: false })
      .limit(60)

    let lotesData = respuestaLotes.data
    let errorLotes = respuestaLotes.error

    // Si el historial falla por cache de relaciones/columnas, no bloqueamos pendientes.
    if (errorLotes) {
      console.log('Error cargando historial de lotes:', errorLotes)

      const respaldoLotes = await supabase
        .from('lotes_compra')
        .select('*')
        .order('fecha_compra', { ascending: false })
        .limit(60)

      lotesData = respaldoLotes.data
      errorLotes = respaldoLotes.error
    }

    if (errorLotes) {
      console.log('Error final historial de lotes:', errorLotes)
    } else {
      setLotes(lotesData || [])
    }

    setCargando(false)
  }

  const cambiarPlataforma = (plataforma) => {
    setPlataformaSeleccionada(plataforma)
    setSeleccionados([])
    setResumenActivo(false)
    setForm((actual) => ({ ...actual, plataforma }))
  }

  const productosFiltrados = useMemo(() => {
    return productos.filter((producto) => {
      const estado = normalizarEstadoCompra(producto.estado_compra)
      const estadoPedido = producto.pedidos?.estado || ''
      const plataformaPedido = producto.pedidos?.plataforma || producto.plataforma || ''

      return (
        plataformaPedido === plataformaSeleccionada &&
        estado === 'Pendiente de compra' &&
        !['Cancelado', 'Devuelto', 'Entregado'].includes(estadoPedido)
      )
    })
  }, [productos, plataformaSeleccionada])

  const lotesFiltrados = useMemo(() => {
    return lotes.filter((lote) => lote.plataforma === plataformaSeleccionada)
  }, [lotes, plataformaSeleccionada])

  const numeroLoteSugerido = useMemo(() => {
    const prefijo = prefijosPlataforma[plataformaSeleccionada] || 'LOT'
    const siguiente = lotesFiltrados.length + 1
    return `${prefijo}-${String(siguiente).padStart(4, '0')}`
  }, [plataformaSeleccionada, lotesFiltrados.length])

  const productosSeleccionados = useMemo(() => {
    const ids = new Set(seleccionados)
    return productosFiltrados.filter((producto) => ids.has(producto.id))
  }, [productosFiltrados, seleccionados])

  const productosAgrupados = useMemo(() => {
    const mapa = new Map()

    productosFiltrados.forEach((producto) => {
      const pedidoId = producto.pedidos?.id || `sin-pedido-${producto.id}`
      if (!mapa.has(pedidoId)) {
        mapa.set(pedidoId, {
          pedidoId,
          codigo: producto.pedidos?.codigo || 'Sin pedido',
          cliente: producto.pedidos?.clientes?.nombre || 'Sin cliente',
          medio: producto.pedidos?.clientes?.medio_contacto || 'Contacto',
          productos: []
        })
      }
      mapa.get(pedidoId).productos.push(producto)
    })

    return Array.from(mapa.values())
  }, [productosFiltrados])

  const subtotalSeleccionado = useMemo(() => {
    return productosSeleccionados.reduce((total, producto) => {
      const precioPagina = Number(producto.precio_pagina ?? producto.precio_shein ?? 0)
      const cantidad = Number(producto.cantidad || 0)
      return total + (precioPagina * cantidad)
    }, 0)
  }, [productosSeleccionados])

  const envioValor = useMemo(() => {
    const valor = Number(form.envio || 0)
    return Number.isFinite(valor) && valor > 0 ? valor : 0
  }, [form.envio])

  const importacionValor = useMemo(() => {
    const valor = Number(form.importacion || 0)
    return Number.isFinite(valor) && valor > 0 ? valor : 0
  }, [form.importacion])

  const impuestosValor = useMemo(() => {
    const valor = Number(form.impuestos || 0)
    return Number.isFinite(valor) && valor > 0 ? valor : 0
  }, [form.impuestos])

  const comisionesValor = useMemo(() => {
    const valor = Number(form.comisiones || 0)
    return Number.isFinite(valor) && valor > 0 ? valor : 0
  }, [form.comisiones])

  const cargosExtra = useMemo(() => {
    return envioValor + importacionValor + impuestosValor + comisionesValor
  }, [envioValor, importacionValor, impuestosValor, comisionesValor])

  const descuentoCuponAplicado = useMemo(() => {
    if (subtotalSeleccionado <= 0) return 0

    const valor = Number(form.descuento || 0)
    if (!Number.isFinite(valor) || valor <= 0) return 0

    if (form.descuentoTipo === 'porcentaje') {
      const porcentajeSeguro = Math.min(valor, 100)
      return Number(((subtotalSeleccionado * porcentajeSeguro) / 100).toFixed(2))
    }

    return Math.min(valor, subtotalSeleccionado)
  }, [subtotalSeleccionado, form.descuento, form.descuentoTipo])

  const puntosAplicados = useMemo(() => {
    if (!form.usarPuntos || subtotalSeleccionado <= 0) return 0
    const puntos = Number(form.puntos || 0)
    if (!Number.isFinite(puntos) || puntos <= 0) return 0
    return Math.min(puntos, subtotalSeleccionado)
  }, [form.usarPuntos, form.puntos, subtotalSeleccionado])

  const descuentoAplicado = useMemo(() => {
    return Math.min(descuentoCuponAplicado + puntosAplicados, subtotalSeleccionado)
  }, [descuentoCuponAplicado, puntosAplicados, subtotalSeleccionado])

  const totalEstimado = useMemo(() => {
    return Math.max(subtotalSeleccionado - descuentoAplicado + cargosExtra, 0)
  }, [subtotalSeleccionado, descuentoAplicado, cargosExtra])

  const totalPagadoFinal = useMemo(() => {
    const total = form.totalPagado === '' ? totalEstimado : Number(form.totalPagado)
    return Number.isFinite(total) ? total : 0
  }, [form.totalPagado, totalEstimado])

  const diferenciaTotal = useMemo(() => {
    return Number((totalPagadoFinal - totalEstimado).toFixed(2))
  }, [totalPagadoFinal, totalEstimado])

  const vistaPreviaProductos = useMemo(() => {
    return productosSeleccionados.map((producto) => {
      const precioPagina = Number(producto.precio_pagina ?? producto.precio_shein ?? 0)
      const cantidad = Number(producto.cantidad || 0)
      const subtotal = precioPagina * cantidad
      const factorTotal = subtotalSeleccionado > 0 ? subtotal / subtotalSeleccionado : 0
      const descuentoProducto = subtotalSeleccionado > 0
        ? Number((descuentoAplicado * factorTotal).toFixed(2))
        : 0
      const precioConDescuento = Math.max(subtotal - descuentoProducto, 0)
      // Importante: los cargos extra NO se meten al producto.
      // Se guardan separados en el lote para que Estadísticas los pueda sumar aparte.
      const costoReal = precioConDescuento
      const precioVentaTotal = Number(producto.precio_venta || precioPagina || 0) * cantidad
      const ganancia = precioVentaTotal - costoReal

      return {
        id: producto.id,
        nombre: producto.nombre_producto || 'Producto',
        pedido: producto.pedidos?.codigo || 'Sin pedido',
        cliente: producto.pedidos?.clientes?.nombre || 'Sin cliente',
        cantidad,
        precioPagina,
        subtotal,
        descuentoProducto,
        precioConDescuento,
        costoReal,
        ganancia
      }
    })
  }, [productosSeleccionados, subtotalSeleccionado, descuentoAplicado])

  const alternarProducto = (id) => {
    setSeleccionados((actuales) => {
      if (actuales.includes(id)) return actuales.filter((item) => item !== id)
      return [...actuales, id]
    })
    setResumenActivo(false)
  }

  const seleccionarPedido = (grupo) => {
    const idsGrupo = grupo.productos.map((producto) => producto.id)
    const todosActivos = idsGrupo.every((id) => seleccionados.includes(id))

    setSeleccionados((actuales) => {
      if (todosActivos) return actuales.filter((id) => !idsGrupo.includes(id))
      return Array.from(new Set([...actuales, ...idsGrupo]))
    })
    setResumenActivo(false)
  }

  const seleccionarTodos = () => {
    setSeleccionados((actuales) => {
      if (actuales.length === productosFiltrados.length && productosFiltrados.length > 0) return []
      return productosFiltrados.map((producto) => producto.id)
    })
    setResumenActivo(false)
  }

  const alternarLoteAbierto = (id) => {
    setLotesAbiertos((actuales) => ({
      ...actuales,
      [id]: !actuales[id]
    }))
  }

  const actualizarForm = (campo, valor) => {
    setForm((actual) => ({ ...actual, [campo]: valor }))
    setResumenActivo(false)
  }

  const validarLote = () => {
    if (seleccionados.length === 0) {
      mostrarToast('Selecciona al menos un producto para registrar la compra.', 'error')
      return false
    }

    const valorDescuento = Number(form.descuento || 0)
    const puntos = Number(form.puntos || 0)
    const envio = Number(form.envio || 0)
    const importacion = Number(form.importacion || 0)
    const impuestos = Number(form.impuestos || 0)
    const comisiones = Number(form.comisiones || 0)
    const totalPagado = form.totalPagado === '' ? 0 : Number(form.totalPagado)

    if ([valorDescuento, puntos, envio, importacion, impuestos, comisiones, totalPagado].some((valor) => !Number.isFinite(valor) || valor < 0)) {
      mostrarToast('Revisa los montos de la compra.', 'error')
      return false
    }

    if (form.descuentoTipo === 'porcentaje' && valorDescuento > 100) {
      mostrarToast('El porcentaje de descuento no puede ser mayor a 100%.', 'error')
      return false
    }

    if (form.descuentoTipo === 'valor' && valorDescuento > subtotalSeleccionado) {
      mostrarToast('El descuento en pesos no puede ser mayor al subtotal seleccionado.', 'error')
      return false
    }

    if (form.usarPuntos && puntos > subtotalSeleccionado) {
      mostrarToast('Los puntos o saldo usado no pueden ser mayores al subtotal seleccionado.', 'error')
      return false
    }

    if (descuentoAplicado > subtotalSeleccionado) {
      mostrarToast('El descuento total de cupón y puntos no puede ser mayor al subtotal seleccionado.', 'error')
      return false
    }

    return true
  }

  const abrirResumen = (event) => {
    event.preventDefault()
    if (!validarLote()) return
    setResumenActivo(true)
  }

  const crearLote = async () => {
    if (guardandoRef.current) return
    if (!validarLote()) return

    const descuento = descuentoAplicado
    const envio = Number(form.envio || 0)
    const importacion = Number(form.importacion || 0)
    const impuestos = Number(form.impuestos || 0)
    const comisiones = Number(form.comisiones || 0)
    const totalPagado = totalPagadoFinal
    const referenciaCupon = [
      form.cupon.trim(),
      puntosAplicados > 0 ? `Puntos/saldo: ${formatearDinero(puntosAplicados)}` : ''
    ].filter(Boolean).join(' · ')

    guardandoRef.current = true
    setGuardando(true)

    const { error } = await supabase.rpc('crear_lote_compra', {
      p_plataforma: plataformaSeleccionada,
      p_numero_orden: '',
      p_cupon: referenciaCupon,
      p_descuento_cupon: descuentoCuponAplicado,
      p_puntos: puntosAplicados,
      p_envio: envio,
      p_importacion: importacion,
      p_impuestos: impuestos,
      p_comisiones: comisiones,
      p_total_pagado: totalPagado,
      p_fecha_compra: form.fechaCompra || hoyISO(),
      p_productos: seleccionados
    })

    guardandoRef.current = false
    setGuardando(false)

    if (error) {
      console.log(error)
      mostrarToast(error.message || 'No se pudo registrar la compra.', 'error')
      return
    }

    mostrarToast('Compra registrada. Ordely actualizó costos reales y estados.')
    setSeleccionados([])
    setResumenActivo(false)
    setForm({
      plataforma: plataformaSeleccionada,
      cupon: '',
      descuento: '',
      descuentoTipo: form.descuentoTipo || 'valor',
      usarPuntos: false,
      puntos: '',
      envio: '',
      importacion: '',
      impuestos: '',
      comisiones: '',
      totalPagado: '',
      fechaCompra: hoyISO()
    })
    setTab('historial')
    cargarDatos()
  }

  const renderCampoDescuento = () => (
    <div className="form-field compras-help-field compras-discount-field">
      <label>Descuento del cupón</label>
      <div className="discount-type-toggle" role="group" aria-label="Tipo de descuento">
        <button
          type="button"
          className={form.descuentoTipo === 'valor' ? 'active' : ''}
          onClick={() => actualizarForm('descuentoTipo', 'valor')}
        >
          Valor $
        </button>
        <button
          type="button"
          className={form.descuentoTipo === 'porcentaje' ? 'active' : ''}
          onClick={() => actualizarForm('descuentoTipo', 'porcentaje')}
        >
          Porcentaje %
        </button>
      </div>
      <input
        type="number"
        min="0"
        max={form.descuentoTipo === 'porcentaje' ? '100' : undefined}
        step="0.01"
        value={form.descuento}
        onChange={(e) => actualizarForm('descuento', e.target.value)}
        placeholder={form.descuentoTipo === 'porcentaje' ? 'Ej. 15' : 'Ej. 100'}
      />
      <small>
        {form.descuentoTipo === 'porcentaje'
          ? 'El porcentaje se aplica al subtotal de los productos seleccionados.'
          : 'Copia el descuento del cupón tal como aparece en la plataforma.'}
      </small>
    </div>
  )

  return (
    <Layout>
      <Toast
        mensaje={toast?.mensaje}
        tipo={toast?.tipo}
        onClose={() => setToast(null)}
      />

      <div className="page-header row-between compras-header compras-header-v25">
        <div>
          <h1>Registrar compras en plataforma</h1>
          <p>Agrupa productos pendientes, captura lo que pagaste en la plataforma y Ordely calcula el costo real.</p>
        </div>

        <div className="compras-header-actions">
          <button type="button" className="btn btn-light-bordered" onClick={() => setGuiaAbierta(true)}>
            ¿Cómo funciona?
          </button>

          <div className="compras-tabs">
            <button type="button" className={tab === 'pendientes' ? 'active' : ''} onClick={() => setTab('pendientes')}>
              Pendientes
            </button>
            <button type="button" className={tab === 'historial' ? 'active' : ''} onClick={() => setTab('historial')}>
              Historial
            </button>
          </div>
        </div>
      </div>

      {guiaAbierta && (
        <div className="compras-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setGuiaAbierta(false) }}>
          <section className="table-card compras-guide-modal" role="dialog" aria-modal="true">
            <button type="button" className="compras-modal-close" onClick={() => setGuiaAbierta(false)} aria-label="Cerrar guía">×</button>
            <span className="compras-guide-kicker">Guía rápida</span>
            <h2>¿Qué se hace aquí?</h2>
            <p>Usa esta pantalla cuando ya vas a comprar productos en SHEIN, Temu, AliExpress o catálogo.</p>
            <div className="compras-guide-steps">
              <div><strong>1</strong><span>Elige la plataforma.</span></div>
              <div><strong>2</strong><span>Selecciona los productos que meterás juntos al carrito.</span></div>
              <div><strong>3</strong><span>Escribe cupón, puntos, envío, importación, impuestos y total final en un solo formulario.</span></div>
              <div><strong>4</strong><span>Ordely reparte el descuento y calcula costos reales.</span></div>
            </div>
            <p className="compras-guide-note">El cupón y los puntos se descuentan solo a productos. Envío, importación, impuestos y comisiones quedan separados para tus estadísticas.</p>
          </section>
        </div>
      )}

      <section className="table-card compras-platform-card compras-platform-card-v25">
        <div className="compras-platform-head">
          <div>
            <span>Paso 1</span>
            <h2>¿Dónde vas a comprar?</h2>
            <p>Solo se mostrarán productos pendientes de la plataforma elegida.</p>
          </div>

          <div className="compras-default-pill">
            Predeterminada: <strong>{plataformaPredeterminada}</strong>
          </div>
        </div>

        <div className="platform-choice-grid platform-choice-grid-v25">
          {plataformas.map((plataforma) => (
            <button
              type="button"
              key={plataforma}
              className={plataformaSeleccionada === plataforma ? 'platform-choice active' : 'platform-choice'}
              onClick={() => cambiarPlataforma(plataforma)}
              disabled={guardando}
            >
              <strong>{plataforma}</strong>
              <span>{plataforma === plataformaPredeterminada ? 'Predeterminada' : 'Ver productos'}</span>
            </button>
          ))}
        </div>
      </section>

      {tab === 'pendientes' && (
        <>
          <div className="compras-flow-summary compras-flow-summary-v25">
            <div><span>Plataforma</span><strong>{plataformaSeleccionada}</strong></div>
            <div><span>Pendientes</span><strong>{productosFiltrados.length}</strong></div>
            <div><span>Seleccionados</span><strong>{productosSeleccionados.length}</strong></div>
            <div><span>Subtotal seleccionado</span><strong>{formatearDinero(subtotalSeleccionado)}</strong></div>
          </div>

          <div className="compras-layout compras-layout-v25">
            <section className="table-card compras-pendientes-card compras-pendientes-card-v25">
              <div className="row-between table-title compras-list-title">
                <div>
                  <span className="compras-step-pill">Paso 2</span>
                  <h2>Selecciona productos pendientes</h2>
                  <p className="muted">Elige los artículos que comprarás juntos en el mismo carrito de {plataformaSeleccionada}.</p>
                </div>

                <button type="button" className="btn btn-light-bordered" onClick={seleccionarTodos} disabled={productosFiltrados.length === 0 || guardando}>
                  {seleccionados.length === productosFiltrados.length && productosFiltrados.length > 0 ? 'Quitar todos' : 'Seleccionar visibles'}
                </button>
              </div>

              {cargando ? (
                <div className="empty-state">Cargando productos...</div>
              ) : productosFiltrados.length === 0 ? (
                <div className="empty-state">
                  No hay productos pendientes de {plataformaSeleccionada}. Cambia de plataforma o registra un pedido nuevo.
                </div>
              ) : (
                <div className="compras-order-groups">
                  {productosAgrupados.map((grupo) => {
                    const idsGrupo = grupo.productos.map((producto) => producto.id)
                    const todosActivos = idsGrupo.every((id) => seleccionados.includes(id))

                    return (
                      <article className="compras-order-group" key={grupo.pedidoId}>
                        <div className="compras-order-head">
                          <div>
                            <strong>{grupo.codigo}</strong>
                            <span>{grupo.cliente}</span>
                          </div>
                          <button type="button" onClick={() => seleccionarPedido(grupo)} disabled={guardando}>
                            {todosActivos ? 'Quitar pedido' : 'Seleccionar pedido'}
                          </button>
                        </div>

                        <div className="compras-products-list compras-products-list-v25">
                          {grupo.productos.map((producto) => {
                            const precioPagina = Number(producto.precio_pagina ?? producto.precio_shein ?? 0)
                            const cantidad = Number(producto.cantidad || 0)
                            const totalPagina = precioPagina * cantidad
                            const activo = seleccionados.includes(producto.id)

                            return (
                              <button
                                type="button"
                                key={producto.id}
                                className={activo ? 'compra-product-card compra-product-card-selected' : 'compra-product-card'}
                                onClick={() => alternarProducto(producto.id)}
                                disabled={guardando}
                              >
                                <span className="compra-check">{activo ? '✓' : ''}</span>
                                <div className="compra-product-main">
                                  <strong>{producto.nombre_producto || 'Producto'}</strong>
                                  <span>
                                    {cantidad} pza. {producto.talla ? `· Talla ${producto.talla}` : ''} {producto.color ? `· ${producto.color}` : ''}
                                  </span>
                                </div>
                                <div className="compra-product-money">
                                  <span>{cantidad} × {formatearDinero(precioPagina)}</span>
                                  <strong>{formatearDinero(totalPagina)}</strong>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <aside className="table-card compras-lote-card compras-lote-card-v25">
              {productosSeleccionados.length === 0 ? (
                <div className="compras-wait-card compras-wait-card-v25">
                  <span>Paso 3</span>
                  <h2>Captura la compra</h2>
                  <p>Primero selecciona los productos que meterás juntos al carrito de {plataformaSeleccionada}. Después aparecerá un formulario único para cupón, puntos, envío y total final.</p>
                </div>
              ) : (
                <>
                  <div className="compras-lote-title-v25">
                    <span className="compras-step-pill">Paso 3</span>
                    <h2>Captura la compra</h2>
                    <p>Llena solo lo que aparezca en la plataforma. El cupón y los puntos se descuentan únicamente a los productos.</p>
                  </div>

                  <form onSubmit={abrirResumen} className="compras-lote-form compras-lote-form-v25">
                    <div className="compras-unified-help">
                      <strong>Todo en un solo paso</strong>
                      <span>El cupón y los puntos bajan solo el costo de los productos. Envío, importación, impuestos y comisiones quedan separados.</span>
                    </div>

                    <div className="form-field compras-help-field">
                      <label>Fecha de compra*</label>
                      <input type="date" value={form.fechaCompra} onChange={(e) => actualizarForm('fechaCompra', e.target.value)} required />
                      <small>Día en que pagarás o pagaste esta compra. Sirve para calcular la posible llegada.</small>
                    </div>

                    <div className="compras-easy-panel compras-unified-panel">
                      <div className="form-field compras-help-field">
                        <label>Cupón utilizado</label>
                        <input value={form.cupon} onChange={(e) => actualizarForm('cupon', e.target.value.toUpperCase())} placeholder="Ej. SHEIN100" />
                        <small>Opcional. Escribe el código, promoción o referencia que usaste.</small>
                      </div>

                      {renderCampoDescuento()}

                      <div className="compras-points-card">
                        <div className="compras-switch-row">
                          <div>
                            <strong>¿Usaste puntos, saldo o monedas?</strong>
                            <span>Actívalo si la plataforma descontó puntos SHEIN, saldo, monedas o crédito.</span>
                          </div>
                          <button
                            type="button"
                            className={form.usarPuntos ? 'compras-switch active' : 'compras-switch'}
                            onClick={() => actualizarForm('usarPuntos', !form.usarPuntos)}
                            aria-pressed={form.usarPuntos}
                          >
                            <span />
                          </button>
                        </div>

                        {form.usarPuntos && (
                          <div className="form-field compras-help-field">
                            <label>Monto descontado por puntos/saldo</label>
                            <input type="number" min="0" step="0.01" value={form.puntos} onChange={(e) => actualizarForm('puntos', e.target.value)} placeholder="Ej. 280.83" />
                            <small>Este monto también se descuenta solo a los productos, igual que el cupón.</small>
                          </div>
                        )}
                      </div>

                      <div className="form-grid compras-lote-money-grid compras-extra-costs-grid">
                        <div className="form-field compras-help-field">
                          <label>Envío</label>
                          <input type="number" min="0" step="0.01" value={form.envio} onChange={(e) => actualizarForm('envio', e.target.value)} placeholder="Ej. 0" />
                          <small>Si fue gratis, déjalo en 0. Se guarda separado.</small>
                        </div>
                        <div className="form-field compras-help-field">
                          <label>Importación</label>
                          <input type="number" min="0" step="0.01" value={form.importacion} onChange={(e) => actualizarForm('importacion', e.target.value)} placeholder="Ej. 0" />
                          <small>Úsalo si la plataforma cobró importación, aduana o gestión.</small>
                        </div>
                        <div className="form-field compras-help-field">
                          <label>Impuestos</label>
                          <input type="number" min="0" step="0.01" value={form.impuestos} onChange={(e) => actualizarForm('impuestos', e.target.value)} placeholder="Ej. 349.77" />
                          <small>Solo si la plataforma muestra impuestos por separado.</small>
                        </div>
                        <div className="form-field compras-help-field">
                          <label>Comisiones</label>
                          <input type="number" min="0" step="0.01" value={form.comisiones} onChange={(e) => actualizarForm('comisiones', e.target.value)} placeholder="Ej. 0" />
                          <small>Seguro, manejo o comisión bancaria. Se guarda separado.</small>
                        </div>
                        <div className="form-field compras-help-field compras-total-full">
                          <label>Total final pagado</label>
                          <input type="number" min="0" step="0.01" value={form.totalPagado} onChange={(e) => actualizarForm('totalPagado', e.target.value)} placeholder="Ej. 3859.40" />
                          <small>Copia el total final de la plataforma para comparar si todo coincide.</small>
                        </div>
                      </div>
                    </div>

                    <div className="compras-discount-preview compras-discount-preview-v25 compras-product-discount-total">
                      <span>Descuento aplicado solo a productos</span>
                      <strong>{formatearDinero(descuentoAplicado)}</strong>
                      <p>Incluye cupón {formatearDinero(descuentoCuponAplicado)}{puntosAplicados > 0 ? ` y puntos/saldo ${formatearDinero(puntosAplicados)}` : ''}. Este monto se reparte proporcionalmente entre los productos seleccionados.</p>
                    </div>

                    <div className="compras-summary-box compras-summary-box-v25 compras-summary-box-unified">
                      <div><span>Productos</span><strong>{productosSeleccionados.length}</strong></div>
                      <div><span>Subtotal productos</span><strong>{formatearDinero(subtotalSeleccionado)}</strong></div>
                      <div><span>Cupón</span><strong>{form.descuentoTipo === 'porcentaje' ? `${Number(form.descuento || 0)}%` : formatearDinero(descuentoCuponAplicado)}</strong></div>
                      <div><span>Puntos/saldo</span><strong>{formatearDinero(puntosAplicados)}</strong></div>
                      <div><span>Envío</span><strong>{formatearDinero(envioValor)}</strong></div>
                      <div><span>Importación</span><strong>{formatearDinero(importacionValor)}</strong></div>
                      <div><span>Impuestos</span><strong>{formatearDinero(impuestosValor)}</strong></div>
                      <div><span>Comisiones</span><strong>{formatearDinero(comisionesValor)}</strong></div>
                      <div><span>Total calculado</span><strong>{formatearDinero(totalEstimado)}</strong></div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={guardando || seleccionados.length === 0}>
                      Revisar resumen antes de confirmar
                    </button>
                  </form>
                </>
              )}
            </aside>
          </div>

          {resumenActivo && (
            <div className="compras-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !guardando) setResumenActivo(false) }}>
              <section className="table-card compras-confirm-card compras-confirm-modal compras-confirm-modal-v25" role="dialog" aria-modal="true" aria-labelledby="compras-resumen-title">
                <div className="compras-confirm-head">
                  <div>
                    <span>Paso 4</span>
                    <h2 id="compras-resumen-title">Revisa antes de confirmar</h2>
                    <p>Compara estos datos con el carrito o resumen de {plataformaSeleccionada}. Si coincide, confirma la compra.</p>
                  </div>

                  <button type="button" className="compras-modal-close" onClick={() => setResumenActivo(false)} disabled={guardando} aria-label="Cerrar resumen">×</button>

                  <div className="compras-confirm-total">
                    <span>Total a guardar</span>
                    <strong>{formatearDinero(totalPagadoFinal)}</strong>
                  </div>
                </div>

                <div className={form.totalPagado === '' || Math.abs(diferenciaTotal) <= 0.01 ? 'compras-match-box ok' : 'compras-match-box warn'}>
                  <strong>{form.totalPagado === '' ? 'Listo para revisar' : Math.abs(diferenciaTotal) <= 0.01 ? 'Todo coincide' : 'Revisa el total'}</strong>
                  <span>
                    {form.totalPagado === ''
                      ? 'No escribiste total final. Ordely guardará el total calculado con cupón, puntos, envío, importación, impuestos y comisiones.'
                      : Math.abs(diferenciaTotal) <= 0.01
                        ? 'El total calculado coincide con el total final que escribiste.'
                        : `Hay una diferencia de ${formatearDinero(Math.abs(diferenciaTotal))}. Revisa cupón, puntos, envío, importación, impuestos o comisiones.`}
                  </span>
                </div>

                <div className="compras-confirm-metrics compras-confirm-metrics-v25">
                  <div><span>Plataforma</span><strong>{plataformaSeleccionada}</strong></div>
                  <div><span>Lote</span><strong>{numeroLoteSugerido}</strong></div>
                  <div><span>Fecha</span><strong>{form.fechaCompra || hoyISO()}</strong></div>
                  <div><span>Cupón</span><strong>{form.cupon || '-'}</strong></div>
                  <div><span>Subtotal productos</span><strong>{formatearDinero(subtotalSeleccionado)}</strong></div>
                  <div><span>Descuento cupón</span><strong>-{formatearDinero(descuentoCuponAplicado)}</strong></div>
                  <div><span>Puntos/saldo</span><strong>-{formatearDinero(puntosAplicados)}</strong></div>
                  <div><span>Envío</span><strong>{formatearDinero(envioValor)}</strong></div>
                  <div><span>Importación</span><strong>{formatearDinero(importacionValor)}</strong></div>
                  <div><span>Impuestos</span><strong>{formatearDinero(impuestosValor)}</strong></div>
                  <div><span>Comisiones</span><strong>{formatearDinero(comisionesValor)}</strong></div>
                  <div><span>Total calculado</span><strong>{formatearDinero(totalEstimado)}</strong></div>
                </div>

                <div className="compras-confirm-products">
                  <div className="compras-confirm-products-head">
                    <strong>Productos seleccionados</strong>
                    <span>Precio de página vs. precio después de cupón y puntos.</span>
                  </div>

                  {vistaPreviaProductos.map((producto) => (
                    <div className="compras-confirm-product-row" key={producto.id}>
                      <div className="compras-confirm-product-info">
                        <strong>{producto.nombre}</strong>
                        <span>{producto.pedido} · {producto.cliente} · {producto.cantidad} pza.</span>
                      </div>

                      <div className="compras-confirm-price">
                        <span>Antes</span>
                        <del>{formatearDinero(producto.subtotal)}</del>
                      </div>

                      <div className="compras-confirm-price final">
                        <span>Con descuento</span>
                        <strong>{formatearDinero(producto.precioConDescuento)}</strong>
                      </div>

                      <div className="compras-confirm-price discount">
                        <span>Ahorro</span>
                        <strong>{formatearDinero(producto.descuentoProducto)}</strong>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="compras-confirm-actions">
                  <button type="button" className="btn btn-light-bordered" onClick={() => setResumenActivo(false)} disabled={guardando}>
                    Editar datos
                  </button>
                  <button type="button" className="btn btn-primary" onClick={crearLote} disabled={guardando}>
                    {guardando ? 'Registrando compra...' : 'Sí, confirmar compra'}
                  </button>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {tab === 'historial' && (
        <section className="table-card compras-history-card compras-history-card-v25">
          <div className="row-between table-title">
            <div>
              <h2>Compras registradas de {plataformaSeleccionada}</h2>
              <p className="muted">Historial de compras en plataforma con descuento y costo real calculado.</p>
            </div>
          </div>

          {lotesFiltrados.length === 0 ? (
            <div className="empty-state">Todavía no tienes compras registradas para {plataformaSeleccionada}.</div>
          ) : (
            <div className="compras-lotes-list compras-lotes-list-v25">
              {lotesFiltrados.map((lote) => {
                const productosLote = lote.lote_productos || []
                const abierto = !!lotesAbiertos[lote.id]

                return (
                  <article className={abierto ? 'compra-lote-item compra-lote-item-open' : 'compra-lote-item'} key={lote.id}>
                    <div className="compra-lote-summary-row compra-lote-summary-row-v25">
                      <div>
                        <span>{lote.codigo_lote}</span>
                        <strong>{lote.plataforma}</strong>
                        <p>{lote.fecha_compra} · {productosLote.length} productos</p>
                      </div>
                      <div><span>Cupón</span><strong>{lote.cupon_usado || '-'}</strong></div>
                      <div><span>Subtotal</span><strong>{formatearDinero(lote.subtotal_pagina)}</strong></div>
                      <div><span>Descuento productos</span><strong>{formatearDinero(lote.descuento_total)}</strong></div>
                      <div><span>Extras</span><strong>{formatearDinero(Number(lote.envio || 0) + Number(lote.importacion || 0) + Number(lote.impuestos || 0) + Number(lote.comisiones || 0))}</strong></div>
                      <div><span>Total real</span><strong>{formatearDinero(lote.total_pagado)}</strong></div>
                      <button type="button" className="btn btn-light-bordered compra-lote-toggle" onClick={() => alternarLoteAbierto(lote.id)}>
                        {abierto ? 'Ocultar productos' : `Ver productos (${productosLote.length})`}
                      </button>
                    </div>

                    {abierto && (
                      <div className="compra-lote-products">
                        {productosLote.length === 0 ? (
                          <div className="empty-state compra-lote-empty">Esta compra no tiene productos visibles.</div>
                        ) : (
                          productosLote.map((item) => {
                            const producto = item.productos_pedido || {}
                            const subtotal = Number(item.subtotal_pagina || 0)
                            const descuento = Number(item.descuento_asignado || 0)
                            const precioConDescuento = Math.max(subtotal - descuento, 0)
                            const costoReal = Number(item.costo_real_total ?? precioConDescuento)
                            const cantidad = Number(item.cantidad || producto.cantidad || 0)
                            const precioUnitarioFinal = cantidad > 0 ? precioConDescuento / cantidad : precioConDescuento

                            return (
                              <div className="compra-lote-product-row" key={item.id}>
                                <div className="compra-lote-product-info">
                                  <strong>{producto.nombre_producto || 'Producto'}</strong>
                                  <span>
                                    {producto.pedidos?.codigo || 'Sin pedido'} · {producto.pedidos?.clientes?.nombre || 'Sin cliente'}
                                    {producto.talla ? ` · Talla ${producto.talla}` : ''}
                                    {producto.color ? ` · ${producto.color}` : ''}
                                  </span>
                                </div>
                                <div className="compra-lote-product-price"><span>Antes</span><del>{formatearDinero(subtotal)}</del></div>
                                <div className="compra-lote-product-price compra-lote-product-final">
                                  <span>Con descuento</span><strong>{formatearDinero(precioConDescuento)}</strong><small>{cantidad} × {formatearDinero(precioUnitarioFinal)}</small>
                                </div>
                                <div className="compra-lote-product-discount">
                                  <span>Ahorro producto</span><strong>{formatearDinero(descuento)}</strong><small>Costo real producto: {formatearDinero(costoReal)}</small>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}
    </Layout>
  )
}
