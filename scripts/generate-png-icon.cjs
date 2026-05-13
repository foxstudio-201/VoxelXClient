/**
 * Generate VoxelXClient logo PNG (512x512) cho Discord RPC asset.
 * Logo: 4 ô vuông xanh trên nền tối, giống icon app.
 * Output: src/assets/voxelxclient-logo.png
 */

const fs   = require('fs')
const path = require('path')

const SIZE    = 512
const PAD     = Math.round(SIZE * 0.08)   // padding ngoài
const GAP     = Math.round(SIZE * 0.05)   // khoảng cách giữa 2 ô
const SQUARE  = Math.floor((SIZE - PAD * 2 - GAP) / 2)
const RADIUS  = Math.round(SQUARE * 0.18) // bo góc

// Màu 4 ô (top-left, top-right, bottom-left, bottom-right)
const COLORS = [
  [74, 222, 128],   // #4ade80
  [34, 197, 94],    // #22c55e
  [22, 163, 74],    // #16a34a
  [74, 222, 128],   // #4ade80
]

const BG = [10, 10, 10]  // #0a0a0a

// ─── Tạo PNG thủ công (không dùng thư viện) ──────────────────────────────────
// Dùng raw RGBA buffer rồi encode PNG bằng zlib

const { deflateSync } = require('zlib')

function writePNG(width, height, rgba) {
  function u32be(n) {
    const b = Buffer.alloc(4)
    b.writeUInt32BE(n, 0)
    return b
  }

  function chunk(type, data) {
    const typeB = Buffer.from(type, 'ascii')
    const crc   = crc32(Buffer.concat([typeB, data]))
    return Buffer.concat([u32be(data.length), typeB, data, u32be(crc)])
  }

  // CRC32
  const crcTable = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      t[i] = c
    }
    return t
  })()

  function crc32(buf) {
    let c = 0xFFFFFFFF
    for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8)
    return (c ^ 0xFFFFFFFF) >>> 0
  }

  // Filter + compress scanlines
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0  // filter type None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4
      const dst = y * (width * 4 + 1) + 1 + x * 4
      raw[dst]     = rgba[src]
      raw[dst + 1] = rgba[src + 1]
      raw[dst + 2] = rgba[src + 2]
      raw[dst + 3] = rgba[src + 3]
    }
  }
  const compressed = deflateSync(raw, { level: 6 })

  const sig    = Buffer.from([137,80,78,71,13,10,26,10])
  const ihdr   = chunk('IHDR', Buffer.concat([u32be(width), u32be(height), Buffer.from([8,6,0,0,0])]))
  const idat   = chunk('IDAT', compressed)
  const iend   = chunk('IEND', Buffer.alloc(0))

  return Buffer.concat([sig, ihdr, idat, iend])
}

// ─── Draw ─────────────────────────────────────────────────────────────────────
function inRoundedRect(px, py, rx, ry, rw, rh, r) {
  if (px < rx || px >= rx + rw || py < ry || py >= ry + rh) return false
  // Check corners
  const corners = [
    [rx + r,      ry + r],
    [rx + rw - r, ry + r],
    [rx + r,      ry + rh - r],
    [rx + rw - r, ry + rh - r],
  ]
  const inInner = px >= rx + r && px < rx + rw - r && py >= ry && py < ry + rh
  const inInnerH = px >= rx && px < rx + rw && py >= ry + r && py < ry + rh - r
  if (inInner || inInnerH) return true
  for (const [cx, cy] of corners) {
    const dx = px - cx, dy = py - cy
    if (dx * dx + dy * dy < r * r) return true
  }
  return false
}

const rgba = Buffer.alloc(SIZE * SIZE * 4)

// Fill background
for (let i = 0; i < SIZE * SIZE; i++) {
  rgba[i * 4]     = BG[0]
  rgba[i * 4 + 1] = BG[1]
  rgba[i * 4 + 2] = BG[2]
  rgba[i * 4 + 3] = 255
}

// Draw 4 squares
const positions = [
  [PAD,              PAD],
  [PAD + SQUARE + GAP, PAD],
  [PAD,              PAD + SQUARE + GAP],
  [PAD + SQUARE + GAP, PAD + SQUARE + GAP],
]

for (let qi = 0; qi < 4; qi++) {
  const [qx, qy] = positions[qi]
  const [r, g, b] = COLORS[qi]

  for (let py = qy; py < qy + SQUARE; py++) {
    for (let px = qx; px < qx + SQUARE; px++) {
      if (!inRoundedRect(px, py, qx, qy, SQUARE, SQUARE, RADIUS)) continue
      const idx = (py * SIZE + px) * 4
      rgba[idx]     = r
      rgba[idx + 1] = g
      rgba[idx + 2] = b
      rgba[idx + 3] = 255
    }
  }
}

// ─── Write output ─────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '../src/assets')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const outPath = path.join(outDir, 'voxelxclient-logo.png')
const png     = writePNG(SIZE, SIZE, rgba)
fs.writeFileSync(outPath, png)
console.log(`✅  voxelxclient-logo.png → ${outPath}  (${SIZE}x${SIZE}, ${png.length} bytes)`)
