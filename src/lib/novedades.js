export const NOVEDADES_VERSION_ACTUAL = '1.1.0'

export const NOVEDADES_ACTUALES = Object.freeze({
  version: NOVEDADES_VERSION_ACTUAL,
  fecha: '15 de julio de 2026',
  resumen: 'Recompensas, costos reales y avisos más claros.',
  secciones: [
    {
      tipo: 'agregado',
      etiqueta: 'Agregado',
      titulo: 'Nuevas herramientas',
      items: [
        {
          titulo: 'Recomienda y gana',
          descripcion: 'Comparte tu código y gana recompensas por referidos válidos.'
        },
        {
          titulo: 'Costos manuales por producto',
          descripcion: 'Escribe el costo real de cada artículo desde la revisión de compra.'
        },
        {
          titulo: 'Novedades y avisos',
          descripcion: 'Consulta la versión, sus cambios y los mensajes importantes.'
        }
      ]
    },
    {
      tipo: 'cambio',
      etiqueta: 'Cambió',
      titulo: 'Funciones mejoradas',
      items: [
        {
          titulo: 'Recompensas más claras',
          descripcion: 'El progreso, los días y las comisiones son más fáciles de entender.'
        },
        {
          titulo: 'Avisos del Plan Básico',
          descripcion: 'Inicio y Pedidos avisan cuando quedan cinco pedidos o se agota el plan.'
        },
        {
          titulo: 'Experiencia en teléfono',
          descripcion: 'Las nuevas pantallas ocupan menos espacio y se leen mejor.'
        }
      ]
    },
    {
      tipo: 'removido',
      etiqueta: 'Removido',
      titulo: 'Menos elementos repetidos',
      items: [
        {
          titulo: 'Datos duplicados',
          descripcion: 'Se simplificó Recomienda y gana para mostrar solo lo necesario.'
        }
      ]
    },
    {
      tipo: 'correccion',
      etiqueta: 'Corregido',
      titulo: 'Parches y estabilidad',
      items: [
        {
          titulo: 'Bienvenida una sola vez',
          descripcion: 'La guía inicial ya no reaparece cada vez que inicias sesión.'
        },
        {
          titulo: 'Soporte y visualización',
          descripcion: 'Se corrigieron detalles de soporte y diseño en ambas pantallas.'
        }
      ]
    }
  ]
})

export const HISTORIAL_VERSIONES = Object.freeze([
  NOVEDADES_ACTUALES,
  Object.freeze({
    version: '1.0.2',
    fecha: '14 de julio de 2026',
    resumen: 'Navegación, compras y pedidos más simples.',
    secciones: [
      {
        tipo: 'agregado',
        etiqueta: 'Agregado',
        titulo: 'Funciones nuevas',
        items: [
          { titulo: 'Llegadas desde Inicio', descripcion: 'Los paquetes se agrupan por pedido y cliente para marcarlos más rápido.' },
          { titulo: 'Guía para cuentas nuevas', descripcion: 'El primer ingreso explica el flujo principal de Ordely.' }
        ]
      },
      {
        tipo: 'cambio',
        etiqueta: 'Cambió',
        titulo: 'Uso más sencillo',
        items: [
          { titulo: 'Pedidos y productos', descripcion: 'El detalle abre en Productos y muestra mejor talla, color y avance.' },
          { titulo: 'Compras agrupadas', descripcion: 'La plataforma y la selección de productos quedaron más claras.' },
          { titulo: 'Navegación adaptable', descripcion: 'El menú y las tarjetas se ajustan mejor a computadora y teléfono.' }
        ]
      },
      {
        tipo: 'correccion',
        etiqueta: 'Corregido',
        titulo: 'Diseño y estados',
        items: [
          { titulo: 'Detalles visuales', descripcion: 'Se corrigieron flechas, barras, tarjetas y elementos encimados.' }
        ]
      }
    ]
  }),
  Object.freeze({
    version: '1.0.1',
    fecha: 'Julio de 2026',
    resumen: 'Mayor seguridad en cálculos y pedidos.',
    secciones: [
      {
        tipo: 'cambio',
        etiqueta: 'Cambió',
        titulo: 'Reglas más seguras',
        items: [
          { titulo: 'Pedidos y folios', descripcion: 'Se reforzó el orden y la generación de números por cuenta.' },
          { titulo: 'Edición y límites', descripcion: 'Se ajustaron los bloqueos sin impedir editar información permitida.' }
        ]
      },
      {
        tipo: 'correccion',
        etiqueta: 'Corregido',
        titulo: 'Cálculos revisados',
        items: [
          { titulo: 'Totales y anticipos', descripcion: 'Se corrigieron validaciones de pagos, saldos y sobrepagos.' },
          { titulo: 'Estadísticas', descripcion: 'Se verificaron métricas, fechas y resultados por cuenta.' }
        ]
      }
    ]
  }),
  Object.freeze({
    version: '1.0.0',
    fecha: 'Julio de 2026',
    resumen: 'Primera versión estable de Ordely.',
    secciones: [
      {
        tipo: 'agregado',
        etiqueta: 'Lanzamiento',
        titulo: 'Funciones principales',
        items: [
          { titulo: 'Control de pedidos', descripcion: 'Clientes, pedidos, productos, compras, pagos y entregas en un solo lugar.' },
          { titulo: 'Seguimiento', descripcion: 'Estados y enlaces privados para consultar el avance de cada pedido.' },
          { titulo: 'Planes', descripcion: 'Acceso Básico, Premium y Pro con funciones según cada cuenta.' }
        ]
      }
    ]
  })
])

export const crearLlaveNovedades = (userId) => {
  const id = String(userId || '').trim()
  return id ? `ordely_novedades:${id}` : ''
}

const obtenerStorage = (storage) => {
  if (storage) return storage
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export const novedadesRemotasFueronVistas = (versionVista) => {
  return String(versionVista || '').trim() === NOVEDADES_VERSION_ACTUAL
}

export const novedadesFueronVistas = (userId, storage) => {
  const llave = crearLlaveNovedades(userId)
  if (!llave) return true

  try {
    return obtenerStorage(storage)?.getItem(llave) === NOVEDADES_VERSION_ACTUAL
  } catch {
    return false
  }
}

export const marcarNovedadesVistas = (userId, storage) => {
  const llave = crearLlaveNovedades(userId)
  if (!llave) return false

  try {
    obtenerStorage(storage)?.setItem(llave, NOVEDADES_VERSION_ACTUAL)
    return true
  } catch {
    return false
  }
}
