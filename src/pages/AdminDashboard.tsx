import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar'
import { supabase } from '../lib/supabaseClient'

interface PeriodMetrics {
  total: number
  manana: number
  tarde: number
}

interface DashboardMetricsRPC {
  hoy: PeriodMetrics & { fecha: string }
  semana: PeriodMetrics & { desde: string; hasta: string }
  mes: PeriodMetrics & { desde: string; hasta: string }
  porGrado: Record<string, number>
  porDia: { fecha: string; manana: number; tarde: number }[]
}

interface QuickCard {
  to: string
  icon: string
  title: string
  desc: string
  color: string
  id: string
  roles?: string[]
}

const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const parseFecha = (fecha: string) => new Date(fecha + 'T00:00:00')
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function formatHoy(fecha: string): string {
  return capitalizar(parseFecha(fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' }))
}

function formatRango(desde: string, hasta: string): string {
  const d1 = parseFecha(desde)
  const d2 = parseFecha(hasta)
  const mismoMes = d1.getMonth() === d2.getMonth()
  const mesHasta = d2.toLocaleDateString('es-AR', { month: 'short' })
  if (mismoMes) return `${d1.getDate()} al ${d2.getDate()} de ${mesHasta}`
  const mesDesde = d1.toLocaleDateString('es-AR', { month: 'short' })
  return `${d1.getDate()} ${mesDesde} al ${d2.getDate()} ${mesHasta}`
}

function formatMes(desde: string): string {
  return capitalizar(parseFecha(desde).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }))
}

