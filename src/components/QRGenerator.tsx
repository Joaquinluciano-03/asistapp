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

// ── Utilidades ────────────────────────────────────────────────────────
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

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url.includes('?') ? url : `${url}?t=${Date.now()}`
  })
}

// ── Dimensiones (Formato Vertical) — SCALE=3 para ~300 DPI ───────────
const S = 3                         // factor de escala de impresión
const CW = 240 * S                  // ancho del carnet: 720 px
const CH = 380 * S                  // alto de cada cara: 1140 px
const FOLD = 16 * S                 // banda de doblez: 48 px
const TOTAL_H = CH * 2 + FOLD       // alto total del canvas: 2328 px
const R = 12 * S                    // border-radius

// ── Cara FRONTAL (datos + foto) ────────────────────────────────────────
async function drawFront(
  ctx: CanvasRenderingContext2D,
  offsetY: number,
  nombre: string,
  apellido: string,
  grado: string,
  division: string,
  photoUrl: string | null | undefined
) {
  const HEADER_H = 60 * S

  // Fondo blanco del carnet
  ctx.save()
  roundRect(ctx, 0, offsetY, CW, CH, R)
  ctx.fillStyle = '#f8fafc'
  ctx.fill()
  ctx.restore()

  // Header degradado
  const hGrad = ctx.createLinearGradient(0, offsetY, CW, offsetY + HEADER_H)
  hGrad.addColorStop(0, '#0d1b3e')
  hGrad.addColorStop(1, '#2d1b6b')
  ctx.save()
  roundRect(ctx, 0, offsetY, CW, HEADER_H + R, R)
  ctx.clip()
  ctx.fillStyle = hGrad
  ctx.fillRect(0, offsetY, CW, HEADER_H + R)
  ctx.restore()

  // Línea acento header
  const ag = ctx.createLinearGradient(0, 0, CW, 0)
  ag.addColorStop(0, '#3b82f6'); ag.addColorStop(0.5, '#8b5cf6'); ag.addColorStop(1, '#3b82f6')
  ctx.fillStyle = ag
  ctx.fillRect(0, offsetY + HEADER_H - 2 * S, CW, 2 * S)

  // Texto header
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${11 * S}px Inter, sans-serif`
  ctx.fillText('INSTITUTO DON ORIONE', CW / 2, offsetY + 26 * S)
  ctx.fillStyle = 'rgba(180,200,255,0.8)'
  ctx.font = `${8 * S}px Inter, sans-serif`
  ctx.fillText('Victoria — Buenos Aires', CW / 2, offsetY + 42 * S)

  // Foto circular (centrada)
  const PR = 56 * S          // radio foto
  const PX = CW / 2          // centro X foto
  const PY = offsetY + HEADER_H + 30 * S + PR  // centro Y foto

  // Sombra + borde
  ctx.save()
  ctx.shadowColor = 'rgba(37,99,235,0.4)'
  ctx.shadowBlur = 12 * S
  ctx.beginPath(); ctx.arc(PX, PY, PR + 4 * S, 0, Math.PI * 2)
  const bg = ctx.createLinearGradient(PX - PR, PY - PR, PX + PR, PY + PR)
  bg.addColorStop(0, '#3b82f6'); bg.addColorStop(1, '#7c3aed')
  ctx.fillStyle = bg; ctx.fill()
  ctx.shadowBlur = 0
  ctx.restore()

  // Foto o iniciales
  ctx.save()
  ctx.beginPath(); ctx.arc(PX, PY, PR, 0, Math.PI * 2); ctx.clip()
  let drawn = false
  if (photoUrl) {
    // Si es de Google, forzar alta resolución (por defecto suele traer s96-c)
    const highResUrl = photoUrl.replace(/=s\d+-c/, '=s512-c')
    const img = await loadImage(highResUrl)
    if (img) { ctx.drawImage(img, PX - PR, PY - PR, PR * 2, PR * 2); drawn = true }
  }
  if (!drawn) {
    const initials = `${apellido[0] ?? ''}${nombre[0] ?? ''}`.toUpperCase()
    const ig = ctx.createLinearGradient(PX - PR, PY - PR, PX + PR, PY + PR)
    ig.addColorStop(0, '#2563eb'); ig.addColorStop(1, '#7c3aed')
    ctx.fillStyle = ig; ctx.fillRect(PX - PR, PY - PR, PR * 2, PR * 2)
    ctx.fillStyle = '#fff'; ctx.font = `bold ${PR * 0.75}px Inter, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(initials, PX, PY)
    ctx.textBaseline = 'alphabetic'
  }
  ctx.restore()

  // Datos texto (centrados debajo de la foto)
  const textY = PY + PR + 30 * S
  ctx.textAlign = 'center'
  ctx.fillStyle = '#64748b'
  ctx.font = `bold ${9 * S}px Inter, sans-serif`
  ctx.fillText('ALUMNO/A', CW / 2, textY)

  ctx.fillStyle = '#0f172a'
  ctx.font = `bold ${18 * S}px Inter, sans-serif`
  ctx.fillText(apellido.toUpperCase(), CW / 2, textY + 24 * S)

  ctx.fillStyle = '#1e293b'
  ctx.font = `${15 * S}px Inter, sans-serif`
  ctx.fillText(nombre, CW / 2, textY + 44 * S)

  // Separador
  ctx.fillStyle = 'rgba(99,148,255,0.25)'
  ctx.fillRect(40 * S, textY + 60 * S, CW - 80 * S, 1 * S)

  // Curso / división
  ctx.fillStyle = '#64748b'
  ctx.font = `${9 * S}px Inter, sans-serif`
  ctx.fillText('AÑO Y DIVISIÓN', CW / 2, textY + 84 * S)
  ctx.fillStyle = '#1e40af'
  ctx.font = `bold ${15 * S}px Inter, sans-serif`
  ctx.fillText(`${grado} — Div. ${division}`, CW / 2, textY + 106 * S)

  // Footer con ID
  ctx.fillStyle = '#94a3b8'
  ctx.font = `${8 * S}px Inter, sans-serif`
  ctx.fillText(`ID: ${studentIdRef.slice(0, 8).toUpperCase()}`, CW / 2, offsetY + CH - 16 * S)
}

