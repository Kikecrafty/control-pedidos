import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const ocultarImagenRota = (event) => {
  event.currentTarget.style.display = 'none'
  event.currentTarget.parentElement?.classList.add('ordely-logo-error')
}

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams()
  const modoInicial = searchParams.get('modo') === 'registro' ? 'registro' : 'login'

  const registroEnProceso = useRef(false)
  const loginEnProceso = useRef(false)

  const [modo, setModo] = useState(modoInicial)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [recuperandoPassword, setRecuperandoPassword] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [registroCompletado, setRegistroCompletado] = useState(false)
  const [mostrarReenviarConfirmacion, setMostrarReenviarConfirmacion] = useState(false)


  useEffect(() => {
    setModo(searchParams.get('modo') === 'registro' ? 'registro' : 'login')
  }, [searchParams])

  const cambiarModo = (nuevoModo) => {
    registroEnProceso.current = false
    loginEnProceso.current = false
    setModo(nuevoModo)
    setError('')
    setMensaje('')
    setMostrarReenviarConfirmacion(false)
    setRegistroCompletado(false)
    setSearchParams(nuevoModo === 'registro' ? { modo: 'registro' } : {})
  }

  const limpiarTexto = (valor) => String(valor || '').trim()

  const esErrorCorreoSinConfirmar = (error) => {
    const mensajeError = String(error?.message || '').toLowerCase()
    const codigoError = String(error?.code || error?.status || '').toLowerCase()

    return (
      mensajeError.includes('email not confirmed') ||
      mensajeError.includes('not confirmed') ||
      mensajeError.includes('confirm') ||
      codigoError.includes('email_not_confirmed') ||
      codigoError.includes('not_confirmed')
    )
  }

  const mostrarCorreoSinConfirmar = () => {
    setError('Confirma tu correo para iniciar sesión.')
    setMensaje('Revisa tu bandeja o spam.')
    setMostrarReenviarConfirmacion(true)
  }

  const reenviarConfirmacion = async () => {
    if (cargando) return

    const emailLimpio = limpiarTexto(email).toLowerCase()

    if (!emailLimpio) {
      setError('Escribe tu correo para reenviar la confirmación')
      return
    }

    setCargando(true)
    setMensaje('')

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: emailLimpio,
      options: {
        emailRedirectTo: `${window.location.origin}/panel`
      }
    })

    if (error) {
      setError(error.message || 'No se pudo reenviar el correo de confirmación')
      setCargando(false)
      return
    }

    setMensaje('Correo reenviado. Revisa tu bandeja o spam.')
    setCargando(false)
  }

  const enviarRecuperacionPassword = async () => {
    if (cargando || recuperandoPassword) return

    const emailLimpio = limpiarTexto(email).toLowerCase()

    setError('')
    setMensaje('')
    setMostrarReenviarConfirmacion(false)

    if (!emailLimpio) {
      setError('Escribe tu correo para recuperar tu contraseña.')
      return
    }

    setRecuperandoPassword(true)

    const { error } = await supabase.auth.resetPasswordForEmail(emailLimpio, {
      redirectTo: `${window.location.origin}/actualizar-password`
    })

    if (error) {
      setError(error.message || 'No se pudo enviar el correo de recuperación.')
      setRecuperandoPassword(false)
      return
    }

    setMensaje('Si existe una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña.')
    setRecuperandoPassword(false)
  }

  const iniciarSesion = async (e) => {
    e.preventDefault()

    if (cargando || loginEnProceso.current) return

    loginEnProceso.current = true
    setCargando(true)
    setError('')
    setMensaje('')
    setMostrarReenviarConfirmacion(false)

    const emailLimpio = limpiarTexto(email).toLowerCase()

    if (!emailLimpio) {
      setError('Escribe tu correo')
      loginEnProceso.current = false
      setCargando(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailLimpio,
      password
    })

    if (error) {
      if (esErrorCorreoSinConfirmar(error)) {
        mostrarCorreoSinConfirmar()
      } else {
        setError('Correo o contraseña incorrectos')
      }

      loginEnProceso.current = false
      setCargando(false)
      return
    }

    window.location.href = '/panel'
  }

  const crearCuenta = async (e) => {
    e.preventDefault()

    // Bloqueo inmediato para evitar varios clics antes de que React actualice el estado.
    if (cargando || registroCompletado || registroEnProceso.current) return

    registroEnProceso.current = true
    setCargando(true)
    setError('')
    setMensaje('')
    setMostrarReenviarConfirmacion(false)

    const nombreLimpio = limpiarTexto(nombre)
    const emailLimpio = limpiarTexto(email).toLowerCase()

    if (!nombreLimpio) {
      setError('Escribe tu nombre o el nombre de tu negocio')
      registroEnProceso.current = false
      setCargando(false)
      return
    }

    if (!emailLimpio) {
      setError('Escribe tu correo')
      registroEnProceso.current = false
      setCargando(false)
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      registroEnProceso.current = false
      setCargando(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      registroEnProceso.current = false
      setCargando(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: emailLimpio,
      password,
      options: {
        data: {
          nombre: nombreLimpio
        },
        emailRedirectTo: `${window.location.origin}/panel`
      }
    })

    if (error) {
      const mensajeError = error.message?.toLowerCase() || ''

      if (
        mensajeError.includes('already') ||
        mensajeError.includes('registered') ||
        mensajeError.includes('exists') ||
        mensajeError.includes('duplicate')
      ) {
        setRegistroCompletado(true)
        setMensaje('Si el correo puede registrarse, recibirás un mensaje de confirmación. Revisa también spam.')
      } else {
        if (mensajeError.includes('rate limit')) {
          setError('Se enviaron muchos correos. Intenta más tarde.')
        } else {
          setError('No se pudo crear la cuenta.')
        }
      }

      registroEnProceso.current = false
      setCargando(false)
      return
    }

    // Supabase puede ocultar si el correo ya existe devolviendo identities vacío.
    // Conservamos una respuesta genérica para no revelar cuentas registradas.
    const identidades = data?.user?.identities
    const respuestaIndicaCorreoExistente = Array.isArray(identidades) && identidades.length === 0

    if (respuestaIndicaCorreoExistente) {
      setRegistroCompletado(true)
      setMensaje('Si el correo puede registrarse, recibirás un mensaje de confirmación. Revisa también spam.')
      registroEnProceso.current = false
      setCargando(false)
      return
    }

    setRegistroCompletado(true)

    if (data.session) {
      window.location.href = '/panel'
      return
    }

    setMensaje('Cuenta creada. Revisa tu correo para confirmar el registro y después inicia sesión.')
    setCargando(false)
  }

  const actualizarEmail = (valor) => {
    setEmail(valor)
    if (registroCompletado) {
      registroEnProceso.current = false
      setRegistroCompletado(false)
      setMensaje('')
    }
    if (mostrarReenviarConfirmacion) {
      setMostrarReenviarConfirmacion(false)
    }
  }

  const esRegistro = modo === 'registro'
  const formularioBloqueado = cargando || recuperandoPassword || registroCompletado

  return (
    <div className="ordely-auth-page">
      <Link to="/" className="ordely-auth-back">
        ← Volver al inicio
      </Link>

      <main className="ordely-auth-card">
        <div className="ordely-auth-brand">
          <img src="/brand/ordely-logo.png" alt="Ordely" onError={ocultarImagenRota} />
          <span className="ordely-logo-text-fallback">Ordely</span>
          <span>Pedidos claros, ventas en orden.</span>
        </div>

        <div className="ordely-auth-tabs" role="tablist" aria-label="Acceso">
          <button
            type="button"
            className={!esRegistro ? 'active' : ''}
            onClick={() => cambiarModo('login')}
            disabled={cargando}
          >
            Iniciar sesión
          </button>

          <button
            type="button"
            className={esRegistro ? 'active' : ''}
            onClick={() => cambiarModo('registro')}
            disabled={cargando}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={esRegistro ? crearCuenta : iniciarSesion} className="ordely-auth-form">
          <div className="ordely-auth-heading">
            <h1>{esRegistro ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
            <p>
              {esRegistro
                ? 'Empieza con tu cuenta gratuita.'
                : 'Entra para continuar con tu panel.'}
            </p>
          </div>

          {esRegistro && (
            <label className="form-field">
              <span>Nombre o negocio*</span>
              <input
                type="text"
                placeholder=""
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                disabled={formularioBloqueado}
              />
            </label>
          )}

          <label className="form-field">
            <span>Correo*</span>
            <input
              type="email"
              placeholder=""
              value={email}
              onChange={(e) => actualizarEmail(e.target.value)}
              required
              disabled={formularioBloqueado}
            />
          </label>

          <label className="form-field">
            <span>Contraseña*</span>
            <input
              type="password"
              placeholder=""
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={formularioBloqueado}
            />
          </label>

          {!esRegistro && (
            <button
              type="button"
              className="ordely-forgot-password"
              onClick={enviarRecuperacionPassword}
              disabled={formularioBloqueado}
            >
              {recuperandoPassword ? 'Enviando enlace...' : '¿Olvidaste la contraseña?'}
            </button>
          )}

          {esRegistro && (
            <label className="form-field">
              <span>Confirmar contraseña*</span>
              <input
                type="password"
                placeholder=""
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={formularioBloqueado}
              />
            </label>
          )}

          {error && (
            <div className="ordely-auth-error">
              <p>{error}</p>

              {mostrarReenviarConfirmacion && (
                <button
                  type="button"
                  className="btn btn-light-bordered"
                  onClick={reenviarConfirmacion}
                  disabled={cargando}
                >
                  Reenviar correo
                </button>
              )}
            </div>
          )}

          {mensaje && <p className="ordely-auth-success">{mensaje}</p>}

          <button
            className="btn btn-primary ordely-auth-submit"
            disabled={formularioBloqueado}
          >
            {cargando
              ? (esRegistro ? 'Verificando cuenta...' : 'Entrando...')
              : registroCompletado
                ? 'Cuenta creada'
                : (esRegistro ? 'Crear cuenta gratis' : 'Entrar')}
          </button>

          <p className="ordely-auth-switch">
            {esRegistro ? '¿Ya tienes cuenta?' : '¿Todavía no tienes cuenta?'}{' '}
            <button
              type="button"
              onClick={() => cambiarModo(esRegistro ? 'login' : 'registro')}
              disabled={cargando}
            >
              {esRegistro ? 'Inicia sesión' : 'Crea una cuenta'}
            </button>
          </p>
        </form>
      </main>
    </div>
  )
}
