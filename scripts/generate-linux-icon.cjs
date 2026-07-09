/**
 * Generate public/icon.png (512x512) from martian_512x.png
 */
const fs = require('fs')
const path = require('path')

const input = path.join(__dirname, '../martian_512x.png')
const output = path.join(__dirname, '../public/icon.png')

if (!fs.existsSync(input)) {
  console.error(`❌  Not found: ${input}`)
  process.exit(1)
}

fs.copyFileSync(input, output)
console.log(`✅  icon.png → ${output}  (512x512)`)