// ── Cara TRASERA (QR grande) ───────────────────────────────────────────
async function drawBack(
  ctx: CanvasRenderingContext2D,
  qrData: string,
  apellido: string,
  nombre: string
) {
  const HEADER_H = 60 * S
  const QR_S = 180 * S

  // Fondo
  roundRect(ctx, 0, 0, CW, CH, R)
  ctx.fillStyle = '#f8fafc'
  ctx.fill()

  // Header (igual al frente)
  const hGrad = ctx.createLinearGradient(0, 0, CW, HEADER_H)
  hGrad.addColorStop(0, '#0d1b3e'); hGrad.addColorStop(1, '#2d1b6b')
  ctx.save()
  roundRect(ctx, 0, 0, CW, HEADER_H + R, R)
  ctx.clip()
  ctx.fillStyle = hGrad; ctx.fillRect(0, 0, CW, HEADER_H + R)
  ctx.restore()

  const ag = ctx.createLinearGradient(0, 0, CW, 0)
  ag.addColorStop(0, '#3b82f6'); ag.addColorStop(0.5, '#8b5cf6'); ag.addColorStop(1, '#3b82f6')
  ctx.fillStyle = ag; ctx.fillRect(0, HEADER_H - 2 * S, CW, 2 * S)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${11 * S}px Inter, sans-serif`
  ctx.fillText('INSTITUTO DON ORIONE', CW / 2, 26 * S)
  ctx.fillStyle = 'rgba(180,200,255,0.8)'
  ctx.font = `${8 * S}px Inter, sans-serif`
  ctx.fillText('Carnet de Asistencia', CW / 2, 42 * S)

  // Label QR
  ctx.fillStyle = '#94a3b8'
  ctx.font = `bold ${9 * S}px Inter, sans-serif`
  ctx.fillText('CÓDIGO QR', CW / 2, HEADER_H + 36 * S)

  // QR grande centrado
  const qrX = (CW - QR_S) / 2
  const qrY = HEADER_H + 54 * S

  // Sombra y fondo blanco del QR
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 12 * S
  roundRect(ctx, qrX - 10 * S, qrY - 10 * S, QR_S + 20 * S, QR_S + 20 * S, 12 * S)
  ctx.fillStyle = '#ffffff'; ctx.fill()
  ctx.shadowBlur = 0
  ctx.restore()

  const tmpCanvas = document.createElement('canvas')
  await QRCodeLib.toCanvas(tmpCanvas, qrData, {
    width: QR_S, margin: 1,
    color: { dark: '#0f172a', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  })
  ctx.drawImage(tmpCanvas, qrX, qrY)

  // Nombre alumno bajo el QR
  ctx.textAlign = 'center'
  ctx.fillStyle = '#0f172a'
  ctx.font = `bold ${12 * S}px Inter, sans-serif`
  ctx.fillText(`${apellido.toUpperCase()}, ${nombre}`, CW / 2, qrY + QR_S + 36 * S)
  
  ctx.fillStyle = '#64748b'
  ctx.font = `${10 * S}px Inter, sans-serif`
  ctx.fillText('ESCANEAR AL INGRESAR', CW / 2, CH - 24 * S)
}

// Ref global para pasar studentId a drawFront sin reestructurar todo
let studentIdRef = ''

// ── Componente ────────────────────────────────────────────────────────
export function QRGenerator({ studentId, nombre, apellido, grado, division, photoUrl }: QRGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState('')
  const [rendering, setRendering] = useState(true)
  const qrData = JSON.stringify({ sid: studentId })

  const render = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setRendering(true)
    studentIdRef = studentId

    canvas.width = CW
    canvas.height = TOTAL_H
    const ctx = canvas.getContext('2d')!

    // ── Fondo del papel (toda la hoja) ──────────────────────────────
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(0, 0, CW, TOTAL_H)

    // ── CARA TRASERA (top, dibujada invertida 180°) ─────────────────
    // Al doblar, la mitad superior se voltea y queda como dorso
    ctx.save()
    ctx.translate(CW, CH)    // esquina inferior-derecha del área superior
    ctx.rotate(Math.PI)       // rotar 180°
    await drawBack(ctx, qrData, apellido, nombre)
    ctx.restore()

    // ── Banda de doblez ─────────────────────────────────────────────
    ctx.fillStyle = '#cbd5e1'
    ctx.fillRect(0, CH, CW, FOLD)

    // Línea de puntos + ícono de tijera
    ctx.setLineDash([6 * S, 4 * S])
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1.5 * S
    ctx.beginPath()
    ctx.moveTo(20 * S, CH + FOLD / 2)
    ctx.lineTo(CW - 20 * S, CH + FOLD / 2)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.textAlign = 'center'
    ctx.fillStyle = '#64748b'
    ctx.font = `${7 * S}px Inter, sans-serif`
    ctx.fillText('✂  DOBLAR AQUÍ  ✂', CW / 2, CH + FOLD / 2 + 3 * S)

    // ── CARA FRONTAL (bottom, orientación normal) ───────────────────
    await drawFront(ctx, CH + FOLD, nombre, apellido, grado, division, photoUrl)

    // Borde exterior
    ctx.strokeStyle = 'rgba(99,148,255,0.2)'
    ctx.lineWidth = 1.5 * S
    ctx.strokeRect(0.5, 0.5, CW - 1, TOTAL_H - 1)

    setDataUrl(canvas.toDataURL('image/png', 1.0))
    setRendering(false)
  }, [studentId, nombre, apellido, grado, division, photoUrl, qrData])

  useEffect(() => { render() }, [render])

  const download = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `carnet_${apellido}_${nombre}.png`.toLowerCase().replace(/\s+/g, '_')
    a.click()
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
      <div style={{ boxShadow: '0 20px 60px rgba(37,99,235,0.25), 0 4px 20px rgba(0,0,0,0.35)', borderRadius: '0.875rem', overflow: 'hidden', maxWidth: '100%', border: '1px solid rgba(99,148,255,0.2)', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', maxWidth: '300px', height: 'auto', opacity: rendering ? 0.3 : 1, transition: 'opacity 0.3s' }}
        />
        {rendering && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', maxWidth: 400, width: '100%' }}>
        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.875rem 0', lineHeight: 1.6 }}>
          🖨️ Imprimí la hoja, doblá por la línea punteada y tenés tu carnet doble faz.
          El QR queda en el dorso y los datos en el frente.
        </p>
        <button
          id="btn-download-carnet"
          onClick={download}
          disabled={!dataUrl || rendering}
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
        >
          {rendering ? <><div className="spinner" /> Generando...</> : '⬇️ Descargar Carnet (Alta Resolución)'}
        </button>
      </div>
    </div>
  )
}
