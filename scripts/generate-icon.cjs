/**
 * Generate a valid .ico file with the VoxelXLauncher logo (4 green squares)
 * Sizes: 256x256, 48x48, 32x32, 16x16
 * No external dependencies — pure Node.js Buffer manipulation
 */

const fs = require('fs')
const path = require('path')

// ─── Draw a frame as raw RGBA pixels ────────────────────────────────────────
function drawFrame(size) {
  const buf = Buffer.alloc(size * size * 4, 0) // transparent black

  const pad   = Math.max(1, Math.round(size * 0.08))  // outer padding
  const gap   = Math.max(1, Math.round(size * 0.06))  // gap between squares
  const half  = Math.floor((size - pad * 2 - gap) / 2) // square side

  // 4 squares: top-left, top-right, bottom-left, bottom-right
  const squares = [
    { x: pad,          y: pad,          color: [74, 222, 128, 255] },  // #4ade80
    { x: pad + half + gap, y: pad,      color: [34, 197, 94,  255] },  // #22c55e
    { x: pad,          y: pad + half + gap, color: [22, 163, 74, 255] }, // #16a34a
    { x: pad + half + gap, y: pad + half + gap, color: [74, 222, 128, 255] }, // #4ade80
  ]

  for (const sq of squares) {
    for (let row = 0; row < half; row++) {
      for (let col = 0; col < half; col++) {
        const px = sq.x + col
        const py = sq.y + row
        if (px >= size || py >= size) continue
        const idx = (py * size + px) * 4
        buf[idx]     = sq.color[0]
        buf[idx + 1] = sq.color[1]
        buf[idx + 2] = sq.color[2]
        buf[idx + 3] = sq.color[3]
      }
    }
  }

  return buf
}

// ─── Encode one BMP DIB (Device Independent Bitmap) for ICO ─────────────────
function encodeBMPDIB(size, rgbaPixels) {
  const rowBytes  = size * 4
  const xorSize   = rowBytes * size
  const andSize   = Math.ceil(size / 8) * size  // 1-bit AND mask (all 0 = opaque)
  const dibSize   = 40 + xorSize + andSize

  const dib = Buffer.alloc(dibSize, 0)
  let o = 0

  // BITMAPINFOHEADER (40 bytes)
  dib.writeUInt32LE(40,        o);      o += 4  // biSize
  dib.writeInt32LE(size,       o);      o += 4  // biWidth
  dib.writeInt32LE(size * 2,   o);      o += 4  // biHeight (×2 for XOR+AND)
  dib.writeUInt16LE(1,         o);      o += 2  // biPlanes
  dib.writeUInt16LE(32,        o);      o += 2  // biBitCount
  dib.writeUInt32LE(0,         o);      o += 4  // biCompression (BI_RGB)
  dib.writeUInt32LE(xorSize,   o);      o += 4  // biSizeImage
  dib.writeInt32LE(0,          o);      o += 4  // biXPelsPerMeter
  dib.writeInt32LE(0,          o);      o += 4  // biYPelsPerMeter
  dib.writeUInt32LE(0,         o);      o += 4  // biClrUsed
  dib.writeUInt32LE(0,         o);      o += 4  // biClrImportant

  // XOR mask — BGRA, bottom-up
  for (let row = size - 1; row >= 0; row--) {
    for (let col = 0; col < size; col++) {
      const src = (row * size + col) * 4
      dib[o++] = rgbaPixels[src + 2]  // B
      dib[o++] = rgbaPixels[src + 1]  // G
      dib[o++] = rgbaPixels[src + 0]  // R
      dib[o++] = rgbaPixels[src + 3]  // A
    }
  }

  // AND mask — all zeros (fully opaque), bottom-up, padded to 4-byte rows
  const andRowBytes = Math.ceil(size / 8)
  const andRowPad   = (4 - (andRowBytes % 4)) % 4
  for (let row = 0; row < size; row++) {
    o += andRowBytes + andRowPad
  }

  return dib
}

// ─── Build the full .ico file ────────────────────────────────────────────────
function buildICO(sizes) {
  const frames = sizes.map(s => ({ size: s, rgba: drawFrame(s), dib: null }))
  frames.forEach(f => { f.dib = encodeBMPDIB(f.size, f.rgba) })

  const headerSize  = 6
  const dirEntrySize = 16
  const dirSize     = headerSize + dirEntrySize * frames.length

  // Calculate offsets
  let offset = dirSize
  frames.forEach(f => { f.offset = offset; offset += f.dib.length })

  const parts = []

  // ICO header
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)              // reserved
  header.writeUInt16LE(1, 2)              // type: 1 = ICO
  header.writeUInt16LE(frames.length, 4)
  parts.push(header)

  // Directory entries
  for (const f of frames) {
    const entry = Buffer.alloc(16)
    entry[0] = f.size >= 256 ? 0 : f.size  // width  (0 = 256)
    entry[1] = f.size >= 256 ? 0 : f.size  // height (0 = 256)
    entry[2] = 0   // color count
    entry[3] = 0   // reserved
    entry.writeUInt16LE(1,          4)      // planes
    entry.writeUInt16LE(32,         6)      // bit count
    entry.writeUInt32LE(f.dib.length, 8)   // size of image data
    entry.writeUInt32LE(f.offset,  12)     // offset
    parts.push(entry)
  }

  // Image data
  frames.forEach(f => parts.push(f.dib))

  return Buffer.concat(parts)
}

// ─── Write output ────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, '../public/icon.ico')
const ico = buildICO([256, 48, 32, 16])
fs.writeFileSync(outPath, ico)
console.log(`✅  icon.ico written → ${outPath}  (${ico.length} bytes)`)
