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

const { spawn } = require('child_process')
const path  = require('path')
const fs    = require('fs')

function substituteArgs(args, vars) {
  if (!Array.isArray(args)) return []
  return args.flatMap(arg => {
    if (typeof arg === 'string') {
      return [arg.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '')]
    }

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

function buildClasspath(libraries, clientJar) {
  const sep = process.platform === 'win32' ? ';' : ':'
  const normalize = p => p.replace(/\\/g, '/').toLowerCase()
  const clientNorm = normalize(clientJar)

  const libs = libraries.filter(l => fs.existsSync(l))
  const alreadyIncluded = libs.some(l => normalize(l) === clientNorm)
  const all = alreadyIncluded ? libs : [...libs, clientJar]
  return all.join(sep)
}

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

  if (!fs.existsSync(instancePath)) fs.mkdirSync(instancePath, { recursive: true })

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

    resolution_width:  '854',
    resolution_height: '480',
  }

  const jvmArgs = [
    `-Xmx${ramMb}m`,
    `-Xms${Math.min(512, ramMb)}m`,
    `-Djava.library.path=${nativesDir}`,
    `-Dminecraft.launcher.brand=VoxelXClient`,
    `-Dminecraft.launcher.version=1.0.0`,

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

    versionJvmArgs = []
  } else if (needsVanillaCP) {

    const sep = process.platform === 'win32' ? ';' : ':'
    const normalize = p => p.replace(/\\/g, '/').toLowerCase()
    const clientNorm = normalize(clientJar)
    const libsOnly = libraries.filter(l => fs.existsSync(l) && normalize(l) !== clientNorm)
    const classpathNoClient = libsOnly.join(sep)

    const vanillaArgs = versionJson.arguments?.jvm
      ? substituteArgs(versionJson.arguments.jvm, { ...vars, classpath: classpathNoClient })
      : [`-Djava.library.path=${nativesDir}`, '-cp', classpathNoClient]

    const cpIdx = vanillaArgs.indexOf('-cp')
    versionJvmArgs = cpIdx >= 0 ? ['-cp', vanillaArgs[cpIdx + 1]] : ['-cp', classpathNoClient]
  } else {
    versionJvmArgs = versionJson.arguments?.jvm
      ? substituteArgs(versionJson.arguments.jvm, vars)
      : [`-Djava.library.path=${nativesDir}`, '-cp', classpath]
  }

  const gameArgs = versionJson.arguments?.game
    ? substituteArgs(versionJson.arguments.game, vars)
    : (versionJson.minecraftArguments || '').split(' ').map(a =>
        a.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '')
      )

  const mainClass = mainClassOverride || versionJson.mainClass

  let finalGameArgs = gameArgs
  if (extraGameArgs.length > 0) {
    const extraKeys = new Set()
    for (let i = 0; i < extraGameArgs.length; i++) {
      if (extraGameArgs[i].startsWith('--')) extraKeys.add(extraGameArgs[i])
    }
    finalGameArgs = []
    for (let i = 0; i < gameArgs.length; i++) {
      if (gameArgs[i].startsWith('--') && extraKeys.has(gameArgs[i])) {
        i++
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

