// Wrapper to re-export marked from UMD bundle
import './marked.min.js'

// marked.min.js sets window.marked in browser context via UMD
// In Vite/ESM context it uses exports — access via globalThis fallback
const m = globalThis.marked || (typeof marked !== 'undefined' ? marked : null)

export const markedParse = m
  ? (text, opts) => m.parse(text, opts)
  : (text) => `<p>${text}</p>` // fallback
