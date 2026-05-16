import { useEffect, useRef } from 'react'

const MUSIC_SRC = new URL('../assets/sound/LIGHTS.mp3', import.meta.url).href

const MIN_PAUSE_MS = 1 * 60 * 1000
const MAX_PAUSE_MS = 3 * 60 * 1000

function randomPause() {
  return MIN_PAUSE_MS + Math.random() * (MAX_PAUSE_MS - MIN_PAUSE_MS)
}

export function useBgMusic(splashDone) {
  const audioRef   = useRef(null)
  const timerRef   = useRef(null)
  const activeRef  = useRef(false)
  const enabledRef = useRef(true)          
  const volumeRef  = useRef(35 / 100)      

  useEffect(() => {
    function handleInit(e) {
      const { enabled, volume } = e.detail ?? {}
      if (typeof enabled === 'boolean') enabledRef.current = enabled
      if (typeof volume  === 'number')  volumeRef.current  = volume / 100
    }
    window.addEventListener('vxc-music-init', handleInit)
    return () => window.removeEventListener('vxc-music-init', handleInit)
  }, [])

  useEffect(() => {
    function handleChange(e) {
      const { enabled, volume } = e.detail ?? {}
      const audio = audioRef.current

      if (typeof enabled === 'boolean') {
        enabledRef.current = enabled
        if (!audio) return

        if (!enabled) {
          fadeOutAudio(audio, 800).then(() => {
            if (!enabledRef.current) audio.pause()
          })
        } else {
          if (audio.paused) {
            audio.currentTime = 0
            audio.volume = 0
            audio.play().catch(() => {})
            fadeInAudio(audio, volumeRef.current, 1500)
          }
        }
      }

      if (typeof volume === 'number') {
        volumeRef.current = volume / 100
        if (audio && !audio.paused && enabledRef.current) {
          smoothVolume(audio, volume / 100, 300)
        }
      }
    }

    window.addEventListener('vxc-music-change', handleChange)
    return () => window.removeEventListener('vxc-music-change', handleChange)
  }, [])

  useEffect(() => {
    if (!splashDone) return

    activeRef.current = true

    const audio = new Audio(MUSIC_SRC)
    audio.volume = 0
    audio.preload = 'auto'
    audioRef.current = audio

    function playOnce() {
      if (!activeRef.current || !enabledRef.current) return
      audio.currentTime = 0
      audio.volume = 0
      audio.play().catch(() => {})
      fadeInAudio(audio, volumeRef.current, 2000)
    }

    function handleEnded() {
      if (!activeRef.current) return
      timerRef.current = setTimeout(() => {
        if (activeRef.current) playOnce()
      }, randomPause())
    }

    audio.addEventListener('ended', handleEnded)
    playOnce()

    return () => {
      activeRef.current = false
      clearTimeout(timerRef.current)
      audio.removeEventListener('ended', handleEnded)
      fadeOutAudio(audio, 800).then(() => {
        audio.pause()
        audio.src = ''
      })
    }
  }, [splashDone])
}

function fadeInAudio(audio, targetVolume, durationMs) {
  const steps    = 40
  const stepTime = durationMs / steps
  const stepVol  = targetVolume / steps
  let current    = 0
  const iv = setInterval(() => {
    current += stepVol
    audio.volume = Math.min(current, targetVolume)
    if (current >= targetVolume) clearInterval(iv)
  }, stepTime)
}

function fadeOutAudio(audio, durationMs) {
  return new Promise(resolve => {
    const startVol = audio.volume
    if (startVol === 0) { resolve(); return }
    const steps    = 30
    const stepTime = durationMs / steps
    const stepVol  = startVol / steps
    const iv = setInterval(() => {
      audio.volume = Math.max(0, audio.volume - stepVol)
      if (audio.volume <= 0) { clearInterval(iv); resolve() }
    }, stepTime)
  })
}

function smoothVolume(audio, targetVolume, durationMs) {
  const start  = audio.volume
  const diff   = targetVolume - start
  const steps  = 20
  const stepTime = durationMs / steps
  let step = 0
  const iv = setInterval(() => {
    step++
    audio.volume = Math.min(1, Math.max(0, start + diff * (step / steps)))
    if (step >= steps) clearInterval(iv)
  }, stepTime)
}
