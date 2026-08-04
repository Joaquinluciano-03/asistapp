import { useState, useEffect, useCallback } from 'react'
import { Navbar } from '../components/Navbar'
import { supabase } from '../lib/supabaseClient'
import type { LlegadaTarde } from '../lib/supabaseClient'
import { exportarLlegadasExcel } from '../utils/exportExcel'
import { useToast } from '../context/ToastContext'
import { GRADOS, DIVISIONES } from '../schemas/studentSchema'

const TURNO_BADGE: Record<string, string> = {
  'mañana': 'badge-primary',
  'tarde': 'badge-warning',
}

const METODO_BADGE: Record<string, string> = {
  'qr': 'badge-success',
  'manual': 'badge-purple',
}

export function Planillas() {
  const { toastError } = useToast()

  const [llegadas, setLlegadas] = useState<LlegadaTarde[]>([])
  const [loading, setLoading] = useState(true)

  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [filtroTurno, setFiltroTurno] = useState('')
  const [filtroGrado, setFiltroGrado] = useState('')
  const [filtroDivision, setFiltroDivision] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('llegadas_tarde')
      .select('*')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })

    if (filtroFechaDesde) query = query.gte('fecha', filtroFechaDesde)
    if (filtroFechaHasta) query = query.lte('fecha', filtroFechaHasta)
    if (filtroTurno) query = query.eq('turno', filtroTurno)
    if (filtroGrado) query = query.eq('grado', filtroGrado)
    if (filtroDivision) query = query.eq('division', filtroDivision)

    const { data, error } = await query.limit(500)
    if (error) {
      toastError('Error al cargar los datos')
    } else {
      setLlegadas((data ?? []) as LlegadaTarde[])
    }
    setLoading(false)
  }, [filtroFechaDesde, filtroFechaHasta, filtroTurno, filtroGrado, filtroDivision, toastError])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExport = () => {
    if (llegadas.length === 0) {
      toastError('No hay datos para exportar')
      return
    }
    exportarLlegadasExcel(llegadas)
  }

  const formatFecha = (fecha: string) => {
    const [y, m, d] = fecha.split('-')
    return `${d}/${m}/${y}`
  }

  const formatHora = (hora: string) => hora.slice(0, 5)

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">📊 Planillas de Llegadas</h1>
            <p className="page-subtitle">
              {loading ? 'Cargando...' : `${llegadas.length} registro${llegadas.length !== 1 ? 's' : ''} encontrado${llegadas.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            id="btn-exportar-excel"
            onClick={handleExport}
            className="btn btn-success"
            disabled={loading || llegadas.length === 0}
          >
            ⬇ Exportar a Excel
          </button>
        </div>

        {/* GRAVE 7: Aviso cuando se alcanza el límite de 500 registros */}
        {!loading && llegadas.length >= 500 && (
          <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '0.75rem', padding: '0.75rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.83rem' }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>Se alcanzó el límite de 500 registros.</span>
            <span style={{ color: '#94a3b8' }}>El reporte y el Excel pueden estar incompletos. Acotá el rango de fechas para ver todos los datos.</span>
          </div>
        )}

        {/* Filters */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.75rem',
              alignItems: 'end',
            }}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="filtro-desde">Desde</label>
              <input
                id="filtro-desde"
                type="date"
                className="input-base"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="filtro-hasta">Hasta</label>
              <input
                id="filtro-hasta"
                type="date"
                className="input-base"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="filtro-turno">Turno</label>
              <select
                id="filtro-turno"
                className="input-base"
                value={filtroTurno}
                onChange={(e) => setFiltroTurno(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="mañana">Mañana</option>
                <option value="tarde">Tarde</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="filtro-grado">Grado</label>
              <select
                id="filtro-grado"
                className="input-base"
                value={filtroGrado}
                onChange={(e) => setFiltroGrado(e.target.value)}
              >
                <option value="">Todos</option>
                {GRADOS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="filtro-division">División</label>
              <select
                id="filtro-division"
                className="input-base"
                value={filtroDivision}
                onChange={(e) => setFiltroDivision(e.target.value)}
              >
                <option value="">Todas</option>
                {DIVISIONES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                setFiltroFechaDesde('')
                setFiltroFechaHasta('')
                setFiltroTurno('')
                setFiltroGrado('')
                setFiltroDivision('')
              }}
              className="btn btn-ghost btn-sm"
              id="btn-limpiar-filtros"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
              </div>
            ) : llegadas.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
                <div style={{ fontWeight: 600, color: '#94a3b8' }}>Sin registros</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  No hay llegadas tarde que coincidan con los filtros aplicados.
                </div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Apellido</th>
                    <th>Nombre</th>
                    <th>Grado</th>
                    <th>Div.</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Turno</th>
                    <th>Método</th>
                    <th>Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {llegadas.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600, color: '#f1f5f9' }}>{l.apellido}</td>
                      <td>{l.nombre}</td>
                      <td>{l.grado}</td>
                      <td>{l.division}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatFecha(l.fecha)}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatHora(l.hora)}</td>
                      <td>
                        <span className={`badge ${TURNO_BADGE[l.turno] ?? 'badge-primary'}`}>
                          {l.turno}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${METODO_BADGE[l.metodo] ?? 'badge-primary'}`}>
                          {l.metodo}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.registrado_por_email ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
