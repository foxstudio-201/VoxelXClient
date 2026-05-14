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
 *   - Launcher sử dụng ai đi kèm trong việc tạo, bản thân người tạo không tự nhận là code toàn bộ do có sự hỗ trợ của ai.
 *   - Giỏi giang thì tự code bằng năng lực của mình đang video làm toàn bộ từ đầu đến cuối, còn không làm được đừng có kích đểu ảnh hưởng đến người sử dụng.
 *   - Bạn chẳng phải là anh hùng mặc áo choàng đỏ mặc quần xịt như thằng trẻ trâu rồi lên mạng ra vẻ ta đây là người tốt, là anh hùng, là người bảo vệ công lý gì đâu :).
 *   - Vậy nên bớt ảo tưởng đi.
 *   - Nếu có sử dụng hoặc tham khảo code này, hãy ghi công cho FoxStudio.
 *   - Minecraft là một thương hiệu của Mojang Studios / Microsoft. Dự án này không liên kết với Mojang.
 */

'use strict'

const { BrowserWindow, app } = require('electron')
const path = require('path')
const fs   = require('fs')
const { pathToFileURL } = require('url')

let sharedLogWin = null

function getOrCreateLogWindow() {
  if (sharedLogWin && !sharedLogWin.isDestroyed()) return sharedLogWin

  sharedLogWin = new BrowserWindow({
    width:  1100,
    height: 650,
    title:  'Minecraft Log',
    frame:  true,
    backgroundColor: '#0a0a0a',
    modal:  false,
    show:   false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration:  true,
      contextIsolation: false,
    },
  })

  sharedLogWin.setMenuBarVisibility(false)

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Minecraft Log</title>
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0a0a0a; color: #d4d4d4;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 13px; height: 100vh;
    display: flex; flex-direction: row; overflow: hidden;
  }

  /* ── Sidebar ── */
  #sidebar {
    width: 210px; flex-shrink: 0;
    background: #0d0d0d; border-right: 1px solid rgba(255,255,255,0.05);
    display: flex; flex-direction: column; overflow: hidden;
  }
  #sidebar-header {
    padding: 14px 14px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.3); font-size: 11px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase; flex-shrink: 0;
  }
  #instance-list { flex: 1; overflow-y: auto; padding: 4px 0; }
  .inst-item {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 14px; cursor: pointer;
    transition: background 0.12s; border-left: 2px solid transparent;
    user-select: none;
  }
  .inst-item:hover { background: rgba(255,255,255,0.03); }
  .inst-item.active { background: rgba(255,255,255,0.05); border-left-color: #4ade80; }
  .inst-item.active.stopped { border-left-color: rgba(255,255,255,0.2); }
  .inst-item.active.error   { border-left-color: #f87171; }
  .inst-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot-running { background: #4ade80; box-shadow: 0 0 5px rgba(74,222,128,0.5); animation: pulse 1.5s infinite; }
  .dot-stopped { background: rgba(255,255,255,0.2); }
  .dot-error   { background: #f87171; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .inst-info { flex: 1; min-width: 0; }
  .inst-name { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .inst-item.active .inst-name { color: rgba(255,255,255,0.9); }
  .inst-sub  { font-size: 11px; color: rgba(255,255,255,0.25); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .inst-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px; flex-shrink: 0; }
  .badge-running { background: rgba(74,222,128,0.12); color: #4ade80; }
  .badge-stopped { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.3); }
  .badge-error   { background: rgba(248,113,113,0.12); color: #f87171; }
  #sidebar-empty { padding: 18px 14px; color: rgba(255,255,255,0.2); font-size: 12px; text-align: center; line-height: 1.6; }

  /* ── Main area ── */
  #main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

  /* ── Error banner ── */
  #error-banner {
    display: none; flex-shrink: 0;
    align-items: flex-start; gap: 10px;
    padding: 8px 12px;
    background: rgba(239,68,68,0.08);
    border-bottom: 1px solid rgba(239,68,68,0.2);
  }
  #error-banner.visible { display: flex; }
  #error-banner-count { font-size: 12px; font-weight: 700; color: #f87171; }
  #error-banner-last  { font-size: 11px; color: rgba(248,113,113,0.6); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 500px; }
  #btn-copy-errors {
    margin-left: auto; flex-shrink: 0;
    display: flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 5px; cursor: pointer;
    background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.25);
    color: #f87171; font-size: 11px; font-weight: 700; font-family: inherit;
    transition: background 0.12s;
  }
  #btn-copy-errors:hover { background: rgba(239,68,68,0.25); }

  /* ── Filter bar ── */
  #filter-bar {
    flex-shrink: 0; display: flex; align-items: center; gap: 2px;
    padding: 5px 10px; border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(0,0,0,0.1);
  }
  .filter-btn {
    position: relative; padding: 4px 10px; border-radius: 5px; cursor: pointer;
    font-size: 11px; font-weight: 700; border: none; background: transparent;
    color: rgba(255,255,255,0.3); font-family: inherit; transition: all 0.12s;
  }
  .filter-btn:hover { color: rgba(255,255,255,0.6); }
  .filter-btn.active { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }
  .filter-badge {
    position: absolute; top: -3px; right: -3px;
    width: 15px; height: 15px; border-radius: 50%;
    background: #ef4444; color: #fff; font-size: 8px;
    display: flex; align-items: center; justify-content: center; font-weight: 700;
  }
  #filter-line-count { margin-left: auto; font-size: 11px; color: rgba(255,255,255,0.25); }
  #btn-copy-filtered, #btn-autoscroll {
    padding: 4px 10px; border-radius: 5px; cursor: pointer; border: none;
    background: transparent; color: rgba(255,255,255,0.3); font-size: 11px;
    font-family: inherit; font-weight: 700; transition: all 0.12s;
  }
  #btn-copy-filtered:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.06); }
  #btn-autoscroll.active { background: rgba(74,222,128,0.15); color: #4ade80; }
  #btn-autoscroll:hover:not(.active) { color: rgba(255,255,255,0.6); }

  /* ── Font size slider ── */
  #font-size-wrap {
    display: flex; align-items: center; gap: 6px;
    padding: 0 6px; border-left: 1px solid rgba(255,255,255,0.06); margin-left: 4px;
  }
  #font-size-label {
    font-size: 11px; color: rgba(255,255,255,0.3); white-space: nowrap;
    min-width: 28px; text-align: right; font-variant-numeric: tabular-nums;
  }
  #font-size-slider {
    -webkit-appearance: none; appearance: none;
    width: 72px; height: 3px; border-radius: 2px; outline: none; cursor: pointer;
    background: linear-gradient(to right, rgba(74,222,128,0.5) 0%, rgba(74,222,128,0.5) 50%, rgba(255,255,255,0.1) 50%);
  }
  #font-size-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 13px; height: 13px; border-radius: 50%;
    background: #4ade80; cursor: pointer;
    box-shadow: 0 0 4px rgba(74,222,128,0.4);
    transition: transform 0.1s;
  }
  #font-size-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }

  /* ── Log area ── */
  #log-area {
    flex: 1; overflow-y: auto; padding: 6px 12px;
    display: flex; flex-direction: column;
  }
  .log-row {
    display: flex; gap: 10px; padding: 2px 5px; border-radius: 3px;
    cursor: pointer; line-height: 1.6; align-items: flex-start;
  }
  .log-row:hover { background: rgba(255,255,255,0.03); }
  .log-row.is-error { background: rgba(239,68,68,0.05); }
  .log-row.is-error:hover { background: rgba(239,68,68,0.1); }
  .log-level {
    flex-shrink: 0; font-weight: 700; min-width: 40px;
    text-align: right; font-size: 0.9em; padding-top: 1px;
  }
  .log-text { flex: 1; word-break: break-all; white-space: pre-wrap; }
  .log-copy { flex-shrink: 0; font-size: 10px; opacity: 0; transition: opacity 0.1s; padding-top: 2px; }
  .log-row:hover .log-copy { opacity: 1; }
  .log-row.copied .log-copy { opacity: 1; color: #4ade80; }

  /* Level colors — matching HomePage exactly */
  .lv-INFO  .log-level { color: #4ade80; }
  .lv-INFO  .log-text  { color: rgba(255,255,255,0.55); }
  .lv-WARN  .log-level { color: #facc15; }
  .lv-WARN  .log-text  { color: rgba(250,204,21,0.7); }
  .lv-ERROR .log-level { color: #f87171; }
  .lv-ERROR .log-text  { color: rgba(252,165,165,0.9); }
  .lv-FATAL .log-level { color: #f472b6; }
  .lv-FATAL .log-text  { color: rgba(244,114,182,0.9); }
  .lv-DEBUG .log-level { color: #60a5fa; }
  .lv-DEBUG .log-text  { color: rgba(147,197,253,0.6); }
  .lv-OTHER .log-level { color: transparent; }
  .lv-OTHER .log-text  { color: rgba(255,255,255,0.35); }

  /* ── Status bar ── */
  #statusbar {
    flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
    padding: 6px 12px; border-top: 1px solid rgba(255,255,255,0.05);
    background: rgba(0,0,0,0.2); font-size: 11px;
  }
  #status-left { display: flex; align-items: center; gap: 7px; }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; }
  .status-running { background: #4ade80; box-shadow: 0 0 4px rgba(74,222,128,0.5); animation: pulse 1.5s infinite; }
  .status-stopped { background: rgba(255,255,255,0.2); }
  .status-error   { background: #f87171; }
  #status-label { }
  .st-running { color: #4ade80; }
  .st-stopped { color: rgba(255,255,255,0.3); }
  .st-error   { color: #f87171; }
  #status-right { color: rgba(255,255,255,0.25); }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
</style>
</head>
<body>
<div id="sidebar">
  <div id="sidebar-header">Instances</div>
  <div id="instance-list"><div id="sidebar-empty">No instances yet</div></div>
</div>
<div id="main">
  <div id="error-banner">
    <div style="flex:1;min-width:0">
      <div id="error-banner-count"></div>
      <div id="error-banner-last"></div>
    </div>
    <button id="btn-copy-errors">&#x2398; Copy errors</button>
  </div>
  <div id="filter-bar">
    <button class="filter-btn active" data-filter="ALL">ALL</button>
    <button class="filter-btn" data-filter="INFO">INFO</button>
    <button class="filter-btn" data-filter="WARN">WARN</button>
    <button class="filter-btn" data-filter="ERROR" id="filter-error-btn">ERROR</button>
    <button class="filter-btn" data-filter="DEBUG">DEBUG</button>
    <span id="filter-line-count">0 lines</span>
    <button id="btn-copy-filtered">&#x2398; Copy</button>
    <button id="btn-autoscroll" class="active">&#x2193; Auto</button>
    <div id="font-size-wrap">
      <input type="range" id="font-size-slider" min="9" max="18" value="13" step="1">
      <span id="font-size-label">13px</span>
    </div>
  </div>
  <div id="log-area"></div>
  <div id="statusbar">
    <div id="status-left">
      <div class="status-dot status-running" id="status-dot"></div>
      <span id="status-label" class="st-running">Waiting...</span>
    </div>
    <div id="status-right"></div>
  </div>
</div>
<script>
  const { ipcRenderer, clipboard } = require('electron')

  // ── State ──────────────────────────────────────────────────────────────────
  const instances = new Map()  // key -> { profileName, username, lines:[], status }
  let activeKey  = null
  let activeFilter = 'ALL'
  let autoScroll = true

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const logArea        = document.getElementById('log-area')
  const instList       = document.getElementById('instance-list')
  const statusDot      = document.getElementById('status-dot')
  const statusLabel    = document.getElementById('status-label')
  const statusRight    = document.getElementById('status-right')
  const filterLineCount= document.getElementById('filter-line-count')
  const errorBanner    = document.getElementById('error-banner')
  const errorBannerCnt = document.getElementById('error-banner-count')
  const errorBannerLast= document.getElementById('error-banner-last')
  const btnCopyErrors  = document.getElementById('btn-copy-errors')
  const btnCopyFiltered= document.getElementById('btn-copy-filtered')
  const btnAutoscroll  = document.getElementById('btn-autoscroll')
  const filterErrorBtn = document.getElementById('filter-error-btn')
  const fontSizeSlider = document.getElementById('font-size-slider')
  const fontSizeLabel  = document.getElementById('font-size-label')

  // ── Font size ─────────────────────────────────────────────────────────────
  let fontSize = 13
  function applyFontSize(px) {
    fontSize = px
    logArea.style.fontSize = px + 'px'
    fontSizeLabel.textContent = px + 'px'
    // Update slider gradient fill
    const pct = ((px - 9) / (18 - 9)) * 100
    fontSizeSlider.style.background =
      'linear-gradient(to right, rgba(74,222,128,0.5) 0%, rgba(74,222,128,0.5) ' + pct + '%, rgba(255,255,255,0.1) ' + pct + '%)'
  }
  fontSizeSlider.addEventListener('input', () => applyFontSize(Number(fontSizeSlider.value)))

  // ── parseLevel — identical to HomePage ────────────────────────────────────
  function parseLevel(line) {
    if (/\\/(INFO)\\]/.test(line))  return 'INFO'
    if (/\\/(WARN)\\]/.test(line))  return 'WARN'
    if (/\\/(ERROR)\\]/.test(line)) return 'ERROR'
    if (/\\/(DEBUG)\\]/.test(line)) return 'DEBUG'
    if (/\\/(FATAL)\\]/.test(line)) return 'FATAL'
    if (line.startsWith('[ERR]'))       return 'ERROR'
    if (line.startsWith('[Launcher]'))  return 'DEBUG'
    return 'OTHER'
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  }

  // ── Build a single log row DOM element ────────────────────────────────────
  function makeRow(line, idx) {
    const level   = parseLevel(line)
    const isError = level === 'ERROR' || level === 'FATAL'
    const row = document.createElement('div')
    row.className = 'log-row lv-' + level + (isError ? ' is-error' : '')
    row.dataset.idx = idx
    row.innerHTML =
      '<span class="log-level">' + (level === 'OTHER' ? '' : escHtml(level)) + '</span>' +
      '<span class="log-text">'  + escHtml(line) + '</span>' +
      '<span class="log-copy">&#x2398;</span>'
    row.addEventListener('click', () => {
      clipboard.writeText(line)
      row.classList.add('copied')
      row.querySelector('.log-copy').textContent = '✓'
      setTimeout(() => {
        row.classList.remove('copied')
        row.querySelector('.log-copy').textContent = '⎘'
      }, 1500)
    })
    return row
  }

  // ── Full re-render of log area (on tab switch / filter change) ─────────────
  function renderLog() {
    logArea.innerHTML = ''
    if (!activeKey || !instances.has(activeKey)) {
      filterLineCount.textContent = '0 lines'
      return
    }
    const inst = instances.get(activeKey)
    const filtered = activeFilter === 'ALL'
      ? inst.lines
      : inst.lines.filter(l => parseLevel(l) === activeFilter)
    filtered.forEach((line, i) => logArea.appendChild(makeRow(line, i)))
    filterLineCount.textContent = filtered.length + ' lines'
    if (autoScroll) scrollToBottom()
    updateErrorBanner(inst)
  }

  // ── Append a single line (fast path, no full re-render) ───────────────────
  function appendLine(key, line) {
    if (!instances.has(key)) return
    const inst = instances.get(key)
    inst.lines.push(line)
    if (key !== activeKey) return
    const level = parseLevel(line)
    if (activeFilter === 'ALL' || activeFilter === level) {
      const row = makeRow(line, inst.lines.length - 1)
      logArea.appendChild(row)
      filterLineCount.textContent = logArea.childElementCount + ' lines'
      if (autoScroll) scrollToBottom()
    }
    updateErrorBanner(inst)
  }

  // ── Error banner ──────────────────────────────────────────────────────────
  function updateErrorBanner(inst) {
    const errors = inst.lines.filter(l => { const lv = parseLevel(l); return lv === 'ERROR' || lv === 'FATAL' })
    if (errors.length === 0) {
      errorBanner.classList.remove('visible')
      return
    }
    errorBanner.classList.add('visible')
    errorBannerCnt.textContent  = errors.length + ' error' + (errors.length > 1 ? 's' : '') + ' detected'
    errorBannerLast.textContent = errors[errors.length - 1]
    btnCopyErrors.onclick = () => clipboard.writeText(errors.join('\\n'))

    // Badge on ERROR filter button
    let badge = filterErrorBtn.querySelector('.filter-badge')
    if (!badge) { badge = document.createElement('span'); badge.className = 'filter-badge'; filterErrorBtn.appendChild(badge) }
    badge.textContent = errors.length > 9 ? '9+' : errors.length
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────
  function renderSidebar() {
    instList.innerHTML = ''
    if (instances.size === 0) {
      const empty = document.createElement('div')
      empty.id = 'sidebar-empty'
      empty.textContent = 'No instances yet'
      instList.appendChild(empty)
      return
    }
    for (const [key, inst] of instances) {
      const isActive = key === activeKey
      const item = document.createElement('div')
      item.className = 'inst-item' +
        (isActive ? ' active' : '') +
        (inst.status === 'stopped' ? ' stopped' : inst.status === 'error' ? ' error' : '')

      const dotCls   = inst.status === 'running' ? 'dot-running' : inst.status === 'error' ? 'dot-error' : 'dot-stopped'
      const badgeCls = inst.status === 'running' ? 'badge-running' : inst.status === 'error' ? 'badge-error' : 'badge-stopped'
      const badgeTxt = inst.status === 'running' ? 'RUN' : inst.status === 'error' ? 'ERR' : 'DONE'

      item.innerHTML =
        '<div class="inst-dot ' + dotCls + '"></div>' +
        '<div class="inst-info">' +
          '<div class="inst-name">' + escHtml(inst.profileName) + '</div>' +
          '<div class="inst-sub">'  + escHtml(inst.username)    + '</div>' +
        '</div>' +
        '<span class="inst-badge ' + badgeCls + '">' + badgeTxt + '</span>'

      item.addEventListener('click', () => {
        activeKey = key
        renderSidebar()
        renderLog()
        updateStatusBar()
      })
      instList.appendChild(item)
    }
  }

  // ── Status bar ────────────────────────────────────────────────────────────
  function updateStatusBar() {
    if (!activeKey || !instances.has(activeKey)) {
      statusDot.className   = 'status-dot status-stopped'
      statusLabel.className = 'st-stopped'
      statusLabel.textContent = 'No instance selected'
      statusRight.textContent = ''
      return
    }
    const inst = instances.get(activeKey)
    if (inst.status === 'running') {
      statusDot.className   = 'status-dot status-running'
      statusLabel.className = 'st-running'
      statusLabel.textContent = '● Running'
    } else if (inst.status === 'error') {
      statusDot.className   = 'status-dot status-error'
      statusLabel.className = 'st-error'
      statusLabel.textContent = '✕ Error'
    } else {
      statusDot.className   = 'status-dot status-stopped'
      statusLabel.className = 'st-stopped'
      statusLabel.textContent = '■ Stopped'
    }
    statusRight.textContent = inst.profileName + ' @ ' + inst.username
  }

  // ── IPC listeners ─────────────────────────────────────────────────────────
  // Also expose as window functions for executeJavaScript fallback
  window._logRegister = function(key, profileName, username) {
    if (!instances.has(key)) {
      instances.set(key, { profileName, username, lines: [], status: 'running' })
    }
    if (!activeKey) activeKey = key
    renderSidebar()
    renderLog()
    updateStatusBar()
  }

  window._logLine = function(key, line) {
    const target = (key && instances.has(key)) ? key : activeKey
    if (target) appendLine(target, line)
  }

  ipcRenderer.on('log:register', (_, { key, profileName, username }) => {
    console.log('[Renderer] log:register received, key=', key, 'profileName=', profileName)
    window._logRegister(key, profileName, username)
  })

  ipcRenderer.on('launcher:log', (_, { key, line }) => {
    const target = (key && instances.has(key)) ? key : activeKey
    if (!target) console.warn('[Renderer] launcher:log: no target for key=', key, 'activeKey=', activeKey)
    if (target) appendLine(target, line)
  })

  ipcRenderer.on('launcher:stopped', (_, { key, code }) => {
    const inst = instances.get(key)
    if (inst) {
      inst.status = code === 0 ? 'stopped' : 'error'
      renderSidebar()
      updateStatusBar()
    }
  })

  // ── Filter buttons ────────────────────────────────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      renderLog()
    })
  })

  // ── Copy filtered ─────────────────────────────────────────────────────────
  btnCopyFiltered.addEventListener('click', () => {
    if (!activeKey || !instances.has(activeKey)) return
    const inst = instances.get(activeKey)
    const lines = activeFilter === 'ALL' ? inst.lines : inst.lines.filter(l => parseLevel(l) === activeFilter)
    clipboard.writeText(lines.join('\\n'))
    btnCopyFiltered.textContent = '✓ Copied'
    setTimeout(() => { btnCopyFiltered.innerHTML = '&#x2398; Copy' }, 1500)
  })

  // ── Smooth momentum scroll ────────────────────────────────────────────────
  // Intercept wheel events and animate scrollTop with easing instead of
  // letting the browser do its chunky default step-scroll.
  let scrollTarget  = logArea.scrollTop
  let scrollRaf     = null
  let userScrolling = false   // true while momentum animation is running

  function animateScroll() {
    const current = logArea.scrollTop
    const diff    = scrollTarget - current
    if (Math.abs(diff) < 0.5) {
      logArea.scrollTop = scrollTarget
      scrollRaf = null
      userScrolling = false
      // Check auto-scroll after momentum settles
      const atBottom = logArea.scrollHeight - logArea.scrollTop - logArea.clientHeight < 40
      if (!atBottom && autoScroll) {
        autoScroll = false
        btnAutoscroll.classList.remove('active')
      }
      return
    }
    // Ease-out: move 18% of remaining distance each frame (~60fps)
    logArea.scrollTop = current + diff * 0.18
    scrollRaf = requestAnimationFrame(animateScroll)
  }

  logArea.addEventListener('wheel', (e) => {
    e.preventDefault()
    userScrolling = true

    // Scale delta — trackpad sends small fractional deltas, mouse wheel sends ~100+
    const delta = e.deltaY * (e.deltaMode === 1 ? 20 : 1)  // deltaMode 1 = lines
    scrollTarget = Math.max(0, Math.min(
      logArea.scrollHeight - logArea.clientHeight,
      scrollTarget + delta
    ))

    if (!scrollRaf) scrollRaf = requestAnimationFrame(animateScroll)
  }, { passive: false })

  // Keep scrollTarget in sync when something else moves scrollTop (e.g. auto-scroll)
  logArea.addEventListener('scroll', () => {
    if (!userScrolling) scrollTarget = logArea.scrollTop
  })

  function scrollToBottom() {
    scrollTarget = logArea.scrollHeight - logArea.clientHeight
    if (!scrollRaf) scrollRaf = requestAnimationFrame(animateScroll)
  }
  btnAutoscroll.addEventListener('click', () => {
    autoScroll = !autoScroll
    btnAutoscroll.classList.toggle('active', autoScroll)
    if (autoScroll) scrollToBottom()
  })
</script>
</body>
</html>`

  const tmpFile = path.join(app.getPath('temp'), 'voxelx-logwindow.html')
  fs.writeFileSync(tmpFile, html, 'utf-8')
  sharedLogWin.loadURL(pathToFileURL(tmpFile).href)

  sharedLogWin.on('closed', () => { sharedLogWin = null })

  return sharedLogWin
}

function createLogWindow(parentWin, profileName, username) {
  const key = `${profileName}::${username}::${Date.now()}`
  const logWin = getOrCreateLogWindow()

  logWin.show()

  const pendingLines = []
  let ready = false

  function flushPending() {
    if (ready) {
      console.log('[LogWindow] flushPending: already flushed, skipping (key=', key, ')')
      return
    }
    ready = true
    if (logWin.isDestroyed()) {
      console.log('[LogWindow] flushPending: window destroyed, aborting')
      return
    }
    console.log('[LogWindow] flushPending: sending log:register for key', key)
    console.log('[LogWindow] flushPending: sending', pendingLines.length, 'pending lines')

    logWin.webContents.send('log:register', { key, profileName, username })

    for (const line of pendingLines) {
      logWin.webContents.send('launcher:log', { key, line })
    }
    pendingLines.length = 0
  }

  let flushScheduled = false
  function scheduleFlush() {
    if (flushScheduled) return
    const wc = logWin.webContents
    console.log('[LogWindow] scheduleFlush: isLoading=', wc.isLoading(), 'isDestroyed=', logWin.isDestroyed())
    if (wc.isLoading()) {
      console.log('[LogWindow] window is loading, waiting for did-finish-load')
      wc.once('did-finish-load', () => {
        console.log('[LogWindow] did-finish-load fired, ready=', ready, 'pendingLines=', pendingLines.length)
        if (flushScheduled) return
        flushScheduled = true
        flushPending()
      })
    } else {
      console.log('[LogWindow] window already loaded, flushing immediately')
      flushScheduled = true
      flushPending()
    }
  }
  scheduleFlush()

  return {
    isDestroyed: () => logWin.isDestroyed(),
    webContents: {
      send: (channel, data) => {
        if (logWin.isDestroyed()) return
        if (channel === 'launcher:log' || channel === 'launcher:logUpdate') {
          const line = data.line
          if (!ready) { pendingLines.push(line); return }
          logWin.webContents.send('launcher:log', { key, line })
        } else if (channel === 'launcher:stopped') {
          if (!ready) flushPending()
          logWin.webContents.send('launcher:stopped', { ...data, key })
        } else {
          logWin.webContents.send(channel, data)
        }
      },
      once: (event, cb) => logWin.webContents.once(event, cb),
      isLoading: () => logWin.webContents.isLoading(),
    },
    show: () => { if (!logWin.isDestroyed()) logWin.show() },
    focus: () => { if (!logWin.isDestroyed()) logWin.focus() },
  }
}

module.exports = { createLogWindow }

