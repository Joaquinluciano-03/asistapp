import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabaseClient'
import type { Student } from '../lib/supabaseClient'
import { QRGenerator } from '../components/QRGenerator'
import { studentSchema, GRADOS, DIVISIONES } from '../schemas/studentSchema'
import type { StudentFormData } from '../schemas/studentSchema'
import { Navbar } from '../components/Navbar'
import { HelpModal } from '../components/HelpModal'

export function EstudianteDashboard() {
  const { user, profile } = useAuth()
  const { toastSuccess, toastError } = useToast()

  const [student, setStudent] = useState<Student | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showInitialHelp, setShowInitialHelp] = useState(false)

  // Foto de perfil de Google (viene en los metadatos de la sesión OAuth)
  const photoUrl: string | null =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined) ??
    null

  const [form, setForm] = useState<StudentFormData>({
    nombre: '',
    apellido: '',
    grado: '',
    division: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof StudentFormData, string>>>({})

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('profile_id', user.id)
        .single()

      // GRAVE 6: Distinguir "sin registro" de error real
      if (error) {
        // PGRST116 = "0 rows returned" = primer login, mostrar manual
        if (error.code === 'PGRST116') {
          setShowInitialHelp(true)
        }
        // Otros errores (red, RLS, Supabase caído): no abrir el manual
      } else if (data) {
        const s = data as Student
        setStudent(s)
        setForm({
          nombre: s.nombre,
          apellido: s.apellido,
          grado: s.grado,
          division: s.division,
        })
        setShowQR(true)
      }

      setLoadingData(false)
    })()
  }, [user])

  const validate = (): boolean => {
    const result = studentSchema.safeParse(form)
    if (!result.success) {
      const errs: Partial<Record<keyof StudentFormData, string>> = {}
      result.error.issues.forEach((e) => {
        const field = e.path[0] as keyof StudentFormData
        errs[field] = e.message
      })
      setErrors(errs)
      return false
    }
    setErrors({})
    return true
  }

  // Paso 1: validar y mostrar confirmación
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || !user || student) return // bloqueado si ya tiene datos
    setShowConfirmModal(true)
  }

  // Paso 2: guardar definitivamente (solo insert, sin update para alumnos)
  const doSave = async () => {
    if (!user) return
    setShowConfirmModal(false)
    setSaving(true)
    try {
      const parsed = studentSchema.parse(form)
      const { data, error } = await supabase
        .from('students')
        .insert({ ...parsed, profile_id: user.id })
        .select()
        .single()
      if (error) throw error
      setStudent(data as Student)
      toastSuccess('¡Datos guardados! Tu QR fue generado.')
      setShowQR(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar los datos'
      toastError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: keyof StudentFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  if (loadingData) {
    return (
      <>
        <Navbar />
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 800 }}>
        <div className="page-header">
          <h1 className="page-title">Mi QR de Asistencia</h1>
          <p className="page-subtitle">
            Completá tus datos para generar tu código QR personal.
          </p>
        </div>

        <div className="student-dashboard-grid">

          {/* ── Panel de datos ── */}
          {student ? (
            // READ-ONLY — datos bloqueados
            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🔒</span>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Mis datos</h2>
              </div>
              <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '0.625rem', padding: '0.8rem 1rem', marginBottom: '1.1rem', fontSize: '0.8rem', color: '#93c5fd', lineHeight: 1.6 }}>
                🔒 Tus datos están <strong>bloqueados</strong>. Si necesitás modificarlos, solicitáselo a un administrador.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[{ label: 'Nombre', value: student.nombre }, { label: 'Apellido', value: student.apellido }, { label: 'Año', value: student.grado }, { label: 'División', value: student.division }].map((item) => (
                  <div key={item.label} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: '0.5rem', padding: '0.875rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{item.label}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.75rem', background: 'rgba(15,23,42,0.5)', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>📧 {profile?.email}</div>
            </div>
          ) : (
            // FORM — primer ingreso
            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1rem' }}>📝 Mis datos</h2>

              {/* ⚠️ Advertencia */}
              <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: '0.625rem', padding: '0.875rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#fde047', lineHeight: 1.65 }}>
                ⚠️ <strong>¡Atención!</strong> Solo podés ingresar tus datos <strong>una sola vez</strong>. Verificá que todo esté correcto antes de guardar — no podrás modificarlos sin la ayuda de un administrador.
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="nombre">Nombre</label>
                  <input id="nombre" type="text" className={`input-base ${errors.nombre ? 'input-error' : ''}`} placeholder="ej. María" value={form.nombre} onChange={(e) => handleChange('nombre', e.target.value)} maxLength={60} />
                  {errors.nombre && <span className="form-error">{errors.nombre}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="apellido">Apellido</label>
                  <input id="apellido" type="text" className={`input-base ${errors.apellido ? 'input-error' : ''}`} placeholder="ej. González" value={form.apellido} onChange={(e) => handleChange('apellido', e.target.value)} maxLength={60} />
                  {errors.apellido && <span className="form-error">{errors.apellido}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="grado">Año</label>
                    <select id="grado" className={`input-base ${errors.grado ? 'input-error' : ''}`} value={form.grado} onChange={(e) => handleChange('grado', e.target.value)}>
                      <option value="">Seleccioná...</option>
                      {GRADOS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    {errors.grado && <span className="form-error">{errors.grado}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="division">División</label>
                    <select id="division" className={`input-base ${errors.division ? 'input-error' : ''}`} value={form.division} onChange={(e) => handleChange('division', e.target.value)}>
                      <option value="">Seleccioná...</option>
                      {DIVISIONES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {errors.division && <span className="form-error">{errors.division}</span>}
                  </div>
                </div>
                <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>📧 {profile?.email}</div>
                <button type="submit" id="btn-guardar-datos" className="btn btn-primary" disabled={saving} style={{ marginTop: '0.25rem' }}>
                  {saving ? <><div className="spinner" /> Guardando...</> : '✅ Guardar y generar QR'}
                </button>
              </form>
            </div>
          )}

          {/* QR */}
          {showQR && student && (
            <div className="glass-card animate-fade-in" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1.25rem', textAlign: 'center' }}>🎫 Tu código QR</h2>
              <QRGenerator studentId={student.id} nombre={student.nombre} apellido={student.apellido} grado={student.grado} division={student.division} photoUrl={photoUrl} />
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de confirmación primer guardado ── */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card animate-fade-in" style={{ maxWidth: 440, width: '100%', padding: '2rem', border: '1px solid rgba(234,179,8,0.35)' }}>
            <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', textAlign: 'center', marginBottom: '0.75rem' }}>¿Confirmás tus datos?</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.65, marginBottom: '1.25rem' }}>
              Una vez guardados, <strong style={{ color: '#fde047' }}>no podrás modificarlos</strong> sin la intervención de un administrador. Revisá que sean correctos.
            </p>
            <div style={{ background: 'rgba(15,23,42,0.6)', borderRadius: '0.625rem', padding: '1rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {[{ label: 'Nombre', value: form.nombre }, { label: 'Apellido', value: form.apellido }, { label: 'Año', value: form.grado }, { label: 'División', value: form.division }].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', marginTop: '0.15rem' }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button id="btn-confirmar-guardar" onClick={doSave} className="btn btn-primary" style={{ flex: 1, fontWeight: 700 }}>✅ Sí, guardar</button>
              <button id="btn-cancelar-guardar" onClick={() => setShowConfirmModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Revisar</button>
            </div>
          </div>
        </div>
      )}

      {showInitialHelp && (
        <HelpModal role={profile?.role === 'estudiante' ? 'estudiante' : 'estudiante'} onClose={() => setShowInitialHelp(false)} />
      )}
    </>
  )
}
