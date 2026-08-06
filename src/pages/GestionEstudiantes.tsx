import { useState, useEffect, useCallback, useMemo } from 'react'
import { Navbar } from '../components/Navbar'
import { supabase } from '../lib/supabaseClient'
import type { Student } from '../lib/supabaseClient'
import { useToast } from '../context/ToastContext'
import { GRADOS, DIVISIONES } from '../schemas/studentSchema'

const BATCH = 1000

// Trae todo el resultado paginando por lotes reales recibidos (no por el
// tamaño de lote pedido) — mismo patrón robusto que ya usa Planillas.tsx
// para exportar, así no se pierde nada si el proyecto de Supabase tiene
// un "Max Rows" distinto al lote pedido.
async function fetchAll<T>(build: (offset: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null; count: number | null }>): Promise<T[]> {
  let offset = 0
  let all: T[] = []
  let total = Infinity
  while (all.length < total) {
    const { data, error, count } = await build(offset)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    if (count != null) total = count
    if (rows.length === 0) break
    all = all.concat(rows)
    offset += rows.length
  }
  return all
}

interface EditForm {
  nombre: string
  apellido: string
  grado: string
  division: string
}

interface EditModal {
  student: Student
  form: EditForm
}

export function GestionEstudiantes() {
  const { toastSuccess, toastError } = useToast()

  const [students, setStudents] = useState<Student[]>([])
  const [emailByProfileId, setEmailByProfileId] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editModal, setEditModal] = useState<EditModal | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [studentsAll, profilesAll] = await Promise.all([
        fetchAll<Student>((offset) =>
          supabase
            .from('students')
            .select('*', { count: 'exact' })
            .order('apellido')
            .order('nombre')
            .range(offset, offset + BATCH - 1)
        ),
        fetchAll<{ id: string; email: string }>((offset) =>
          supabase
            .from('profiles')
            .select('id, email', { count: 'exact' })
            .eq('role', 'estudiante')
            .range(offset, offset + BATCH - 1)
        ),
      ])
      setStudents(studentsAll)
      const map: Record<string, string> = {}
      for (const p of profilesAll) map[p.id] = p.email
      setEmailByProfileId(map)
    } catch {
      toastError('Error al cargar los alumnos')
    }
    setLoading(false)
  }, [toastError])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) =>
      s.nombre.toLowerCase().includes(q) ||
      s.apellido.toLowerCase().includes(q) ||
      (emailByProfileId[s.profile_id] ?? '').toLowerCase().includes(q)
    )
  }, [students, search, emailByProfileId])

  // Agrupado curso -> división, en el orden curricular (no alfabético), con
  // los alumnos de cada división ordenados alfabéticamente por apellido.
  const grouped = useMemo(() => {
    const byGrado = new Map<string, Map<string, Student[]>>()
    for (const s of filtered) {
      if (!byGrado.has(s.grado)) byGrado.set(s.grado, new Map())
      const byDivision = byGrado.get(s.grado)!
      if (!byDivision.has(s.division)) byDivision.set(s.division, [])
      byDivision.get(s.division)!.push(s)
    }

    const sortStudents = (list: Student[]) =>
      [...list].sort((a, b) =>
        a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es')
      )

    const gradoOrder = [...GRADOS, ...[...byGrado.keys()].filter((g) => !GRADOS.includes(g)).sort()]

    return gradoOrder
      .filter((grado) => byGrado.has(grado))
      .map((grado) => {
        const byDivision = byGrado.get(grado)!
        const divisionOrder = [...DIVISIONES, ...[...byDivision.keys()].filter((d) => !DIVISIONES.includes(d)).sort()]
        const divisiones = divisionOrder
          .filter((division) => byDivision.has(division))
          .map((division) => ({ division, students: sortStudents(byDivision.get(division)!) }))
        const total = divisiones.reduce((acc, d) => acc + d.students.length, 0)
        return { grado, total, divisiones }
      })
  }, [filtered])

  const handleOpenEdit = (student: Student) => {
    setEditModal({ student, form: { nombre: student.nombre, apellido: student.apellido, grado: student.grado, division: student.division } })
  }

  const handleSaveEdit = async () => {
    if (!editModal) return
    setEditSaving(true)
    const { form: f, student: s } = editModal

    const { data: studentData, error } = await supabase
      .from('students')
      .update({ ...f, updated_at: new Date().toISOString() })
      .eq('id', s.id)
      .select()
    if (error) {
      toastError(`Error: ${error.message}`)
      setEditSaving(false)
      return
    }
    if (!studentData || studentData.length === 0) {
      toastError('No se pudo guardar (sin permisos).')
      setEditSaving(false)
      return
    }

    // Mantener consistencia — actualizar snapshots históricos en llegadas_tarde
    const { error: llegadasError } = await supabase.from('llegadas_tarde').update({
      nombre: f.nombre,
      apellido: f.apellido,
      grado: f.grado,
      division: f.division,
    }).eq('student_id', s.id)

    if (llegadasError) {
      toastError(`Datos guardados, pero falló la sincronización del historial: ${llegadasError.message}`)
      setEditSaving(false)
      return
    }

    setStudents((prev) => prev.map((st) => st.id === s.id ? { ...st, ...f } : st))
    toastSuccess(`Datos de ${s.apellido}, ${s.nombre} actualizados`)
    setEditModal(null)
    setEditSaving(false)
  }

  const totalCount = students.length
  const filteredCount = filtered.length
  const isSearching = search.trim().length > 0

  return (
    <>
      <Navbar />
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">🎓 Gestión de Estudiantes</h1>
          <p className="page-subtitle">
            {loading
              ? 'Cargando...'
              : isSearching
                ? `${filteredCount.toLocaleString('es-AR')} de ${totalCount.toLocaleString('es-AR')} alumno${totalCount !== 1 ? 's' : ''}`
                : `${totalCount.toLocaleString('es-AR')} alumno${totalCount !== 1 ? 's' : ''} registrado${totalCount !== 1 ? 's' : ''} en el sistema`}
          </p>
        </div>

        {/* Buscador */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              id="buscar-alumno-gestion"
              type="text"
              className="input-base"
              placeholder="🔍 Buscar por nombre, apellido o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Listado agrupado por curso y división */}
        {loading ? (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
          </div>
        ) : grouped.length === 0 ? (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
            <div style={{ fontWeight: 600, color: '#94a3b8' }}>
              {isSearching ? 'Sin resultados' : 'Todavía no hay alumnos registrados'}
            </div>
            {isSearching && (
              <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>No hay alumnos que coincidan con "{search}".</div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {grouped.map(({ grado, total, divisiones }) => (
              <div key={grado} className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9' }}>{grado}</h2>
                  <span className="badge badge-primary">{total} alumno{total !== 1 ? 's' : ''}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {divisiones.map(({ division, students: divStudents }) => (
                    <div key={division}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          División {division}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>— {divStudents.length} alumno{divStudents.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="panel" style={{ overflow: 'hidden' }}>
                        {divStudents.map((s, i) => (
                          <div
                            key={s.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              padding: '0.65rem 0.875rem',
                              borderTop: i === 0 ? 'none' : '1px solid rgba(148,163,184,0.07)',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.875rem' }}>
                                {s.apellido}, {s.nombre}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {emailByProfileId[s.profile_id] ?? '—'}
                              </div>
                            </div>
                            <button
                              id={`btn-editar-alumno-${s.id}`}
                              onClick={() => handleOpenEdit(s)}
                              className="btn btn-secondary btn-sm"
                              title="Editar datos del alumno"
                              style={{ flexShrink: 0, fontSize: '0.75rem', padding: '0.3rem 0.55rem' }}
                            >✏️</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal editar datos del alumno ── */}
      {editModal && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setEditModal(null) }}
        >
          <div className="modal-card animate-fade-in" style={{ maxWidth: 440, padding: '2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.4rem' }}>✏️ Editar datos del alumno</h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
              {emailByProfileId[editModal.student.profile_id] ?? ''}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.35rem' }}>Nombre</label>
                  <input className="input-base" value={editModal.form.nombre} onChange={(e) => setEditModal((m) => m ? { ...m, form: { ...m.form, nombre: e.target.value } } : null)} maxLength={60} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.35rem' }}>Apellido</label>
                  <input className="input-base" value={editModal.form.apellido} onChange={(e) => setEditModal((m) => m ? { ...m, form: { ...m.form, apellido: e.target.value } } : null)} maxLength={60} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.35rem' }}>Año</label>
                  <select className="input-base" value={editModal.form.grado} onChange={(e) => setEditModal((m) => m ? { ...m, form: { ...m.form, grado: e.target.value } } : null)}>
                    <option value="">Seleccioná...</option>
                    {GRADOS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.35rem' }}>División</label>
                  <select className="input-base" value={editModal.form.division} onChange={(e) => setEditModal((m) => m ? { ...m, form: { ...m.form, division: e.target.value } } : null)}>
                    <option value="">Seleccioná...</option>
                    {DIVISIONES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button id="btn-guardar-edicion-alumno" onClick={handleSaveEdit} disabled={editSaving} className="btn btn-primary" style={{ flex: 1, fontWeight: 700 }}>
                {editSaving ? <><div className="spinner" /> Guardando...</> : '💾 Guardar cambios'}
              </button>
              <button onClick={() => setEditModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
