import { useEffect, useRef } from 'react'

const COLORS = [
  'rgba(37, 99, 235, 0.32)',
  'rgba(79, 70, 229, 0.26)',
  'rgba(124, 58, 237, 0.22)',
  'rgba(14, 165, 233, 0.22)'
]

export default function LandingParticles() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frameId = 0
    let visible = true
    let intersecting = true
    let lastFrame = 0
    let particles = []

    const createParticles = (width, height) => {
      const compact = width < 720
      const count = compact ? 9 : Math.min(22, Math.max(14, Math.round(width / 70)))

      particles = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: compact ? 1.2 + Math.random() * 2.2 : 1.4 + Math.random() * 2.8,
        speedX: (Math.random() - 0.5) * (compact ? 0.12 : 0.18),
        speedY: (Math.random() - 0.5) * (compact ? 0.09 : 0.14),
        color: COLORS[index % COLORS.length],
        pulse: Math.random() * Math.PI * 2
      }))
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 1.6)

      canvas.width = Math.max(1, Math.floor(rect.width * ratio))
      canvas.height = Math.max(1, Math.floor(rect.height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      createParticles(rect.width, rect.height)
    }

    const draw = (timestamp = 0) => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      context.clearRect(0, 0, width, height)

      particles.forEach((particle) => {
        const pulse = 0.82 + Math.sin(timestamp * 0.0012 + particle.pulse) * 0.18
        const radius = particle.radius * pulse

        context.beginPath()
        context.arc(particle.x, particle.y, radius, 0, Math.PI * 2)
        context.fillStyle = particle.color
        context.fill()

        if (!reducedMotion.matches) {
          particle.x += particle.speedX
          particle.y += particle.speedY

          if (particle.x < -8) particle.x = width + 8
          if (particle.x > width + 8) particle.x = -8
          if (particle.y < -8) particle.y = height + 8
          if (particle.y > height + 8) particle.y = -8
        }
      })
    }

    const animate = (timestamp) => {
      frameId = window.requestAnimationFrame(animate)
      if (!visible || !intersecting) return

      // Límite aproximado de 30 FPS para evitar trabajo innecesario.
      if (timestamp - lastFrame < 33) return
      lastFrame = timestamp
      draw(timestamp)
    }

    const handleVisibility = () => {
      visible = document.visibilityState === 'visible'
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting
      },
      { threshold: 0.02 }
    )

    const resizeObserver = new ResizeObserver(resize)
    observer.observe(canvas)
    resizeObserver.observe(canvas)
    document.addEventListener('visibilitychange', handleVisibility)
    reducedMotion.addEventListener?.('change', resize)

    resize()
    draw()
    frameId = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(frameId)
      observer.disconnect()
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      reducedMotion.removeEventListener?.('change', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="ol-particles" aria-hidden="true" />
}
