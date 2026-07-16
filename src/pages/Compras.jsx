import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import Layout from '../components/Layout'
import Toast from '../components/Toast'
import EmptyState from '../components/EmptyState'
import PageHelp from '../components/PageHelp'
import { PLATAFORMAS, PLATAFORMA_PREDETERMINADA } from '../lib/plataformas'
import { obtenerFechaLocalHoy } from '../lib/fechas'
import {
  calcularResumenCostosManuales,
  inicializarCostosManuales
} from '../lib/comprasCostos'

const hoyISO = () => obtenerFechaLocalHoy()

const formatearDinero = (valor) => `$${Number(valor || 0).toFixed(2)}`
const normalizarEstadoCompra = (estado) => estado || 'Pendiente de compra'

const obtenerPlataformaConfigurada = () => {
  if (typeof window === 'undefined') return PLATAFORMA_PREDETERMINADA

  try {
    const perfil = JSON.parse(localStorage.getItem('control_pedidos_perfil_cache') || '{}')
    const candidata = perfil?.plataforma_predeterminada || localStorage.getItem('plataforma_predeterminada')
    return PLATAFORMAS.includes(candidata) ? candidata : PLATAFORMA_PREDETERMINADA
  } catch {
    return PLATAFORMA_PREDETERMINADA
  }
}

