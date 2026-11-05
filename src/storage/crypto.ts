// Criptografia client-side (Web Crypto). A frase-senha nunca é gravada em disco.
const enc = new TextEncoder(), dec = new TextDecoder()
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export interface EncryptedBlob { v: 1; salt: string; iv: string; data: string }

async function key(pass: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 310000, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
export async function encryptText(plain: string, pass: string): Promise<EncryptedBlob> {
  if (!pass) throw new Error('Frase-senha obrigatória')
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pass, salt), enc.encode(plain))
  return { v: 1, salt: b64(salt), iv: b64(iv), data: b64(ct) }
}
export async function decryptText(blob: EncryptedBlob, pass: string): Promise<string> {
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) as BufferSource }, await key(pass, unb64(blob.salt)), unb64(blob.data))
    return dec.decode(pt)
  } catch { throw new Error('Frase-senha incorreta ou dados corrompidos') }
}
export async function sha256Hex(text: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('')
}
