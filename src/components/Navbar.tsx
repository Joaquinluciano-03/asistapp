import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { HelpModal } from './HelpModal'

const ROLE_LABEL: Record<string, string> = {
  estudiante: 'Estudiante',
  preceptor: 'Preceptor',
  admin: 'Admin',
  superadmin: 'Superadmin',
}

const ROLE_BADGE: Record<string, string> = {
  estudiante: 'badge-primary',
  preceptor: 'badge-success',
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const clock = useDigitalClock()

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Cerrar menú al cambiar ruta
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const handleSignOut = async () => {
    setMenuOpen(false)
    await signOut()
    toastSuccess('Sesión cerrada correctamente')
    navigate('/login')
  }

  if (!profile) return null

  const isAdmin = profile.role === 'admin' || profile.role === 'superadmin' || profile.role === 'preceptor'

  interface AdminLink { to: string; label: string; exact?: boolean; roles?: string[] }
  const adminLinks: AdminLink[] = [
    { to: '/admin', label: '🏠 Inicio', exact: true },
    { to: '/admin/escanear', label: '📷 Escanear QR' },
    { to: '/admin/planillas', label: '📋 Planillas' },
    { to: '/admin/carga-retroactiva', label: '🕓 Carga retroactiva' },
    { to: '/admin/alumnos', label: '🎓 Alumnos' },
    // Usuarios: preceptor no tiene nada que hacer ahí (gestiona alumnos en /admin/alumnos)
    { to: '/admin/usuarios', label: '👥 Usuarios', roles: ['admin', 'superadmin'] },
  ].filter((link) => !link.roles || link.roles.includes(profile.role))

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to
    return location.pathname.startsWith(to) && to !== '/admin'
  }

  return (
    <>
      <nav style={{ background: 'rgba(8,13,28,0.92)', backdropFilter: 'blur(20px) saturate(150%)', WebkitBackdropFilter: 'blur(20px) saturate(150%)', borderBottom: '1px solid rgba(148,163,184,0.1)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.25rem' }}>

          {/* ── Fila principal ── */}
          <div style={{ display: 'flex', alignItems: 'center', height: '60px', gap: '0.75rem' }}>

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/favicon.ico" alt="Logo Don Orione" style={{ width: 34, height: 34, objectFit: 'contain' }} />
              </div>
              <div className="navbar-brand-text">
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f1f5f9', lineHeight: 1.2, letterSpacing: '-0.02em' }}>AsistIDO</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', lineHeight: 1.2 }}>Don Orione Victoria</div>
              </div>
            </div>

            {/* Links de navegación (solo desktop, solo admin) */}
            {isAdmin && (
              <div className="navbar-links-desktop">
                {adminLinks.map((link) => {
                  const active = isActive(link.to, link.exact)
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      style={{
                        padding: '0.35rem 0.7rem',
                        borderRadius: 'var(--r-sm)',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        textDecoration: 'none',
                        transition: 'background 0.15s, color 0.15s',
                        color: active ? '#2dd4bf' : '#94a3b8',
                        background: active ? 'rgba(20,184,166,0.14)' : 'transparent',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(148,163,184,0.08)' }}
                      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                    >
                      {link.label.replace(/^[^\s]+\s/, '')}
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* ── Reloj digital (siempre visible para admin) ── */}
            {isAdmin && (
              <div style={{ textAlign: 'center', lineHeight: 1.2, userSelect: 'none', flexShrink: 0 }}>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, letterSpacing: '0.08em', color: '#ffffff', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 18px rgba(45,212,191,0.5)' }}>
                  {clock.hh}<span style={{ animation: 'clockBlink 1s step-end infinite', display: 'inline-block', opacity: 0.7 }}>:</span>{clock.mm}<span style={{ animation: 'clockBlink 1s step-end infinite', display: 'inline-block', opacity: 0.7 }}>:</span>{clock.ss}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#e2e8f0', fontWeight: 700, textTransform: 'capitalize', letterSpacing: '0.04em', marginTop: '0.05rem' }}>{clock.fecha}</div>
              </div>
            )}

            {/* Botones desktop (solo admin) */}
            {isAdmin && (
              <div className="navbar-actions-desktop">
                <span className={`badge ${ROLE_BADGE[profile.role]}`} style={{ fontSize: '0.62rem' }}>{ROLE_LABEL[profile.role]}</span>
                <button onClick={() => setShowHelp(true)} className="btn btn-secondary btn-sm" style={{ background: '#f1f5f9', color: '#0f172a', fontWeight: 600 }}>Ayuda</button>
                <button onClick={handleSignOut} className="btn btn-secondary btn-sm" id="btn-signout">Salir</button>
              </div>
            )}

            {/* Botones desktop (estudiante) */}
            {!isAdmin && (
              <div className="navbar-actions-desktop">
                <button onClick={() => setShowHelp(true)} className="btn btn-secondary btn-sm" style={{ background: '#f1f5f9', color: '#0f172a', fontWeight: 600 }}>Ayuda</button>
                <button onClick={handleSignOut} className="btn btn-secondary btn-sm" id="btn-signout">Salir</button>
              </div>
            )}

            {/* ── Hamburguesa (solo mobile) ── */}
            <div ref={menuRef} className="navbar-hamburger-wrap">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 'var(--r-sm)', width: 38, height: 38, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0 }}
                aria-label="Menú"
              >
                <span style={{ display: 'block', width: 18, height: 2, background: menuOpen ? '#2dd4bf' : '#94a3b8', borderRadius: 2, transition: 'all 0.2s', transform: menuOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none' }} />
                <span style={{ display: 'block', width: 18, height: 2, background: menuOpen ? 'transparent' : '#94a3b8', borderRadius: 2, transition: 'all 0.2s' }} />
                <span style={{ display: 'block', width: 18, height: 2, background: menuOpen ? '#2dd4bf' : '#94a3b8', borderRadius: 2, transition: 'all 0.2s', transform: menuOpen ? 'rotate(-45deg) translate(4px, -4px)' : 'none' }} />
              </button>

              {/* Dropdown menu */}
              {menuOpen && (
                <div
                  className="animate-fade-in"
                  style={{ position: 'absolute', top: '56px', right: '1rem', width: 230, background: 'rgba(10,16,35,0.98)', border: '1px solid rgba(99,148,255,0.16)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', backdropFilter: 'blur(20px) saturate(150%)', WebkitBackdropFilter: 'blur(20px) saturate(150%)', zIndex: 200, overflow: 'hidden' }}
                >
                  {/* Info usuario */}
                  <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid rgba(99,148,255,0.1)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.email}</div>
                      <span className={`badge ${ROLE_BADGE[profile.role]}`} style={{ fontSize: '0.6rem', marginTop: '0.2rem' }}>{ROLE_LABEL[profile.role]}</span>
                    </div>
                  </div>

                  {/* Links admin */}
                  {isAdmin && (
                    <div style={{ padding: '0.5rem' }}>
                      {adminLinks.map((link) => (
                        <Link
                          key={link.to}
                          to={link.to}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.65rem 0.75rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            textDecoration: 'none',
                            color: isActive(link.to, link.exact) ? '#2dd4bf' : '#cbd5e1',
                            background: isActive(link.to, link.exact) ? 'rgba(20,184,166,0.14)' : 'transparent',
                            transition: 'background 0.15s',
                          }}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Acciones */}
                  <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(99,148,255,0.08)' }}>
                    <button
                      onClick={() => { setMenuOpen(false); setShowHelp(true) }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 500, color: '#cbd5e1', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      📖 Ayuda
                    </button>
                    <button
                      onClick={handleSignOut}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 500, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      🚪 Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <style>{`
          /* Desktop: mostrar links y acciones */
          .navbar-links-desktop { display: flex; gap: 0.2rem; }
          .navbar-actions-desktop { display: flex; align-items: center; gap: 0.5rem; }
          .navbar-hamburger-wrap { display: none; position: relative; }
          .navbar-brand-text { display: block; }

          /* Mobile: ocultar links desktop, mostrar hamburguesa */
          @media (max-width: 700px) {
            .navbar-links-desktop { display: none !important; }
            .navbar-actions-desktop { display: none !important; }
            .navbar-hamburger-wrap { display: block; }
            .navbar-brand-text { display: none; }
          }
        `}</style>
      </nav>

      {showHelp && <HelpModal role={profile.role} onClose={() => setShowHelp(false)} />}
    </>
  )
}
