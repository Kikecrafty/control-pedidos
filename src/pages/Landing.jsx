import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'

const iconPaths = {
  arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  order: <><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  wallet: <><path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10H5a3 3 0 0 1-3-3V7"/><path d="M16 14h.01"/></>,
  link: <><path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15"/><path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15"/></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></>,
  spark: <><path d="m12 3-1.2 3.8L7 8l3.8 1.2L12 13l1.2-3.8L17 8l-3.8-1.2z"/><path d="m5 15-.7 2.3L2 18l2.3.7L5 21l.7-2.3L8 18l-2.3-.7z"/><path d="m19 14-.6 1.9-1.9.6 1.9.6L19 19l.6-1.9 1.9-.6-1.9-.6z"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></>,
  chart: <><path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-8"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></>,
}

function Icon({ name, size = 20, strokeWidth = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  )
}

function BrandMark({ compact = false, tagline = false }) {
  return (
    <span className={`ol44-brand ${compact ? 'is-compact' : ''}`}>
      <svg className="ol44-brand-symbol" viewBox="0 0 56 56" aria-hidden="true">
        <defs>
          <linearGradient id="ol44LogoGradient" x1="6" y1="8" x2="49" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563eb" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <path d="M17 8.5a21 21 0 1 1-8.5 12" fill="none" stroke="url(#ol44LogoGradient)" strokeWidth="4.2" strokeLinecap="round" />
        <circle cx="17" cy="8.5" r="4" fill="#fff" stroke="#2563eb" strokeWidth="3" />
        <circle cx="8.5" cy="20.5" r="4" fill="#fff" stroke="#2563eb" strokeWidth="3" />
        <circle cx="46.5" cy="40.5" r="4" fill="#fff" stroke="#7c3aed" strokeWidth="3" />
        <path d="m20.5 28 5.3 5.2L36.5 22" fill="none" stroke="#16a34a" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="ol44-brand-copy">
        <span className="ol44-brand-word">Ordely</span>
        {tagline && <span className="ol44-brand-tagline">Pedidos claros, ventas en orden.</span>}
      </span>
    </span>
  )
}

function ParticleField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const mediaReduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let previous = 0
    let running = true
    let particles = []

    const createParticles = () => {
      const mobile = window.innerWidth < 720
      const count = mobile ? 10 : 22
      particles = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * canvas.clientWidth,
        y: Math.random() * canvas.clientHeight,
        vx: (Math.random() - 0.5) * (mobile ? 0.12 : 0.2),
        vy: (Math.random() - 0.5) * (mobile ? 0.12 : 0.2),
        radius: 1.2 + Math.random() * 1.8,
        alpha: 0.16 + Math.random() * 0.28,
        tone: index % 3,
      }))
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      createParticles()
    }

    const draw = (time) => {
      if (!running) return
      if (time - previous < 33) {
        frame = requestAnimationFrame(draw)
        return
      }
      previous = time
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      ctx.clearRect(0, 0, width, height)

      particles.forEach((particle, i) => {
        particle.x += particle.vx
        particle.y += particle.vy
        if (particle.x < -20) particle.x = width + 20
        if (particle.x > width + 20) particle.x = -20
        if (particle.y < -20) particle.y = height + 20
        if (particle.y > height + 20) particle.y = -20

        const colors = ['37, 99, 235', '124, 58, 237', '14, 165, 233']
        ctx.beginPath()
        ctx.fillStyle = `rgba(${colors[particle.tone]}, ${particle.alpha})`
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        ctx.fill()

        if (window.innerWidth > 720) {
          for (let j = i + 1; j < particles.length; j += 1) {
            const other = particles[j]
            const dx = particle.x - other.x
            const dy = particle.y - other.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance < 105) {
              ctx.beginPath()
              ctx.strokeStyle = `rgba(79, 70, 229, ${(1 - distance / 105) * 0.075})`
              ctx.lineWidth = 0.7
              ctx.moveTo(particle.x, particle.y)
              ctx.lineTo(other.x, other.y)
              ctx.stroke()
            }
          }
        }
      })
      frame = requestAnimationFrame(draw)
    }

    const onVisibility = () => {
      running = document.visibilityState === 'visible' && !mediaReduced.matches
      if (running) frame = requestAnimationFrame(draw)
      else cancelAnimationFrame(frame)
    }

    resize()
    if (!mediaReduced.matches) frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    mediaReduced.addEventListener?.('change', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      mediaReduced.removeEventListener?.('change', onVisibility)
    }
  }, [])

  return <canvas className="ol44-particles" ref={canvasRef} aria-hidden="true" />
}

