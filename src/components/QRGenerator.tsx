import { useEffect, useRef, useState } from 'react'
import QRCodeLib from 'qrcode'

interface QRGeneratorProps {
  studentId: string
  nombre: string
  apellido: string
  grado: string
  division: string
}

export function QRGenerator({ studentId, nombre, apellido, grado, division }: QRGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState<string>('')

  const qrData = JSON.stringify({ sid: studentId })

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const QR_SIZE = 220
    const PADDING = 16
    const FOOTER_HEIGHT = 60
    const TOTAL_HEIGHT = QR_SIZE + FOOTER_HEIGHT

    canvas.width = QR_SIZE + PADDING * 2
    canvas.height = TOTAL_HEIGHT + PADDING * 2

    // Background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Generate QR into temp canvas
    const tempCanvas = document.createElement('canvas')
    QRCodeLib.toCanvas(tempCanvas, qrData, {
      width: QR_SIZE,
      margin: 1,
      color: { dark: '#0f172a', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then(() => {
      ctx.drawImage(tempCanvas, PADDING, PADDING)

      // Footer text
      ctx.fillStyle = '#0f172a'
      ctx.textAlign = 'center'
      const cx = canvas.width / 2

      ctx.font = 'bold 13px Inter, system-ui, sans-serif'
      ctx.fillText(`${apellido}, ${nombre}`, cx, QR_SIZE + PADDING + 24)

      ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.fillStyle = '#475569'
      ctx.fillText(`${grado} — División ${division}`, cx, QR_SIZE + PADDING + 44)

      setDataUrl(canvas.toDataURL('image/png'))
    })
  }, [studentId, nombre, apellido, grado, division, qrData])

  const handleDownload = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr_${apellido}_${nombre}.png`.toLowerCase().replace(/\s+/g, '_')
    a.click()
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
      <div
        style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '1rem',
          boxShadow: '0 0 40px rgba(59,130,246,0.2)',
          border: '1px solid rgba(148,163,184,0.1)',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', borderRadius: '0.5rem' }} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
          Este QR contiene tu ID único. Presentalo al personal para registrar tu llegada.
        </p>
        <button
          onClick={handleDownload}
          disabled={!dataUrl}
          className="btn btn-primary"
          id="btn-download-qr"
        >
          ⬇ Descargar QR (PNG)
        </button>
      </div>
    </div>
  )
}
