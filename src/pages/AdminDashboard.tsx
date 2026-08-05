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
  porDia: { fecha: string; count: number }[]
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

  const cards = [
    { to: '/admin/escanear', icon: '📷', title: 'Escanear QR', desc: 'Leé el QR del alumno para registrar su llegada tarde.', color: '#2563eb', id: 'card-escanear' },
    { to: '/admin/planillas', icon: '📊', title: 'Planillas', desc: 'Historial de llegadas tarde, filtros y exportación a Excel.', color: '#0891b2', id: 'card-planillas' },
    { to: '/admin/usuarios', icon: '👥', title: 'Usuarios', desc: 'Administrá roles: estudiante, admin y superadmin.', color: '#059669', id: 'card-usuarios' },
  ]

  const porDiaLabeled = metricas
    ? metricas.porDia.map(({ fecha, count }) => {
        const d = parseFecha(fecha)
        return { dia: `${DIAS_ES[d.getDay()]} ${d.getDate()}`, count }
      })
    : []
  const maxDia = Math.max(...porDiaLabeled.map((d) => d.count), 1)
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
                { key: 'hoy', icon: '📅', label: 'Hoy', subtitle: formatHoy(metricas.hoy.fecha), data: metricas.hoy, color: '#f59e0b' },
                { key: 'semana', icon: '🗓️', label: 'Esta semana', subtitle: formatRango(metricas.semana.desde, metricas.semana.hasta), data: metricas.semana, color: '#3b82f6' },
                { key: 'mes', icon: '📆', label: 'Este mes', subtitle: formatMes(metricas.mes.desde), data: metricas.mes, color: '#8b5cf6' },
              ].map((p) => (
                <div key={p.key} className="stat-card" style={{ borderTop: `3px solid ${p.color}40` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>{p.icon}</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textAlign: 'right' }}>{p.subtitle}</span>
                  </div>
                  <div className="stat-value" style={{ color: p.color, fontSize: '1.75rem' }}>{p.data.total}</div>
                  <div className="stat-label">{p.label}</div>
                  <div style={{ display: 'flex', gap: '0.875rem', marginTop: '0.6rem', fontSize: '0.75rem', fontWeight: 600 }}>
                    <span style={{ color: '#4ade80' }}>🌅 {p.data.manana}</span>
                    <span style={{ color: '#a78bfa' }}>🌆 {p.data.tarde}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Gráfico de tendencia — últimos 7 días corridos (no confundir con "Esta semana", que es lunes a hoy) */}
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                📊 Tendencia — últimos 7 días
              </h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '100px' }}>
                {porDiaLabeled.map((d) => (
                  <div key={d.dia} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>{d.count || ''}</span>
                    <div
                      style={{
                        width: '100%',
                        background: d.count > 0 ? 'linear-gradient(180deg, #3b82f6, #1d4ed8)' : 'rgba(51,65,85,0.5)',
                        borderRadius: '4px 4px 0 0',
                        height: `${Math.max((d.count / maxDia) * 80, d.count > 0 ? 8 : 4)}px`,
                        transition: 'height 0.3s ease',
                        boxShadow: d.count > 0 ? '0 0 8px rgba(59,130,246,0.3)' : 'none',
                      }}
                    />
                    <span style={{ fontSize: '0.6rem', color: '#64748b', textAlign: 'center', lineHeight: 1.2 }}>{d.dia}</span>
                  </div>
                ))}
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
