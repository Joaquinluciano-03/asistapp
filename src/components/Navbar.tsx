import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { HelpModal } from './HelpModal'

const ROLE_LABEL: Record<string, string> = {
  estudiante: 'Estudiante',
  admin: 'Admin',
  superadmin: 'Superadmin',
}

const ROLE_BADGE: Record<string, string> = {
  estudiante: 'badge-primary',
  admin: 'badge-warning',
  superadmin: 'badge-purple',
}

function useDigitalClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const hh = String(time.getHours()).padStart(2, '0')
  const mm = String(time.getMinutes()).padStart(2, '0')
  const ss = String(time.getSeconds()).padStart(2, '0')
  const fecha = time.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  return { hh, mm, ss, fecha }
}

export function Navbar() {
  const { profile, signOut } = useAuth()
  const { toastSuccess } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [showHelp, setShowHelp] = useState(false)
  const clock = useDigitalClock()

  const handleSignOut = async () => {
    await signOut()
    toastSuccess('Sesión cerrada correctamente')
    navigate('/login')
  }

  if (!profile) return null

  const isAdmin = profile.role === 'admin' || profile.role === 'superadmin'

  const adminLinks = [
    { to: '/admin', label: 'Inicio', exact: true },
    { to: '/admin/escanear', label: 'Escanear QR' },
    { to: '/admin/planillas', label: 'Planillas' },
    { to: '/admin/usuarios', label: 'Usuarios' },
  ]

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to
    return location.pathname.startsWith(to) && to !== '/admin'
  }

  return (
    <>
      <nav
        style={{
          background: 'rgba(15,23,42,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(148,163,184,0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div className="page-container" style={{ padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'relative' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  flexShrink: 0,
                }}
              >
                🏫
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f1f5f9', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                  AsistIDO
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.2 }}>
                  Don Orione Victoria
                </div>
              </div>
            </div>

            {/* ── Reloj digital centrado (solo admin) ── */}
            {isAdmin && (
              <div
                className="hidden-mobile"
                style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', lineHeight: 1.1, userSelect: 'none' }}
              >
                <div style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '0.08em', color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                  {clock.hh}<span style={{ opacity: 0.5, animation: 'clockBlink 1s step-end infinite' }}>:</span>{clock.mm}<span style={{ opacity: 0.5, animation: 'clockBlink 1s step-end infinite' }}>:</span>{clock.ss}
                </div>
                <div style={{ fontSize: '0.62rem', color: '#475569', fontWeight: 600, textTransform: 'capitalize', letterSpacing: '0.04em', marginTop: '0.1rem' }}>{clock.fecha}</div>
              </div>
            )}

            {/* Admin nav links */}
            {isAdmin && (
              <div style={{ display: 'flex', gap: '0.25rem' }} className="hidden-mobile">
                {adminLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      textDecoration: 'none',
                      transition: 'all 0.15s',
                      color: isActive(link.to, link.exact) ? '#60a5fa' : '#94a3b8',
                      background: isActive(link.to, link.exact) ? 'rgba(59,130,246,0.1)' : 'transparent',
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {/* User info + logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ textAlign: 'right' }} className="hidden-mobile">
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.email}
                </div>
                <span className={`badge ${ROLE_BADGE[profile.role]}`} style={{ fontSize: '0.65rem' }}>
                  {ROLE_LABEL[profile.role]}
                </span>
              </div>
              <button
                onClick={() => setShowHelp(true)}
                className="btn btn-secondary btn-sm"
                style={{ background: '#f1f5f9', color: '#0f172a', borderColor: '#e2e8f0', fontWeight: 600 }}
              >
                Ayuda
              </button>
              <button
                onClick={handleSignOut}
                className="btn btn-secondary btn-sm"
                id="btn-signout"
              >
                Salir
              </button>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 640px) {
            .hidden-mobile { display: none !important; }
          }
        `}</style>
      </nav>
      {showHelp && <HelpModal role={profile.role} onClose={() => setShowHelp(false)} />}
    </>
  )
}
