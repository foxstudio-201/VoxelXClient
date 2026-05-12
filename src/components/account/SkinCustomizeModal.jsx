/**
 * VoxelXClient — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXClient
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - This software is provided as-is without warranty of any kind.
 *   - Do not redistribute or resell without explicit permission from FoxStudio.
 *   - If you use or reference this code, please credit FoxStudio.
 *   - Minecraft is a trademark of Mojang Studios / Microsoft. This project is not affiliated with Mojang.
 */

 /**
 * VoxelXClient — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXClient
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - Dành cho mấy cháu cứ thích phỉ báng.
 *   - Launcher sử dụng ai đi kèm trong việc tạo, bản thân người tạo không tự nhận là code toàn bộ do có sự hỗ trợ của ai, vậy nên đừng có mà nói này nói nọ.
 *   - Giỏi giang thì tự code bằng năng lực của mình đi, còn không làm được đừng có kích đểu ảnh hưởng đến người sử dụng.
 *   - Bạn chẳng phải là anh hùng mặc áo choàng đỏ mặc quần xịt như thằng trẻ trâu rồi lên mạng ra vẻ ta đây là người tốt, là anh hùng, là người bảo vệ công lý gì đâu :).
 *   - Vậy nên bớt ảo tưởng đi.
 *   - Nếu có sử dụng hoặc tham khảo code này, hãy ghi công cho FoxStudio.
 *   - Minecraft là một thương hiệu của Mojang Studios / Microsoft. Dự án này không liên kết với Mojang.
 */

