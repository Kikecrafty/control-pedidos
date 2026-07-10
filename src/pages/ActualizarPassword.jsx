import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const ocultarImagenRota = (event) => {
  event.currentTarget.style.display = 'none'
  event.currentTarget.parentElement?.classList.add('ordely-logo-error')
}

export default function ActualizarPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [revisandoSesion, setRevisandoSesion] = useState(true)
  const [sesionValida, setSesionValida] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [actualizada, setActualizada] = useState(false)

  useEffect(() => {
    let activo = true

    const revisarSesion = async () => {
      const { data } = await supabase.auth.getSession()

      if (!activo) return

      setSesionValida(Boolean(data.session))
      setRevisandoSesion(false)
    }

    revisarSesion()

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSesionValida(Boolean(session))
      }

      setRevisandoSesion(false)
    })

    return () => {
      activo = false
      data.subscription.unsubscribe()
    }
  }, [])

  const guardarPassword = async (e) => {
    e.preventDefault()

    if (cargando || actualizada) return

    setError('')
    setMensaje('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)

    const { error } = await supabase.auth.updateUser({
      password
    })

    if (error) {
      setError('El enlace venció o no es válido. Solicita otro correo.')
      setCargando(false)
      return
    }

    setActualizada(true)
    setMensaje('Contraseña actualizada.')
    setPassword('')
    setConfirmPassword('')
    await supabase.auth.signOut()
    setCargando(false)
  }

  return (
    <div className="ordely-auth-page">
      <Link to="/login" className="ordely-auth-back">
        ← Iniciar sesión
      </Link>

      <main className="ordely-auth-card ordely-password-card">
        <div className="ordely-auth-brand">
          <img src="/brand/ordely-logo.png" alt="Ordely" onError={ocultarImagenRota} />
          <span className="ordely-logo-text-fallback">Ordely</span>
          <span>Pedidos claros, ventas en orden.</span>
        </div>

        <form onSubmit={guardarPassword} className="ordely-auth-form">
          <div className="ordely-auth-heading">
            <h1>Nueva contraseña</h1>
            <p>Escribe una contraseña nueva para tu cuenta.</p>
          </div>

          {revisandoSesion && (
            <p className="ordely-auth-success">Verificando enlace...</p>
          )}

          {!revisandoSesion && !sesionValida && !actualizada && (
            <div className="ordely-auth-error">
              <p>El enlace venció o no es válido.</p>
              <Link to="/login" className="btn btn-light-bordered">
                Pedir otro enlace
              </Link>
            </div>
          )}

          {sesionValida && !actualizada && (
            <>
              <label className="form-field">
                <span>Nueva contraseña*</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={cargando}
                />
              </label>

              <label className="form-field">
                <span>Confirmar contraseña*</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={cargando}
                />
              </label>
            </>
          )}

          {error && <p className="ordely-auth-error">{error}</p>}
          {mensaje && <p className="ordely-auth-success">{mensaje}</p>}

          {sesionValida && !actualizada && (
            <button className="btn btn-primary ordely-auth-submit" disabled={cargando}>
              {cargando ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          )}

          {actualizada && (
            <Link to="/login" className="btn btn-primary ordely-auth-submit">
              Iniciar sesión
            </Link>
          )}
        </form>
      </main>
    </div>
  )
}
