import { useState, useCallback, useRef } from 'react'
import { Navbar } from '../components/Navbar'
import { supabase } from '../lib/supabaseClient'
import type { Student } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getFechaArgentina } from '../utils/turno'

interface CargaReciente {
  id: string
  nombre: string
  apellido: string
  fecha: string
  turno: 'mañana' | 'tarde'
}

export function CargaRetroactiva() {
  const { user, profile } = useAuth()
  const { toastSuccess, toastError, toastWarning } = useToast()

  const hoy = getFechaArgentina()

  const [student, setStudent] = useState<Student | null>(null)
  const [fecha, setFecha] = useState(hoy)
  const [turno, setTurno] = useState<'mañana' | 'tarde'>('mañana')
  const [registrando, setRegistrando] = useState(false)
  const [recientes, setRecientes] = useState<CargaReciente[]>([])

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Student[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    const trimmed = value.trim()
    if (trimmed.length < 2) { setSearchResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('students')
        .select('*')
        .or(`apellido.ilike.%${trimmed}%,nombre.ilike.%${trimmed}%`)
        .order('apellido')
        .limit(15)
      setSearchResults((data ?? []) as Student[])
      setSearching(false)
    }, 300)
  }, [])

  const handleSelectStudent = (s: Student) => {
    setSearch('')
    setSearchResults([])
    setStudent(s)
  }

  const handleRegistrar = async () => {
    if (!student || !user || !profile) return
    if (fecha > hoy) { toastError('No se puede cargar una fecha futura.'); return }

    setRegistrando(true)

    const { data: existente } = await supabase
      .from('llegadas_tarde')
      .select('id')
      .eq('student_id', student.id)
      .eq('fecha', fecha)
      .eq('turno', turno)
      .limit(1)

    if (existente && existente.length > 0) {
      toastWarning(`${student.nombre} ${student.apellido} ya tiene una llegada registrada ese día en el turno ${turno}.`)
      setRegistrando(false)
      return
    }

    const { error } = await supabase.from('llegadas_tarde').insert({
      student_id: student.id,
      fecha,
      turno,
      metodo: 'manual_retroactivo',
      registrado_por: user.id,
      registrado_por_email: profile.email,
    })

    if (error) {
      if (error.code === '23505') {
        toastWarning(`${student.nombre} ${student.apellido} ya tiene una llegada registrada ese día en el turno ${turno}.`)
      } else {
        toastError(`Error al registrar: ${error.message}`)
      }
      setRegistrando(false)
      return
    }

    toastSuccess(`Cargada — ${student.nombre} ${student.apellido} (${fecha}, turno ${turno})`)
    setRecientes((prev) => [{ id: `${student.id}-${fecha}-${turno}-${Date.now()}`, nombre: student.nombre, apellido: student.apellido, fecha, turno }, ...prev].slice(0, 8))
    setStudent(null)
    setRegistrando(false)
    searchInputRef.current?.focus()
  }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 className="page-title">🕓 Carga retroactiva</h1>
          <p className="page-subtitle">Registrá llegadas tarde de fechas pasadas — para asentar datos tomados en papel si el sistema o la conexión a internet estuvieron caídos.</p>
        </div>

        <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)' }}>
          <p style={{ margin: 0, fontSize: '0.83rem', color: '#fde68a', lineHeight: 1.6 }}>
            ⚠️ Esta carga queda identificada como <strong>"Retroactivo"</strong> en Planillas y en las exportaciones, para distinguirla de un registro tomado en el momento con QR. No se puede cargar una fecha futura.
          </p>
        </div>

        {/* Buscador de alumno */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            1. Buscar alumno
          </div>

          {student ? (
            <div className="panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>{student.apellido}, {student.nombre}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{student.grado} — Div. {student.division}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setStudent(null)}>Cambiar</button>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                <input
                  ref={searchInputRef}
                  id="buscar-alumno-retroactivo"
                  type="text"
                  className="input-base"
                  placeholder="Escribí apellido o nombre..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
                {searching && (
                  <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
                    <div className="spinner" />
                  </div>
                )}
              </div>
              {searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '220px', overflowY: 'auto' }}>
                  {searchResults.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStudent(s)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', background: 'rgba(6,15,35,0.55)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: '#cbd5e1', fontSize: '0.875rem', transition: 'background 0.15s, border-color 0.15s', textAlign: 'left' }}
                      onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(13,148,136,0.16)'; b.style.borderColor = 'rgba(45,212,191,0.35)' }}
                      onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(6,15,35,0.55)'; b.style.borderColor = 'rgba(148,163,184,0.08)' }}
                    >
                      <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{s.apellido}, {s.nombre}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.grado} — Div. {s.division}</span>
                    </button>
                  ))}
                </div>
              )}
              {search.trim().length >= 2 && searchResults.length === 0 && !searching && (
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.5rem 0 0' }}>Sin resultados para "{search}"</p>
              )}
            </>
          )}
        </div>

        {/* Fecha y turno */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            2. Fecha y turno de la llegada
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="fecha-retroactiva" style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>Fecha</label>
              <input
                id="fecha-retroactiva"
                type="date"
                className="input-base"
                value={fecha}
                max={hoy}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>Turno</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${turno === 'mañana' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setTurno('mañana')}
                >
                  🌅 Mañana
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${turno === 'tarde' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setTurno('tarde')}
                >
                  🌇 Tarde
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          id="btn-registrar-retroactivo"
          className="btn btn-success"
          style={{ width: '100%', marginBottom: '1.5rem' }}
          disabled={!student || registrando}
          onClick={handleRegistrar}
        >
          {registrando ? <><div className="spinner" /> Registrando...</> : '✅ Registrar llegada retroactiva'}
        </button>

        {/* Cargados en esta sesión */}
        {recientes.length > 0 && (
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Cargados en esta sesión ({recientes.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {recientes.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(6,15,35,0.4)', borderRadius: 'var(--r-sm)', fontSize: '0.8rem' }}>
                  <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{r.apellido}, {r.nombre}</span>
                  <span style={{ color: '#64748b' }}>{r.fecha} — {r.turno}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
