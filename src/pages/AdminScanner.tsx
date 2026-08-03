import { useState, useCallback } from 'react'
import { QRScanner } from '../components/QRScanner'
import { Navbar } from '../components/Navbar'
import { supabase } from '../lib/supabaseClient'
import type { Student } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

type ScanState = 'scanning' | 'confirming' | 'registering' | 'done'

export function AdminScanner() {
  const { user, profile } = useAuth()
  const { toastSuccess, toastError, toastWarning } = useToast()
  const [scanState, setScanState] = useState<ScanState>('scanning')
  const [student, setStudent] = useState<Student | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [lastScannedId, setLastScannedId] = useState<string | null>(null)

  const handleScan = useCallback(
    async (raw: string) => {
      if (scanState !== 'scanning') return

      let studentId: string | null = null

      // Try to parse JSON { sid: "uuid" } or fallback to raw UUID
      try {
        const parsed = JSON.parse(raw)
        if (parsed?.sid) studentId = parsed.sid
        else studentId = raw.trim()
      } catch {
        studentId = raw.trim()
      }

      if (!studentId) {
        toastWarning('QR inválido: no se pudo extraer el ID del alumno')
        return
      }

      // Debounce same QR
      if (studentId === lastScannedId) return
      setLastScannedId(studentId)

      setScanState('confirming')

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()

      if (error || !data) {
        toastError('Alumno no encontrado. El QR puede estar desactualizado.')
        setScanState('scanning')
        setLastScannedId(null)
        return
      }

      setStudent(data as Student)
    },
    [scanState, lastScannedId, toastWarning, toastError]
  )

  const handleConfirm = async () => {
    if (!student || !user || !profile) return
    setScanState('registering')

    const { error } = await supabase.from('llegadas_tarde').insert({
      student_id: student.id,
      metodo: 'qr',
      registrado_por: user.id,
      registrado_por_email: profile.email,
      // El servidor completa: nombre, apellido, grado, division, fecha, hora, turno
    })

    if (error) {
      if (error.code === '23505') {
        toastWarning(`Ya se registró la llegada tarde de ${student.nombre} ${student.apellido} hoy.`)
      } else {
        toastError(`Error al registrar: ${error.message}`)
      }
      setScanState('confirming')
      return
    }

    toastSuccess(`✅ Registrado — ${student.nombre} ${student.apellido}`)
    setScanState('done')
    setTimeout(() => {
      setScanState('scanning')
      setStudent(null)
      setLastScannedId(null)
    }, 2500)
  }

  const handleCancel = () => {
    setScanState('scanning')
    setStudent(null)
    setLastScannedId(null)
  }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 600 }}>
        <div className="page-header">
          <h1 className="page-title">📷 Escanear QR</h1>
          <p className="page-subtitle">
            Apuntá la cámara al código QR del alumno para registrar su llegada tarde.
          </p>
        </div>

        {cameraError && (
          <div
            className="glass-card"
            style={{
              padding: '1.25rem',
              borderColor: 'rgba(239,68,68,0.3)',
              background: 'rgba(220,38,38,0.1)',
              color: '#f87171',
              marginBottom: '1.5rem',
            }}
          >
            ⚠️ {cameraError}
          </div>
        )}

        {/* Scanner */}
        {(scanState === 'scanning' || scanState === 'confirming' || scanState === 'registering') && (
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              {scanState === 'scanning' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      background: '#22c55e',
                      borderRadius: '50%',
                      animation: 'pulse 1.5s infinite',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', color: '#4ade80' }}>Cámara activa — esperando QR...</span>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                  Cámara pausada
                </div>
              )}
            </div>

            <QRScanner
              onScan={handleScan}
              onError={(e) => setCameraError(e)}
              active={scanState === 'scanning'}
            />

            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
              }
            `}</style>
          </div>
        )}

        {/* Confirmation card */}
        {(scanState === 'confirming' || scanState === 'registering') && student && (
          <div className="glass-card animate-fade-in" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Confirmar registro
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
                  { label: 'Nombre', value: student.nombre },
                  { label: 'Apellido', value: student.apellido },
                  { label: 'Grado', value: student.grado },
                  { label: 'División', value: student.division },
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
                id="btn-confirmar-llegada"
                onClick={handleConfirm}
                disabled={scanState === 'registering'}
                className="btn btn-success"
                style={{ flex: 1 }}
              >
                {scanState === 'registering' ? (
                  <><div className="spinner" /> Registrando...</>
                ) : (
                  '✅ Confirmar llegada tarde'
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={scanState === 'registering'}
                className="btn btn-secondary"
                id="btn-cancelar-scan"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {scanState === 'done' && (
          <div
            className="glass-card animate-fade-in"
            style={{
              padding: '2rem',
              textAlign: 'center',
              borderColor: 'rgba(74,222,128,0.3)',
              background: 'rgba(22,163,74,0.1)',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.5rem' }}>
              Llegada registrada
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Preparando para el siguiente escaneo...
            </div>
          </div>
        )}
      </div>
    </>
  )
}