const liveOrders = [
  { code: 'SHN-18', client: 'Mariana López', state: 'En camino', stateClass: 'purple', total: '$1,280', paid: '$700' },
  { code: 'TEM-07', client: 'Sofía Ramírez', state: 'Pago parcial', stateClass: 'amber', total: '$840', paid: '$400' },
  { code: 'ORD-24', client: 'Andrea Cruz', state: 'Entregado', stateClass: 'green', total: '$540', paid: '$540' },
]

function LiveCommandCenter() {
  const [activeOrder, setActiveOrder] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setActiveOrder((current) => (current + 1) % liveOrders.length), 3200)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="ol44-command-wrap" aria-label="Vista demostrativa del panel de Ordely">
      <div className="ol44-command-glow" />
      <div className="ol44-command-card">
        <div className="ol44-command-top">
          <div className="ol44-command-brand"><BrandMark compact /></div>
          <div className="ol44-command-search">Buscar pedido o cliente</div>
          <span className="ol44-live-pill"><i /> En vivo</span>
        </div>

        <div className="ol44-command-body">
          <aside className="ol44-command-side" aria-hidden="true">
            <span className="active"><Icon name="chart" size={16} /></span>
            <span><Icon name="order" size={16} /></span>
            <span><Icon name="users" size={16} /></span>
            <span><Icon name="wallet" size={16} /></span>
          </aside>

          <div className="ol44-command-content">
            <div className="ol44-command-heading">
              <div>
                <span>Resumen operativo</span>
                <strong>Todo bajo control</strong>
              </div>
              <div className="ol44-mini-avatar">EC</div>
            </div>

            <div className="ol44-kpis">
              <article>
                <span>Pedidos activos</span>
                <strong>14</strong>
                <small>+3 esta semana</small>
              </article>
              <article>
                <span>Por cobrar</span>
                <strong>$2,430</strong>
                <small>4 pedidos</small>
              </article>
              <article>
                <span>Entregados</span>
                <strong>28</strong>
                <small>Este mes</small>
              </article>
            </div>

            <div className="ol44-order-table">
              <div className="ol44-order-head">
                <span>Pedido</span><span>Cliente</span><span>Estado</span><span>Total</span><span>Pagado</span>
              </div>
              {liveOrders.map((order, index) => (
                <div key={order.code} className={`ol44-order-row ${activeOrder === index ? 'is-active' : ''}`}>
                  <strong>{order.code}</strong>
                  <span>{order.client}</span>
                  <span><b className={`ol44-status ${order.stateClass}`}>{order.state}</b></span>
                  <span>{order.total}</span>
                  <span>{order.paid}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="ol44-float-card ol44-float-payment">
        <span className="ol44-float-icon green"><Icon name="wallet" size={16} /></span>
        <span><small>Pago registrado</small><strong>+$400.00</strong></span>
      </div>

      <div className="ol44-float-card ol44-float-link">
        <span className="ol44-float-icon purple"><Icon name="link" size={16} /></span>
        <span><small>Seguimiento enviado</small><strong>Cliente actualizado</strong></span>
      </div>
    </div>
  )
}

const featureCards = [
  {
    icon: 'order',
    eyebrow: 'PEDIDOS',
    title: 'Encuentra cualquier pedido al instante.',
    text: 'Ve cliente, productos, fecha estimada y estado en una sola ficha, sin volver a buscar entre chats.',
    benefit: 'Todo el pedido en un solo lugar',
    className: 'blue',
  },
  {
    icon: 'wallet',
    eyebrow: 'PAGOS',
    title: 'Sabe exactamente quién ya pagó.',
    text: 'Registra anticipos y pagos parciales. Ordely calcula automáticamente cuánto falta por cobrar.',
    benefit: 'Saldo pendiente siempre visible',
    className: 'dark',
  },
  {
    icon: 'users',
    eyebrow: 'CLIENTES',
    title: 'Recuerda todo sin depender de tu memoria.',
    text: 'Consulta el historial de cada cliente, sus pedidos anteriores y cómo va cada entrega.',
    benefit: 'Historial por cliente',
    className: 'cream',
  },
  {
    icon: 'link',
    eyebrow: 'SEGUIMIENTO',
    title: 'Tu cliente puede revisar su pedido sin escribirte.',
    text: 'Comparte un enlace privado para consultar estado, pagos y fecha estimada sin iniciar sesión.',
    benefit: 'Menos preguntas repetidas',
    className: 'violet',
  },
]

function RevealObserver() {
  useEffect(() => {
    const elements = document.querySelectorAll('[data-ol44-reveal]')
    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])
  return null
}

function BeforeAfter() {
  const beforeItems = [
    ['¿Cuánto me falta?', 'Buscar pagos y volver a hacer cuentas.'],
    ['¿Cuándo llega?', 'Revisar chats, notas y capturas.'],
    ['¿Ya pagué?', 'Confirmar depósitos uno por uno.'],
  ]

  const afterItems = [
    ['Estado', 'En camino'],
    ['Entrega estimada', '21 de julio'],
    ['Seguimiento', 'Listo para enviar'],
  ]

  return (
    <section className="ol44-contrast" id="por-que">
      <div className="ol44-shell">
        <div className="ol50-contrast-heading" data-ol44-reveal>
          <div className="ol50-heading-kicker">
            <span className="ol44-section-index">01</span>
            <p className="ol44-eyebrow">ANTES Y DESPUÉS</p>
          </div>
          <div className="ol50-heading-copy">
            <h2>Menos tiempo buscando.<br /><em>Más respuestas al instante.</em></h2>
            <p>Ordely reúne el pedido, los pagos y la entrega para que puedas responder con certeza sin detener tu trabajo.</p>
          </div>
        </div>

        <div className="ol50-compare-grid">
          <article className="ol50-before-card" data-ol44-reveal>
            <div className="ol50-card-top">
              <span className="ol50-card-dot red" />
              <div>
                <small>SIN ORDELY</small>
                <strong>Todo depende de recordar dónde lo anotaste.</strong>
              </div>
            </div>

            <div className="ol50-pain-list">
              {beforeItems.map(([question, detail]) => (
                <div className="ol50-pain-row" key={question}>
                  <span className="ol50-message-icon"><Icon name="message" size={17} /></span>
                  <div><strong>{question}</strong><small>{detail}</small></div>
                </div>
              ))}
            </div>

            <div className="ol50-card-footer dark">
              <Icon name="clock" size={18} />
              <span><strong>Cada pregunta te hace pausar.</strong> Buscar, revisar y calcular otra vez.</span>
            </div>
          </article>

          <article className="ol50-after-card" data-ol44-reveal>
            <div className="ol50-card-top light">
              <span className="ol50-card-dot green" />
              <div>
                <small>CON ORDELY</small>
                <strong>La respuesta está lista antes de que te la pidan.</strong>
              </div>
            </div>

            <div className="ol50-order-box">
              <div className="ol50-order-head">
                <div><small>Pedido</small><strong>SHN-18</strong></div>
                <b className="ol44-status purple">En camino</b>
              </div>

              <div className="ol50-money-grid">
                <span><small>Total</small><strong>$1,280</strong></span>
                <span><small>Pagado</small><strong>$700</strong></span>
                <span><small>Restante</small><strong>$580</strong></span>
              </div>

              <div className="ol50-progress" aria-hidden="true"><i /></div>

              <div className="ol50-answer-list">
                {afterItems.map(([label, value], index) => (
                  <div key={label}>
                    <span className={`ol50-answer-icon ${index === 2 ? 'violet' : ''}`}>
                      <Icon name={index === 0 ? 'order' : index === 1 ? 'clock' : 'link'} size={16} />
                    </span>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="ol50-card-footer light">
              <Icon name="spark" size={18} />
              <span><strong>Responde en segundos.</strong> Sin volver a buscar ni hacer cuentas.</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

function FeatureBento() {
  return (
    <section className="ol44-features" id="funciones">
      <div className="ol44-shell">
        <div className="ol44-section-head" data-ol44-reveal>
          <div>
            <p className="ol44-eyebrow">MÁS CLARIDAD, MENOS TRABAJO REPETIDO</p>
            <h2>Lo que Ordely hace por ti en cada pedido.</h2>
          </div>
          <p>Menos tiempo buscando mensajes y haciendo cuentas. Más claridad para cobrar, entregar y responder a tus clientes.</p>
        </div>

        <div className="ol46-feature-grid">
          {featureCards.map((feature, index) => (
            <article key={feature.title} className={`ol46-feature-card ${feature.className}`} data-ol44-reveal>
              <div className="ol46-feature-top">
                <div className="ol46-feature-icon"><Icon name={feature.icon} size={21} /></div>
                <span>{String(index + 1).padStart(2, '0')} · {feature.eyebrow}</span>
              </div>

              <h3>{feature.title}</h3>
              <p>{feature.text}</p>

              {index === 0 && (
                <div className="ol46-demo ol46-order-demo" aria-hidden="true">
                  <span><b>SHN-18</b><small>En camino</small></span>
                  <i />
                  <em>Entrega estimada: 21 de julio</em>
                </div>
              )}
              {index === 1 && (
                <div className="ol46-demo ol46-money-demo" aria-hidden="true">
                  <span><small>Pagado</small><strong>$700</strong></span>
                  <span><small>Por cobrar</small><strong>$580</strong></span>
                </div>
              )}
              {index === 2 && (
                <div className="ol46-demo ol46-client-demo" aria-hidden="true">
                  <span><i>ML</i><b>Mariana López</b><small>3 pedidos</small></span>
                  <span><i>SR</i><b>Sofía Ramírez</b><small>2 pedidos</small></span>
                </div>
              )}
              {index === 3 && (
                <div className="ol46-demo ol46-link-demo" aria-hidden="true">
                  <Icon name="link" size={17} />
                  <span><b>Seguimiento listo</b><small>miordely.com/seguimiento/…</small></span>
                </div>
              )}

              <div className="ol46-feature-benefit"><Icon name="check" size={15} /> {feature.benefit}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const steps = [
  { number: '01', title: 'Registra', text: 'Agrega cliente, productos, monto y fecha estimada.' },
  { number: '02', title: 'Cobra', text: 'Guarda anticipos, pagos parciales y saldo restante.' },
  { number: '03', title: 'Actualiza', text: 'Mueve el pedido por estados conforme avanza.' },
  { number: '04', title: 'Comparte', text: 'Envía seguimiento para mantener informado al cliente.' },
]

function Workflow() {
  return (
    <section className="ol44-workflow" id="como-funciona">
      <div className="ol44-shell ol44-workflow-grid">
        <div className="ol44-workflow-sticky" data-ol44-reveal>
          <p className="ol44-eyebrow">UN FLUJO, DE PRINCIPIO A FIN</p>
          <h2>Cuatro movimientos para llevar un pedido con claridad.</h2>
          <p>Ordely acompaña el proceso real de tu negocio sin obligarte a trabajar de otra manera.</p>
          <Link to="/login?modo=registro" className="ol44-text-link">Comenzar ahora <Icon name="arrow" size={18} /></Link>
        </div>

        <div className="ol44-steps">
          {steps.map((step) => (
            <article key={step.number} data-ol44-reveal>
              <span>{step.number}</span>
              <div><h3>{step.title}</h3><p>{step.text}</p></div>
              <Icon name="arrow" size={20} />
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function TrackingShowcase() {
  return (
    <section className="ol44-tracking" id="seguimiento">
      <div className="ol44-shell ol44-tracking-grid">
        <div className="ol44-tracking-copy" data-ol44-reveal>
          <span className="ol44-section-index">02</span>
          <p className="ol44-eyebrow">SEGUIMIENTO PÚBLICO</p>
          <h2>Tu cliente consulta. Tú sigues trabajando.</h2>
          <p>Comparte un enlace único con el estado, los productos, el total pagado, el saldo y la fecha estimada. Sin cuentas adicionales y sin exponer datos internos.</p>
          <ul>
            <li><Icon name="check" size={18} /> Solo información útil para el cliente</li>
            <li><Icon name="check" size={18} /> Consulta desde cualquier teléfono</li>
            <li><Icon name="check" size={18} /> Se actualiza cuando tú cambias el pedido</li>
          </ul>
        </div>

        <div className="ol44-tracking-scene" data-ol44-reveal>
          <div className="ol44-track-window">
            <div className="ol44-track-top"><BrandMark compact /><span>Seguimiento de pedido</span></div>
            <div className="ol44-track-order">
              <div><small>Pedido</small><strong>SHN-12</strong><p>SHEIN · Prueba 11</p></div>
              <b className="ol44-status purple">En camino</b>
            </div>
            <div className="ol44-track-metrics">
              <span><small>Total</small><strong>$250</strong></span>
              <span><small>Pagado</small><strong>$50</strong></span>
              <span><small>Restante</small><strong>$200</strong></span>
            </div>
            <div className="ol44-track-product">
              <span className="ol44-product-icon"><Icon name="order" size={20} /></span>
              <div><strong>Producto del pedido</strong><small>Estimado: 21 de julio</small></div>
              <span>x1</span>
            </div>
            <div className="ol44-track-timeline">
              <span className="done"><i /><small>Registrado</small></span>
              <span className="done"><i /><small>Comprado</small></span>
              <span className="current"><i /><small>En camino</small></span>
              <span><i /><small>Entregado</small></span>
            </div>
          </div>
          <div className="ol44-share-bubble"><Icon name="link" size={17} /> Enlace listo para enviar</div>
        </div>
      </div>
    </section>
  )
}

function BasicPlanNote() {
  return (
    <section className="ol44-basic-note">
      <div className="ol44-shell">
        <div className="ol44-basic-card" data-ol44-reveal>
          <span className="ol44-basic-icon"><Icon name="shield" size={24} /></span>
          <div>
            <p>EMPIEZA SIN COMPLICARTE</p>
            <h2>El plan básico incluye lo esencial para organizar tus primeros pedidos.</h2>
            <span>Tiene un límite inicial pensado para comenzar con control. Cuando tu operación crezca, podrás ampliar tu capacidad sin perder información.</span>
          </div>
          <Link to="/login?modo=registro" className="ol44-btn ol44-btn-light">Crear mi cuenta <Icon name="arrow" size={18} /></Link>
        </div>
      </div>
    </section>
  )
}

const faqs = [
  ['¿Puedo usar Ordely desde el celular?', 'Sí. La plataforma está diseñada para trabajar desde celular, tablet o computadora.'],
  ['¿Mis clientes necesitan crear una cuenta?', 'No. El seguimiento público se abre directamente desde el enlace que compartes.'],
  ['¿Sirve solamente para SHEIN?', 'No. Puedes organizar pedidos de SHEIN, Temu, AliExpress, TikTok Shop, Mercado Libre, Amazon, catálogo, compras grupales o productos personalizados.'],
  ['¿Puedo registrar pagos parciales?', 'Sí. Puedes guardar anticipos, pagos adicionales y consultar el saldo pendiente.'],
]

function FAQ() {
  return (
    <section className="ol44-faq" id="preguntas">
      <div className="ol44-shell ol44-faq-grid">
        <div data-ol44-reveal>
          <p className="ol44-eyebrow">PREGUNTAS FRECUENTES</p>
          <h2>Lo que necesitas saber antes de empezar.</h2>
        </div>
        <div className="ol44-faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question} data-ol44-reveal>
              <summary>{question}<span>+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Landing({ session }) {
  const navItems = useMemo(() => [
    ['Por qué Ordely', '#por-que'],
    ['Funciones', '#funciones'],
    ['Cómo funciona', '#como-funciona'],
    ['Seguimiento', '#seguimiento'],
  ], [])

  return (
    <div className="ol44-page">
      <RevealObserver />
      <header className="ol44-nav">
        <div className="ol44-shell ol44-nav-inner">
          <Link to="/" className="ol44-nav-brand" aria-label="Ir al inicio"><BrandMark tagline /></Link>
          <nav className="ol44-nav-links" aria-label="Navegación principal">
            {navItems.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          <div className="ol44-nav-actions">
            {session ? (
              <Link to="/panel" className="ol44-btn ol44-btn-dark">Ir al panel <Icon name="arrow" size={17} /></Link>
            ) : (
              <>
                <Link to="/login" className="ol44-btn ol44-btn-light ol44-auth-login">Iniciar sesión</Link>
                <Link to="/login?modo=registro" className="ol44-btn ol44-btn-dark ol44-auth-signup">Crear cuenta</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="ol44-hero">
          <ParticleField />
          <div className="ol44-hero-orb one" aria-hidden="true" />
          <div className="ol44-hero-orb two" aria-hidden="true" />


          <div className="ol44-shell ol44-hero-grid">
            <div className="ol44-hero-copy">
              <p className="ol44-hero-tag"><span /> Control para ventas por encargo</p>
              <h1>Tu negocio no necesita más chats.<br /><em>Necesita orden.</em></h1>
              <p className="ol44-hero-description">Centraliza pedidos, clientes, anticipos, pagos, entregas y seguimiento en una plataforma diseñada para trabajar rápido desde celular o computadora.</p>
              <div className="ol44-hero-actions">
                {session ? (
                  <Link to="/panel" className="ol44-btn ol44-btn-primary">Abrir mi panel <Icon name="arrow" size={18} /></Link>
                ) : (
                  <>
                    <Link to="/login?modo=registro" className="ol44-btn ol44-btn-primary">Empezar a organizarme <Icon name="arrow" size={18} /></Link>
                    <a href="#como-funciona" className="ol44-btn ol44-btn-ghost">Ver cómo funciona</a>
                  </>
                )}
              </div>
              <div className="ol44-hero-proof">
                <span><Icon name="check" size={17} /> Desde cualquier dispositivo</span>
                <span><Icon name="check" size={17} /> Seguimiento por enlace</span>
                <span><Icon name="check" size={17} /> Sin hojas de cálculo</span>
              </div>
              <div className="ol44-limit-inline"><Icon name="shield" size={18} /><span><strong>Empieza con lo esencial.</strong> El plan básico incluye un límite inicial de pedidos.</span></div>
            </div>
            <LiveCommandCenter />
          </div>

          <div className="ol46-usecases" aria-label="Negocios que pueden usar Ordely">
            <div className="ol44-shell ol46-usecases-inner">
              <div className="ol46-usecases-copy">
                <span>ORDEN PARA TU FORMA DE VENDER</span>
                <strong>Ideal para pedidos por plataforma, catálogo o encargo.</strong>
              </div>
              <div className="ol46-usecase-list">
                <span>SHEIN</span>
                <span>Temu</span>
                <span>AliExpress</span>
                <span>TikTok Shop</span>
                <span>Mercado Libre</span>
                <span>Amazon</span>
                <span>Catálogo</span>
                <span>Pedidos grupales</span>
                <span>Compras por encargo</span>
                <span>Productos personalizados</span>
              </div>
            </div>
          </div>
        </section>

        <BeforeAfter />
        <FeatureBento />
        <Workflow />
        <TrackingShowcase />
        <BasicPlanNote />
        <FAQ />

        <section className="ol44-final">
          <div className="ol44-shell">
            <div className="ol44-final-card" data-ol44-reveal>
              <div className="ol44-final-copy">
                <p className="ol44-eyebrow">ORDEN QUE SE NOTA</p>
                <h2>Empieza a trabajar con más claridad desde tu siguiente pedido.</h2>
                <p>Crea tu cuenta, registra tu operación y deja que Ordely reúna las piezas.</p>
              </div>
              <div className="ol44-final-actions">
                {session ? (
                  <Link to="/panel" className="ol44-btn ol44-btn-white">Ir al panel <Icon name="arrow" size={18} /></Link>
                ) : (
                  <>
                    <Link to="/login?modo=registro" className="ol44-btn ol44-btn-white">Crear cuenta</Link>
                    <Link to="/login" className="ol44-final-login">Ya tengo una cuenta</Link>
                  </>
                )}
              </div>
              <div className="ol44-final-rings" aria-hidden="true"><i /><i /><i /></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="ol44-footer">
        <div className="ol44-shell ol44-footer-inner">
          <BrandMark />
          <p>Pedidos claros, ventas en orden.</p>
          <span>© {new Date().getFullYear()} miordely.com</span>
        </div>
      </footer>
    </div>
  )
}
