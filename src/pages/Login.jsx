import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const iniciarSesion = async (e) => {
    e.preventDefault()
    setCargando(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setError('Correo o contraseña incorrectos')
    } else {
      window.location.href = '/'
    }

    setCargando(false)
  }

  return (
    <div className="login-page">
      <form onSubmit={iniciarSesion} className="login-card">
        <h1>Control de Pedidos</h1>
        <p>Administra tus pedidos de SHEIN</p>

        <label>Correo</label>
        <input
          type="email"
          placeholder="tu_correo@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label>Contraseña</label>
        <input
          type="password"
          placeholder="Tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary" disabled={cargando}>
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}