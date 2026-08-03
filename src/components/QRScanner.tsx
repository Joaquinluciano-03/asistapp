import { useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: string) => void
  active?: boolean
}

// ID único por instancia para evitar conflictos entre renders
let instanceCount = 0

export function QRScanner({ onScan, onError, active = true }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerIdRef = useRef<string>(`qr-scanner-${++instanceCount}`)
  const onScanRef = useRef(onScan)
  const onErrorRef = useRef(onError)
  const startingRef = useRef(false)

  // Keep refs updated without re-triggering the effect
  useEffect(() => { onScanRef.current = onScan }, [onScan])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const stopScanner = useCallback(async () => {
    startingRef.current = false
    const scanner = scannerRef.current
    if (!scanner) return

    try {
      const state = scanner.getState()
      if (
        state === Html5QrcodeScannerState.SCANNING ||
        state === Html5QrcodeScannerState.PAUSED
      ) {
        await scanner.stop()
      }
    } catch {
      // Ignorar errores al detener
    } finally {
      try { scanner.clear() } catch { /* noop */ }
      scannerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!active) {
      void stopScanner()
      return
    }

    let cancelled = false

    const startScanner = async () => {
      // Evitar iniciar si ya hay una instancia arrancando
      if (startingRef.current) return
      startingRef.current = true

      // Detener instancia previa si existe
      await stopScanner()

      if (cancelled) return

      const containerId = containerIdRef.current
      const el = document.getElementById(containerId)
      if (!el) return

      // Limpiar cualquier contenido previo inyectado por html5-qrcode
      el.innerHTML = ''

      const scanner = new Html5Qrcode(containerId, { verbose: false })
      scannerRef.current = scanner
      startingRef.current = false

      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.333,
            disableFlip: false,
          },
          (decodedText) => {
            if (!cancelled) onScanRef.current(decodedText)
          },
          () => {
            // Errores de "no se encontró QR" — ignorar, son normales
          }
        )
      } catch {
        if (!cancelled && onErrorRef.current) {
          onErrorRef.current('No se pudo acceder a la cámara. Verificá los permisos.')
        }
      }
    }

    void startScanner()

    return () => {
      cancelled = true
      void stopScanner()
    }
  // Solo 'active' y 'stopScanner' como deps: las callbacks van por ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stopScanner])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Contenedor con ID único — html5-qrcode inyecta el video aquí */}
      <div
        id={containerIdRef.current}
        style={{
          width: '100%',
          maxWidth: '420px',
          margin: '0 auto',
          borderRadius: '1rem',
          overflow: 'hidden',
          border: '2px solid rgba(59,130,246,0.4)',
          boxShadow: '0 0 40px rgba(59,130,246,0.15)',
          background: '#0f172a',
          minHeight: '300px',
        }}
      />

      {/* Overlay de esquinas — solo visual, no interfiere con el video */}
      {active && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '260px',
            height: '260px',
            pointerEvents: 'none',
          }}
        >
          {(['topleft', 'topright', 'bottomleft', 'bottomright'] as const).map((pos) => (
            <div
              key={pos}
              style={{
                position: 'absolute',
                width: '28px',
                height: '28px',
                borderColor: '#3b82f6',
                borderStyle: 'solid',
                borderWidth: 0,
                ...(pos === 'topleft' && {
                  top: -2, left: -2,
                  borderTopWidth: 3, borderLeftWidth: 3,
                  borderTopLeftRadius: '0.5rem',
                }),
                ...(pos === 'topright' && {
                  top: -2, right: -2,
                  borderTopWidth: 3, borderRightWidth: 3,
                  borderTopRightRadius: '0.5rem',
                }),
                ...(pos === 'bottomleft' && {
                  bottom: -2, left: -2,
                  borderBottomWidth: 3, borderLeftWidth: 3,
                  borderBottomLeftRadius: '0.5rem',
                }),
                ...(pos === 'bottomright' && {
                  bottom: -2, right: -2,
                  borderBottomWidth: 3, borderRightWidth: 3,
                  borderBottomRightRadius: '0.5rem',
                }),
              }}
            />
          ))}

          {/* Línea de escaneo animada */}
          <div
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
              animation: 'scanLine 2s ease-in-out infinite',
              top: '50%',
            }}
          />
        </div>
      )}
    </div>
  )
}
