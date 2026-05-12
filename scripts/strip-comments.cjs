const fs = require('fs')
const path = require('path')
const acorn = require('acorn')

const ROOT_DIRS = [
  path.join(process.cwd(), 'src'),
  path.join(process.cwd(), 'electron')
]

const TARGET_EXTS = new Set(['.js', '.jsx', '.css', '.cjs'])
const SEPARATOR_RE = /^\s*\/\/\s*───.*$/u

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function collectFiles() {
  const files = []
  for (const dir of ROOT_DIRS) {
    for (const file of walk(dir)) {
      const ext = path.extname(file).toLowerCase()
      if (TARGET_EXTS.has(ext)) files.push(file)
    }
  }
  return files
}

function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

function stripJsCommentsWithRegex(source, keepSeparator) {
  const lines = source.split(/\r?\n/)
  const result = []
  let inBlock = false

  for (let line of lines) {
    if (inBlock) {
      const endIdx = line.indexOf('*/')
      if (endIdx !== -1) {
        inBlock = false
        line = line.slice(endIdx + 2)
      } else {
        continue
      }
    }

    let processed = line

    const blockStart = processed.indexOf('/*')
    if (blockStart !== -1) {
      const blockEnd = processed.indexOf('*/', blockStart + 2)
      if (blockEnd !== -1) {
        processed = processed.slice(0, blockStart) + processed.slice(blockEnd + 2)
      } else {
        processed = processed.slice(0, blockStart)
        inBlock = true
      }
    }

    const lineCommentIdx = processed.indexOf('//')
    if (lineCommentIdx !== -1) {
      const beforeComment = processed.slice(0, lineCommentIdx)
      const commentPart = processed.slice(lineCommentIdx)

      if (keepSeparator && SEPARATOR_RE.test(commentPart)) {
        processed = beforeComment + commentPart
      } else {
        const inString = checkIfInString(processed, lineCommentIdx)
        if (!inString) {
          processed = beforeComment.replace(/\s+$/, '')
        }
      }
    }

    result.push(processed)
  }

  return result.join('\n')
}

function checkIfInString(line, idx) {
  let inDouble = false
  let inSingle = false
  let inTemplate = false
  let escape = false

  for (let i = 0; i < idx; i++) {
    const ch = line[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"' && !inSingle && !inTemplate) inDouble = !inDouble
    else if (ch === "'" && !inDouble && !inTemplate) inSingle = !inSingle
    else if (ch === '`' && !inDouble && !inSingle) inTemplate = !inTemplate
  }

  return inDouble || inSingle || inTemplate
}

function stripCommentsFromCode(source, ext) {
  if (ext === '.css') {
    return stripCssComments(source)
  }

  let result = source

  try {
    const comments = []
    const parser = ext === '.jsx' ? require('acorn-jsx') : null

    const config = {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowHashBang: true,
      onComment(block, text, start, end) {
        comments.push({ block, text, start, end })
      }
    }

    if (parser) {
      acorn.Parser.extend(parser()).parse(source, config)
    } else {
      acorn.parse(source, config)
    }

    let processed = ''
    let cursor = 0

    for (const comment of comments) {
      processed += source.slice(cursor, comment.start)

      const rawComment = source.slice(comment.start, comment.end)
      if (!comment.block && SEPARATOR_RE.test(rawComment)) {
        processed += rawComment
      }

      cursor = comment.end
    }

    processed += source.slice(cursor)
    result = processed
  } catch (e) {
    result = stripJsCommentsWithRegex(source, true)
  }

  const lines = result.split(/\r?\n/)
  const cleaned = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === '') {
      if (cleaned.length === 0) continue
      if (cleaned[cleaned.length - 1] === '') continue
      cleaned.push('')
      continue
    }

    cleaned.push(line.replace(/[ \t]+$/g, ''))
  }

  return cleaned.join('\n').trimStart() + '\n'
}

let updated = 0
let failed = 0
let skipped = 0

for (const file of collectFiles()) {
  try {
    const ext = path.extname(file).toLowerCase()
    const basename = path.basename(file).toLowerCase()

    if (basename.includes('.min.')) {
      skipped++
      continue
    }

    const source = fs.readFileSync(file, 'utf8')
    const stripped = stripCommentsFromCode(source, ext)

    if (stripped !== source) {
      fs.writeFileSync(file, stripped, 'utf8')
      updated++
      console.log(`UPDATED ${path.relative(process.cwd(), file)}`)
    } else {
      skipped++
    }
  } catch (error) {
    failed++
    console.error(`FAILED ${path.relative(process.cwd(), file)}: ${error.message}`)
  }
}

console.log(`DONE updated=${updated} skipped=${skipped} failed=${failed}`)