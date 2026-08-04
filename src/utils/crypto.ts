/**
 * Cifrado XOR simétrico con clave repetida.
 * Encrypt = Decrypt (operación simétrica).
 */
const CIPHER_KEY = 'IDO'

function xorCipher(text: string, key: string): string {
  const keyLen = key.length
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % keyLen))
  }
  return result
}

/** Cifra un string con XOR+Base64. */
export function xorEncrypt(text: string): string {
  return btoa(unescape(encodeURIComponent(xorCipher(text, CIPHER_KEY))))
}

/**
 * Descifra un string XOR+Base64.
 * Devuelve null si el input no es un Base64 válido producido por xorEncrypt.
 */
export function xorDecrypt(encoded: string): string | null {
  try {
    const decoded = decodeURIComponent(escape(atob(encoded)))
    return xorCipher(decoded, CIPHER_KEY)
  } catch {
    return null
  }
}

// ── Firmas (Anti-falsificación) ──────────────────────────────────────

const SIGNATURE_SALT = 'AsistIDO_Secure_Salt_2026'

/**
 * Genera un hash SHA-256 ligero para firmar el contenido del QR.
 * Evita que se falsifiquen QRs simplemente cifrando un UUID con XOR.
 */
export async function generateSignature(payload: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(payload + SIGNATURE_SALT)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  // Retornamos solo los primeros 16 caracteres para no hacer el QR gigante
  return hashHex.substring(0, 16)
}

/**
 * Verifica que un payload coincida con su firma.
 */
export async function verifySignature(payload: string, signature: string): Promise<boolean> {
  if (!signature) return false
  const expected = await generateSignature(payload)
  return expected === signature
}
