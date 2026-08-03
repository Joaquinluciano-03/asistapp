import { useEffect, useRef, useState, useCallback } from 'react'
import QRCodeLib from 'qrcode'

interface QRGeneratorProps {
  studentId: string
  nombre: string
  apellido: string
  grado: string
  division: string
  photoUrl?: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function clipCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
}

function drawInitials(ctx: CanvasRenderingContext2D, nombre: string, apellido: string, cx: number, cy: number, r: number) {
  const initials = `${apellido[0] ?? ''}${nombre[0] ?? ''}`.toUpperCase()
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  grad.addColorStop(0, '#2563eb')
  grad.addColorStop(1, '#7c3aed')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${r * 0.75}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initials, cx, cy)
  ctx.textBaseline = 'alphabetic'
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    // Añadir timestamp para evitar cache CORS corrupta
    img.src = url.includes('?') ? url : `${url}?t=${Date.now()}`
  })
}

// ── Constantes del carnet ─────────────────────────────────────────────
const W = 400
const H = 630
const RADIUS = 18      // border-radius del carnet
const HEADER_H = 130
const PHOTO_R = 52     // radio de la foto
const QR_SIZE = 160

export function QRGenerator({ studentId, nombre, apellido, grado, division, photoUrl }: QRGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState<string>('')
  const [rendering, setRendering] = useState(true)

  const qrData = JSON.stringify({ sid: studentId })

  const renderCarnet = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setRendering(true)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = W
    canvas.height = H

    // ── 1. Fondo base del carnet ──────────────────────────────────────
    roundRect(ctx, 0, 0, W, H, RADIUS)
    ctx.fillStyle = '#f8fafc'
    ctx.fill()

    // ── 2. Header degradado ───────────────────────────────────────────
    const headerGrad = ctx.createLinearGradient(0, 0, W, HEADER_H)
    headerGrad.addColorStop(0, '#0d1b3e')
    headerGrad.addColorStop(0.6, '#1a3270')
    headerGrad.addColorStop(1, '#2d1b6b')
    ctx.save()
    roundRect(ctx, 0, 0, W, HEADER_H, RADIUS)
    ctx.clip()
    // Extender el clip hasta el borde inferior del header (cortar bordes redondos solo arriba)
    ctx.fillRect(0, RADIUS, W, HEADER_H - RADIUS)
    roundRect(ctx, 0, 0, W, HEADER_H, RADIUS)
    ctx.fillStyle = headerGrad
    ctx.fill()
    ctx.restore()

    // Línea de acento en el header
    const accentGrad = ctx.createLinearGradient(0, 0, W, 0)
    accentGrad.addColorStop(0, '#3b82f6')
    accentGrad.addColorStop(0.5, '#8b5cf6')
    accentGrad.addColorStop(1, '#3b82f6')
    ctx.fillStyle = accentGrad
    ctx.fillRect(0, HEADER_H - 3, W, 3)

    // ── 3. Texto del header ───────────────────────────────────────────
    ctx.textAlign = 'center'

    // Ícono de escuela
    ctx.font = '28px system-ui'
    ctx.fillText('🏫', W / 2, 44)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px Inter, system-ui, sans-serif'
    ctx.fillText('INSTITUTO DON ORIONE', W / 2, 72)

    ctx.fillStyle = 'rgba(148, 179, 255, 0.85)'
    ctx.font = '11px Inter, system-ui, sans-serif'
    ctx.fillText('Victoria — Buenos Aires', W / 2, 90)

    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(60, 100, W - 120, 1)

    ctx.fillStyle = 'rgba(148, 179, 255, 0.7)'
    ctx.font = 'bold 10px Inter, system-ui, sans-serif'
    ctx.letterSpacing = '2px'
    ctx.fillText('CARNET DE ASISTENCIA', W / 2, 118)
    ctx.letterSpacing = '0px'

    // ── 4. Franja de curso ────────────────────────────────────────────
    const bandY = HEADER_H + 12
    const bandH = 34
    ctx.fillStyle = '#eef2ff'
    roundRect(ctx, 20, bandY, W - 40, bandH, 8)
    ctx.fill()
    ctx.strokeStyle = 'rgba(99, 148, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#1e40af'
    ctx.font = 'bold 13px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${grado}° AÑO — DIVISIÓN ${division.toUpperCase()}`, W / 2, bandY + 22)

    // ── 5. Foto del alumno ────────────────────────────────────────────
    const photoY = HEADER_H + 62
    const photoCX = W / 2
    const photoCY = photoY + PHOTO_R

    // Sombra de la foto
    ctx.shadowColor = 'rgba(37, 99, 235, 0.35)'
    ctx.shadowBlur = 18
    ctx.beginPath()
    ctx.arc(photoCX, photoCY, PHOTO_R + 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.shadowBlur = 0

    // Borde degradado de la foto
    const borderGrad = ctx.createLinearGradient(photoCX - PHOTO_R, photoCY - PHOTO_R, photoCX + PHOTO_R, photoCY + PHOTO_R)
    borderGrad.addColorStop(0, '#3b82f6')
    borderGrad.addColorStop(1, '#7c3aed')
    ctx.beginPath()
    ctx.arc(photoCX, photoCY, PHOTO_R + 3, 0, Math.PI * 2)
    ctx.strokeStyle = borderGrad
    ctx.lineWidth = 3
    ctx.stroke()

    // Foto circular o iniciales
    ctx.save()
    clipCircle(ctx, photoCX, photoCY, PHOTO_R)

    let photoDrawn = false
    if (photoUrl) {
      const img = await loadImage(photoUrl)
      if (img) {
        ctx.drawImage(img, photoCX - PHOTO_R, photoCY - PHOTO_R, PHOTO_R * 2, PHOTO_R * 2)
        photoDrawn = true
      }
    }
    if (!photoDrawn) {
      drawInitials(ctx, nombre, apellido, photoCX, photoCY, PHOTO_R)
    }
    ctx.restore()

    // ── 6. Nombre del alumno ──────────────────────────────────────────
    const nameY = photoCY + PHOTO_R + 22
    ctx.textAlign = 'center'
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 18px Inter, system-ui, sans-serif'
    ctx.fillText(`${apellido.toUpperCase()}, ${nombre}`, W / 2, nameY)

    ctx.fillStyle = '#64748b'
    ctx.font = '12px Inter, system-ui, sans-serif'
    ctx.fillText('Alumno/a', W / 2, nameY + 20)

    // Separador
    const sepGrad = ctx.createLinearGradient(60, 0, W - 60, 0)
    sepGrad.addColorStop(0, 'transparent')
    sepGrad.addColorStop(0.3, 'rgba(99, 148, 255, 0.4)')
    sepGrad.addColorStop(0.7, 'rgba(99, 148, 255, 0.4)')
    sepGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = sepGrad
    ctx.fillRect(60, nameY + 34, W - 120, 1)

    // ── 7. QR Code ────────────────────────────────────────────────────
    const qrY = nameY + 50
    const qrLabel = 'Código QR de Asistencia'

    ctx.fillStyle = '#94a3b8'
    ctx.font = '10px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(qrLabel.toUpperCase(), W / 2, qrY - 4)

    const tempCanvas = document.createElement('canvas')
    await QRCodeLib.toCanvas(tempCanvas, qrData, {
      width: QR_SIZE,
      margin: 1,
      color: { dark: '#0f172a', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })

    // Fondo blanco del QR con sombra suave
    const qrX = (W - QR_SIZE) / 2
    ctx.shadowColor = 'rgba(0,0,0,0.12)'
    ctx.shadowBlur = 10
    roundRect(ctx, qrX - 8, qrY + 4, QR_SIZE + 16, QR_SIZE + 16, 10)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.drawImage(tempCanvas, qrX, qrY + 12)

    // ── 8. Footer ─────────────────────────────────────────────────────
    const footerY = H - 38
    ctx.fillStyle = '#f1f5f9'
    roundRect(ctx, 0, footerY, W, H - footerY, RADIUS)
    // Solo bordes inferiores redondeados
    ctx.fillRect(0, footerY, W, RADIUS)
    roundRect(ctx, 0, footerY, W, H - footerY, RADIUS)
    ctx.fill()

    ctx.fillStyle = '#94a3b8'
    ctx.font = '9.5px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('AsistIDO • Sistema de asistencia escolar', W / 2, footerY + 16)
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '8.5px Inter, system-ui, sans-serif'
    ctx.fillText(`ID: ${studentId.slice(0, 8).toUpperCase()}`, W / 2, footerY + 29)

    // ── 9. Borde exterior del carnet ──────────────────────────────────
    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, RADIUS)
    ctx.strokeStyle = 'rgba(99, 148, 255, 0.25)'
    ctx.lineWidth = 1
    ctx.stroke()

    setDataUrl(canvas.toDataURL('image/png', 1.0))
    setRendering(false)
  }, [studentId, nombre, apellido, grado, division, photoUrl, qrData])

  useEffect(() => {
    renderCarnet()
  }, [renderCarnet])

  const handleDownload = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `carnet_${apellido}_${nombre}.png`.toLowerCase().replace(/\s+/g, '_')
    a.click()
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
      {/* Vista previa del carnet */}
      <div
        style={{
          position: 'relative',
          borderRadius: '1.25rem',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(37, 99, 235, 0.25), 0 4px 16px rgba(0,0,0,0.3)',
          border: '1px solid rgba(99, 148, 255, 0.2)',
          maxWidth: '100%',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
            opacity: rendering ? 0.4 : 1,
            transition: 'opacity 0.3s',
          }}
        />
        {rendering && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          </div>
        )}
      </div>

      {/* Descripción + botón */}
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 400 }}>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.875rem', lineHeight: 1.5 }}>
          Este carnet contiene tu foto, datos escolares y QR único.<br />
          Guardalo en tu celular o imprimilo para presentarlo.
        </p>
        <button
          onClick={handleDownload}
          disabled={!dataUrl || rendering}
          className="btn btn-primary btn-lg"
          id="btn-download-carnet"
          style={{ width: '100%' }}
        >
          {rendering ? (
            <><div className="spinner" /> Generando carnet...</>
          ) : (
            '⬇️ Descargar Carnet (PNG)'
          )}
        </button>
      </div>
    </div>
  )
}
