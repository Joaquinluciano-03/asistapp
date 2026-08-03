import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabaseClient'
import type { Student } from '../lib/supabaseClient'
import { QRGenerator } from '../components/QRGenerator'
import { studentSchema, GRADOS, DIVISIONES } from '../schemas/studentSchema'
import type { StudentFormData } from '../schemas/studentSchema'
import { Navbar } from '../components/Navbar'

export function EstudianteDashboard() {
  const { user, profile } = useAuth()
  const { toastSuccess, toastError } = useToast()

  const [student, setStudent] = useState<Student | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showQR, setShowQR] = useState(false)

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
      try {
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('profile_id', user.id)
          .single()
        if (data) {
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
      } finally {
        setLoadingData(false)
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || !user) return

    setSaving(true)
    try {
      const parsed = studentSchema.parse(form)

      if (student) {
        // Update
        const { error } = await supabase
          .from('students')
          .update({ ...parsed, updated_at: new Date().toISOString() })
          .eq('id', student.id)
        if (error) throw error
        setStudent({ ...student, ...parsed })
        toastSuccess('Datos actualizados correctamente')
      } else {
        // Insert
        const { data, error } = await supabase
          .from('students')
          .insert({ ...parsed, profile_id: user.id })
          .select()
          .single()
        if (error) throw error
        setStudent(data as Student)
        toastSuccess('Datos guardados correctamente')
      }
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

        <div style={{ display: 'grid', gridTemplateColumns: showQR && student ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
          {/* Form */}
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1.25rem' }}>
              {student ? '✏️ Editar mis datos' : '📝 Mis datos'}
            </h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="nombre">Nombre</label>
                <input
                  id="nombre"
                  type="text"
                  className={`input-base ${errors.nombre ? 'input-error' : ''}`}
                  placeholder="ej. María"
                  value={form.nombre}
                  onChange={(e) => handleChange('nombre', e.target.value)}
                  maxLength={60}
                />
                {errors.nombre && <span className="form-error">{errors.nombre}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="apellido">Apellido</label>
                <input
                  id="apellido"
                  type="text"
                  className={`input-base ${errors.apellido ? 'input-error' : ''}`}
                  placeholder="ej. González"
                  value={form.apellido}
                  onChange={(e) => handleChange('apellido', e.target.value)}
                  maxLength={60}
                />
                {errors.apellido && <span className="form-error">{errors.apellido}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="grado">Grado</label>
                  <select
                    id="grado"
                    className={`input-base ${errors.grado ? 'input-error' : ''}`}
                    value={form.grado}
                    onChange={(e) => handleChange('grado', e.target.value)}
                  >
                    <option value="">Seleccioná...</option>
                    {GRADOS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  {errors.grado && <span className="form-error">{errors.grado}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="division">División</label>
                  <select
                    id="division"
                    className={`input-base ${errors.division ? 'input-error' : ''}`}
                    value={form.division}
                    onChange={(e) => handleChange('division', e.target.value)}
                  >
                    <option value="">Seleccioná...</option>
                    {DIVISIONES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {errors.division && <span className="form-error">{errors.division}</span>}
                </div>
              </div>

              {/* User info */}
              <div
                style={{
                  background: 'rgba(15,23,42,0.5)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  fontSize: '0.8rem',
                  color: '#64748b',
                }}
              >
                📧 {profile?.email}
              </div>

              <button
                type="submit"
                id="btn-guardar-datos"
                className="btn btn-primary"
                disabled={saving}
                style={{ marginTop: '0.25rem' }}
              >
                {saving ? (
                  <><div className="spinner" /> Guardando...</>
                ) : student ? (
                  '💾 Actualizar datos'
                ) : (
                  '✅ Guardar y generar QR'
                )}
              </button>
            </form>
          </div>

          {/* QR */}
          {showQR && student && (
            <div className="glass-card animate-fade-in" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1.25rem', textAlign: 'center' }}>
                🎫 Tu código QR
              </h2>
              <QRGenerator
                studentId={student.id}
                nombre={student.nombre}
                apellido={student.apellido}
                grado={student.grado}
                division={student.division}
                photoUrl={photoUrl}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