export default function Compras() {
  const plataformaConfiguradaInicial = useMemo(obtenerPlataformaConfigurada, [])
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
  const [plataformaPredeterminada, setPlataformaPredeterminada] = useState(plataformaConfiguradaInicial)
  const [plataformaSeleccionada, setPlataformaSeleccionada] = useState(plataformaConfiguradaInicial)
  const [resumenActivo, setResumenActivo] = useState(false)
  const [errorCarga, setErrorCarga] = useState('')
  const [costosManuales, setCostosManuales] = useState({})

  const [form, setForm] = useState({
    plataforma: plataformaConfiguradaInicial,
    numeroOrden: '',
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
    usarCostosManuales: false,
    fechaCompra: hoyISO()
  })

  useEffect(() => {
    const actualizarPlataformaConfigurada = (evento) => {
      const nuevaPlataforma = evento?.detail
      if (!PLATAFORMAS.includes(nuevaPlataforma)) return

      const anterior = plataformaPredeterminada
      setPlataformaPredeterminada(nuevaPlataforma)
      setPlataformaSeleccionada((actual) => actual === anterior ? nuevaPlataforma : actual)
      setForm((actual) => actual.plataforma === anterior
        ? { ...actual, plataforma: nuevaPlataforma }
        : actual)
      setSeleccionados([])
      setCostosManuales({})
      setResumenActivo(false)
    }

    window.addEventListener('plataformaPredeterminadaCambiada', actualizarPlataformaConfigurada)
    return () => window.removeEventListener('plataformaPredeterminadaCambiada', actualizarPlataformaConfigurada)
  }, [plataformaPredeterminada])

  const mostrarToast = useCallback((mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo })
  }, [])

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setErrorCarga('')

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

          const plataformaPerfil = PLATAFORMAS.includes(perfilData?.plataforma_predeterminada)
            ? perfilData.plataforma_predeterminada
            : plataformaConfiguradaInicial

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
      setErrorCarga('No pudimos cargar los productos pendientes. Revisa tu conexión e intenta nuevamente.')
      mostrarToast('No se pudieron cargar los productos pendientes.', 'error')
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

    let lotesData = respuestaLotes.data
    let errorLotes = respuestaLotes.error

    // Si el historial falla por cache de relaciones/columnas, no bloqueamos pendientes.
    if (errorLotes) {
      console.log('Error cargando historial de lotes:', errorLotes)

      const respaldoLotes = await supabase
        .from('lotes_compra')
        .select('*')
        .order('fecha_compra', { ascending: false })

      lotesData = respaldoLotes.data
      errorLotes = respaldoLotes.error
    }

    if (errorLotes) {
      console.log('Error final historial de lotes:', errorLotes)
    } else {
      setLotes(lotesData || [])
    }

    setCargando(false)
  }, [mostrarToast, plataformaConfiguradaInicial])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const cambiarPlataforma = (plataforma) => {
    setPlataformaSeleccionada(plataforma)
    setSeleccionados([])
    setCostosManuales({})
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

  const resumenCostosManuales = useMemo(() => {
    return calcularResumenCostosManuales(productosSeleccionados, costosManuales, cargosExtra)
  }, [productosSeleccionados, costosManuales, cargosExtra])

  const descuentoEfectivoProductos = form.usarCostosManuales
    ? resumenCostosManuales.ahorroProductos
    : descuentoAplicado

  const totalEstimado = useMemo(() => {
    if (form.usarCostosManuales) return resumenCostosManuales.totalEstimado
    return Math.max(subtotalSeleccionado - descuentoAplicado + cargosExtra, 0)
  }, [form.usarCostosManuales, resumenCostosManuales.totalEstimado, subtotalSeleccionado, descuentoAplicado, cargosExtra])

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
      const costoManual = resumenCostosManuales.lineas.find((linea) => linea.id === producto.id)
      const descuentoProducto = form.usarCostosManuales
        ? Number(costoManual?.ahorro || 0)
        : subtotalSeleccionado > 0
          ? Number((descuentoAplicado * factorTotal).toFixed(2))
          : 0
      const precioConDescuento = form.usarCostosManuales
        ? Number(costoManual?.costoTotal || 0)
        : Math.max(subtotal - descuentoProducto, 0)
      // Importante: los cargos extra NO se meten al producto.
      // Se guardan separados en el lote para que Estadísticas los pueda sumar aparte.
      const costoReal = form.usarCostosManuales
        ? Number(costoManual?.costoTotal || 0)
        : precioConDescuento
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
  }, [productosSeleccionados, subtotalSeleccionado, descuentoAplicado, form.usarCostosManuales, resumenCostosManuales.lineas])

  useEffect(() => {
    if (!form.usarCostosManuales) return

    const sugeridos = inicializarCostosManuales(productosSeleccionados, descuentoAplicado)
    setCostosManuales((actuales) => {
      const siguientes = {}
      productosSeleccionados.forEach((producto) => {
        siguientes[producto.id] = Object.prototype.hasOwnProperty.call(actuales, producto.id)
          ? actuales[producto.id]
          : sugeridos[producto.id]
      })
      return siguientes
    })
  }, [form.usarCostosManuales, productosSeleccionados, descuentoAplicado])

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

  const alternarCostosManuales = () => {
    const activar = !form.usarCostosManuales
    if (activar) {
      setCostosManuales(inicializarCostosManuales(productosSeleccionados, descuentoAplicado))
    }
    setForm((actual) => ({ ...actual, usarCostosManuales: activar }))
    setResumenActivo(false)
  }

  const actualizarCostoManual = (productoId, valor) => {
    setCostosManuales((actuales) => ({ ...actuales, [productoId]: valor }))
  }

  const validarLote = () => {
    if (seleccionados.length === 0) {
      mostrarToast('Selecciona al menos un producto para registrar la compra.', 'error')
      return false
    }

    if (form.usarCostosManuales && !resumenCostosManuales.valido) {
      mostrarToast('Escribe el costo real total de cada producto seleccionado.', 'error')
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

    if (!form.usarCostosManuales && form.descuentoTipo === 'valor' && valorDescuento > subtotalSeleccionado) {
      mostrarToast('El descuento en pesos no puede ser mayor al subtotal seleccionado.', 'error')
      return false
    }

    if (!form.usarCostosManuales && form.usarPuntos && puntos > subtotalSeleccionado) {
      mostrarToast('Los puntos o saldo usado no pueden ser mayores al subtotal seleccionado.', 'error')
      return false
    }

    if (!form.usarCostosManuales && descuentoAplicado > subtotalSeleccionado) {
      mostrarToast('El descuento total de cupón y puntos no puede ser mayor al subtotal seleccionado.', 'error')
      return false
    }

    if (form.totalPagado !== '' && Math.abs(diferenciaTotal) > 0.009) {
      mostrarToast('El total final no coincide con el desglose. Corrige la diferencia antes de guardar.', 'error')
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

    const envio = Number(form.envio || 0)
    const importacion = Number(form.importacion || 0)
    const impuestos = Number(form.impuestos || 0)
    const comisiones = Number(form.comisiones || 0)
    const totalPagado = totalPagadoFinal
    const referenciaCupon = [
      form.cupon.trim(),
      form.usarCostosManuales && Number(form.descuento || 0) > 0
        ? `Cupón indicado: ${form.descuentoTipo === 'porcentaje' ? `${Number(form.descuento)}%` : formatearDinero(form.descuento)}`
        : '',
      puntosAplicados > 0 ? `Puntos/saldo: ${formatearDinero(puntosAplicados)}` : ''
    ].filter(Boolean).join(' · ')

    guardandoRef.current = true
    setGuardando(true)

    const fechaCompra = form.fechaCompra || hoyISO()

    const funcionCompra = form.usarCostosManuales
      ? 'crear_lote_compra_costos_manuales_v1'
      : 'crear_lote_compra'
    const parametrosCompra = form.usarCostosManuales
      ? {
          p_plataforma: plataformaSeleccionada,
          p_numero_orden: form.numeroOrden.trim(),
          p_cupon: referenciaCupon,
          p_envio: envio,
          p_importacion: importacion,
          p_impuestos: impuestos,
          p_comisiones: comisiones,
          p_total_pagado: totalPagado,
          p_fecha_compra: fechaCompra,
          p_productos: resumenCostosManuales.lineas.map((linea) => ({
            producto_id: linea.id,
            costo_total: linea.costoTotal
          }))
        }
      : {
          p_plataforma: plataformaSeleccionada,
          p_numero_orden: form.numeroOrden.trim(),
          p_cupon: referenciaCupon,
          p_descuento_cupon: descuentoCuponAplicado,
          p_puntos: puntosAplicados,
          p_envio: envio,
          p_importacion: importacion,
          p_impuestos: impuestos,
          p_comisiones: comisiones,
          p_total_pagado: totalPagado,
          p_fecha_compra: fechaCompra,
          p_productos: seleccionados
        }

    const { error } = await supabase.rpc(funcionCompra, parametrosCompra)

    if (error) {
      guardandoRef.current = false
      setGuardando(false)
      console.log(error)
      mostrarToast(error.message || 'No se pudo registrar la compra.', 'error')
      return
    }

    guardandoRef.current = false
    setGuardando(false)
    mostrarToast('Compra registrada. Los productos ya aparecen como comprados.')
    setSeleccionados([])
    setCostosManuales({})
    setResumenActivo(false)
    setForm({
      plataforma: plataformaSeleccionada,
      numeroOrden: '',
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
      usarCostosManuales: false,
      fechaCompra: hoyISO()
    })
    setTab('historial')
    await cargarDatos()
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
      <PageHelp page="compras" />

      <Toast
        mensaje={toast?.mensaje}
        tipo={toast?.tipo}
        onClose={() => setToast(null)}
      />

      {errorCarga && (
        <EmptyState
          icon="error"
          tone="error"
          eyebrow="No se pudo actualizar"
          title="Las compras no están disponibles por ahora."
          description={errorCarga}
          actionLabel="Intentar de nuevo"
          onAction={cargarDatos}
          compact
          className="compras-load-error"
        />
      )}

      <div className="page-header row-between compras-header compras-header-v25">
        <div>
          <h1>Compras agrupadas</h1>
          <p>Junta los productos que comprarás en el mismo carrito y registra el total pagado.</p>
        </div>

        <div className="compras-header-actions">
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

      <section className="table-card compras-platform-card compras-platform-card-v25">
        <div className="compras-platform-head compras-platform-head-single">
          <div>
            <span>Paso 1</span>
            <h2>¿Dónde vas a comprar?</h2>
            <p>Solo se mostrarán productos pendientes de la plataforma elegida.</p>
          </div>
        </div>

        <label className="compras-platform-single-select">
          <span>Plataforma del carrito</span>
          <div className="compras-platform-select-control">
            <select
              value={plataformaSeleccionada}
              onChange={(evento) => cambiarPlataforma(evento.target.value)}
              disabled={guardando}
              aria-label="Seleccionar plataforma del carrito"
            >
              {PLATAFORMAS.map((plataforma) => (
                <option value={plataforma} key={plataforma}>
                  {plataforma}{plataforma === plataformaPredeterminada ? ' — Predeterminada' : ''}
                </option>
              ))}
            </select>
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="m7 9.5 5 5 5-5" />
              </svg>
            </span>
          </div>
          <small>
            {plataformaSeleccionada === plataformaPredeterminada
              ? 'Esta es la plataforma predeterminada en Configuración.'
              : `Plataforma predeterminada en Configuración: ${plataformaPredeterminada}.`}
          </small>
        </label>
      </section>

      {tab === 'pendientes' && (
        <>
          <div className="compras-flow-summary compras-flow-summary-v25">
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
                  <p className="muted">Elige los artículos que formarán esta compra agrupada en {plataformaSeleccionada}.</p>
                </div>

                <button type="button" className="btn btn-light-bordered" onClick={seleccionarTodos} disabled={productosFiltrados.length === 0 || guardando}>
                  {seleccionados.length === productosFiltrados.length && productosFiltrados.length > 0 ? 'Quitar todos' : 'Seleccionar todo'}
                </button>
              </div>

              {cargando ? (
                <EmptyState
                  icon="loading"
                  eyebrow="Actualizando"
                  title="Estamos buscando productos pendientes."
                  description={`Revisando pedidos de ${plataformaSeleccionada}.`}
                  compact
                />
              ) : productosFiltrados.length === 0 ? (
                <EmptyState
                  icon="purchases"
                  eyebrow="Sin productos pendientes"
                  title={`No hay nada por comprar en ${plataformaSeleccionada}.`}
                  description="Cambia de plataforma o crea un pedido nuevo para que sus productos aparezcan aquí."
                  actionLabel="Crear nuevo pedido"
                  actionTo="/nuevo-pedido"
                  secondaryLabel="Ver otra plataforma"
                  onSecondary={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  compact
                />
              ) : (
                <div className="compras-order-groups">
                  {productosAgrupados.map((grupo) => {
                    return (
                      <article className="compras-order-group" key={grupo.pedidoId}>
                        <div className="compras-order-head">
                          <div>
                            <strong>{grupo.codigo}</strong>
                            <span>{grupo.cliente}</span>
                          </div>
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
                  <p>Primero selecciona los productos que comprarás juntos en {plataformaSeleccionada}. Después aparecerá un formulario para cupón, puntos, envío y total final.</p>
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

                    <section className={form.usarCostosManuales ? 'compras-manual-costs active' : 'compras-manual-costs'}>
                      <div className="compras-switch-row compras-manual-costs-head">
                        <div>
                          <strong>Asignar el costo de cada producto manualmente</strong>
                          <span>Úsalo cuando el carrito incluya artículos que no pertenecen a pedidos y el cupón no pueda repartirse correctamente.</span>
                        </div>
                        <button
                          type="button"
                          className={form.usarCostosManuales ? 'compras-switch active' : 'compras-switch'}
                          onClick={alternarCostosManuales}
                          aria-pressed={form.usarCostosManuales}
                        >
                          <span />
                        </button>
                      </div>

                      {form.usarCostosManuales && (
                        <div className="compras-manual-costs-body compras-manual-costs-next">
                          <strong>Los costos se capturan en la revisión</strong>
                          <p>
                            Completa los datos de la compra y pulsa “Revisar resumen”. Ahí podrás escribir el costo real de cada producto antes de confirmar.
                          </p>
                        </div>
                      )}
                    </section>

                    <div className="form-field compras-help-field">
                      <label>Fecha de compra*</label>
                      <input type="date" value={form.fechaCompra} onChange={(e) => actualizarForm('fechaCompra', e.target.value)} required />
                      <small>Día en que pagarás o pagaste esta compra. Sirve para calcular la posible llegada.</small>
                    </div>

                    <div className="form-field compras-help-field">
                      <label>Número de orden de la plataforma</label>
                      <input
                        value={form.numeroOrden}
                        onChange={(e) => actualizarForm('numeroOrden', e.target.value)}
                        placeholder="Ej. GSH123456789"
                        maxLength={120}
                      />
                      <small>Opcional. Facilita localizar esta compra en la plataforma.</small>
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
                          <label>{form.usarCostosManuales ? 'Total de productos del pedido y sus cargos' : 'Total final pagado'}</label>
                          <input type="number" min="0" step="0.01" value={form.totalPagado} onChange={(e) => actualizarForm('totalPagado', e.target.value)} placeholder="Ej. 3859.40" />
                          <small>
                            {form.usarCostosManuales
                              ? 'No copies el total completo del carrito si también compraste artículos ajenos a pedidos.'
                              : 'Copia el total final de la plataforma para comparar si todo coincide.'}
                          </small>
                        </div>
                      </div>
                    </div>

                    <div className="compras-discount-preview compras-discount-preview-v25 compras-product-discount-total">
                      <span>{form.usarCostosManuales ? 'Ahorro reflejado en costos manuales' : 'Descuento aplicado solo a productos'}</span>
                      <strong>{formatearDinero(descuentoEfectivoProductos)}</strong>
                      <p>
                        {form.usarCostosManuales
                          ? 'Ordely usará exactamente los costos que escribiste; el cupón y los puntos quedan como referencia y no se descuentan otra vez.'
                          : `Incluye cupón ${formatearDinero(descuentoCuponAplicado)}${puntosAplicados > 0 ? ` y puntos/saldo ${formatearDinero(puntosAplicados)}` : ''}. Este monto se reparte proporcionalmente entre los productos seleccionados.`}
                      </p>
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
                      {form.usarCostosManuales && <div><span>Costo manual productos</span><strong>{formatearDinero(resumenCostosManuales.costoProductos)}</strong></div>}
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
                      ? form.usarCostosManuales
                        ? 'Ordely guardará la suma de los costos manuales y los cargos indicados, sin incluir artículos ajenos a pedidos.'
                        : 'No escribiste total final. Ordely guardará el total calculado con cupón, puntos, envío, importación, impuestos y comisiones.'
                      : Math.abs(diferenciaTotal) <= 0.01
                        ? 'El total calculado coincide con el total final que escribiste.'
                        : `Hay una diferencia de ${formatearDinero(Math.abs(diferenciaTotal))}. Revisa ${form.usarCostosManuales ? 'los costos manuales y los cargos' : 'cupón, puntos, envío, importación, impuestos o comisiones'}.`}
                  </span>
                </div>

                <div className="compras-confirm-metrics compras-confirm-metrics-v25">
                  <div><span>Plataforma</span><strong>{plataformaSeleccionada}</strong></div>
                  <div><span>Código de compra</span><strong>Se asignará automáticamente</strong></div>
                  <div><span>Orden de plataforma</span><strong>{form.numeroOrden || '-'}</strong></div>
                  <div><span>Fecha</span><strong>{form.fechaCompra || hoyISO()}</strong></div>
                  <div><span>Cupón</span><strong>{form.cupon || '-'}</strong></div>
                  <div><span>Subtotal productos</span><strong>{formatearDinero(subtotalSeleccionado)}</strong></div>
                  <div><span>{form.usarCostosManuales ? 'Ahorro en productos' : 'Descuento cupón'}</span><strong>-{formatearDinero(form.usarCostosManuales ? descuentoEfectivoProductos : descuentoCuponAplicado)}</strong></div>
                  <div><span>{form.usarCostosManuales ? 'Puntos indicados' : 'Puntos/saldo'}</span><strong>{form.usarCostosManuales ? formatearDinero(puntosAplicados) : `-${formatearDinero(puntosAplicados)}`}</strong></div>
                  <div><span>Envío</span><strong>{formatearDinero(envioValor)}</strong></div>
                  <div><span>Importación</span><strong>{formatearDinero(importacionValor)}</strong></div>
                  <div><span>Impuestos</span><strong>{formatearDinero(impuestosValor)}</strong></div>
                  <div><span>Comisiones</span><strong>{formatearDinero(comisionesValor)}</strong></div>
                  <div><span>Total calculado</span><strong>{formatearDinero(totalEstimado)}</strong></div>
                </div>

                <div className="compras-confirm-products">
                  <div className="compras-confirm-products-head">
                    <strong>Productos seleccionados</strong>
                    <span>{form.usarCostosManuales ? 'Precio de página vs. costo real escrito manualmente.' : 'Precio de página vs. precio después de cupón y puntos.'}</span>
                  </div>

                  {vistaPreviaProductos.map((producto) => (
                    <div
                      className={form.usarCostosManuales ? 'compras-confirm-product-row manual-cost' : 'compras-confirm-product-row'}
                      key={producto.id}
                    >
                      <div className="compras-confirm-product-info">
                        <strong>{producto.nombre}</strong>
                        <span>{producto.pedido} · {producto.cliente} · {producto.cantidad} pza.</span>
                      </div>

                      <div className="compras-confirm-price">
                        <span>Antes</span>
                        <del>{formatearDinero(producto.subtotal)}</del>
                      </div>

                      {form.usarCostosManuales ? (
                        <label className="compras-confirm-price final compras-confirm-manual-editor">
                          <span>Costo real total</span>
                          <span className="compras-confirm-manual-input">
                            <span aria-hidden="true">$</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={costosManuales[producto.id] ?? ''}
                              onChange={(event) => actualizarCostoManual(producto.id, event.target.value)}
                              aria-label={`Costo real total de ${producto.nombre}`}
                              required
                            />
                          </span>
                        </label>
                      ) : (
                        <div className="compras-confirm-price final">
                          <span>Con descuento</span>
                          <strong>{formatearDinero(producto.precioConDescuento)}</strong>
                        </div>
                      )}

                      <div className="compras-confirm-price discount">
                        <span>Ahorro</span>
                        <strong>{formatearDinero(producto.descuentoProducto)}</strong>
                      </div>
                    </div>
                  ))}

                  {form.usarCostosManuales && (
                    <div className="compras-confirm-manual-total">
                      <span>Costo manual de productos</span>
                      <strong>{formatearDinero(resumenCostosManuales.costoProductos)}</strong>
                    </div>
                  )}
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
              <p className="muted">Revisa cada compra agrupada, sus descuentos y el costo real calculado.</p>
            </div>
          </div>

          {lotesFiltrados.length === 0 ? (
            <EmptyState
              icon="history"
              eyebrow="Historial vacío"
              title={`Todavía no tienes compras registradas en ${plataformaSeleccionada}.`}
              description="Cuando confirmes una compra agrupada, aquí podrás revisar sus productos, descuentos y costo real."
              actionLabel="Ir a pendientes"
              onAction={() => setTab('pendientes')}
              compact
            />
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
                          <EmptyState
                            icon="products"
                            eyebrow="Sin detalle"
                            title="No hay productos visibles en esta compra."
                            description="El resumen general de la compra sigue disponible."
                            compact
                            className="compra-lote-empty"
                          />
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
