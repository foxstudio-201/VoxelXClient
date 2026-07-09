import { useState, useEffect, createContext, useContext } from 'react'
import { loadAppSettings, saveAppSettings } from '../utils/appSettings'

export const LangContext = createContext(null)

const cache = {}

async function fetchLang(code) {
  if (cache[code]) return cache[code]
  const res = await fetch(`/locales/${code}.json`)
  if (!res.ok) return null
  const data = await res.json()
  cache[code] = data
  return data
}

async function fetchLangList() {
  try {
    const res = await fetch('/locales/index.json')
    return (await res.json()).languages || []
  } catch {
    return [
      { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
      { code: 'en', name: 'English', flag: '🇬🇧' },
    ]
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
