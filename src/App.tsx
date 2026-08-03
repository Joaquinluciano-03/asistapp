import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { EstudianteDashboard } from './pages/EstudianteDashboard'
import { AdminDashboard } from './pages/AdminDashboard'
import { AdminScanner } from './pages/AdminScanner'
import { AdminManual } from './pages/AdminManual'
import { Planillas } from './pages/Planillas'
import { GestionUsuarios } from './pages/GestionUsuarios'

const ADMIN_ROLES = ['admin', 'superadmin'] as const

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Estudiante */}
            <Route
              path="/estudiante"
              element={
                <ProtectedRoute allowedRoles={['estudiante']}>
                  <EstudianteDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin / Superadmin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/escanear"
              element={
                <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
                  <AdminScanner />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/manual"
              element={
                <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
                  <AdminManual />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/planillas"
              element={
                <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
                  <Planillas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/usuarios"
              element={
                <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
                  <GestionUsuarios />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
