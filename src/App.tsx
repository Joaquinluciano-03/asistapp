import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'

// Lazy load de todas las páginas — reduce el bundle inicial drasticamente
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })))
const EstudianteDashboard = lazy(() => import('./pages/EstudianteDashboard').then(m => ({ default: m.EstudianteDashboard })))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminScanner = lazy(() => import('./pages/AdminScanner').then(m => ({ default: m.AdminScanner })))
const Planillas = lazy(() => import('./pages/Planillas').then(m => ({ default: m.Planillas })))
const GestionUsuarios = lazy(() => import('./pages/GestionUsuarios').then(m => ({ default: m.GestionUsuarios })))

const STAFF_ROLES = ['preceptor', 'admin', 'superadmin'] as const

// Spinner de carga mientras se descarga el chunk de la página
function PageLoader() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          className="spinner"
          style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 1rem' }}
        />
        <p style={{ color: '#475569', fontSize: '0.875rem' }}>Cargando...</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<PageLoader />}>
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

              {/* Staff (Admin / Superadmin / Preceptor) */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/escanear"
                element={
                  <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
                    <AdminScanner />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/planillas"
                element={
                  <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
                    <Planillas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/usuarios"
                element={
                  <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
                    <GestionUsuarios />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
