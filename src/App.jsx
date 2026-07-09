import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { procesarMiPlanVencido } from './lib/planes'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Pedidos from './pages/Pedidos'
import NuevoPedido from './pages/NuevoPedido'
import DetallePedido from './pages/DetallePedido'
import Seguimiento from './pages/Seguimiento'
import Planes from './pages/Planes'
import Metricas from './pages/Metricas'
import AdminControl from './pages/AdminControl'

function ProtectedRoute({ session, children }) {
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true

    const iniciar = async () => {
      const { data } = await supabase.auth.getSession()
      const sesionActual = data.session || null

      if (sesionActual) {
        await procesarMiPlanVencido()
        window.dispatchEvent(new Event('planActualizado'))
      }

      if (activo) {
        setSession(sesionActual)
        setCargando(false)
      }
    }

    iniciar()

    const { data } = supabase.auth.onAuthStateChange(async (_event, nuevaSesion) => {
      if (nuevaSesion) {
        await procesarMiPlanVencido()
        window.dispatchEvent(new Event('planActualizado'))
      }

      setSession(nuevaSesion)
    })

    return () => {
      activo = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) return

    const revisarAlVolver = async () => {
      await procesarMiPlanVencido()
      window.dispatchEvent(new Event('planActualizado'))
    }

    window.addEventListener('focus', revisarAlVolver)

    return () => {
      window.removeEventListener('focus', revisarAlVolver)
    }
  }, [session])

  if (cargando) {
    return <div className="loading">Cargando...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/seguimiento/:token" element={<Seguimiento />} />

        <Route
          path="/login"
          element={!session ? <Login /> : <Navigate to="/" replace />}
        />

        <Route
          path="/"
          element={
            <ProtectedRoute session={session}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clientes"
          element={
            <ProtectedRoute session={session}>
              <Clientes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pedidos"
          element={
            <ProtectedRoute session={session}>
              <Pedidos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/nuevo-pedido"
          element={
            <ProtectedRoute session={session}>
              <NuevoPedido />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pedidos/:id"
          element={
            <ProtectedRoute session={session}>
              <DetallePedido />
            </ProtectedRoute>
          }
        />

        <Route
          path="/planes"
          element={
            <ProtectedRoute session={session}>
              <Planes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/metricas"
          element={
            <ProtectedRoute session={session}>
              <Metricas />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin-control"
          element={
            <ProtectedRoute session={session}>
              <AdminControl />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
