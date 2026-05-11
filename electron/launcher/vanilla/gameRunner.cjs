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

'use strict'
/**
 * gameRunner.cjs
 * Build launch arguments and spawn the Minecraft process.
 * Supports Vanilla, Fabric, Forge.
 */

const { spawn } = require('child_process')
const path  = require('path')
const fs    = require('fs')

// ─── Argument template substitution ──────────────────────────────────────────
function substituteArgs(args, vars) {
  if (!Array.isArray(args)) return []
  return args.flatMap(arg => {
    if (typeof arg === 'string') {
      return [arg.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '')]
    }
    // Rule-based arg (1.13+)
    if (arg.rules) {
      const allowed = arg.rules.every(rule => {
        if (rule.action === 'allow') {
          if (rule.os) return rule.os.name === vars._os
          if (rule.features) {
            return Object.entries(rule.features).every(([k, v]) => vars._features?.[k] === v)
          }
          return true
        }
        return false
      })
      if (!allowed) return []
      const value = arg.value
      return Array.isArray(value) ? value : [value]
    }
    return []
  }).map(a => typeof a === 'string'
    ? a.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '')
    : String(a)
  )
}

function getOS() {
  switch (process.platform) {
    case 'win32':  return 'windows'
    case 'darwin': return 'osx'
    default:       return 'linux'
  }
}

// ─── Build classpath ──────────────────────────────────────────────────────────
function buildClasspath(libraries, clientJar) {
  const sep = process.platform === 'win32' ? ';' : ':'
  const normalize = p => p.replace(/\\/g, '/').toLowerCase()
  const clientNorm = normalize(clientJar)
  // Only append clientJar if it's not already in libraries (Forge includes it)
  const libs = libraries.filter(l => fs.existsSync(l))
  const alreadyIncluded = libs.some(l => normalize(l) === clientNorm)
  const all = alreadyIncluded ? libs : [...libs, clientJar]
  return all.join(sep)
}

// ─── Main launch function ─────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string} opts.javaPath       - path to java executable
 * @param {string} opts.clientJar      - path to client.jar
 * @param {string[]} opts.libraries    - classpath libraries
 * @param {string} opts.nativesDir     - natives directory
 * @param {string} opts.assetsDir      - assets directory
 * @param {string} opts.assetIndex     - asset index id
 * @param {object} opts.versionJson    - full version JSON
 * @param {string} opts.instancePath   - game working directory
 * @param {string} opts.gameVersion    - e.g. "1.21.4"
 * @param {string} opts.username       - player username
 * @param {string} opts.uuid           - player UUID
 * @param {string} opts.accessToken    - MC access token (or "0" for offline)
 * @param {number} opts.ramMb          - RAM in MB
 * @param {string} opts.loader         - 'vanilla' | 'fabric' | 'forge' | 'neoforge'
 * @param {string} opts.loaderVersion  - loader version string
 * @param {function} opts.onLog        - callback(line: string)
 * @param {function} opts.onExit       - callback(code: number)
 */