export function AdminDashboard() {
  const { profile } = useAuth()
  const [metricas, setMetricas] = useState<DashboardMetricsRPC | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoadingMetrics(true)
      const { data, error } = await supabase.rpc('dashboard_metrics_periodos')
      if (!error && data) {
        setMetricas(data as DashboardMetricsRPC)
      }
      setLoadingMetrics(false)
    }
    fetchMetrics()
  }, [])

  const cards: QuickCard[] = [
    { to: '/admin/escanear', icon: '📷', title: 'Escanear QR', desc: 'Leé el QR del alumno para registrar su llegada tarde.', color: '#0d9488', id: 'card-escanear' },
    { to: '/admin/planillas', icon: '📊', title: 'Planillas', desc: 'Historial de llegadas tarde, filtros y exportación a Excel.', color: '#d97706', id: 'card-planillas' },
    { to: '/admin/carga-retroactiva', icon: '🕓', title: 'Carga retroactiva', desc: 'Registrá llegadas tarde de fechas pasadas.', color: '#7c3aed', id: 'card-carga-retroactiva' },
    { to: '/admin/alumnos', icon: '🎓', title: 'Alumnos', desc: 'Padrón de estudiantes por año y división.', color: '#0369a1', id: 'card-alumnos' },
    // Usuarios: preceptor no tiene nada que hacer ahí (gestiona alumnos en /admin/alumnos)
    { to: '/admin/usuarios', icon: '👥', title: 'Usuarios', desc: 'Administrá roles: estudiante, preceptor, admin y superadmin.', color: '#059669', id: 'card-usuarios', roles: ['admin', 'superadmin'] },
  ].filter((card) => !card.roles || card.roles.includes(profile?.role ?? ''))

  const porDiaLabeled = metricas
    ? metricas.porDia.map(({ fecha, manana, tarde }) => {
        const d = parseFecha(fecha)
        return { fecha, dia: `${DIAS_ES[d.getDay()]} ${d.getDate()}`, manana, tarde, total: manana + tarde }
      })
    : []
  const maxDia = Math.max(...porDiaLabeled.map((d) => d.total), 1)
  const topGrados = metricas
    ? Object.entries(metricas.porGrado).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : []

  return (
    <>
      <Navbar />
      <div className="page-container">
        {/* Bienvenida */}
        <div className="page-header">
          <h1 className="page-title">
            👋 Bienvenido,{' '}
            <span className="gradient-text">
              {profile?.role === 'superadmin' ? 'Superadmin' : profile?.role === 'preceptor' ? 'Preceptor' : 'Admin'}
            </span>
          </h1>
          <p className="page-subtitle">{profile?.email} — Seleccioná una función para comenzar.</p>
        </div>

        {/* Accesos rápidos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {cards.map((card) => (
            <Link key={card.to} to={card.to} id={card.id} style={{ textDecoration: 'none' }}>
              <div
                className="glass-card"
                style={{ padding: '1.5rem', transition: 'all 0.2s', cursor: 'pointer' }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'translateY(-4px)'; el.style.borderColor = `${card.color}40`; el.style.boxShadow = `0 8px 30px ${card.color}20` }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'translateY(0)'; el.style.borderColor = 'rgba(148,163,184,0.1)'; el.style.boxShadow = 'none' }}
              >
                <div style={{ width: 48, height: 48, borderRadius: '12px', background: `${card.color}20`, border: `1px solid ${card.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: '0.875rem' }}>
                  {card.icon}
                </div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.375rem' }}>{card.title}</h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>{card.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Métricas ─────────────────────────────── */}
        <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📈 Métricas
          </h2>
          {loadingMetrics && <div className="spinner" />}
        </div>

        {metricas && (
          <>
            {/* Tarjetas por período — hoy / semana / mes, cada una con su rango y su split por turno */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { key: 'hoy', icon: '📅', periodo: 'Hoy', subtitle: formatHoy(metricas.hoy.fecha), data: metricas.hoy, color: '#f59e0b' },
                { key: 'semana', icon: '🗓️', periodo: 'Esta semana', subtitle: formatRango(metricas.semana.desde, metricas.semana.hasta), data: metricas.semana, color: '#14b8a6' },
                { key: 'mes', icon: '📆', periodo: 'Este mes', subtitle: formatMes(metricas.mes.desde), data: metricas.mes, color: '#e11d48' },
              ].map((p) => (
                <div key={p.key} className="stat-card" style={{ borderTop: `3px solid ${p.color}40` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>{p.icon}</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textAlign: 'right' }}>{p.subtitle}</span>
                  </div>
                  <div className="stat-value" style={{ color: p.color, fontSize: '1.75rem' }}>{p.data.total}</div>
                  <div className="stat-label">Llegadas tarde — {p.periodo.toLowerCase()}</div>
                  <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                    <div>
                      <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>🌅 Turno mañana</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#4ade80', marginTop: '0.2rem' }}>{p.data.manana}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>🌆 Turno tarde</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fb7185', marginTop: '0.2rem' }}>{p.data.tarde}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Gráfico de tendencia — lunes a viernes de la semana actual, desglosado por turno (sin fin de semana) */}
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  📊 Tendencia en la semana
                </h3>
                <div style={{ display: 'flex', gap: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: 'linear-gradient(180deg,#2dd4bf,#0f766e)', display: 'inline-block' }} />
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Mañana</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: 'linear-gradient(180deg,#fb7185,#e11d48)', display: 'inline-block' }} />
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Tarde</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', height: '120px' }}>
                {porDiaLabeled.map((d) => {
                  const hasData = d.total > 0
                  const barH = hasData ? Math.max((d.total / maxDia) * 84, 10) : 4
                  const mananaH = hasData ? (d.manana / d.total) * barH : 0
                  const tardeH = hasData ? barH - mananaH : 0
                  return (
                    <div key={d.fecha} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>{hasData ? d.total : ''}</span>
                      {hasData ? (
                        <div style={{ width: '100%', maxWidth: 52, borderRadius: '4px 4px 0 0', overflow: 'hidden', boxShadow: '0 0 8px rgba(13,148,136,0.25)' }}>
                          {d.tarde > 0 && (
                            <div style={{ width: '100%', height: `${tardeH}px`, background: 'linear-gradient(180deg,#fb7185,#e11d48)', transition: 'height 0.3s ease' }} />
                          )}
                          {d.manana > 0 && (
                            <div style={{ width: '100%', height: `${mananaH}px`, background: 'linear-gradient(180deg,#2dd4bf,#0f766e)', transition: 'height 0.3s ease' }} />
                          )}
                        </div>
                      ) : (
                        <div style={{ width: '100%', maxWidth: 52, height: '4px', background: 'rgba(51,65,85,0.5)', borderRadius: '4px 4px 0 0' }} />
                      )}
                      <span style={{ fontSize: '0.64rem', color: '#64748b', textAlign: 'center', lineHeight: 1.2 }}>{d.dia}</span>
                      <span style={{ fontSize: '0.6rem', color: '#475569', textAlign: 'center' }}>
                        {hasData ? `${d.manana}M · ${d.tarde}T` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top cursos — del mes actual */}
            {topGrados.length > 0 && (
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                  🏫 Llegadas por curso — este mes (top {topGrados.length})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                  {topGrados.map(([curso, count], i) => (
                    <div key={curso} className="panel" style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '8px', background: i === 0 ? 'rgba(251,191,36,0.2)' : 'rgba(51,65,85,0.6)', border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.4)' : 'rgba(71,85,105,0.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: i === 0 ? '#fbbf24' : '#94a3b8', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.875rem' }}>{curso}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{count} llegadas</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
