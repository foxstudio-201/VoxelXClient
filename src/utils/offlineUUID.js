/**
 * Generate a Mojang-compatible offline UUID for a given username.
 *
 * Mojang's algorithm (used by vanilla server for offline mode):
 *   UUID = UUID.nameUUIDFromBytes("OfflinePlayer:<username>".getBytes("UTF-8"))
 *
 * Which is UUID v3 (MD5-based) with a special namespace:
 *   namespace = 00000000-0000-0000-0000-000000000000  (null UUID / no namespace)
 *   BUT Mojang does NOT use a namespace — it hashes the raw bytes directly,
 *   then sets version=3 and variant=2 bits.
 *
 * Exact steps:
 *   1. UTF-8 encode "OfflinePlayer:<username>"
 *   2. MD5 hash the bytes
 *   3. Set bits: hash[6] = (hash[6] & 0x0f) | 0x30   → version 3
 *                hash[8] = (hash[8] & 0x3f) | 0x80   → variant 2 (RFC 4122)
 *   4. Format as 8-4-4-4-12 hex string
 */

// ─── Pure-JS MD5 (RFC 1321) ───────────────────────────────────────────────────
// Compact implementation — no external deps
function md5(input /* Uint8Array */) {
  // Pre-processing: add padding bits
  const msgLen = input.length
  const bitLen = msgLen * 8

  // Pad to 448 mod 512 bits, then append 64-bit length
  const padLen = ((msgLen % 64) < 56 ? 56 : 120) - (msgLen % 64)
  const padded = new Uint8Array(msgLen + padLen + 8)
  padded.set(input)
  padded[msgLen] = 0x80
  // Append length as 64-bit little-endian
  const dv = new DataView(padded.buffer)
  dv.setUint32(msgLen + padLen,     bitLen >>> 0,        true)
  dv.setUint32(msgLen + padLen + 4, Math.floor(bitLen / 2**32), true)

  // MD5 constants
  const T = new Uint32Array(64)
  for (let i = 0; i < 64; i++) T[i] = (Math.abs(Math.sin(i + 1)) * 2**32) >>> 0

  const S = [
    7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
    5, 9,14,20, 5, 9,14,20, 5, 9,14,20, 5, 9,14,20,
    4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
    6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21,
  ]

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476

  for (let i = 0; i < padded.length; i += 64) {
    const M = new Uint32Array(16)
    for (let j = 0; j < 16; j++) {
      M[j] = dv.getUint32(i + j * 4, true)
    }

    let A = a0, B = b0, C = c0, D = d0

    for (let j = 0; j < 64; j++) {
      let F, g
      if (j < 16) {
        F = (B & C) | (~B & D); g = j
      } else if (j < 32) {
        F = (D & B) | (~D & C); g = (5 * j + 1) % 16
      } else if (j < 48) {
        F = B ^ C ^ D;           g = (3 * j + 5) % 16
      } else {
        F = C ^ (B | ~D);        g = (7 * j) % 16
      }
      F = (F + A + T[j] + M[g]) >>> 0
      A = D; D = C; C = B
      B = (B + ((F << S[j]) | (F >>> (32 - S[j])))) >>> 0
    }

    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }

  // Output as Uint8Array (little-endian per word)
  const out = new Uint8Array(16)
  const odv = new DataView(out.buffer)
  odv.setUint32(0,  a0, true)
  odv.setUint32(4,  b0, true)
  odv.setUint32(8,  c0, true)
  odv.setUint32(12, d0, true)
  return out
}

// ─── UTF-8 encode ─────────────────────────────────────────────────────────────
function utf8Encode(str) {
  return new TextEncoder().encode(str)
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Returns the Mojang offline UUID for a username.
 * @param {string} username  e.g. "Steve"
 * @returns {string}         e.g. "61699b2e-d327-3932-9a6e-dc1f5b49b843"
 */
export function offlineUUID(username) {
  const input = utf8Encode(`OfflinePlayer:${username}`)
  const hash  = md5(input)

  // Set version = 3
  hash[6] = (hash[6] & 0x0f) | 0x30
  // Set variant = RFC 4122 (10xx xxxx)
  hash[8] = (hash[8] & 0x3f) | 0x80

  const hex = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}