/**
 * VoxelXClient — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXClient
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - This software is provided as-is without warranty of any kind.
 *   - Do not redistribute or resell without explicit permission from FoxStudio.
 *   - If you use or reference this code, please credit FoxStudio.
 *   - Minecraft is a trademark of Mojang Studios / Microsoft. This project is not affiliated with Mojang.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

const TABS = [
  { id: 'skin',   label: 'Skin' },
  { id: 'cape',   label: 'Cape' },
  { id: 'elytra', label: 'Elytra' },
]

const SKIN_TYPES = [
  { id: 'wide', label: 'Classic (Wide)' },
  { id: 'slim', label: 'Slim (Alex)' },
]

export default function SkinCustomizeModal({ account, cosmeticData = [], onClose, onApply }) {
  const [activeTab, setActiveTab]         = useState('skin')
  const [selectedFile, setSelectedFile]   = useState(null)
  const [previewUrl, setPreviewUrl]       = useState(null)
  const [skinType, setSkinType]           = useState('wide')
  const [selectedApiItem, setApiItem]     = useState(null)
  const [isDragging, setIsDragging]       = useState(false)
  const [applying, setApplying]           = useState(false)
  const [done, setDone]                   = useState(false)
  const fileInputRef                      = useRef(null)
  const dragCounter                       = useRef(0)

  useEffect(() => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setApiItem(null)
    setDone(false)
  }, [activeTab])

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function processFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setSelectedFile(file)
    setPreviewUrl(url)
    setApiItem(null)
  }

  const onDragEnter = useCallback(e => {
    e.preventDefault(); e.stopPropagation()
    dragCounter.current++
    if (dragCounter.current === 1) setIsDragging(true)
  }, [])
  const onDragOver = useCallback(e => { e.preventDefault(); e.stopPropagation() }, [])
  const onDragLeave = useCallback(e => {
    e.preventDefault(); e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }, [])
  const onDrop = useCallback(e => {
    e.preventDefault(); e.stopPropagation()
    dragCounter.current = 0; setIsDragging(false)
    const file = e.dataTransfer.files[0]
    processFile(file)
  }, [])

  function handleBrowse() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e) {
    processFile(e.target.files[0])
    e.target.value = ''
  }

  function handleSelectApiItem(item) {
    setApiItem(item)
    setSelectedFile(null)
    const url = activeTab === 'skin' ? item.skinUrl : activeTab === 'cape' ? item.capeUrl : item.elytraUrl
    if (url) setPreviewUrl(url)
  }

async function handleApply() {
    const url = previewUrl
    if (!url) return
    setApplying(true)
    try {

      const existing = isElectron
        ? (await window.electronAPI.getSkinPrefs({ uuid: account?.uuid })) || {}
        : {}

      const persistUrl = url.startsWith('blob:')
        ? await new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext('2d')
              ctx.drawImage(img, 0, 0)
              resolve(canvas.toDataURL('image/png'))
            }
            img.onerror = reject
            img.src = url
          }).catch(() => url)
        : url

      const newPrefs = {
        uuid:      account?.uuid,
        skinUrl:   activeTab === 'skin'   ? persistUrl : (existing.skinUrl   || null),
        capeUrl:   activeTab === 'cape'   ? persistUrl : (existing.capeUrl   || null),
        elytraUrl: activeTab === 'elytra' ? persistUrl : (existing.elytraUrl || null),
      }

      if (isElectron) {
        await window.electronAPI.saveSkinPrefs(newPrefs)
      } else {

        localStorage.setItem(`vxc_skin_prefs_${account?.uuid}`, JSON.stringify(newPrefs))
      }

      onApply?.({ type: activeTab, url, skinType: activeTab === 'skin' ? skinType : undefined })
      setDone(true)
      setTimeout(() => onClose(), 800)
    } finally {
      setApplying(false)
    }
  }

  const apiItems = cosmeticData.filter(item => {
    if (activeTab === 'skin')   return !!item.skinUrl
    if (activeTab === 'cape')   return !!item.capeUrl
    if (activeTab === 'elytra') return !!item.elytraUrl
    return false
  })

  const canApply = !!previewUrl && !applying && !done

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(14,14,14,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          maxHeight: '85vh',
        }}
      >
        {}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div>
            <h3 className="text-white font-bold text-sm">Tuỳ chỉnh Cosmetics</h3>
            <p className="text-white/30 text-xs mt-0.5">{account?.username}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {}
        <div className="flex gap-0 border-b border-white/5 flex-shrink-0 px-5">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-white/30 hover:text-white/60'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {}
        <div className="flex flex-col flex-1 overflow-hidden">

          {}
          <div className="flex-shrink-0 px-5 pt-4 space-y-4">
            {}
            {activeTab === 'skin' && (
              <div>
                <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">
                  Loại skin
                </label>
                <div className="flex gap-2">
                  {SKIN_TYPES.map(st => (
                    <button key={st.id} onClick={() => setSkinType(st.id)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        skinType === st.id
                          ? 'bg-green-500/15 border-green-500/30 text-green-400'
                          : 'bg-white/3 border-white/8 text-white/40 hover:text-white/60 hover:bg-white/6'
                      }`}>
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {}
            <div>
              <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">
                Tải lên từ máy
              </label>
              <div
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={handleBrowse}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-200"
                style={{
                  background: isDragging ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px dashed ${isDragging ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.12)'}`,
                }}
              >
                {previewUrl && selectedFile ? (
                  <img src={previewUrl} alt="preview"
                    className="w-12 h-12 rounded-lg object-contain flex-shrink-0"
                    style={{ imageRendering: 'pixelated', background: 'rgba(255,255,255,0.05)' }} />
                ) : (
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
                    <svg className="w-5 h-5 text-green-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/60">
                    {isDragging ? 'Thả file vào đây' : selectedFile ? selectedFile.name : 'Kéo & thả hoặc click để chọn'}
                  </p>
                  <p className="text-[10px] text-white/25 mt-0.5">PNG, 64×64 hoặc 128×128</p>
                </div>
                {selectedFile && (
                  <button onClick={e => { e.stopPropagation(); setSelectedFile(null); setPreviewUrl(null) }}
                    className="w-6 h-6 flex items-center justify-center rounded-md text-white/25 hover:text-white/60 hover:bg-white/8 transition-all flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {}
            {apiItems.length > 0 && (
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">
                  Từ thư viện ({apiItems.length})
                </label>
              </div>
            )}
          </div>

          {}
          <div className="flex-1 overflow-y-auto px-5 pb-4 mt-2"
            style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {apiItems.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {apiItems.map((item, i) => {
                  const url = activeTab === 'skin' ? item.skinUrl : activeTab === 'cape' ? item.capeUrl : item.elytraUrl
                  if (!url) return null
                  const isSelected = selectedApiItem === item
                  return (
                    <button key={i} onClick={() => handleSelectApiItem(item)}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all"
                      style={{
                        background: isSelected ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isSelected ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.07)'}`,
                      }}>
                      <img src={url} alt={item.playerName}
                        className="w-10 h-10 rounded-lg object-contain"
                        style={{ imageRendering: 'pixelated', background: 'rgba(255,255,255,0.05)' }}
                        onError={e => { e.currentTarget.style.display = 'none' }} />
                      <span className="text-[9px] text-white/40 truncate w-full text-center">{item.playerName}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <p className="text-xs text-white/25">Không có {activeTab} nào trong thư viện</p>
              </div>
            )}
          </div>
        </div>

        {}
        <div className="flex gap-2 px-5 py-4 border-t border-white/5 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white transition-all border border-white/8 hover:bg-white/5">
            Hủy
          </button>
          <button onClick={handleApply} disabled={!canApply}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: done ? 'rgba(74,222,128,0.3)' : 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: canApply ? '0 4px 16px rgba(34,197,94,0.25)' : 'none' }}>
            {done ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                Đã áp dụng
              </>
            ) : applying ? 'Đang áp dụng...' : 'Áp dụng'}
          </button>
        </div>
      </div>
    </div>
  )
}

