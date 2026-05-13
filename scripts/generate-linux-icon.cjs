/**
 * Generate public/icon.png (512x512) for Linux electron-builder
 */
const fs   = require('fs')
const path = require('path')
const { deflateSync } = require('zlib')

const SIZE   = 512
const PAD    = Math.round(SIZE * 0.08)
const GAP    = Math.round(SIZE * 0.05)
const SQUARE = Math.floor((SIZE - PAD * 2 - GAP) / 2)
const RADIUS = Math.round(SQUARE * 0.18)

const COLORS = [
  [74, 222, 128],
  [34, 197, 94],
  [22, 163, 74],
  [74, 222, 128],
]
const BG = [10, 10, 10]

function writePNG(width, height, rgba) {
  function u32be(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n, 0); return b }
  const crcTable = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      t[i] = c
    }
    return t
  })()
  function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }
  function chunk(type, data) {
    const typeB = Buffer.from(type, 'ascii')
    return Buffer.concat([u32be(data.length), typeB, data, u32be(crc32(Buffer.concat([typeB, data])))])
  }
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4, dst = y * (width * 4 + 1) + 1 + x * 4
      raw[dst] = rgba[src]; raw[dst+1] = rgba[src+1]; raw[dst+2] = rgba[src+2]; raw[dst+3] = rgba[src+3]
    }
  }
  const sig  = Buffer.from([137,80,78,71,13,10,26,10])
  const ihdr = chunk('IHDR', Buffer.concat([u32be(width), u32be(height), Buffer.from([8,6,0,0,0])]))
  const idat = chunk('IDAT', deflateSync(raw, { level: 6 }))
  const iend = chunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, ihdr, idat, iend])
}

function inRoundedRect(px, py, rx, ry, rw, rh, r) {
  if (px < rx || px >= rx+rw || py < ry || py >= ry+rh) return false
  const inInner  = px >= rx+r && px < rx+rw-r && py >= ry && py < ry+rh
  const inInnerH = px >= rx && px < rx+rw && py >= ry+r && py < ry+rh-r
  if (inInner || inInnerH) return true
  for (const [cx,cy] of [[rx+r,ry+r],[rx+rw-r,ry+r],[rx+r,ry+rh-r],[rx+rw-r,ry+rh-r]]) {
    const dx = px-cx, dy = py-cy
    if (dx*dx+dy*dy < r*r) return true
  }
  return false
}

const rgba = Buffer.alloc(SIZE * SIZE * 4)
for (let i = 0; i < SIZE*SIZE; i++) { rgba[i*4]=BG[0]; rgba[i*4+1]=BG[1]; rgba[i*4+2]=BG[2]; rgba[i*4+3]=255 }

const positions = [[PAD,PAD],[PAD+SQUARE+GAP,PAD],[PAD,PAD+SQUARE+GAP],[PAD+SQUARE+GAP,PAD+SQUARE+GAP]]
for (let qi = 0; qi < 4; qi++) {
  const [qx,qy] = positions[qi], [r,g,b] = COLORS[qi]
  for (let py = qy; py < qy+SQUARE; py++)
    for (let px = qx; px < qx+SQUARE; px++) {
      if (!inRoundedRect(px,py,qx,qy,SQUARE,SQUARE,RADIUS)) continue
      const idx = (py*SIZE+px)*4
      rgba[idx]=r; rgba[idx+1]=g; rgba[idx+2]=b; rgba[idx+3]=255
    }
}

const outPath = path.join(__dirname, '../public/icon.png')
fs.writeFileSync(outPath, writePNG(SIZE, SIZE, rgba))
console.log(`✅  icon.png → ${outPath}  (${SIZE}x${SIZE})`)
