import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { SUPABASE_CONFIGURED } from '../lib/supabaseClient'

export function Login() {
  const { user, profile, loading, signInWithGoogle } = useAuth()
  const { toastError } = useToast()
  const [signingIn, setSigningIn] = useState(false)

  // Redirect if already authenticated
  if (!loading && user && profile) {
    if (profile.role === 'estudiante') return <Navigate to="/estudiante" replace />
    return <Navigate to="/admin" replace />
  }

  const handleLogin = async () => {
    setSigningIn(true)
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión'
      toastError(msg)
      setSigningIn(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'radial-gradient(ellipse at top, #1e3a8a 0%, #0f172a 50%, #020617 100%)',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'fixed',
          top: '18%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '640px',
          height: '320px',
          background: 'radial-gradient(ellipse, rgba(37,99,235,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="glass-card animate-fade-in"
        style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 'var(--r-lg)',
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 1.25rem',
              boxShadow: '0 0 44px rgba(37,99,235,0.35), var(--shadow-md)',
            }}
          >
            🏫
          </div>

          <h1
            style={{
              fontSize: '2.1rem',
              fontWeight: 900,
              letterSpacing: '-0.045em',
              marginBottom: '0.3rem',
              color: '#f1f5f9',
              background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            AsistIDO
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Escuela Don Orione Victoria
          </p>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.3rem' }}>
            Sistema de registro de llegadas tarde
          </p>
        </div>

        <div className="divider" />

        {/* Notice */}
        {!SUPABASE_CONFIGURED ? (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--r-md)',
              padding: '0.875rem 1rem',
              marginBottom: '1.5rem',
              fontSize: '0.8rem',
              color: '#f87171',
              lineHeight: 1.6,
            }}
          >
            ⚠️ <strong>Configuración faltante:</strong><br />
            El archivo <code>.env</code> no está configurado. Copiá <code>.env.example</code> a <code>.env</code> y completá las variables de Supabase.
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(37,99,235,0.1)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 'var(--r-md)',
              padding: '0.875rem 1rem',
              marginBottom: '1.5rem',
              fontSize: '0.8rem',
              color: '#93c5fd',
              lineHeight: 1.6,
            }}
          >
            ℹ️ <strong>Solo para personal y alumnos</strong> del colegio.<br />
            Se requiere cuenta <code style={{ background: 'rgba(59,130,246,0.15)', padding: '0 4px', borderRadius: 4 }}>@donorionevictoria.com.ar</code>
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          id="btn-google-signin"
          onClick={handleLogin}
          disabled={signingIn || loading || !SUPABASE_CONFIGURED}
          className="btn btn-lg btn-google"
          style={{
            width: '100%',
            background: 'white',
            color: '#1f2937',
            fontWeight: 600,
            fontSize: '0.95rem',
            gap: '0.75rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          {signingIn ? (
            <>
              <div className="spinner" style={{ borderTopColor: '#1d4ed8' }} />
              Redirigiendo...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
                <path fill="#34A853" d="M6.3 14.7l7 5.1C15.2 16 19.3 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z" />
                <path fill="#FBBC05" d="M24 46c5.8 0 10.9-1.9 14.8-5.2l-6.8-5.6C29.9 37 27.1 38 24 38c-5.8 0-10.8-3.9-12.5-9.2L4.7 34.4C8.2 41.4 15.5 46 24 46z" />
                <path fill="#EA4335" d="M44.5 20H24v8.5h11.8C34.5 31.8 32 34.1 28.7 35.4l6.8 5.6C39.7 37.2 44.5 31.2 44.5 24c0-1.3-.2-2.7-.5-4H44.5z" />
              </svg>
              Iniciar sesión con Google
            </>
          )}
        </button>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.75rem', marginTop: '1.25rem' }}>
          Al ingresar aceptás las políticas de uso interno del colegio.
        </p>
      </div>
    </div>
  )
}
