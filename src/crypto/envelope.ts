// AES-GCM field envelope: every encrypted value is stored as base64 {iv, ct}.
// GCM authenticates the ciphertext, so tampering or a wrong key throws on decrypt.

export interface Envelope {
  iv: string;
  ct: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function encryptField(
  key: CryptoKey,
  plaintext: string,
): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  );
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

export async function decryptField(
  key: CryptoKey,
  env: Envelope,
): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(env.iv) },
    key,
    fromBase64(env.ct),
  );
  return decoder.decode(plaintext);
}
