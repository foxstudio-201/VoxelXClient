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

// Track running game processes
// Key: `${profileId}::${accountId}` - allows same profile with different accounts
const runningGames = new Map()

function makeKey(profileId, accountId) {
  return `${profileId}::${accountId}`
}


const { createLogWindow } = require('./logWindow.cjs')


// --- IPC Handlers ---
function registerLauncherHandlers(getTrustedWindow) {

  // launcher:launch
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

    const instancePath = profile.instancePath
    if (!fs.existsSync(instancePath)) fs.mkdirSync(instancePath, { recursive: true })

    // Create launcher_profiles.json if missing — required by Forge installer
    const launcherProfilesPath = path.join(instancePath, 'launcher_profiles.json')
    if (!fs.existsSync(launcherProfilesPath)) {
      fs.writeFileSync(launcherProfilesPath, JSON.stringify({
        profiles: {},
        selectedProfile: null,
        clientToken: 'VoxelXClient',
        authenticationDatabase: {},
        launcherVersion: { name: '2.0.0', format: 21 },
      }, null, 2))
    }

    // All game files stored inside the profile's instancePath:
    //   instancePath/runtimes/   <- Java runtime (per-profile)
    //   instancePath/versions/   <- version JSON + client.jar
    //   instancePath/libraries/  <- classpath libraries
    //   instancePath/assets/     <- textures, sounds
    //   instancePath/accounts/<accountId>/  <- saves, options (per-account)
    const sharedPath  = instancePath
    const runtimesDir = path.join(instancePath, 'runtimes')
    const gameDataDir = path.join(instancePath, 'accounts', account.id)
    if (!fs.existsSync(gameDataDir)) fs.mkdirSync(gameDataDir, { recursive: true })

    function sendProgress(data) {
      if (!win.isDestroyed()) win.webContents.send('launcher:progress', data)
    }

    // ── Log file setup (trước khi bắt đầu download) ─────────────────────
    const logsDir = path.join(profile.instancePath, 'logs')
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
    const logFilePath = path.join(logsDir, `${timestamp}.log`)
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf-8' })
    logStream.on('error', () => {}) // prevent unhandled error events

    function writeLog(line) {
      if (!win.isDestroyed()) win.webContents.send('launcher:log', { line })
      if (logStream.writable) { try { logStream.write(line + '\n') } catch {} }
      // Also forward to log window if it exists
      if (logWinRef && !logWinRef.isDestroyed()) logWinRef.webContents.send('launcher:log', { line })
    }

    // writeLogUpdate — replaces the last line in the log panel (for progress updates)
    // Throttles file writes to avoid spam — only writes to file every 1 second
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

    // logWinRef is set after createLogWindow is called
    let logWinRef = null

    function sendProgressAndLog(data) {
      sendProgress(data)
      if (data.log) writeLog(`[Launcher] ${data.log}`)
    }

    // sendProgressAndUpdate — sends progress + updates last log line (no new line appended in UI)
    function sendProgressAndUpdate(data) {
      sendProgress(data)
      if (data.log) writeLogUpdate(`[Launcher] ${data.log}`)
    }

    try {
      sendProgressAndLog({ phase: 'resolve', log: `Loading version info for ${profile.gameVersion}...`, percent: 2 })
      const versionJson = await resolveVersion(profile.gameVersion, sharedPath)

      sendProgressAndLog({ phase: 'java', log: 'Checking Java runtime...', percent: 5 })

      // Ưu tiên Java do user chọn (lưu trong profile.javaPath = instancePath/jre/bin/java)
      // Nếu không có thì dùng Mojang-managed Java
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
          // Same phase → update the last line (no new line in UI)
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

      // Auto-refresh Microsoft token nếu sắp hết hạn (< 5 phút)
      let accessToken = account.type === 'microsoft' ? (account.mcToken || '0') : '0'
      if (account.type === 'microsoft' && account.msRefreshToken) {
        const fiveMin = 5 * 60 * 1000
        const needsRefresh = !account.mcTokenExpiry || (account.mcTokenExpiry - Date.now() < fiveMin)
        if (needsRefresh) {
          sendProgressAndLog({ phase: 'launching', log: 'Làm mới phiên đăng nhập Microsoft...', percent: 98 })
          try {
            const { refreshMinecraftToken } = require('../msAuth.cjs')
            const refreshed = await refreshMinecraftToken(account.msRefreshToken)
            // Lưu token mới vào accounts.json
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

      // ── Fabric loader setup ──────────────────────────────────────────────
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

        // Deduplicate: Fabric libs take priority over vanilla libs with same artifact
        // Extract artifact id (groupId:artifactId) from jar path to detect duplicates
        function getArtifactKey(jarPath) {
          // e.g. .../org/ow2/asm/asm/9.6/asm-9.6.jar -> "org/ow2/asm/asm"
          const normalized = jarPath.replace(/\\/g, '/')
          const match = normalized.match(/libraries\/(.+)\/[^/]+\/[^/]+\.jar$/)
          return match ? match[1] : jarPath
        }

        // Build set of artifact keys from Fabric libs
        const fabricKeys = new Set(fabricResult.extraLibraries.map(getArtifactKey))

        // Filter vanilla libs — remove any that conflict with Fabric libs
        const filteredVanillaLibs = assets.libraries.filter(lib => {
          const key = getArtifactKey(lib)
          return !fabricKeys.has(key)
        })

        extraLibraries = fabricResult.extraLibraries
        // Fabric libs go FIRST in classpath so they take precedence
        assets.libraries = [...extraLibraries, ...filteredVanillaLibs]
        extraLibraries = [] // already merged into assets.libraries

        sendProgressAndLog({ phase: 'fabric', log: `Fabric ready. Main: ${mainClassOverride}`, percent: 97 })

        // Auto-install Fabric API + Mod Menu from Modrinth
        sendProgressAndLog({ phase: 'fabric_mods', log: 'Checking Fabric mods (Fabric API, Mod Menu)...', percent: 97 })
        const modsDir = path.join(gameDataDir, 'mods')
        await ensureFabricMods(profile.gameVersion, modsDir, (p) => {
          sendProgressAndLog({ phase: 'fabric_mods', log: p.log, percent: 97, doneFiles: p.done, totalFiles: p.total })
        })

        // ── VoxelXSkin mod injection ──────────────────────────────────────
        // Fabric supports loading extra mods via the JVM property:
        //   -Dfabric.addMods=<path1>;<path2>
        // This is the correct way to inject mods outside the mods/ folder.
        // The jar is stored in instancePath/.vxc/ (hidden dir, not shown in mod list).
        try {
          const gameVer = profile.gameVersion
          const mcMajor = gameVer?.split('.').slice(0, 2).join('.')
          const modSkinDir = path.join(__dirname, '../../mod-skin')

          // Find best matching JAR: exact version first, then major.minor fallback
          let skinJarSrc = null
          const exactJar = path.join(modSkinDir, `VoxelXSkin-${gameVer}.jar`)
          const majorJar = path.join(modSkinDir, `VoxelXSkin-${mcMajor}.jar`)

          if (fs.existsSync(exactJar))      skinJarSrc = exactJar
          else if (fs.existsSync(majorJar)) skinJarSrc = majorJar

          if (skinJarSrc) {
            // Copy to hidden dir inside instancePath
            const hiddenDir = path.join(instancePath, '.vxc')
            if (!fs.existsSync(hiddenDir)) {
              fs.mkdirSync(hiddenDir, { recursive: true })
              if (process.platform === 'win32') {
                try { require('child_process').execSync(`attrib +h "${hiddenDir}"`, { windowsHide: true }) } catch {}
              }
            }
            const jarName    = path.basename(skinJarSrc)
            const skinJarDest = path.join(hiddenDir, jarName)

            // Copy only if missing or size changed
            const srcStat  = fs.statSync(skinJarSrc)
            const destStat = fs.existsSync(skinJarDest) ? fs.statSync(skinJarDest) : null
            if (!destStat || destStat.size !== srcStat.size) {
              fs.copyFileSync(skinJarSrc, skinJarDest)
            }

            // Inject via -Dfabric.addMods — Fabric's official extra-mod loading mechanism
            // Multiple paths are separated by the OS path separator (; on Windows, : on Unix)
            const sep = process.platform === 'win32' ? ';' : ':'
            const existingAddMods = extraJvmArgs.find(a => typeof a === 'string' && a.startsWith('-Dfabric.addMods='))
            if (existingAddMods) {
              // Append to existing property
              const idx = extraJvmArgs.indexOf(existingAddMods)
              extraJvmArgs[idx] = existingAddMods + sep + skinJarDest
            } else {
              extraJvmArgs.push(`-Dfabric.addMods=${skinJarDest}`)
            }

            sendProgressAndLog({ phase: 'fabric_mods', log: `VoxelXSkin ${gameVer} injected via fabric.addMods.`, percent: 97 })

            // Write launcher_profile.json so the mod knows which UUID to apply skin for
            try {
              const vxcConfigDir = path.join(gameDataDir, 'config', 'voxelxskin')
              if (!fs.existsSync(vxcConfigDir)) fs.mkdirSync(vxcConfigDir, { recursive: true })
              fs.writeFileSync(
                path.join(vxcConfigDir, 'launcher_profile.json'),
                JSON.stringify({ launcherUuid: account.uuid }, null, 2)
              )
            } catch (cfgErr) {
              writeLog(`[WARN] VoxelXSkin config write failed: ${cfgErr.message}`)
            }

            // Write skins.json from saved skin preferences
            try {
              const vxcConfigDir = path.join(gameDataDir, 'config', 'voxelxskin')
              const skinsPath = path.join(vxcConfigDir, 'skins.json')
              let skinsMap = {}
              if (fs.existsSync(skinsPath)) {
                try { skinsMap = JSON.parse(fs.readFileSync(skinsPath, 'utf-8')) } catch {}
              }
              const skinPrefsPath = path.join(DATA_DIR, 'skin_prefs.json')
              if (fs.existsSync(skinPrefsPath)) {
                const prefs = JSON.parse(fs.readFileSync(skinPrefsPath, 'utf-8'))
                const accountPrefs = prefs[account.uuid] || {}
                if (accountPrefs.skinUrl || accountPrefs.capeUrl || accountPrefs.elytraUrl) {
                  skinsMap[account.uuid] = {
                    skinPath:   accountPrefs.skinUrl   || null,
                    capePath:   accountPrefs.capeUrl   || null,
                    elytraPath: accountPrefs.elytraUrl || null,
                    playerName: account.username,
                  }
                  fs.writeFileSync(skinsPath, JSON.stringify(skinsMap, null, 2))
                }
              }
            } catch (skinPrefErr) {
              writeLog(`[WARN] VoxelXSkin skin prefs write failed: ${skinPrefErr.message}`)
            }
          } else {
            writeLog(`[INFO] VoxelXSkin: no matching JAR for MC ${gameVer}, skipping.`)
          }
        } catch (skinErr) {
          writeLog(`[WARN] VoxelXSkin injection failed: ${skinErr.message}`)
        }
      }

      // ── Forge loader setup ───────────────────────────────────────────────
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
          sharedPath,   // instanceRoot — for {ROOT} variable in processors
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

        // Forge libs go FIRST in classpath
        assets.libraries = [...forgeResult.extraLibraries, ...filteredVanillaLibs]

        // Use forge-client.jar as custom client JAR (xvl_src approach)
        // forge-client.jar is the patched Minecraft client that includes Forge's module setup
        if (forgeResult.customClientJar) {
          assets.clientJar = forgeResult.customClientJar
        }

        // Forge 1.17+ uses module system — needs vanilla -cp without clientJar
        if (forgeResult.needsVanillaClasspath) {
          extraJvmArgs = [...extraJvmArgs, '__needsVanillaClasspath__']
        }

        sendProgressAndLog({ phase: 'forge', log: `Forge ready. Main: ${mainClassOverride}`, percent: 97 })
      }

      // ── NeoForge loader setup ────────────────────────────────────────────
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

        // NeoForge needs vanilla classpath (-cp) from versionJson — flag it
        if (neoforgeResult.needsVanillaClasspath) {
          extraJvmArgs = [...extraJvmArgs, '__needsVanillaClasspath__']
        }

        sendProgressAndLog({ phase: 'neoforge', log: `NeoForge ready. Main: ${mainClassOverride}`, percent: 97 })
      }

      sendProgressAndLog({ phase: 'launching', log: `Launching as ${account.username}...`, percent: 98 })
      const logWin = showLog ? createLogWindow(win, profile.name, account.username) : null
      // Set logWinRef so writeLog/writeLogUpdate can forward to log window
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
        onLog: (line) => {
          writeLog(line)
        },
        onExit: (code) => {
          try { logStream.end() } catch {}
          logWinRef = null  // clear reference after game exits
          const game = runningGames.get(gameKey)
          if (game) {
            const elapsed = game.stopTracker()
            runningGames.delete(gameKey)
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

      // Hide launcher if setting enabled
      if (hideLauncher && !win.isDestroyed()) {
        win.hide()
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

  // launcher:stop
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

  // launcher:isRunning
  ipcMain.handle('launcher:isRunning', (e, { profileId, accountId }) => {
    if (!getTrustedWindow(e)) return false
    if (accountId) return runningGames.has(makeKey(profileId, accountId))
    for (const k of runningGames.keys()) {
      if (k.startsWith(profileId + '::')) return true
    }
    return false
  })

  // launcher:listRunning
  ipcMain.handle('launcher:listRunning', (e) => {
    if (!getTrustedWindow(e)) return []
    return Array.from(runningGames.keys()).map(key => {
      const [profileId, accountId] = key.split('::')
      return { profileId, accountId, key }
    })
  })

  // launcher:getStats
  ipcMain.handle('launcher:getStats', (e, { profileId }) => {
    if (!getTrustedWindow(e)) return null
    const profilesData = readProfiles()
    const profile = profilesData.profiles.find(p => p.id === profileId)
    if (!profile) return null
    return getProfileStats(profile)
  })

  // launcher:getLatestLog — đọc file log mới nhất của profile theo tên
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

  // launcher:listLogs — liệt kê tất cả log files của profile
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

  // ── CurseForge search ───────────────────────────────────────────────────────
  ipcMain.handle('curseforge:search', async (e, opts) => {
    return await cfSearch.searchProjects(opts)
  })
  ipcMain.handle('curseforge:getProject', async (e, id) => {
    return await cfSearch.getProject(id)
  })
  ipcMain.handle('curseforge:getVersions', async (e, id, filters) => {
    return await cfSearch.getProjectVersions(id, filters)
  })
  ipcMain.handle('curseforge:getCategories', async (e, projectType) => {
    return await cfSearch.getCategories(projectType)
  })
  ipcMain.handle('curseforge:install', async (e, opts) => {
    return await cfSearch.installVersion(opts, (p) => {
      const wins = require('electron').BrowserWindow.getAllWindows()
      wins.forEach(w => {
        if (!w.isDestroyed()) w.webContents.send('curseforge:installProgress', p)
      })
    })
  })

  // ── Technic search ──────────────────────────────────────────────────────────
  ipcMain.handle('technic:search', async (e, opts) => {
    return await technicSearch.searchProjects(opts)
  })
  ipcMain.handle('technic:getProject', async (e, id) => {
    return await technicSearch.getProject(id)
  })
  ipcMain.handle('technic:getVersions', async (e, id, filters) => {
    return await technicSearch.getProjectVersions(id)
  })
  ipcMain.handle('technic:install', async (e, opts) => {
    return await technicSearch.installVersion(opts, (p) => {
      const wins = require('electron').BrowserWindow.getAllWindows()
      wins.forEach(w => {
        if (!w.isDestroyed()) w.webContents.send('technic:installProgress', p)
      })
    })
  })

  // ── FTB search ──────────────────────────────────────────────────────────────
  ipcMain.handle('ftb:search', async (e, opts) => {
    return await ftbSearch.searchProjects(opts)
  })
  ipcMain.handle('ftb:getProject', async (e, id) => {
    return await ftbSearch.getProject(id)
  })
  ipcMain.handle('ftb:getVersions', async (e, id) => {
    return await ftbSearch.getProjectVersions(id)
  })
  ipcMain.handle('ftb:install', async (e, opts) => {
    return await ftbSearch.installVersion(opts, (p) => {
      const wins = require('electron').BrowserWindow.getAllWindows()
      wins.forEach(w => {
        if (!w.isDestroyed()) w.webContents.send('ftb:installProgress', p)
      })
    })
  })

  // ── Modrinth search & install ─────────────────────────────────────────────

  ipcMain.handle('modrinth:search', async (e, opts) => {
    if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
    try { return await searchProjects(opts) }
    catch (err) { return { error: err.message } }
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
    try {
      return await installVersion({
        ...opts,
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
  // ── VoxelXSkin skin preferences ──────────────────────────────────────────
  // skin:savePrefs — save skin/cape/elytra URL for an account UUID
  // Stored in DATA_DIR/skin_prefs.json, applied to skins.json on next launch
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

  // skin:getPrefs — get saved skin prefs for an account UUID
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
}

module.exports = { registerLauncherHandlers }
