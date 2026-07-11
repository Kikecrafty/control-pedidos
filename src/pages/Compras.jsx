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

  const [form, setForm] = useState({
    plataforma: 'SHEIN',
    cupon: '',
    descuento: '',
    descuentoTipo: 'valor',
    envio: '',
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

    const { data: productosData, error: errorProductos } = await supabase
      .from('productos_pedido')
      .select('*, pedidos(id, codigo, plataforma, estado, clientes(nombre, telefono))')
      .is('lote_compra_id', null)
      .order('fecha_agregado', { ascending: false, nullsFirst: false })

    if (errorProductos) {
      console.log(errorProductos)
      mostrarToast('No se pudieron cargar productos pendientes. Revisa que ejecutaste el SQL de la Parte 4.', 'error')
    } else {
      setProductos(productosData || [])
    }

    const { data: lotesData, error: errorLotes } = await supabase
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

    if (errorLotes) {
      console.log(errorLotes)
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

  const subtotalSeleccionado = useMemo(() => {
    return productosSeleccionados.reduce((total, producto) => {
      const precioPagina = Number(producto.precio_pagina ?? producto.precio_shein ?? 0)
      const cantidad = Number(producto.cantidad || 0)
      return total + (precioPagina * cantidad)
    }, 0)
  }, [productosSeleccionados])

  const descuentoAplicado = useMemo(() => {
    const valor = Number(form.descuento || 0)
    if (!Number.isFinite(valor) || valor <= 0 || subtotalSeleccionado <= 0) return 0

    if (form.descuentoTipo === 'porcentaje') {
      const porcentajeSeguro = Math.min(valor, 100)
      return (subtotalSeleccionado * porcentajeSeguro) / 100
    }

    return Math.min(valor, subtotalSeleccionado)
  }, [subtotalSeleccionado, form.descuento, form.descuentoTipo])

  const totalEstimado = useMemo(() => {
    const envio = Number(form.envio || 0)
    const comisiones = Number(form.comisiones || 0)
    return Math.max(subtotalSeleccionado - descuentoAplicado + envio + comisiones, 0)
  }, [subtotalSeleccionado, descuentoAplicado, form.envio, form.comisiones])

  const totalPagadoFinal = useMemo(() => {
    const total = form.totalPagado === '' ? totalEstimado : Number(form.totalPagado)
    return Number.isFinite(total) ? total : 0
  }, [form.totalPagado, totalEstimado])

  const subtotalConCuponSeleccionado = useMemo(() => {
    return productosSeleccionados.reduce((total, producto) => {
      if (producto.participa_cupon === false) return total
      const precioPagina = Number(producto.precio_pagina ?? producto.precio_shein ?? 0)
      const cantidad = Number(producto.cantidad || 0)
      return total + (precioPagina * cantidad)
    }, 0)
  }, [productosSeleccionados])

  const vistaPreviaProductos = useMemo(() => {
    const envio = Number(form.envio || 0)
    const comisiones = Number(form.comisiones || 0)

    return productosSeleccionados.map((producto) => {
      const precioPagina = Number(producto.precio_pagina ?? producto.precio_shein ?? 0)
      const cantidad = Number(producto.cantidad || 0)
      const subtotal = precioPagina * cantidad
      const factorTotal = subtotalSeleccionado > 0 ? subtotal / subtotalSeleccionado : 0
      const aplicaCupon = producto.participa_cupon !== false
      const descuentoProducto = aplicaCupon && subtotalConCuponSeleccionado > 0
        ? Number((descuentoAplicado * (subtotal / subtotalConCuponSeleccionado)).toFixed(2))
        : 0
      const envioProducto = Number((envio * factorTotal).toFixed(2))
      const comisionProducto = Number((comisiones * factorTotal).toFixed(2))
      const precioConDescuento = Math.max(subtotal - descuentoProducto, 0)
      const costoReal = Math.max(precioConDescuento + envioProducto + comisionProducto, 0)
      const precioVentaTotal = Number(producto.precio_venta || 0) * cantidad
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
  }, [productosSeleccionados, subtotalSeleccionado, subtotalConCuponSeleccionado, descuentoAplicado, form.envio, form.comisiones])

  const alternarProducto = (id) => {
    setSeleccionados((actuales) => {
      if (actuales.includes(id)) return actuales.filter((item) => item !== id)
      return [...actuales, id]
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
      mostrarToast('Selecciona al menos un producto para crear el lote.', 'error')
      return false
    }

    const valorDescuento = Number(form.descuento || 0)
    const descuento = descuentoAplicado
    const envio = Number(form.envio || 0)
    const comisiones = Number(form.comisiones || 0)
    const totalPagado = totalPagadoFinal

    if ([valorDescuento, descuento, envio, comisiones, totalPagado].some((valor) => !Number.isFinite(valor) || valor < 0)) {
      mostrarToast('Revisa los montos del lote.', 'error')
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
    const comisiones = Number(form.comisiones || 0)
    const totalPagado = totalPagadoFinal

    guardandoRef.current = true
    setGuardando(true)

    const { error } = await supabase.rpc('crear_lote_compra', {
      p_plataforma: plataformaSeleccionada,
      p_numero_orden: '',
      p_cupon: form.cupon.trim(),
      p_descuento: descuento,
      p_envio: envio,
      p_comisiones: comisiones,
      p_total_pagado: totalPagado,
      p_fecha_compra: form.fechaCompra || hoyISO(),
      p_productos: seleccionados
    })

    guardandoRef.current = false
    setGuardando(false)

    if (error) {
      console.log(error)
      mostrarToast(error.message || 'No se pudo crear el lote.', 'error')
      return
    }

    mostrarToast('Lote creado y costos reales calculados.')
    setSeleccionados([])
    setResumenActivo(false)
    setForm({
      plataforma: plataformaSeleccionada,
      cupon: '',
      descuento: '',
      descuentoTipo: form.descuentoTipo || 'valor',
      envio: '',
      comisiones: '',
      totalPagado: '',
      fechaCompra: hoyISO()
    })
    setTab('historial')
    cargarDatos()
  }

  return (
    <Layout>
      <Toast
        mensaje={toast?.mensaje}
        tipo={toast?.tipo}
        onClose={() => setToast(null)}
      />

      <div className="page-header row-between compras-header">
        <div>
          <h1>Compras</h1>
          <p>Primero elige la plataforma, selecciona productos y revisa el lote antes de confirmarlo.</p>
        </div>

        <div className="compras-tabs">
          <button type="button" className={tab === 'pendientes' ? 'active' : ''} onClick={() => setTab('pendientes')}>
            Pendientes
          </button>
          <button type="button" className={tab === 'historial' ? 'active' : ''} onClick={() => setTab('historial')}>
            Historial
          </button>
        </div>
      </div>

      <section className="table-card compras-platform-card">
        <div className="compras-platform-head">
          <div>
            <span>Paso 1</span>
            <h2>Elige la plataforma de compra</h2>
            <p>Ordely usa tu plataforma predeterminada y solo muestra productos pendientes de esa tienda.</p>
          </div>

          <div className="compras-default-pill">
            Predeterminada: <strong>{plataformaPredeterminada}</strong>
          </div>
        </div>

        <div className="platform-choice-grid">
          {plataformas.map((plataforma) => (
            <button
              type="button"
              key={plataforma}
              className={plataformaSeleccionada === plataforma ? 'platform-choice active' : 'platform-choice'}
              onClick={() => cambiarPlataforma(plataforma)}
              disabled={guardando}
            >
              <strong>{plataforma}</strong>
              <span>
                {plataforma === plataformaPredeterminada ? 'Predeterminada' : 'Ver pendientes'}
              </span>
            </button>
          ))}
        </div>
      </section>

      {tab === 'pendientes' && (
        <>
          <div className="compras-flow-summary">
            <div>
              <span>Plataforma</span>
              <strong>{plataformaSeleccionada}</strong>
            </div>
            <div>
              <span>Productos disponibles</span>
              <strong>{productosFiltrados.length}</strong>
            </div>
            <div>
              <span>Seleccionados</span>
              <strong>{productosSeleccionados.length}</strong>
            </div>
            <div>
              <span>Nuevo lote sugerido</span>
              <strong>{numeroLoteSugerido}</strong>
            </div>
          </div>

          <div className="compras-layout compras-layout-v7">
            <section className="table-card compras-pendientes-card">
              <div className="row-between table-title compras-list-title">
                <div>
                  <h2>Paso 2 · Selecciona productos</h2>
                  <p className="muted">Solo aparecen productos pendientes de {plataformaSeleccionada}.</p>
                </div>

                <button type="button" className="btn btn-light-bordered" onClick={seleccionarTodos} disabled={productosFiltrados.length === 0 || guardando}>
                  {seleccionados.length === productosFiltrados.length && productosFiltrados.length > 0 ? 'Quitar todos' : 'Seleccionar todos'}
                </button>
              </div>

              {cargando ? (
                <div className="empty-state">Cargando productos...</div>
              ) : productosFiltrados.length === 0 ? (
                <div className="empty-state">
                  No hay productos pendientes de {plataformaSeleccionada}. Cambia de plataforma o registra un pedido nuevo.
                </div>
              ) : (
                <div className="compras-products-list">
                  {productosFiltrados.map((producto) => {
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
                            {producto.pedidos?.codigo || 'Sin pedido'} · {producto.pedidos?.clientes?.nombre || 'Sin cliente'} · {producto.pedidos?.plataforma || plataformaSeleccionada}
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
              )}
            </section>

            <aside className="table-card compras-lote-card compras-lote-card-v7">
              {productosSeleccionados.length === 0 ? (
                <div className="compras-wait-card">
                  <span>Paso 3</span>
                  <h2>Configura el lote</h2>
                  <p>Selecciona uno o más productos de {plataformaSeleccionada}. Después aparecerá el formulario para poner cupón, descuento, envío y total real.</p>
                </div>
              ) : (
                <>
                  <h2>Paso 3 · Configura el lote</h2>
                  <p className="muted">Llena los datos como aparecen en el carrito de {plataformaSeleccionada}. El código del lote se genera automático.</p>

                  <form onSubmit={abrirResumen} className="compras-lote-form">
                    <div className="compras-form-section-title">
                      <strong>Compra en {plataformaSeleccionada}</strong>
                      <span>Referencia sugerida: {numeroLoteSugerido}. No necesitas capturar número de orden.</span>
                    </div>

                    <div className="form-field compras-help-field">
                      <label>Fecha de compra*</label>
                      <input type="date" value={form.fechaCompra} onChange={(e) => actualizarForm('fechaCompra', e.target.value)} required />
                      <small>Es el día en que pagarás o pagaste el lote. Con esta fecha Ordely calcula la posible llegada.</small>
                    </div>

                    <div className="form-field compras-help-field">
                      <label>Cupón utilizado</label>
                      <input value={form.cupon} onChange={(e) => actualizarForm('cupon', e.target.value.toUpperCase())} placeholder="Ej. SHEIN100" />
                      <small>Opcional. Escribe el cupón o promoción que aparece en la plataforma para este carrito.</small>
                    </div>

                    <div className="compras-form-section-title compras-form-section-title-money">
                      <strong>Descuento y total real</strong>
                      <span>El descuento se muestra antes de confirmar para que lo compares con la plataforma.</span>
                    </div>

                    <div className="form-grid compras-lote-money-grid">
                      <div className="form-field compras-help-field compras-discount-field">
                        <label>Descuento</label>
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
                            ? 'El porcentaje se aplica al subtotal de todos los productos seleccionados. Ejemplo: 15 = 15% de descuento.'
                            : 'Escribe el descuento en pesos que quitó el cupón al carrito completo.'}
                        </small>
                      </div>

                      <div className="form-field compras-help-field">
                        <label>Envío</label>
                        <input type="number" min="0" step="0.01" value={form.envio} onChange={(e) => actualizarForm('envio', e.target.value)} placeholder="Ej. 0" />
                        <small>Si pagaste envío, pon el total para repartirlo en el costo real del lote.</small>
                      </div>

                      <div className="form-field compras-help-field">
                        <label>Comisiones</label>
                        <input type="number" min="0" step="0.01" value={form.comisiones} onChange={(e) => actualizarForm('comisiones', e.target.value)} placeholder="Ej. 0" />
                        <small>Cargos extra como comisión bancaria, seguro, manejo u otros cargos.</small>
                      </div>

                      <div className="form-field compras-help-field">
                        <label>Total pagado real</label>
                        <input type="number" min="0" step="0.01" value={form.totalPagado} onChange={(e) => actualizarForm('totalPagado', e.target.value)} placeholder="Opcional" />
                        <small>Opcional. Si lo dejas vacío, Ordely calcula subtotal - descuento + envío + comisiones.</small>
                      </div>
                    </div>

                    <div className="compras-discount-preview">
                      <span>Descuento detectado antes de confirmar</span>
                      <strong>{formatearDinero(descuentoAplicado)}</strong>
                      <p>
                        {form.descuentoTipo === 'porcentaje'
                          ? `Ordely aplicará ${Number(form.descuento || 0)}% a los ${productosSeleccionados.length} productos seleccionados.`
                          : 'Este monto se repartirá proporcionalmente entre los productos seleccionados.'}
                      </p>
                    </div>

                    <div className="compras-summary-box">
                      <div><span>Productos</span><strong>{productosSeleccionados.length}</strong></div>
                      <div><span>Subtotal página</span><strong>{formatearDinero(subtotalSeleccionado)}</strong></div>
                      <div><span>Descuento</span><strong>{form.descuentoTipo === 'porcentaje' ? `${Number(form.descuento || 0)}%` : formatearDinero(descuentoAplicado)}</strong></div>
                      <div><span>Total calculado</span><strong>{formatearDinero(totalEstimado)}</strong></div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={guardando || seleccionados.length === 0}>
                      Revisar resumen general
                    </button>
                  </form>
                </>
              )}
            </aside>
          </div>

          {resumenActivo && (
            <div className="compras-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !guardando) setResumenActivo(false) }}>
              <section className="table-card compras-confirm-card compras-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="compras-resumen-title">
              <div className="compras-confirm-head">
                <div>
                  <span>Paso 4</span>
                  <h2 id="compras-resumen-title">Resumen general antes de confirmar</h2>
                  <p>Compara estos importes con el carrito de {plataformaSeleccionada}. Si coinciden, confirma para crear el lote y calcular costos reales.</p>
                </div>

                <button type="button" className="compras-modal-close" onClick={() => setResumenActivo(false)} disabled={guardando} aria-label="Cerrar resumen">×</button>

                <div className="compras-confirm-total">
                  <span>Total real a guardar</span>
                  <strong>{formatearDinero(totalPagadoFinal)}</strong>
                </div>
              </div>

              <div className="compras-confirm-metrics">
                <div><span>Plataforma</span><strong>{plataformaSeleccionada}</strong></div>
                <div><span>Lote</span><strong>{numeroLoteSugerido}</strong></div>
                <div><span>Fecha</span><strong>{form.fechaCompra || hoyISO()}</strong></div>
                <div><span>Cupón</span><strong>{form.cupon || '-'}</strong></div>
                <div><span>Subtotal página</span><strong>{formatearDinero(subtotalSeleccionado)}</strong></div>
                <div><span>Descuento total</span><strong>{formatearDinero(descuentoAplicado)}</strong></div>
                <div><span>Envío</span><strong>{formatearDinero(form.envio)}</strong></div>
                <div><span>Comisiones</span><strong>{formatearDinero(form.comisiones)}</strong></div>
              </div>

              <div className="compras-confirm-products">
                <div className="compras-confirm-products-head">
                  <strong>Productos del lote</strong>
                  <span>Precio de página tachado vs. precio después del cupón.</span>
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
                      <span>Con cupón</span>
                      <strong>{formatearDinero(producto.precioConDescuento)}</strong>
                    </div>

                    <div className="compras-confirm-price discount">
                      <span>Descuento</span>
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
                  {guardando ? 'Creando lote...' : 'Confirmar y crear lote'}
                </button>
              </div>
              </section>
            </div>
          )}
        </>
      )}

      {tab === 'historial' && (
        <section className="table-card compras-history-card">
          <div className="row-between table-title">
            <div>
              <h2>Lotes recientes de {plataformaSeleccionada}</h2>
              <p className="muted">Compras cerradas con cupón y costo real calculado.</p>
            </div>
          </div>

          {lotesFiltrados.length === 0 ? (
            <div className="empty-state">Todavía no tienes lotes creados para {plataformaSeleccionada}.</div>
          ) : (
            <div className="compras-lotes-list">
              {lotesFiltrados.map((lote) => {
                const productosLote = lote.lote_productos || []
                const abierto = !!lotesAbiertos[lote.id]

                return (
                  <article className={abierto ? 'compra-lote-item compra-lote-item-open' : 'compra-lote-item'} key={lote.id}>
                    <div className="compra-lote-summary-row">
                      <div>
                        <span>{lote.codigo_lote}</span>
                        <strong>{lote.plataforma}</strong>
                        <p>{lote.fecha_compra} · {productosLote.length} productos</p>
                      </div>

                      <div>
                        <span>Cupón</span>
                        <strong>{lote.cupon_usado || '-'}</strong>
                      </div>

                      <div>
                        <span>Subtotal</span>
                        <strong>{formatearDinero(lote.subtotal_pagina)}</strong>
                      </div>

                      <div>
                        <span>Descuento</span>
                        <strong>{formatearDinero(lote.descuento_total)}</strong>
                      </div>

                      <div>
                        <span>Total real</span>
                        <strong>{formatearDinero(lote.total_pagado)}</strong>
                      </div>

                      <button type="button" className="btn btn-light-bordered compra-lote-toggle" onClick={() => alternarLoteAbierto(lote.id)}>
                        {abierto ? 'Ocultar productos' : `Ver productos (${productosLote.length})`}
                      </button>
                    </div>

                    {abierto && (
                      <div className="compra-lote-products">
                        {productosLote.length === 0 ? (
                          <div className="empty-state compra-lote-empty">Este lote no tiene productos visibles.</div>
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

                                <div className="compra-lote-product-price">
                                  <span>Antes</span>
                                  <del>{formatearDinero(subtotal)}</del>
                                </div>

                                <div className="compra-lote-product-price compra-lote-product-final">
                                  <span>Con descuento</span>
                                  <strong>{formatearDinero(precioConDescuento)}</strong>
                                  <small>{cantidad} × {formatearDinero(precioUnitarioFinal)}</small>
                                </div>

                                <div className="compra-lote-product-discount">
                                  <span>Descuento aplicado</span>
                                  <strong>{formatearDinero(descuento)}</strong>
                                  {(Number(item.envio_asignado || 0) > 0 || Number(item.comision_asignada || 0) > 0) && (
                                    <small>Costo real: {formatearDinero(costoReal)}</small>
                                  )}
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
