import { useState } from 'react'
import Modal from './Modal'

const GUIAS = {
  dashboard: {
    etiqueta: 'Inicio',
    titulo: 'Cómo funciona Inicio',
    descripcion: 'Este panel reúne lo que necesita atención para que no tengas que revisar pedido por pedido.',
    pasos: [
      ['Revisa “Pedidos por comprar”', 'Ahí aparecen los pedidos que todavía tienen productos pendientes de pedir en la plataforma. Entra a Compras para seleccionarlos y registrar la compra.'],
      ['Revisa las llegadas', 'Los productos que ya llegaron o que posiblemente ya llegaron aparecen primero. Después verás todos los que siguen en camino.'],
      ['Abre el pedido correcto', 'Cada producto tiene acceso directo a su pedido. Desde la sección Productos puedes marcarlo como recibido, dejado en negocio o entregado.'],
      ['Consulta la actividad reciente', 'Sirve para volver rápidamente a los últimos pedidos que se crearon o modificaron.']
    ],
    sinAccion: 'Si no hay pedidos por comprar, posibles llegadas ni entregas pendientes, no necesitas hacer nada aquí. Puedes crear un pedido nuevo o continuar trabajando desde otra sección.'
  },
  pedidos: {
    etiqueta: 'Pedidos',
    titulo: 'Cómo funciona Pedidos',
    descripcion: 'Aquí consultas todos los pedidos y separas lo que falta comprar de lo que ya fue pedido en plataforma.',
    pasos: [
      ['Usa “Por comprar”', 'Muestra pedidos que todavía tienen al menos un producto pendiente de compra. Para comprarlos, entra al apartado Compras.'],
      ['Usa “Ya comprados”', 'Muestra los pedidos cuyos productos ya fueron registrados en una compra. Puedes consultar su avance y las fechas relacionadas.'],
      ['Busca y filtra', 'Encuentra pedidos por código, cliente, producto, plataforma o fecha sin recorrer toda la lista.'],
      ['Abre el detalle', 'Desde Ver pedido puedes registrar pagos, revisar productos, compartir seguimiento y actualizar la llegada o entrega.']
    ],
    sinAccion: 'Si un pedido ya está completo, no necesitas modificarlo. Úsalo solo como historial. Si aún no has comprado sus productos, regresa a Por comprar y continúa desde Compras.'
  },
  nuevoPedido: {
    etiqueta: 'Nuevo pedido',
    titulo: 'Cómo funciona Nuevo pedido',
    descripcion: 'Esta pantalla sirve para registrar lo que el cliente solicitó antes de realizar la compra en la plataforma.',
    pasos: [
      ['Selecciona al cliente y la plataforma', 'Elige un cliente existente o registra uno nuevo. Después selecciona dónde se hará la compra.'],
      ['Agrega todos los productos', 'Registra nombre, cantidad, variante, precio y comisión extra cuando corresponda. Usa Agregar producto para incluir más artículos.'],
      ['Registra el anticipo', 'Si el cliente ya pagó algo, indica el monto y la fecha. Ordely calculará automáticamente el saldo restante.'],
      ['Guarda y continúa en Compras', 'El pedido quedará como pendiente de compra. Cuando vayas a pedir los productos en la plataforma, regístralos desde Compras.']
    ],
    sinAccion: 'Si todavía no tienes todos los datos del cliente o de los productos, puedes esperar antes de crear el pedido para evitar información incompleta.'
  },
  compras: {
    etiqueta: 'Compras',
    titulo: 'Cómo funciona Compras',
    descripcion: 'Aquí conviertes los productos pendientes en una compra real realizada en SHEIN, Temu, Amazon u otra plataforma.',
    pasos: [
      ['Elige la plataforma', 'Selecciona la misma plataforma que usaste al registrar los pedidos.'],
      ['Selecciona los productos', 'Marca los artículos que vas a pedir juntos en esa compra. Puedes combinar productos de varios clientes.'],
      ['Captura el total real', 'Registra lo que realmente pagaste después de descuentos, cupones, envío o costos adicionales.'],
      ['Confirma la compra', 'Ordely marcará los productos como comprados, guardará la fecha y calculará su llegada estimada.']
    ],
    sinAccion: 'Si no aparecen productos, significa que no tienes pedidos pendientes para esa plataforma. Registra primero un pedido o cambia de plataforma.'
  },
  clientes: {
    etiqueta: 'Clientes',
    titulo: 'Cómo funciona Clientes',
    descripcion: 'Esta sección reúne los datos de cada cliente, sus pedidos y el saldo que todavía falta cobrar.',
    pasos: [
      ['Registra al cliente una sola vez', 'Guarda su nombre y medio de contacto. Después podrás reutilizarlo en todos sus pedidos.'],
      ['Abre su ficha', 'Consulta pedidos activos, historial, saldo pendiente y sus datos de contacto.'],
      ['Crea un pedido desde su ficha', 'El cliente se seleccionará automáticamente para ahorrar tiempo.'],
      ['Mantén la información actualizada', 'Edita su contacto cuando cambie y elimina únicamente clientes que no tengan pedidos relacionados.']
    ],
    sinAccion: 'Si el cliente no tiene pedidos activos ni saldo pendiente, su ficha puede conservarse como historial para futuras compras.'
  },
  detallePedido: {
    etiqueta: 'Detalle del pedido',
    titulo: 'Cómo funciona Detalle del pedido',
    descripcion: 'Aquí administras un pedido completo: productos, pagos, seguimiento y cambios importantes.',
    pasos: [
      ['Revisa el resumen', 'Comprueba cliente, plataforma, total, saldo y el siguiente punto importante del pedido.'],
      ['Actualiza cada producto', 'En Productos puedes marcar la compra, recepción, llegada al negocio y entrega al cliente.'],
      ['Registra los pagos', 'En Pagos agrega anticipos o abonos para que el saldo se mantenga correcto.'],
      ['Comparte el seguimiento', 'Envía al cliente su enlace privado para que consulte el avance sin preguntarte por mensaje.'],
      ['Consulta el historial', 'Revisa los cambios registrados para saber qué ocurrió y cuándo.']
    ],
    sinAccion: 'Si el pedido está entregado y pagado, no necesitas modificarlo. Déjalo como historial, salvo que debas marcarlo como devuelto.'
  },
  metricas: {
    etiqueta: 'Estadísticas',
    titulo: 'Cómo funciona Estadísticas',
    descripcion: 'Esta pantalla resume ventas, cobros, plataformas y clientes para ayudarte a entender el negocio.',
    pasos: [
      ['Selecciona un periodo', 'Consulta hoy, semana, mes, todo el historial o un rango personalizado.'],
      ['Revisa ventas y cobros', 'Compara cuánto vendiste, cuánto ya cobraste y cuánto sigue pendiente.'],
      ['Analiza plataformas y clientes', 'Identifica dónde vendes más y qué clientes generan más movimiento.'],
      ['Abre pedidos desde el resumen', 'Usa los accesos directos para revisar cualquier pedido que necesite atención.']
    ],
    sinAccion: 'Si todavía tienes pocos pedidos, las gráficas pueden mostrar poca información. Continúa registrando operaciones y los resultados se completarán automáticamente.'
  },
  planes: {
    etiqueta: 'Planes',
    titulo: 'Cómo funciona Planes',
    descripcion: 'Aquí comparas las funciones disponibles y eliges el plan que se adapte al tamaño de tu operación.',
    pasos: [
      ['Revisa tu plan actual', 'Comprueba qué funciones tienes activas en este momento.'],
      ['Compara las opciones', 'Mira límites, herramientas y diferencias antes de realizar un cambio.'],
      ['Elige solo cuando lo necesites', 'Cambia de plan cuando el volumen de pedidos o las funciones requeridas lo justifiquen.']
    ],
    sinAccion: 'Si tu plan actual cubre tus necesidades, no tienes que cambiar nada.'
  },
  soporte: {
    etiqueta: 'Ayuda y soporte',
    titulo: 'Cómo funciona Ayuda y soporte',
    descripcion: 'Este apartado reúne preguntas frecuentes, contacto directo y comentarios para mejorar Ordely.',
    pasos: [
      ['Consulta las preguntas frecuentes', 'Revisa primero las respuestas rápidas sobre compras, pagos, llegadas y seguimiento.'],
      ['Contacta por WhatsApp', 'Usa soporte directo cuando exista una falla urgente o una duda que necesite atención personal.'],
      ['Envía una sugerencia u opinión', 'Describe la idea o problema con detalle. El administrador podrá revisarlo desde su panel.'],
      ['Consulta el estado', 'Tus comentarios recientes aparecerán abajo como Nuevo, En revisión, Respondido o Resuelto.']
    ],
    sinAccion: 'Si ya resolviste tu duda con las preguntas frecuentes, no necesitas enviar un comentario ni contactar a soporte.'
  }
}

export default function PageHelp({ page }) {
  const [abierto, setAbierto] = useState(false)
  const guia = GUIAS[page]

  if (!guia) return null

  return (
    <>
      <button
        type="button"
        className="page-help-button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">?</span>
        Cómo funciona {guia.etiqueta}
      </button>

      <Modal
        abierto={abierto}
        titulo={guia.titulo}
        onClose={() => setAbierto(false)}
        className="page-help-modal"
      >
        <div className="page-help-content">
          <p className="page-help-intro">{guia.descripcion}</p>

          <div className="page-help-steps">
            {guia.pasos.map(([titulo, descripcion], index) => (
              <article key={titulo}>
                <span>{index + 1}</span>
                <div>
                  <strong>{titulo}</strong>
                  <p>{descripcion}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="page-help-no-action">
            <strong>Cuando no necesitas hacer nada</strong>
            <p>{guia.sinAccion}</p>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={() => setAbierto(false)}>
              Entendido
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
