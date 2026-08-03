import { useState, useEffect } from 'react'
import { Navbar } from '../components/Navbar'
import { supabase } from '../lib/supabaseClient'
import type { Student } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export function AdminManual() {
  const { user, profile } = useAuth()
  const { toastSuccess, toastError, toastWarning } = useToast()

  const [search, setSearch] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Student | null>(null)
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length < 2) {
      setStudents([])
      return
    }

    const timeout = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('students')
        .select('*')
        .or(`apellido.ilike.%${trimmed}%,nombre.ilike.%${trimmed}%`)
        .order('apellido')
        .limit(20)
      setStudents((data ?? []) as Student[])
      setSearching(false)
    }, 350)

    return () => clearTimeout(timeout)
  }, [search])

  const handleSelect = (s: Student) => {
    setSelected(s)
    setSearch('')
    setStudents([])
  }

  const handleRegister = async () => {
    if (!selected || !user || !profile) return
    setRegistering(true)

    const { error } = await supabase.from('llegadas_tarde').insert({
      student_id: selected.id,
      metodo: 'manual',
      registrado_por: user.id,
      registrado_por_email: profile.email,
    })

    if (error) {
      if (error.code === '23505') {
        toastWarning(`Ya se registró la llegada tarde de ${selected.nombre} ${selected.apellido} hoy.`)
      } else {
        toastError(`Error al registrar: ${error.message}`)
      }
    } else {
      toastSuccess(`✅ Llegada registrada para ${selected.nombre} ${selected.apellido}`)
      setSelected(null)
    }

    setRegistering(false)
  }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 600 }}>
        <div className="page-header">
          <h1 className="page-title">✍️ Carga Manual</h1>
          <p className="page-subtitle">
            Buscá al alumno por nombre o apellido y registrá su llegada tarde manualmente.
          </p>
        </div>

        {/* Search */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', position: 'relative' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="buscar-alumno">Buscar alumno</label>
            <div style={{ position: 'relative' }}>
              <input
                id="buscar-alumno"
                type="text"
                className="input-base"
                placeholder="Escribí apellido o nombre..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setSelected(null)
                }}
                autoComplete="off"
              />
              {searching && (
                <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
                  <div className="spinner" />
                </div>
              )}
            </div>
          </div>

          {/* Dropdown */}
          {students.length > 0 && (
            <div
              style={{
                marginTop: '0.5rem',
                background: '#1e293b',
                border: '1px solid rgba(148,163,184,0.15)',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                maxHeight: '240px',
                overflowY: 'auto',
              }}
            >
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#cbd5e1',
                    fontSize: '0.875rem',
                    transition: 'background 0.15s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(148,163,184,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  }}
                >
                  <span>
                    <strong>{s.apellido}</strong>, {s.nombre}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {s.grado} — Div. {s.division}
                  </span>
                </button>
              ))}
            </div>
          )}

          {search.trim().length >= 2 && students.length === 0 && !searching && (
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.75rem' }}>
              No se encontraron alumnos para "{search}"
            </p>
          )}
        </div>

        {/* Selected student */}
        {selected && (
          <div className="glass-card animate-fade-in" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Alumno seleccionado
            </h3>

            <div
              style={{
                background: 'rgba(15,23,42,0.5)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { label: 'Nombre', value: selected.nombre },
                  { label: 'Apellido', value: selected.apellido },
                  { label: 'Grado', value: selected.grado },
                  { label: 'División', value: selected.division },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9', marginTop: '0.2rem' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                id="btn-registrar-manual"
                onClick={handleRegister}
                disabled={registering}
                className="btn btn-success"
                style={{ flex: 1 }}
              >
                {registering ? (
                  <><div className="spinner" /> Registrando...</>
                ) : (
                  '✅ Registrar llegada tarde'
                )}
              </button>
              <button
                onClick={() => setSelected(null)}
                disabled={registering}
                className="btn btn-secondary"
                id="btn-limpiar-seleccion"
              >
                Limpiar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
