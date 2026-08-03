import { useState, useCallback, useRef } from 'react'
import { QRScanner } from '../components/QRScanner'
import { Navbar } from '../components/Navbar'
import { supabase } from '../lib/supabaseClient'
import type { Student } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

type ScanState = 'scanning' | 'confirming' | 'registering' | 'done'

interface LastFichaje {
  nombre: string
  apellido: string
  hora: string
}

export function AdminScanner() {
  const { user, profile } = useAuth()
  const { toastSuccess, toastError, toastWarning } = useToast()

  const [scanState, setScanState] = useState<ScanState>('scanning')
  const [student, setStudent] = useState<Student | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [lastScannedId, setLastScannedId] = useState<string | null>(null)
  const [lastFichaje, setLastFichaje] = useState<LastFichaje | null>(null)

  // ── Buscador de alumnos ──────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Student[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const handleSelectFromSearch = useCallback((s: Student) => {
    setSearch('')
    setSearchResults([])
    setStudent(s)
    setScanState('confirming')
  }, [])

  // ── Scan handler ─────────────────────────────────────────────────
  const handleScan = useCallback(
    async (raw: string) => {
      if (scanState !== 'scanning') return
      let studentId: string | null = null
      try {
        const parsed = JSON.parse(raw)
        studentId = parsed?.sid ?? raw.trim()
      } catch {
        studentId = raw.trim()
      }
      if (!studentId) { toastWarning('QR inválido'); return }
      if (studentId === lastScannedId) return
      setLastScannedId(studentId)
      setScanState('confirming')
      const { data, error } = await supabase.from('students').select('*').eq('id', studentId).single()
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

  // ── Confirm ──────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!student || !user || !profile) return
    setScanState('registering')
    const { error } = await supabase.from('llegadas_tarde').insert({
      student_id: student.id,
      metodo: 'qr',
      registrado_por: user.id,
      registrado_por_email: profile.email,
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
    const ahora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLastFichaje({ nombre: student.nombre, apellido: student.apellido, hora: ahora })
    toastSuccess(`✅ Registrado — ${student.nombre} ${student.apellido}`)
    setScanState('done')
    setTimeout(() => { setScanState('scanning'); setStudent(null); setLastScannedId(null) }, 2000)
  }

  const handleCancel = () => { setScanState('scanning'); setStudent(null); setLastScannedId(null) }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 560 }}>

        {/* Header + último fichaje */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="page-title">📷 Escanear QR</h1>
            <p className="page-subtitle">Apuntá la cámara al QR del alumno o buscalo por nombre.</p>
          </div>
          {lastFichaje && (
            <div className="animate-fade-in" style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '0.75rem', padding: '0.625rem 1rem', fontSize: '0.8rem', lineHeight: 1.4, flexShrink: 0 }}>
              <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>✅ Último fichaje</div>
              <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{lastFichaje.apellido}, {lastFichaje.nombre}</div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>🕐 {lastFichaje.hora}</div>
            </div>
          )}
        </div>

        {/* Error cámara */}
        {cameraError && (
          <div className="glass-card" style={{ padding: '1rem', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(220,38,38,0.1)', color: '#f87171', marginBottom: '1.25rem' }}>
            ⚠️ {cameraError}
          </div>
        )}

        {/* SCANNER — arriba, ancho completo */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {scanState === 'scanning' ? (
              <><div className="pulse-dot" /><span style={{ fontSize: '0.8rem', color: '#4ade80' }}>Cámara activa — esperando QR...</span></>
            ) : (
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Cámara pausada</span>
            )}
          </div>
          <QRScanner
            onScan={handleScan}
            onError={(e) => setCameraError(e)}
            active={scanState === 'scanning'}
          />
        </div>

        {/* BUSCADOR — debajo del scanner, ancho completo */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            🔍 Buscar alumno manualmente
          </div>
          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
            <input
              id="buscar-alumno-scanner"
              type="text"
              className="input-base"
              placeholder="Escribí apellido o nombre..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              autoComplete="off"
            />
            {searching && (
              <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
                <div className="spinner" />
              </div>
            )}
          </div>

          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '220px', overflowY: 'auto', marginTop: '0.25rem' }}>
              {searchResults.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectFromSearch(s)}
                  disabled={scanState === 'confirming' || scanState === 'registering'}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: '0.5rem', cursor: 'pointer', color: '#cbd5e1', fontSize: '0.875rem', transition: 'all 0.15s', textAlign: 'left' }}
                  onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(37,99,235,0.15)'; b.style.borderColor = 'rgba(59,130,246,0.3)' }}
                  onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(15,23,42,0.5)'; b.style.borderColor = 'rgba(148,163,184,0.08)' }}
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
        </div>

        {/* Confirmación */}
        {(scanState === 'confirming' || scanState === 'registering') && student && (
          <div className="glass-card animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Confirmar registro
            </h3>
            <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[{ label: 'Nombre', value: student.nombre }, { label: 'Apellido', value: student.apellido }, { label: 'Grado', value: student.grado }, { label: 'División', value: student.division }].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginTop: '0.2rem' }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button id="btn-confirmar-llegada" onClick={handleConfirm} disabled={scanState === 'registering'} className="btn btn-success" style={{ flex: 1 }}>
                {scanState === 'registering' ? <><div className="spinner" /> Registrando...</> : '✅ Confirmar llegada tarde'}
              </button>
              <button id="btn-cancelar-scan" onClick={handleCancel} disabled={scanState === 'registering'} className="btn btn-secondary">Cancelar</button>
            </div>
          </div>
        )}

        {/* Done */}
        {scanState === 'done' && (
          <div className="glass-card animate-fade-in" style={{ padding: '2rem', textAlign: 'center', borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(22,163,74,0.1)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.5rem' }}>Llegada registrada</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Preparando siguiente escaneo...</div>
          </div>
        )}
      </div>
    </>
  )
}
