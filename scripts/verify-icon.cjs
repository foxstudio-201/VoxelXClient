const fs = require('fs')
const buf = fs.readFileSync('public/icon.ico')
const reserved = buf.readUInt16LE(0)
const type     = buf.readUInt16LE(2)
const count    = buf.readUInt16LE(4)
console.log('Reserved:', reserved, '(must be 0)')
console.log('Type:', type, '(must be 1 for ICO)')
console.log('Image count:', count)
for (let i = 0; i < count; i++) {
  const o    = 6 + i * 16
  const w    = buf[o]     || 256
  const h    = buf[o + 1] || 256
  const bits = buf.readUInt16LE(o + 6)
  console.log('  [' + i + '] ' + w + 'x' + h + ' @ ' + bits + 'bpp')
}
