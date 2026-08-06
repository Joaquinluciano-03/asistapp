import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../lib/supabaseClient'

interface Props {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          <p className="text-slate-400 text-sm">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    // Redirect to the appropriate dashboard
    if (profile.role === 'estudiante' || profile.role === 'usuario_nuevo') {
      return <Navigate to="/estudiante" replace />
    }
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}
