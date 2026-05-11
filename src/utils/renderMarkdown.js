import { marked } from './marked.esm.js'

marked.setOptions({ breaks: true, gfm: true })

const markedParse = (src) => marked.parse(src)

/**
 * Pre-process Markdown that has been stripped of newlines
 * Insert \n\n before block-level elements so marked can parse them
 */
function restoreNewlines(md) {
  // Step 1: Protect inline elements from being split
  // Replace image/link patterns with placeholders temporarily
  const placeholders = []
  let protected_md = md.replace(/!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\)/g, (match) => {
    const idx = placeholders.length
    placeholders.push(match)
    return `\x00PLACEHOLDER${idx}\x00`
  })

  // Step 2: Insert newlines before block-level markers
  protected_md = protected_md
    // Before headings (## Title) — only if preceded by non-newline
    .replace(/([^\n])(#{1,6} )/g, '$1\n\n$2')
    // Before unordered list items
    .replace(/([^\n\-\*\+])(\n?[\*\-\+] )/g, '$1\n$2')
    // Before numbered list items
    .replace(/([^\n])(\n?\d+\. )/g, '$1\n$2')
    // Before blockquotes
    .replace(/([^\n])(> )/g, '$1\n\n$2')
    // Before horizontal rules
    .replace(/([^\n])(---+|===+)(\s)/g, '$1\n\n$2$3')
    // Clean up excessive newlines
    .replace(/\n{4,}/g, '\n\n\n')

  // Step 3: Restore placeholders
  protected_md = protected_md.replace(/\x00PLACEHOLDER(\d+)\x00/g, (_, idx) => placeholders[parseInt(idx)])

  return protected_md
}

export function renderMarkdown(content) {
  if (!content) return ''

  // If it's HTML already, just sanitize
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return sanitize(content)
  }

  // Check if content lacks newlines (single-line Markdown)
  const lineCount = (content.match(/\n/g) || []).length
  const charCount = content.length
  // If very few newlines relative to content length, restore them
  const processed = (lineCount < charCount / 200) ? restoreNewlines(content) : content

  const html = markedParse(processed)
  return sanitize(html)
}

function sanitize(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    .replace(/href="javascript:[^"]*"/gi, 'href="#"')
    .replace(/<a\b(?![^>]*\btarget=)/gi, '<a target="_blank" rel="noopener noreferrer" ')
    .replace(/<img\b/gi, '<img onerror="this.style.display=\'none\'" ')
}
