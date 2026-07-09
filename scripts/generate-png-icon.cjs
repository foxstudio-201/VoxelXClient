/**
 * Generate src/assets/VoxelXLauncher-logo.png (512x512) for Discord RPC asset
 * from martian_512x.png
 */
const fs = require('fs')
const path = require('path')

const input = path.join(__dirname, '../martian_512x.png')
const output = path.join(__dirname, '../src/assets/VoxelXLauncher-logo.png')

if (!fs.existsSync(input)) {
  console.error(`❌  Not found: ${input}`)
  process.exit(1)
}

fs.copyFileSync(input, output)
console.log(`✅  VoxelXLauncher-logo.png → ${output}  (512x512)`)
