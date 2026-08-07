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
  'manual_retroactivo': 'badge-warning',
}

const METODO_LABEL: Record<string, string> = {
  'qr': 'QR',
  'manual': 'Manual',
  'manual_retroactivo': 'Retroactivo',
}

const PAGE_SIZE = 500
const EXPORT_BATCH_SIZE = 1000
const EXPORT_WARNING_THRESHOLD = 20000

export function Planillas() {
  const { toastError, toastWarning } = useToast()

  const [llegadas, setLlegadas] = useState<LlegadaTarde[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [filtroTurno, setFiltroTurno] = useState('')
  const [filtroGrado, setFiltroGrado] = useState('')
  const [filtroDivision, setFiltroDivision] = useState('')

  // Query base con los filtros actuales — se reusa tanto para paginar en
  // pantalla como para traer TODO el filtro al exportar. El orden incluye
  // 'id' como desempate final para que .range() sea determinístico (sin
  // eso, filas con la misma fecha+hora podrían duplicarse o saltearse
  // entre páginas).
  const buildQuery = useCallback(() => {
    let query = supabase
      .from('llegadas_tarde')
      .select('*', { count: 'exact' })
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
      .order('id', { ascending: true })

    if (filtroFechaDesde) query = query.gte('fecha', filtroFechaDesde)
    if (filtroFechaHasta) query = query.lte('fecha', filtroFechaHasta)
    if (filtroTurno) query = query.eq('turno', filtroTurno)
    if (filtroGrado) query = query.eq('grado', filtroGrado)
    if (filtroDivision) query = query.eq('division', filtroDivision)

    return query
  }, [filtroFechaDesde, filtroFechaHasta, filtroTurno, filtroGrado, filtroDivision])

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    const { data, error, count } = await buildQuery().range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      toastError('Error al cargar los datos')
    } else {
      const rows = (data ?? []) as LlegadaTarde[]
      setLlegadas((prev) => (append ? [...prev, ...rows] : rows))
      setTotalCount(count ?? 0)
    }

    if (append) setLoadingMore(false)
    else setLoading(false)
  }, [buildQuery, toastError])

  // Cambió algún filtro -> volver a la primera página
  useEffect(() => {
    fetchPage(0, false)
  }, [fetchPage])

  const handleLoadMore = () => {
    fetchPage(llegadas.length, true)
  }

  const fetchAllForExport = useCallback(async (): Promise<LlegadaTarde[]> => {
    let offset = 0
    let all: LlegadaTarde[] = []
    let total = Infinity
    // Avanza por la cantidad REAL de filas recibidas (no por el tamaño de
    // lote pedido) y corta recién cuando junta el total exacto que reportó
    // la propia query — así no se pierde nada aunque el servidor devuelva
    // lotes más chicos de lo pedido (ej. si el proyecto de Supabase tiene
    // un "Max Rows" distinto a EXPORT_BATCH_SIZE).
    while (all.length < total) {
      const { data, error, count } = await buildQuery().range(offset, offset + EXPORT_BATCH_SIZE - 1)
      if (error) throw error
      const rows = (data ?? []) as LlegadaTarde[]
      if (count != null) total = count
      if (rows.length === 0) break
      all = all.concat(rows)
      offset += rows.length
    }
    return all
  }, [buildQuery])

  const handleExport = async () => {
    if (totalCount === 0) {
      toastError('No hay datos para exportar')
      return
    }
    setExporting(true)
    try {
      if (totalCount > EXPORT_WARNING_THRESHOLD) {
        toastWarning(`Exportando ${totalCount.toLocaleString('es-AR')} registros, puede tardar unos segundos...`)
      }
      const all = await fetchAllForExport()
      exportarLlegadasExcel(all)
    } catch {
      toastError('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  const formatFecha = (fecha: string) => {
    const [y, m, d] = fecha.split('-')
    return `${d}/${m}/${y}`
  }

  const formatHora = (hora: string) => hora.slice(0, 5)

  const hasMore = llegadas.length < totalCount

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">📊 Planillas de Llegadas</h1>
            <p className="page-subtitle">
              {loading
                ? 'Cargando...'
                : `${llegadas.length.toLocaleString('es-AR')} de ${totalCount.toLocaleString('es-AR')} registro${totalCount !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            id="btn-exportar-excel"
            onClick={handleExport}
            className="btn btn-success"
            disabled={loading || exporting || totalCount === 0}
          >
            {exporting ? <><div className="spinner" /> Preparando export...</> : '⬇ Exportar a Excel'}
          </button>
        </div>

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
                          {METODO_LABEL[l.metodo] ?? l.metodo}
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

          {!loading && hasMore && (
            <div style={{ padding: '1.25rem', textAlign: 'center', borderTop: '1px solid rgba(148,163,184,0.08)' }}>
              <button
                id="btn-cargar-mas"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="btn btn-secondary btn-sm"
              >
                {loadingMore
                  ? <><div className="spinner" /> Cargando...</>
                  : `Cargar más (${llegadas.length.toLocaleString('es-AR')} de ${totalCount.toLocaleString('es-AR')})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
