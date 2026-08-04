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
