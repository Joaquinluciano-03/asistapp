import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar'

export function AdminDashboard() {
  const { profile } = useAuth()

  const cards = [
    {
      to: '/admin/escanear',
      icon: '📷',
      title: 'Escanear QR',
      desc: 'Leé el código QR del alumno con la cámara para registrar su llegada tarde automáticamente.',
      color: '#2563eb',
      id: 'card-escanear',
    },
    {
      to: '/admin/manual',
      icon: '✍️',
      title: 'Carga Manual',
      desc: 'Registrá una llegada tarde buscando al alumno por nombre o apellido.',
      color: '#7c3aed',
      id: 'card-manual',
    },
    {
      to: '/admin/planillas',
      icon: '📊',
      title: 'Planillas',
      desc: 'Consultá el historial de llegadas tarde, aplicá filtros y exportá a Excel.',
      color: '#0891b2',
      id: 'card-planillas',
    },
    {
      to: '/admin/usuarios',
      icon: '👥',
      title: 'Usuarios',
      desc: 'Administrá roles de usuarios: cambiá entre estudiante y admin.',
      color: '#059669',
      id: 'card-usuarios',
    },
  ]

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">
            👋 Bienvenido,{' '}
            <span className="gradient-text">
              {profile?.role === 'superadmin' ? 'Superadmin' : 'Admin'}
            </span>
          </h1>
          <p className="page-subtitle">
            {profile?.email} — Seleccioná una función para comenzar.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {cards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              id={card.id}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="glass-card"
                style={{
                  padding: '1.75rem',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  display: 'block',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'translateY(-4px)'
                  el.style.borderColor = `${card.color}40`
                  el.style.boxShadow = `0 8px 30px ${card.color}20`
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'translateY(0)'
                  el.style.borderColor = 'rgba(148,163,184,0.1)'
                  el.style.boxShadow = 'none'
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '14px',
                    background: `${card.color}20`,
                    border: `1px solid ${card.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    marginBottom: '1rem',
                  }}
                >
                  {card.icon}
                </div>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#f1f5f9',
                    marginBottom: '0.5rem',
                  }}
                >
                  {card.title}
                </h3>
                <p style={{ fontSize: '0.825rem', color: '#64748b', lineHeight: 1.6 }}>
                  {card.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