function launchGame(opts) {
  const {
    javaPath, clientJar, libraries, nativesDir, assetsDir, assetIndex,
    versionJson, instancePath, gameVersion, username, uuid, accessToken,
    ramMb = 2048, mainClassOverride, extraJvmArgs = [], extraGameArgs = [],
    shimJar = null, shimWorkDir = null,
    onLog, onExit,
  } = opts

  const os = getOS()
  const classpath = buildClasspath(libraries, clientJar)

  // Ensure game dir exists
  if (!fs.existsSync(instancePath)) fs.mkdirSync(instancePath, { recursive: true })

  // Template variables
  const vars = {
    _os:              os,
    _features:        { is_demo_user: false, has_custom_resolution: false },
    auth_player_name: username,
    auth_uuid:        uuid,
    auth_access_token: accessToken || '0',
    auth_xuid:        '0',
    user_type:        accessToken && accessToken !== '0' ? 'msa' : 'legacy',
    version_name:     versionJson.id,
    game_directory:   instancePath,
    assets_root:      assetsDir,
    assets_index_name: assetIndex,
    version_type:     versionJson.type || 'release',
    natives_directory: nativesDir,
    launcher_name:    'VoxelXClient',
    launcher_version: '1.0.0',
    classpath,
    // Resolution
    resolution_width:  '854',
    resolution_height: '480',
  }

  // JVM args
  const jvmArgs = [
    `-Xmx${ramMb}m`,
    `-Xms${Math.min(512, ramMb)}m`,
    `-Djava.library.path=${nativesDir}`,
    `-Dminecraft.launcher.brand=VoxelXClient`,
    `-Dminecraft.launcher.version=1.0.0`,
    // Force UTF-8 output on all platforms (especially Windows CP1252)
    '-Dfile.encoding=UTF-8',
    '-Dstdout.encoding=UTF-8',
    '-Dstderr.encoding=UTF-8',
    '-Djava.util.logging.config.file=',
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    '-XX:G1NewSizePercent=30',
    '-XX:G1MaxNewSizePercent=40',
    '-XX:G1HeapRegionSize=8M',
    '-XX:G1ReservePercent=20',
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    '-XX:InitiatingHeapOccupancyPercent=15',
    '-XX:G1MixedGCLiveThresholdPercent=90',
    '-XX:G1RSetUpdatingPauseTimePercent=5',
    '-XX:SurvivorRatio=32',
    '-XX:+PerfDisableSharedMem',
    '-XX:MaxTenuringThreshold=1',
  ]

  // Version-specific JVM args from version JSON.
  // For Forge: extraJvmArgs has everything (including -cp via module system), skip vanilla JVM args.
  // For NeoForge: extraJvmArgs has module path args but NO -cp — needs vanilla's -cp.
  //               Signaled by '__needsVanillaClasspath__' sentinel in extraJvmArgs.
  // For Vanilla/Fabric: use versionJson.arguments.jvm which includes -cp.
  const needsVanillaCP = extraJvmArgs.includes('__needsVanillaClasspath__')
  const cleanExtraJvmArgs = extraJvmArgs.filter(a => a !== '__needsVanillaClasspath__')

  const isForge = !needsVanillaCP && cleanExtraJvmArgs.length > 0 && cleanExtraJvmArgs.some(
    a => typeof a === 'string' && (
      a.includes('bootstraplauncher') ||
      a === '--add-modules' ||
      a === 'ALL-MODULE-PATH' ||
      a === '-p'
    )
  )

  let versionJvmArgs
  if (isForge) {
    // Forge: extraJvmArgs has everything, skip vanilla JVM args entirely
    versionJvmArgs = []
  } else if (needsVanillaCP) {
    // NeoForge: needs vanilla's -cp but WITHOUT clientJar (NeoForge loads it via module system)
    const sep = process.platform === 'win32' ? ';' : ':'
    const normalize = p => p.replace(/\\/g, '/').toLowerCase()
    const clientNorm = normalize(clientJar)
    const libsOnly = libraries.filter(l => fs.existsSync(l) && normalize(l) !== clientNorm)
    const classpathNoClient = libsOnly.join(sep)

    const vanillaArgs = versionJson.arguments?.jvm
      ? substituteArgs(versionJson.arguments.jvm, { ...vars, classpath: classpathNoClient })
      : [`-Djava.library.path=${nativesDir}`, '-cp', classpathNoClient]
    // Extract just -cp <value> from vanilla args
    const cpIdx = vanillaArgs.indexOf('-cp')
    versionJvmArgs = cpIdx >= 0 ? ['-cp', vanillaArgs[cpIdx + 1]] : ['-cp', classpathNoClient]
  } else {
    versionJvmArgs = versionJson.arguments?.jvm
      ? substituteArgs(versionJson.arguments.jvm, vars)
      : [`-Djava.library.path=${nativesDir}`, '-cp', classpath]
  }

  // Game args
  const gameArgs = versionJson.arguments?.game
    ? substituteArgs(versionJson.arguments.game, vars)
    : (versionJson.minecraftArguments || '').split(' ').map(a =>
        a.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '')
      )

  // Main class
  const mainClass = mainClassOverride || versionJson.mainClass

  // Dedup game args — extraGameArgs take priority over vanilla game args
  let finalGameArgs = gameArgs
  if (extraGameArgs.length > 0) {
    const extraKeys = new Set()
    for (let i = 0; i < extraGameArgs.length; i++) {
      if (extraGameArgs[i].startsWith('--')) extraKeys.add(extraGameArgs[i])
    }
    finalGameArgs = []
    for (let i = 0; i < gameArgs.length; i++) {
      if (gameArgs[i].startsWith('--') && extraKeys.has(gameArgs[i])) {
        i++ // skip value too
      } else {
        finalGameArgs.push(gameArgs[i])
      }
    }
  }

  const spawnArgs = [
    ...jvmArgs,
    ...versionJvmArgs,
    ...cleanExtraJvmArgs,
    mainClass,
    ...finalGameArgs,
    ...extraGameArgs,
  ]
  const spawnCwd = shimWorkDir || instancePath

  onLog?.(`[Launcher] Java: ${javaPath}`)
  onLog?.(`[Launcher] Main: ${mainClass}`)
  onLog?.(`[Launcher] Args: ${spawnArgs.slice(0, 5).join(' ')}...`)

  const proc = spawn(javaPath, spawnArgs, {
    cwd:      spawnCwd,
    stdio:    ['ignore', 'pipe', 'pipe'],
    detached: false,
  })

  // Use StringDecoder to correctly handle multi-byte UTF-8 characters
  const { StringDecoder } = require('string_decoder')
  const outDecoder = new StringDecoder('utf8')
  const errDecoder = new StringDecoder('utf8')
  let outBuf = ''
  let errBuf = ''

  proc.stdout.on('data', chunk => {
    outBuf += outDecoder.write(chunk)
    const lines = outBuf.split('\n')
    outBuf = lines.pop()
    lines.filter(Boolean).forEach(line => onLog?.(line))
  })
  proc.stdout.on('end', () => {
    const rem = outDecoder.end()
    if (outBuf + rem) onLog?.(outBuf + rem)
  })

  proc.stderr.on('data', chunk => {
    errBuf += errDecoder.write(chunk)
    const lines = errBuf.split('\n')
    errBuf = lines.pop()
    lines.filter(Boolean).forEach(line => onLog?.(`[ERR] ${line}`))
  })
  proc.stderr.on('end', () => {
    const rem = errDecoder.end()
    if (errBuf + rem) onLog?.(`[ERR] ${errBuf + rem}`)
  })
  proc.on('close', code => {
    onLog?.(`[Launcher] Game exited with code ${code}`)
    onExit?.(code)
  })
  proc.on('error', err => {
    onLog?.(`[Launcher] Spawn error: ${err.message}`)
    onExit?.(-1)
  })

  return proc
}

module.exports = { launchGame }
