import { useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: string) => void
  active?: boolean
}

export function QRScanner({ onScan, onError, active = true }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerId = 'qr-scanner-container'

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        // State 2 = SCANNING
        if (state === 2) {
          await scannerRef.current.stop()
        }
      } catch {
        // Ignore stop errors
      }
      scannerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!active) {
      stopScanner()
      return
    }

    let mounted = true

    const startScanner = async () => {
      await stopScanner()

      if (!mounted) return

      const scanner = new Html5Qrcode(containerId)
      scannerRef.current = scanner

      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (mounted) onScan(decodedText)
          },
          () => {
            // Scan errors (not found) — ignore
          }
        )
      } catch (err) {
        if (mounted && onError) {
          onError('No se pudo acceder a la cámara. Verificá los permisos.')
        }
      }
    }

    startScanner()

    return () => {
      mounted = false
      stopScanner()
    }
  }, [active, onScan, onError, stopScanner])

  return (
    <div style={{ position: 'relative' }}>
      <div
        id={containerId}
        style={{
          width: '100%',
          maxWidth: '400px',
          margin: '0 auto',
          borderRadius: '1rem',
          overflow: 'hidden',
          border: '2px solid rgba(59,130,246,0.4)',
          boxShadow: '0 0 40px rgba(59,130,246,0.15)',
        }}
      />
      {active && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '250px',
            height: '250px',
            border: '2px solid rgba(59,130,246,0.6)',
            borderRadius: '0.75rem',
            pointerEvents: 'none',
          }}
        >
          {/* Corner indicators */}
          {['topleft', 'topright', 'bottomleft', 'bottomright'].map((pos) => (
            <div
              key={pos}
              style={{
                position: 'absolute',
                width: '24px',
                height: '24px',
                borderColor: '#3b82f6',
                borderStyle: 'solid',
                borderWidth: 0,
                ...(pos === 'topleft' && { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: '0.5rem' }),
                ...(pos === 'topright' && { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: '0.5rem' }),
                ...(pos === 'bottomleft' && { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: '0.5rem' }),
                ...(pos === 'bottomright' && { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: '0.5rem' }),
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
