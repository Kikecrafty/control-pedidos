import Modal from './Modal'

const PASOS = [
  {
    numero: '01',
    icono: 'cliente',
    titulo: 'Crea un cliente',
    descripcion: 'Guarda sus datos una sola vez para tener sus pedidos, pagos y entregas siempre organizados.'
  },
  {
    numero: '02',
    icono: 'pedido',
    titulo: 'Registra el pedido',
    descripcion: 'Agrega los productos, precios y anticipo. Si el cliente todavía no existe, también puedes crearlo aquí.'
  },
  {
    numero: '03',
    icono: 'compra',
    titulo: 'Registra tu compra',
    descripcion: 'Cuando compres en la plataforma, entra a Compras, selecciona los artículos comprados juntos y registra cupón, envío, comisiones y el total real.'
  },
  {
    numero: '04',
    icono: 'avance',
    titulo: 'Actualiza cada avance',
    descripcion: 'Desde Pedidos indica cuando se compró, llegó, está en tu negocio y finalmente se entregó al cliente.'
  }
]

function PasoIcono({ tipo }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  }

  if (tipo === 'cliente') {
    return (
      <svg {...props}>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M18.5 5.5v4M16.5 7.5h4" />
      </svg>
    )
  }

  if (tipo === 'pedido') {
    return (
      <svg {...props}>
        <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    )
  }

  if (tipo === 'compra') {
    return (
      <svg {...props}>
        <path d="M5 8.5h14l-1 11H6l-1-11Z" />
        <path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" />
        <path d="M9 13h6" />
      </svg>
    )
  }

  return (
    <svg {...props}>
      <path d="M4 12h4l2.2 3L15 8l2 4h3" />
      <path d="M5 4.5h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
    </svg>
  )
}

export default function BienvenidaInicial({ abierto, onClose, onConfigurar }) {
  return (
    <Modal
      abierto={abierto}
      titulo="¡Bienvenido a Ordely!"
      onClose={onClose}
      className="ordely-welcome-modal"
    >
      <div className="ordely-welcome-content">
        <section className="ordely-welcome-hero">
          <div className="ordely-welcome-brand">
            <img src="/brand/ordely-icon.png" alt="" />
            <span>Ordely</span>
          </div>
          <div>
            <span className="ordely-welcome-eyebrow">Tu negocio, siempre en orden</span>
            <h3>¿Qué es Ordely?</h3>
            <p>
              Es tu espacio para controlar clientes, pedidos, compras, anticipos y entregas desde un solo lugar.
              Este es el flujo recomendado para comenzar.
            </p>
          </div>
        </section>

        <div className="ordely-welcome-flow" aria-label="Flujo principal de Ordely">
          <span>Cliente</span><i>→</i><span>Pedido</span><i>→</i><span>Compra</span><i>→</i><span>Entrega</span>
        </div>

        <section className="ordely-welcome-steps" aria-label="Primeros pasos">
          {PASOS.map((paso) => (
            <article className="ordely-welcome-step" key={paso.numero}>
              <div className="ordely-welcome-step-icon">
                <PasoIcono tipo={paso.icono} />
              </div>
              <div className="ordely-welcome-step-copy">
                <span>Paso {paso.numero}</span>
                <h4>{paso.titulo}</h4>
                <p>{paso.descripcion}</p>
              </div>
            </article>
          ))}
        </section>

        <aside className="ordely-welcome-settings">
          <div className="ordely-welcome-settings-icon" aria-hidden="true">⚙</div>
          <div>
            <strong>Recomendado antes de comenzar</strong>
            <p>
              Entra a <b>Mi cuenta y configuración</b> para elegir tus plataformas, tiempos de entrega,
              datos del negocio y preferencias de fecha.
            </p>
          </div>
        </aside>

        <div className="ordely-welcome-actions">
          <button type="button" className="btn btn-primary" onClick={onConfigurar}>
            Configurar mis preferencias
          </button>
          <button type="button" className="btn btn-light-bordered" onClick={onClose}>
            Comenzar ahora
          </button>
        </div>
      </div>
    </Modal>
  )
}
