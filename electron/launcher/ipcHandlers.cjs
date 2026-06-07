/**
 * VoxelXLauncher — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXLauncher
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - This software is provided as-is without warranty of any kind.
 *   - Do not redistribute or resell without explicit permission from FoxStudio.
 *   - If you use or reference this code, please credit FoxStudio.
 *   - Minecraft is a trademark of Mojang Studios / Microsoft. This project is not affiliated with Mojang.
 */

 /**
 * VoxelXLauncher — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXLauncher
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

const { ipcMain } = require('electron')
const path = require('path')
const fs   = require('fs')
const { app } = require('electron')

const { resolveVersion }      = require('./vanilla/versionResolver.cjs')
const { ensureJava }          = require('./java/javaManager.cjs')
const { downloadAssets }      = require('./vanilla/assetManager.cjs')
const { setupFabric }         = require('./fabric/fabricLoader.cjs')
const { setupForge }          = require('./forge/forgeLoader.cjs')
const { setupNeoForge }       = require('./neoforge/neoforgeLoader.cjs')
const { ensureFabricMods }    = require('./modrinth/modrinthMods.cjs')
const { ensureVoxelXMods }    = require('./voxelxMods.cjs')
const { searchProjects, getProject, getProjectVersions, installVersion, getGameVersions, getCategories } = require('./modrinth/modrinthSearch.cjs')
const cfSearch = require('./curseforge/curseForgeSearch.cjs')
const technicSearch = require('./technic/technicSearch.cjs')
const ftbSearch = require('./ftb/ftbSearch.cjs')
const { launchGame }          = require('./vanilla/gameRunner.cjs')
const { startPlaytimeTracker, getProfileStats } = require('./statsTracker.cjs')

const DATA_DIR      = path.join(app.getPath('appData'), '.VoxelXClient')
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

function readProfiles() {
  try { return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8')) }
  catch { return { profiles: [], selectedProfileId: null } }
}
function writeProfiles(data) {
  const tmp = PROFILES_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, PROFILES_FILE)
}
function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) }
  catch { return {} }
}

const runningGames = new Map()

function makeKey(profileId, accountId) {
  return `${profileId}::${accountId}`
}

function syncDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return

  const stat = fs.statSync(srcDir)
  if (!stat.isDirectory()) return

  fs.mkdirSync(destDir, { recursive: true })

  const entries = fs.readdirSync(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name)
    const destPath = path.join(destDir, entry.name)

    if (entry.isDirectory()) {
      syncDirRecursive(srcPath, destPath)
      continue
    }

    if (!entry.isFile()) continue

    let shouldCopy = true
    if (fs.existsSync(destPath)) {
      try {
        const srcStat = fs.statSync(srcPath)
        const destStat = fs.statSync(destPath)
        shouldCopy = srcStat.size !== destStat.size || srcStat.mtimeMs > destStat.mtimeMs + 1000
      } catch {
        shouldCopy = true
      }
    }

    if (shouldCopy) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function syncModpackSharedDirs(profile, gameDataDir) {
  if (!profile?.importSource) return []

  const synced = []
  for (const dirName of ['mods', 'config', 'resourcepacks']) {
    const srcDir = path.join(profile.instancePath, dirName)
    if (!fs.existsSync(srcDir)) continue
    syncDirRecursive(srcDir, path.join(gameDataDir, dirName))
    synced.push(dirName)
  }
  return synced
}

const { createLogWindow } = require('./logWindow.cjs')

function registerLauncherHandlers(getTrustedWindow) {

  ipcMain.handle('launcher:launch', async (e, { profileId, ramMb }) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }

    const profilesData = readProfiles()
    const profile = profilesData.profiles.find(p => p.id === profileId)
    if (!profile) return { error: 'Profile not found' }

    let accountsData
    try {
      accountsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'accounts.json'), 'utf-8'))
    } catch { accountsData = { accounts: [], selectedId: null } }

    const account = accountsData.accounts.find(a => a.id === accountsData.selectedId)
    if (!account) return { error: 'No account selected' }

    const gameKey = makeKey(profileId, account.id)
    if (runningGames.has(gameKey)) {
      return { error: `Profile "${profile.name}" is already running with account "${account.username}".` }
    }

    const settings      = readSettings()
    const hideLauncher  = settings.hideLauncherOnLaunch !== false
    const showLog       = settings.showLogWindow !== false
    const boostMode     = settings.boostMode === true

    const instancePath = profile.instancePath
    if (!fs.existsSync(instancePath)) fs.mkdirSync(instancePath, { recursive: true })

    const launcherProfilesPath = path.join(instancePath, 'launcher_profiles.json')
    if (!fs.existsSync(launcherProfilesPath)) {
      fs.writeFileSync(launcherProfilesPath, JSON.stringify({
        profiles: {},
        selectedProfile: null,
        clientToken: 'VoxelXLauncher',
        authenticationDatabase: {},
        launcherVersion: { name: '2.0.0', format: 21 },
      }, null, 2))
    }

    const sharedPath  = instancePath
    const runtimesDir = path.join(instancePath, 'runtimes')
    const gameDataDir = path.join(instancePath, 'accounts', account.id)
    if (!fs.existsSync(gameDataDir)) fs.mkdirSync(gameDataDir, { recursive: true })

    try {
      const syncedDirs = syncModpackSharedDirs(profile, gameDataDir)
      if (syncedDirs.length > 0) {
        if (!win.isDestroyed()) {
          win.webContents.send('launcher:progress', {
            phase: 'prepare_modpack',
            log: `Syncing modpack data: ${syncedDirs.join(', ')}...`,
            percent: 1,
          })
        }
      }
    } catch (syncErr) {
      return { error: `Failed to sync modpack files: ${syncErr.message}` }
    }

    function sendProgress(data) {
      if (!win.isDestroyed()) win.webContents.send('launcher:progress', data)
    }

    const logsDir = path.join(profile.instancePath, 'logs')
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
    const logFilePath = path.join(logsDir, `${timestamp}.log`)
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf-8' })
    logStream.on('error', () => {})

    function writeLog(line) {
      if (!win.isDestroyed()) win.webContents.send('launcher:log', { line })
      if (logStream.writable) { try { logStream.write(line + '\n') } catch {} }

      if (logWinRef && !logWinRef.isDestroyed()) logWinRef.webContents.send('launcher:log', { line })
    }

    let lastFileWriteTime = 0
    function writeLogUpdate(line) {
      if (!win.isDestroyed()) win.webContents.send('launcher:logUpdate', { line })
      const now = Date.now()
      if (now - lastFileWriteTime >= 1000) {
        lastFileWriteTime = now
        if (logStream.writable) { try { logStream.write(line + '\n') } catch {} }
      }
      if (logWinRef && !logWinRef.isDestroyed()) logWinRef.webContents.send('launcher:logUpdate', { line })
    }

    let logWinRef = null

    function sendProgressAndLog(data) {
      sendProgress(data)
      if (data.log) writeLog(`[Launcher] ${data.log}`)
    }

    function sendProgressAndUpdate(data) {
      sendProgress(data)
      if (data.log) writeLogUpdate(`[Launcher] ${data.log}`)
    }

    try {
      sendProgressAndLog({ phase: 'resolve', log: `Loading version info for ${profile.gameVersion}...`, percent: 2 })
      const versionJson = await resolveVersion(profile.gameVersion, sharedPath)

      sendProgressAndLog({ phase: 'java', log: 'Checking Java runtime...', percent: 5 })

      let javaPath
      if (profile.javaPath && fs.existsSync(profile.javaPath)) {
        javaPath = profile.javaPath
        sendProgressAndLog({ phase: 'java', log: `Using custom Java: ${path.basename(path.dirname(path.dirname(profile.javaPath)))}`, percent: 8 })
      } else {
        javaPath = await ensureJava(profile.gameVersion, runtimesDir, (p) => {
          const pct = p.phase === 'java_download' ? 5 + Math.round((p.done / p.total) * 25) : 5
          if (p.phase === 'java_download') {
            sendProgressAndUpdate({
              phase: 'java',
              log: `Java ${p.javaVersion}: ${p.done}/${p.total} files (${p.percent}%)`,
              percent: pct,
              doneFiles: p.done,
              totalFiles: p.total,
            })
          } else if (p.phase === 'java_ready') {
            sendProgressAndLog({ phase: 'java', log: `Java ${p.javaVersion} ready`, percent: pct })
          } else {
            sendProgressAndLog({ phase: 'java', log: `Downloading Java ${p.javaVersion}...`, percent: pct })
          }
        }, versionJson)
      }

      sendProgressAndLog({ phase: 'assets', log: 'Checking game assets...', percent: 30 })
      let lastAssetPhase = ''
      const assets = await downloadAssets(versionJson, sharedPath, (p) => {
        let pct = 30
        if (p.totalFiles > 0) pct = 30 + Math.round((p.doneFiles / p.totalFiles) * 65)
        if (p.phase === 'asset_error') {
          writeLog(`[WARN] ${p.log}`)
          return
        }
        const phaseChanged = p.phase !== lastAssetPhase
        if (phaseChanged) {
          lastAssetPhase = p.phase
          sendProgressAndLog({
            phase: 'assets',
            log: p.log || `Assets: ${p.doneFiles}/${p.totalFiles}`,
            percent: pct,
            doneFiles: p.doneFiles,
            totalFiles: p.totalFiles,
            speed: p.speed,
          })
        } else if (p.phase === 'done') {
          sendProgressAndLog({ phase: 'assets', log: p.log, percent: pct })
        } else {

          sendProgressAndUpdate({
            phase: 'assets',
            log: p.log || `Assets: ${p.doneFiles}/${p.totalFiles}`,
            percent: pct,
            doneFiles: p.doneFiles,
            totalFiles: p.totalFiles,
            speed: p.speed,
          })
        }
      })

      sendProgressAndLog({ phase: 'launching', log: `Launching as ${account.username}...`, percent: 98 })

      let accessToken = account.type === 'microsoft' ? (account.mcToken || '0') : '0'
      if (account.type === 'microsoft' && account.msRefreshToken) {
        const fiveMin = 5 * 60 * 1000
        const needsRefresh = !account.mcTokenExpiry || (account.mcTokenExpiry - Date.now() < fiveMin)
        if (needsRefresh) {
          sendProgressAndLog({ phase: 'launching', log: 'Làm mới phiên đăng nhập Microsoft...', percent: 98 })
          try {
            const { refreshMinecraftToken } = require('../msAuth.cjs')
            const refreshed = await refreshMinecraftToken(account.msRefreshToken)

            const accountsPath = path.join(DATA_DIR, 'accounts.json')
            try {
              const accountsData2 = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'))
              const idx = accountsData2.accounts.findIndex(a => a.id === account.id)
              if (idx >= 0) {
                accountsData2.accounts[idx] = {
                  ...accountsData2.accounts[idx],
                  username:       refreshed.username,
                  msRefreshToken: refreshed.msRefreshToken,
                  mcToken:        refreshed.mcToken,
                  mcTokenExpiry:  refreshed.mcTokenExpiry,
                }
                const tmp = accountsPath + '.tmp'
                fs.writeFileSync(tmp, JSON.stringify(accountsData2, null, 2), { mode: 0o600 })
                fs.renameSync(tmp, accountsPath)
              }
            } catch {}
            accessToken = refreshed.mcToken || accessToken
          } catch (err) {
            writeLog(`[WARN] Không thể làm mới token Microsoft: ${err.message}`)
          }
        }
      }

      let mainClassOverride = null
      let extraLibraries    = []
      let extraJvmArgs      = []
      let extraGameArgs     = []
      let forgeShimJar      = null

      if (profile.loader === 'fabric' && profile.loaderVersion) {
        sendProgressAndLog({ phase: 'fabric', log: `Setting up Fabric ${profile.loaderVersion}...`, percent: 96 })
        const fabricLibsDir = path.join(sharedPath, 'libraries')
        let lastFabricPhase = ''
        const fabricResult = await setupFabric(
          profile.gameVersion,
          profile.loaderVersion,
          fabricLibsDir,
          (p) => {
            const phaseChanged = p.phase !== lastFabricPhase
            if (phaseChanged) { lastFabricPhase = p.phase; sendProgressAndLog({ phase: 'fabric', log: p.log, percent: 96, doneFiles: p.done, totalFiles: p.total }) }
            else sendProgressAndUpdate({ phase: 'fabric', log: p.log, percent: 96, doneFiles: p.done, totalFiles: p.total })
          }
        )
        mainClassOverride = fabricResult.mainClass

        function getArtifactKey(jarPath) {

          const normalized = jarPath.replace(/\\/g, '/')
          const match = normalized.match(/libraries\/(.+)\/[^/]+\/[^/]+\.jar$/)
          return match ? match[1] : jarPath
        }

        const fabricKeys = new Set(fabricResult.extraLibraries.map(getArtifactKey))

        const filteredVanillaLibs = assets.libraries.filter(lib => {
          const key = getArtifactKey(lib)
          return !fabricKeys.has(key)
        })

        extraLibraries = fabricResult.extraLibraries

        assets.libraries = [...extraLibraries, ...filteredVanillaLibs]
        extraLibraries = []

        sendProgressAndLog({ phase: 'fabric', log: `Fabric ready. Main: ${mainClassOverride}`, percent: 97 })

        sendProgressAndLog({ phase: 'fabric_mods', log: 'Checking Fabric mods (Fabric API, Mod Menu)...', percent: 97 })
        const modsDir = path.join(gameDataDir, 'mods')
        await ensureFabricMods(profile.gameVersion, modsDir, (p) => {
          sendProgressAndLog({ phase: 'fabric_mods', log: p.log, percent: 97, doneFiles: p.done, totalFiles: p.total })
        }, profile.autoPerformanceMods === true)

        try {
          const vxcJars = await ensureVoxelXMods(
            profile.gameVersion,
            sharedPath,
            (p) => sendProgressAndLog({ phase: 'fabric_mods', log: p.log, percent: 97 })
          )
          if (vxcJars.length > 0) {
            const sep = process.platform === 'win32' ? ';' : ':'
            const addModsArg = `-Dfabric.addMods=${vxcJars.join(sep)}`
            extraJvmArgs = [...extraJvmArgs, addModsArg]
            sendProgressAndLog({ phase: 'fabric_mods', log: `VoxelXMods: loaded ${vxcJars.length} mod(s) via -Dfabric.addMods`, percent: 97 })
          }
        } catch (vxcErr) {
          sendProgressAndLog({ phase: 'fabric_mods', log: `[WARN] VoxelXMods: ${vxcErr.message}`, percent: 97 })
        }

        try {
          const vxcConfigDir = path.join(gameDataDir, 'config', 'voxelxskin')
          if (!fs.existsSync(vxcConfigDir)) fs.mkdirSync(vxcConfigDir, { recursive: true })
          fs.writeFileSync(
            path.join(vxcConfigDir, 'launcher_profile.json'),
            JSON.stringify({ launcherUuid: account.uuid }, null, 2)
          )
          sendProgressAndLog({ phase: 'fabric_mods', log: `VoxelXSkin: launcher_profile.json → ${account.uuid}`, percent: 97 })
        } catch (cfgErr) {
          writeLog(`[WARN] VoxelXSkin launcher_profile write failed: ${cfgErr.message}`)
        }
      }

      if (profile.loader === 'forge' && profile.loaderVersion) {
        sendProgressAndLog({ phase: 'forge', log: `Setting up Forge ${profile.loaderVersion}...`, percent: 93 })
        const forgeLibsDir = path.join(sharedPath, 'libraries')
        let lastForgePhase = ''

        const forgeResult = await setupForge(
          profile.gameVersion,
          profile.loaderVersion,
          forgeLibsDir,
          assets.clientJar,
          javaPath,
          sharedPath,
          (p) => {
            const phaseChanged = p.phase !== lastForgePhase
            if (phaseChanged) {
              lastForgePhase = p.phase
              sendProgressAndLog({ phase: 'forge', log: p.log, percent: 95, doneFiles: p.done, totalFiles: p.total })
            } else {
              sendProgressAndUpdate({ phase: 'forge', log: p.log, percent: 95, doneFiles: p.done, totalFiles: p.total })
            }
          }
        )

        mainClassOverride = forgeResult.mainClass
        extraJvmArgs      = forgeResult.jvmArgs  || []
        extraGameArgs     = forgeResult.gameArgs  || []
        forgeShimJar      = forgeResult.shimJar   || null

        function getArtifactKey(jarPath) {
          const normalized = jarPath.replace(/\\/g, '/')
          const match = normalized.match(/libraries\/(.+)\/[^/]+\/[^/]+\.jar$/)
          return match ? match[1] : jarPath
        }

        const forgeKeys = new Set(forgeResult.extraLibraries.map(getArtifactKey))
        const filteredVanillaLibs = assets.libraries.filter(lib => !forgeKeys.has(getArtifactKey(lib)))

        assets.libraries = [...forgeResult.extraLibraries, ...filteredVanillaLibs]

        if (forgeResult.customClientJar) {
          assets.clientJar = forgeResult.customClientJar
        }

        if (forgeResult.needsVanillaClasspath) {
          extraJvmArgs = [...extraJvmArgs, '__needsVanillaClasspath__']
        }

        sendProgressAndLog({ phase: 'forge', log: `Forge ready. Main: ${mainClassOverride}`, percent: 97 })
      }

      if (profile.loader === 'neoforge' && profile.loaderVersion) {
        sendProgressAndLog({ phase: 'neoforge', log: `Setting up NeoForge ${profile.loaderVersion}...`, percent: 93 })
        const neoforgeLibsDir = path.join(sharedPath, 'libraries')
        let lastNeoForgePhase = ''

        const neoforgeResult = await setupNeoForge(
          profile.gameVersion,
          profile.loaderVersion,
          neoforgeLibsDir,
          assets.clientJar,
          javaPath,
          sharedPath,
          (p) => {
            const phaseChanged = p.phase !== lastNeoForgePhase
            if (phaseChanged) {
              lastNeoForgePhase = p.phase
              sendProgressAndLog({ phase: 'neoforge', log: p.log, percent: 95, doneFiles: p.done, totalFiles: p.total })
            } else {
              sendProgressAndUpdate({ phase: 'neoforge', log: p.log, percent: 95, doneFiles: p.done, totalFiles: p.total })
            }
          }
        )

        mainClassOverride = neoforgeResult.mainClass
        extraJvmArgs      = neoforgeResult.jvmArgs  || []
        extraGameArgs     = neoforgeResult.gameArgs  || []
        forgeShimJar      = neoforgeResult.shimJar   || null

        function getArtifactKeyNeo(jarPath) {
          const normalized = jarPath.replace(/\\/g, '/')
          const match = normalized.match(/libraries\/(.+)\/[^/]+\/[^/]+\.jar$/)
          return match ? match[1] : jarPath
        }

        const neoKeys = new Set(neoforgeResult.extraLibraries.map(getArtifactKeyNeo))
        const filteredVanillaLibsNeo = assets.libraries.filter(lib => !neoKeys.has(getArtifactKeyNeo(lib)))

        assets.libraries = [...neoforgeResult.extraLibraries, ...filteredVanillaLibsNeo]

        if (neoforgeResult.customClientJar) {
          assets.clientJar = neoforgeResult.customClientJar
        }

        if (neoforgeResult.needsVanillaClasspath) {
          extraJvmArgs = [...extraJvmArgs, '__needsVanillaClasspath__']
        }

        sendProgressAndLog({ phase: 'neoforge', log: `NeoForge ready. Main: ${mainClassOverride}`, percent: 97 })
      }

      sendProgressAndLog({ phase: 'launching', log: `Launching as ${account.username}...`, percent: 98 })

      // Boost Mode: tắt tiến trình nền trước khi khởi động game
      if (boostMode && process.platform === 'win32') {
        sendProgressAndLog({ phase: 'launching', log: 'Boost Mode: đang tắt tiến trình nền...', percent: 98 })
        try {
          const { exec } = require('child_process')
          const BOOST_KILL_LIST = [
            'OneDrive.exe', 'Teams.exe', 'Slack.exe', 'Spotify.exe',
            'EpicGamesLauncher.exe', 'GalaxyClient.exe', 'upc.exe',
            'origin.exe', 'OriginWebHelperService.exe',
            'SearchIndexer.exe', 'SearchProtocolHost.exe', 'SearchFilterHost.exe',
            'SgrmBroker.exe', 'OneDriveSetup.exe',
            'SkypeApp.exe', 'SkypeBridge.exe',
            'Cortana.exe', 'WinStore.App.exe',
            'XboxApp.exe', 'XboxGameBarWidgets.exe', 'GameBar.exe', 'GameBarFTServer.exe',
            'RiotClientServices.exe', 'EADesktop.exe', 'BattleNet.exe', 'Agent.exe',
          ]
          const killPromises = BOOST_KILL_LIST.map(proc =>
            new Promise(resolve => {
              exec(`taskkill /F /IM "${proc}" /T`, { windowsHide: true }, () => resolve())
            })
          )
          await Promise.all(killPromises)
          sendProgressAndLog({ phase: 'launching', log: 'Boost Mode: đã dọn tiến trình nền ✓', percent: 98 })
        } catch (boostErr) {
          writeLog(`[WARN] Boost Mode error: ${boostErr.message}`)
        }
      }

      // Force GPU: set Windows GPU preference cho java process dùng discrete GPU
      if (process.platform === 'win32') {
        try {
          const { exec } = require('child_process')
          // GpuPreference=2 = High Performance (discrete GPU)
          // Áp dụng cho cả java.exe và javaw.exe
          const javaExeNorm = javaPath.replace(/\//g, '\\')
          const javawExe    = javaExeNorm.replace(/java\.exe$/i, 'javaw.exe')
          const regEntries  = [javaExeNorm, javawExe].filter(Boolean)
          for (const exe of regEntries) {
            await new Promise(resolve => {
              exec(
                `reg add "HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences" /v "${exe}" /t REG_SZ /d "GpuPreference=2;" /f`,
                { windowsHide: true },
                () => resolve()
              )
            })
          }
          sendProgressAndLog({ phase: 'launching', log: 'GPU: đã set High Performance GPU cho Java ✓', percent: 98 })
        } catch (gpuErr) {
          writeLog(`[WARN] GPU preference error: ${gpuErr.message}`)
        }
      }

      const logWin = showLog ? createLogWindow(win, profile.name, account.username) : null

      logWinRef = logWin

      const proc = launchGame({
        javaPath,
        clientJar:         assets.clientJar,
        libraries:         assets.libraries,
        nativesDir:        assets.nativesDir,
        assetsDir:         assets.assetsDir,
        assetIndex:        assets.assetIndex,
        versionJson,
        mainClassOverride,
        extraJvmArgs,
        extraGameArgs,
        shimJar:           forgeShimJar,
        shimWorkDir:       sharedPath,
        instancePath:      gameDataDir,
        gameVersion:       profile.gameVersion,
        username:          account.username,
        uuid:              account.uuid,
        accessToken,
        ramMb:             ramMb || 2048,
        boostMode,
        onLog: (line) => {
          writeLog(line)
        },
        onExit: (code) => {
          try { logStream.end() } catch {}
          logWinRef = null
          const game = runningGames.get(gameKey)
          if (game) {
            const elapsed = game.stopTracker()
            runningGames.delete(gameKey)
            try { process.setProcessPriority(process.pid, 'normal') } catch {}
            if (!win.isDestroyed()) {
              win.show()
              win.focus()
              win.webContents.send('launcher:stopped', { profileId, accountId: account.id, code, elapsed })
            }
            if (logWin && !logWin.isDestroyed()) {
              logWin.webContents.send('launcher:stopped', { profileId, accountId: account.id, code, elapsed })
            }
          }
        },
      })

      if (hideLauncher && !win.isDestroyed()) {
        win.hide()
      }

      if (proc.pid) {
        try {
          // Boost Mode: game được priority cao, launcher thấp để nhường tài nguyên
          // Bình thường: game below normal (launcher ưu tiên hơn)
          if (boostMode) {
            process.setProcessPriority(proc.pid, 'high')
            process.setProcessPriority(process.pid, 'below normal')
          } else {
            process.setProcessPriority(proc.pid, 'below normal')
            process.setProcessPriority(process.pid, 'below normal')
          }
        } catch {}
      }

      const stopTracker = startPlaytimeTracker(profileId, profilesData, writeProfiles)
      runningGames.set(gameKey, { proc, stopTracker, logWin })

      sendProgress({ phase: 'running', log: 'Minecraft is running!', percent: 100 })
      return { ok: true }

    } catch (err) {
      writeLog(`[Launcher] ERROR: ${err.message}`)
      try { logStream.end() } catch {}
      sendProgress({ phase: 'error', log: `Error: ${err.message}`, error: err.message, percent: 0 })
      return { error: err.message }
    }
  })

  ipcMain.handle('launcher:stop', (e, { profileId, accountId }) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const key = accountId ? makeKey(profileId, accountId) : null

    if (key && runningGames.has(key)) {
      try { runningGames.get(key).proc.kill() } catch {}
      return { ok: true }
    }

    let stopped = 0
    for (const [k, game] of runningGames) {
      if (k.startsWith(profileId + '::')) {
        try { game.proc.kill() } catch {}
        stopped++
      }
    }
    return stopped > 0 ? { ok: true, stopped } : { error: 'Game is not running' }
  })

  ipcMain.handle('launcher:isRunning', (e, { profileId, accountId }) => {
    if (!getTrustedWindow(e)) return false
    if (accountId) return runningGames.has(makeKey(profileId, accountId))
    for (const k of runningGames.keys()) {
      if (k.startsWith(profileId + '::')) return true
    }
    return false
  })

  ipcMain.handle('launcher:listRunning', (e) => {
    if (!getTrustedWindow(e)) return []
    return Array.from(runningGames.keys()).map(key => {
      const [profileId, accountId] = key.split('::')
      return { profileId, accountId, key }
    })
  })

  ipcMain.handle('launcher:getStats', (e, { profileId }) => {
    if (!getTrustedWindow(e)) return null
    const profilesData = readProfiles()
    const profile = profilesData.profiles.find(p => p.id === profileId)
    if (!profile) return null
    return getProfileStats(profile)
  })

  ipcMain.handle('launcher:getLatestLog', (e, { profileId }) => {
    if (!getTrustedWindow(e)) return null
    const profilesData = readProfiles()
    const profile = profilesData.profiles.find(p => p.id === profileId)
    if (!profile) return null

    const logsDir = path.join(profile.instancePath, 'logs')
    if (!fs.existsSync(logsDir)) return null

    try {
      const files = fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.log'))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(logsDir, f)).mtime }))
        .sort((a, b) => b.mtime - a.mtime)

      if (files.length === 0) return null

      const latestFile = path.join(logsDir, files[0].name)
      const content = fs.readFileSync(latestFile, 'utf-8')
      const lines = content.split('\n').filter(Boolean)
      return {
        filename: files[0].name,
        mtime: files[0].mtime.toISOString(),
        lines,
        profileName: profile.name,
      }
    } catch {
      return null
    }
  })

  ipcMain.handle('launcher:listLogs', (e, { profileId }) => {
    if (!getTrustedWindow(e)) return []
    const profilesData = readProfiles()
    const profile = profilesData.profiles.find(p => p.id === profileId)
    if (!profile) return []

    const logsDir = path.join(profile.instancePath, 'logs')
    if (!fs.existsSync(logsDir)) return []

    try {
      return fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.log'))
        .map(f => {
          const stat = fs.statSync(path.join(logsDir, f))
          return { filename: f, mtime: stat.mtime.toISOString(), size: stat.size }
        })
        .sort((a, b) => new Date(b.mtime) - new Date(a.mtime))
    } catch {
      return []
    }
  })

  ipcMain.handle('curseforge:search', async (e, opts) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    return await cfSearch.searchProjects(opts)
  })
  ipcMain.handle('curseforge:getProject', async (e, id) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    return await cfSearch.getProject(id)
  })
  ipcMain.handle('curseforge:getVersions', async (e, id, filters) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    return await cfSearch.getProjectVersions(id, filters)
  })
  ipcMain.handle('curseforge:getCategories', async (e, projectType) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    return await cfSearch.getCategories(projectType)
  })
  ipcMain.handle('curseforge:install', async (e, opts) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    let targetPath = opts.instancePath
    if (opts.accountId) {
      targetPath = path.join(opts.instancePath, 'accounts', opts.accountId)
      if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true })
    }
    return await cfSearch.installVersion({ ...opts, instancePath: targetPath }, (p) => {
      const wins = require('electron').BrowserWindow.getAllWindows()
      wins.forEach(w => {
        if (!w.isDestroyed()) w.webContents.send('curseforge:installProgress', p)
      })
    })
  })

  ipcMain.handle('technic:install', async (e, opts) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    return await technicSearch.installVersion(opts, (p) => {
      const wins = require('electron').BrowserWindow.getAllWindows()
      wins.forEach(w => {
        if (!w.isDestroyed()) w.webContents.send('technic:installProgress', p)
      })
    })
  })

  ipcMain.handle('ftb:search', async (e, opts) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    return await ftbSearch.searchProjects(opts)
  })
  ipcMain.handle('ftb:getProject', async (e, id) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    return await ftbSearch.getProject(id)
  })
  ipcMain.handle('ftb:getVersions', async (e, id) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    return await ftbSearch.getProjectVersions(id)
  })
  ipcMain.handle('ftb:install', async (e, opts) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    return await ftbSearch.installVersion(opts, (p) => {
      const wins = require('electron').BrowserWindow.getAllWindows()
      wins.forEach(w => {
        if (!w.isDestroyed()) w.webContents.send('ftb:installProgress', p)
      })
    })
  })

  ipcMain.handle('modrinth:search', async (e, opts) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    try { return await searchProjects(opts) }
    catch (err) { return { error: err.message } }
  })

  ipcMain.handle('spiget:search', async (e, opts) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    const { query = '', size = 20, page = 1 } = opts || {}
    const https = require('https')
    try {
      const data = await new Promise((resolve, reject) => {
        const encoded = encodeURIComponent(query || '*')

        const url = query
          ? `https://api.spiget.org/v2/search/resources/${encoded}?size=${size}&page=${page}&sort=-downloads&fields=id,name,tag,icon,downloads,rating,testedVersions,premium,file`
          : `https://api.spiget.org/v2/resources/free?size=${size}&page=${page}&sort=-downloads&fields=id,name,tag,icon,downloads,rating,testedVersions,premium,file`
        https.get(url, { headers: { 'User-Agent': 'VoxelXLauncher/1.0' }, timeout: 8000 }, res => {
          let body = ''
          res.on('data', c => { body += c })
          res.on('end', () => {
            try { resolve(JSON.parse(body)) } catch { resolve([]) }
          })
        }).on('error', reject).on('timeout', reject)
      })

      const list = Array.isArray(data) ? data : (data?.results || [])

      const results = list.map(r => ({
        ...r,
        icon_url: r.icon?.url ? `https://www.spigotmc.org/${r.icon.url}` : null,
        title:    r.name,
        description: r.tag || '',
        downloads: r.downloads || 0,
        resource_id: r.id,
      }))
      return { ok: true, results }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('modrinth:getProject', async (e, idOrSlug) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    try { return await getProject(idOrSlug) }
    catch (err) { return { error: err.message } }
  })

  ipcMain.handle('modrinth:getVersions', async (e, idOrSlug, filters) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    try { return await getProjectVersions(idOrSlug, filters) }
    catch (err) { return { error: err.message } }
  })

  ipcMain.handle('modrinth:install', async (e, opts) => {
    const win = getTrustedWindow(e)
    if (!win) return { error: 'Unauthorized' }
    
    // Resolve correct instance path for the account if provided
    let targetPath = opts.instancePath
    if (opts.accountId) {
      targetPath = path.join(opts.instancePath, 'accounts', opts.accountId)
      if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true })
    }

    try {
      return await installVersion({
        ...opts,
        instancePath: targetPath,
        onProgress: (p) => {
          if (!win.isDestroyed()) win.webContents.send('modrinth:installProgress', p)
        },
      })
    } catch (err) { return { error: err.message } }
  })

  ipcMain.handle('modrinth:getGameVersions', async (e) => {
    if (!getTrustedWindow(e)) return []
    try { return await getGameVersions() }
    catch { return [] }
  })

  ipcMain.handle('modrinth:getCategories', async (e) => {
    if (!getTrustedWindow(e)) return []
    try { return await getCategories() }
    catch { return [] }
  })

  ipcMain.handle('skin:savePrefs', (e, { uuid, skinUrl, capeUrl, elytraUrl, skinPreview }) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!uuid || typeof uuid !== 'string') return { error: 'Invalid UUID' }
    try {
      const skinPrefsPath = path.join(DATA_DIR, 'skin_prefs.json')
      let prefs = {}
      if (fs.existsSync(skinPrefsPath)) {
        try { prefs = JSON.parse(fs.readFileSync(skinPrefsPath, 'utf-8')) } catch {}
      }
      prefs[uuid] = {
        skinUrl:     skinUrl     || null,
        capeUrl:     capeUrl     || null,
        elytraUrl:   elytraUrl   || null,
        skinPreview: skinPreview || prefs[uuid]?.skinPreview || null,
        updatedAt:   new Date().toISOString(),
      }
      const tmp = skinPrefsPath + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(prefs, null, 2), { mode: 0o600 })
      fs.renameSync(tmp, skinPrefsPath)
      return { ok: true }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('skin:getPrefs', (e, { uuid }) => {
    if (!getTrustedWindow(e)) return null
    if (!uuid) return null
    try {
      const skinPrefsPath = path.join(DATA_DIR, 'skin_prefs.json')
      if (!fs.existsSync(skinPrefsPath)) return null
      const prefs = JSON.parse(fs.readFileSync(skinPrefsPath, 'utf-8'))
      return prefs[uuid] || null
    } catch {
      return null
    }
  })

  ipcMain.handle('skin:uploadToWeb', async (e, { dataUrl, type, skinType, webToken, uuid }) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    if (!dataUrl || !type || !webToken) return { error: 'Thiếu thông tin' }

    const https = require('https')

    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      const fileBuffer = Buffer.from(base64, 'base64')
      const fileName = `${type}.png`

      const boundary = 'vxc_skin_' + Date.now()
      const CRLF = '\r\n'

      const parts = []

      parts.push(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
        `Content-Type: image/png${CRLF}${CRLF}`
      )

      const typePart =
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="type"${CRLF}${CRLF}` +
        type + CRLF

      const skinTypePart = type === 'skin'
        ? `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="skinType"${CRLF}${CRLF}` +
          (skinType || 'wide') + CRLF
        : ''

      const header = Buffer.from(parts[0], 'utf8')
      const typePartBuf = Buffer.from(typePart, 'utf8')
      const skinTypePartBuf = Buffer.from(skinTypePart, 'utf8')
      const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8')

      const body = Buffer.concat([
        header, fileBuffer, Buffer.from(CRLF, 'utf8'),
        typePartBuf,
        ...(skinTypePart ? [skinTypePartBuf] : []),
        footer,
      ])

      const result = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'voxelx.io.vn',
          path: '/api/upload-skin',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${webToken}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length,
            'User-Agent': 'VoxelXLauncher/1.0',
          },
        }, (res) => {
          let data = ''
          res.on('data', c => { data += c })
          res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
            catch { resolve({ status: res.statusCode, body: { error: data } }) }
          })
        })
        req.on('error', reject)
        req.write(body)
        req.end()
      })

      if (result.status !== 200) {
        return { error: result.body?.error || `HTTP ${result.status}` }
      }

      const uploadedUrl = result.body?.url
      if (!uploadedUrl) return { error: 'Không nhận được URL từ server' }

      if (uuid) {
        try {
          const skinPrefsPath = path.join(DATA_DIR, 'skin_prefs.json')
          let prefs = {}
          if (fs.existsSync(skinPrefsPath)) {
            try { prefs = JSON.parse(fs.readFileSync(skinPrefsPath, 'utf-8')) } catch {}
          }
          prefs[uuid] = {
            ...prefs[uuid],
            [type === 'skin' ? 'skinUrl' : type === 'cape' ? 'capeUrl' : 'elytraUrl']: uploadedUrl,
            updatedAt: new Date().toISOString(),
          }
          const tmp = skinPrefsPath + '.tmp'
          fs.writeFileSync(tmp, JSON.stringify(prefs, null, 2), { mode: 0o600 })
          fs.renameSync(tmp, skinPrefsPath)
        } catch {}
      }

      return { ok: true, url: uploadedUrl, type, skinType }
    } catch (err) {
      return { error: err.message }
    }
  })
}

module.exports = { registerLauncherHandlers }

