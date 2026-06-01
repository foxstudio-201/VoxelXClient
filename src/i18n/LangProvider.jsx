import { useState, useEffect, createContext, useContext } from 'react'
import { loadAppSettings, saveAppSettings } from '../utils/appSettings'

export const LangContext = createContext(null)

const GITHUB_BASE = 'https://raw.githubusercontent.com/foxstudio-201/VoxelXClient/main/public/locales'
const cache = {}

async function fetchLang(code) {
  if (cache[code]) return cache[code]
  // Thử local trước (luôn mới nhất khi build)
  try {
    const res = await fetch(`/locales/${code}.json`)
    if (res.ok) {
      const data = await res.json()
      cache[code] = data
      return data
    }
  } catch {}
  // Fallback về GitHub nếu local không có
  try {
    const bust = Date.now()
    const res = await fetch(`${GITHUB_BASE}/${code}.json?v=${bust}`, { cache: 'no-store' })
    if (!res.ok) throw new Error('fetch failed')
    const data = await res.json()
    cache[code] = data
    return data
  } catch {
    return null
  }
}

async function fetchLangList() {
  try {
    const res = await fetch(`${GITHUB_BASE}/index.json`, { cache: 'no-store' })
    if (!res.ok) throw new Error()
    return (await res.json()).languages || []
  } catch {
    try {
      const res2 = await fetch('/locales/index.json')
      return (await res2.json()).languages || []
    } catch {
      return [
        { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
        { code: 'en', name: 'English', flag: '🇬🇧' },
      ]
    }
  }
}

function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((acc, k) => acc?.[k], obj)
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('vi')
  const [translations, setTranslations] = useState({})
  const [langs, setLangs] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchLangList().then(setLangs)
    loadAppSettings().then(s => {
      const code = s?.language || 'vi'
      setLangState(code)
      fetchLang(code).then(data => { if (data) setTranslations(data) })
    })
  }, [])

  async function setLang(code) {
    setLoading(true)
    const data = await fetchLang(code)
    if (data) {
      setTranslations(data)
      setLangState(code)
      saveAppSettings({ language: code })
      window.dispatchEvent(new CustomEvent('vxc-lang-change', { detail: code }))
    }
    setLoading(false)
  }

  function t(key, vars = {}) {
    let str = getNestedValue(translations, key) || key
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`{{${k}}}`, 'g'), v)
    })
    return str
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t, langs, loading, translations }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside LangProvider')
  return ctx
}
