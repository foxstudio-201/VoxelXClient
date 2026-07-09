/**
 * Generate public/icon.ico from martian_256x.png
 * Requires ImageMagick (convert/magick)
 */
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const input = path.join(__dirname, '../martian_256x.png')
const output = path.join(__dirname, '../public/icon.ico')

if (!fs.existsSync(input)) {
  console.error(`❌  Not found: ${input}`)
  process.exit(1)
}

execSync(`convert "${input}" -define icon:auto-resize=256,128,64,48,32,16 "${output}"`, { stdio: 'inherit' })
const stat = fs.statSync(output)
console.log(`✅  icon.ico → ${output}  (${stat.size} bytes)`)
