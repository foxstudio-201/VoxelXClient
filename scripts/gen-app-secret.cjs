/**
 * Script tạo APP_SECRET ngẫu nhiên lúc build/install.
 * Chạy tự động qua postinstall.
 * File output bị gitignore — không bao giờ commit lên repo.
 */

const crypto = require('crypto')
const fs     = require('fs')
const path   = require('path')

const OUT_FILE = path.join(__dirname, '../electron/app-secret.cjs')

// Nếu file đã tồn tại → giữ nguyên (không tạo lại mỗi lần install)
if (fs.existsSync(OUT_FILE)) {
  console.log('[gen-secret] app-secret.cjs đã tồn tại, bỏ qua.')
  process.exit(0)
}

// Tạo 48 bytes ngẫu nhiên → base64url (64 ký tự)
const secret = crypto.randomBytes(48).toString('base64url')
const appId  = 'com.voxelxclient.launcher'

// Obfuscate nhẹ: chia secret thành nhiều mảnh, ghép lại lúc runtime
// Ai đọc file này cũng không thấy secret nguyên vẹn
const mid    = Math.floor(secret.length / 2)
const part1  = secret.slice(0, mid)
const part2  = secret.slice(mid)
const xorKey = 0x5A

// XOR từng char của part2 với key → lưu dạng số
const part2Encoded = Array.from(part2).map(c => c.charCodeAt(0) ^ xorKey)

const content = `// AUTO-GENERATED — DO NOT EDIT — DO NOT COMMIT
// Tạo bởi scripts/gen-app-secret.cjs lúc npm install
// File này bị gitignore và sẽ được tạo lại nếu bị xóa
'use strict'
const _a = ${JSON.stringify(part1)}
const _b = ${JSON.stringify(part2Encoded)}.map(c => String.fromCharCode(c ^ ${xorKey})).join('')
const _id = ${JSON.stringify(appId)}
module.exports = { secret: _a + _b, appId: _id }
`

fs.writeFileSync(OUT_FILE, content, { encoding: 'utf-8', mode: 0o600 })
console.log('[gen-secret] Đã tạo app-secret.cjs')
