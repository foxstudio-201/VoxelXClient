'use strict'

const AdmZip = require('adm-zip')
const https  = require('https')
const http   = require('http')
const fs     = require('fs')
const path   = require('path')
const { spawnSync } = require('child_process')

const NEOFORGE_MAVEN = 'https://maven.neoforged.net/releases'
const MANIFEST_URL   = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client  = url.startsWith('https') ? https : http
    const dir     = path.dirname(destPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const tmpPath = destPath + '.tmp'
    const req = client.get(url, { headers: { 'User-Agent': 'VoxelXLauncher/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}: ${url}`)) }
      const out = fs.createWriteStream(tmpPath)
      res.pipe(out)
      out.on('finish', () => {
        try { fs.renameSync(tmpPath, destPath) } catch {
          fs.copyFileSync(tmpPath, destPath); try { fs.unlinkSync(tmpPath) } catch {}
        }
        resolve()
      })
      out.on('error', err => { try { fs.unlinkSync(tmpPath) } catch {}; reject(err) })
      res.on('error',  err => { try { fs.unlinkSync(tmpPath) } catch {}; reject(err) })
    })
    req.on('error', reject)
  })
}

function mavenToPath(coord) {
  if (!coord) return null
  const atIdx = coord.indexOf('@')
  const ext   = atIdx >= 0 ? coord.slice(atIdx + 1) : 'jar'
  const base  = atIdx >= 0 ? coord.slice(0, atIdx)  : coord
  const parts = base.split(':')
  if (parts.length < 3) return null
  const [group, artifact, version, classifier] = parts
  const groupPath = group.replace(/\./g, '/')
  const fileName  = classifier
    ? `${artifact}-${version}-${classifier}.${ext}`
    : `${artifact}-${version}.${ext}`
  return `${groupPath}/${artifact}/${version}/${fileName}`
}

function resolveJvmArgs(rawArgs, librariesDir, versionName) {
  if (!Array.isArray(rawArgs)) return []
  const sep       = process.platform === 'win32' ? ';' : ':'
  const libDirFwd = librariesDir.replace(/\\/g, '/')
  function subst(s) {
    return s
      .replace(/\$\{library_directory\}/g,   libDirFwd)
      .replace(/\$\{classpath_separator\}/g, sep)
      .replace(/\$\{version_name\}/g,        versionName)
  }
  const result = []
  for (const arg of rawArgs) {
    if (typeof arg === 'string') { result.push(subst(arg)); continue }
    if (arg && typeof arg === 'object' && arg.value) {
      let allowed = true
      if (Array.isArray(arg.rules)) {
        allowed = arg.rules.every(rule => {
          if (rule.action !== 'allow') return false
          if (rule.os) {
            const osName = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
            return rule.os.name === osName
          }
          return true
        })
      }
      if (!allowed) continue
      const values = Array.isArray(arg.value) ? arg.value : [arg.value]
      for (const v of values) { if (typeof v === 'string') result.push(subst(v)) }
    }
  }
  return result
}

function parseLibraryComponents(name) {
  if (!name) return null
  const atIdx = name.indexOf('@')
  const ext   = atIdx >= 0 ? name.slice(atIdx + 1) : 'jar'
  const base  = atIdx >= 0 ? name.slice(0, atIdx)  : name
  const parts = base.split(':')
  if (parts.length < 3) return null
  return {
    group:      parts[0],
    artifact:   parts[1],
    version:    parts[2],
    classifier: parts[3] || null,
    ext:        ext,
  }
}

function getMainClassFromJar(jarPath) {
  try {
    const jar   = new AdmZip(jarPath)
    const entry = jar.getEntry('META-INF/MANIFEST.MF')
    if (!entry) return null
    const content = entry.getData().toString('utf-8')
    const match = content.match(/Main-Class:\s*(\S+)/)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na !== nb) return na - nb
  }
  return 0
}

function replaceTokens(tokens, value) {
  const buf = []
  let i = 0
  while (i < value.length) {
    const c = value[i]
    if (c === '\\' && i + 1 < value.length) {
      buf.push(value[++i])
    } else if (c === '{') {
      let j = i + 1
      let key = ''
      while (j <= value.length) {
        if (j === value.length) break
        const d = value[j]
        if (d === '\\' && j + 1 < value.length) {
          key += value[++j]
        } else if (d === '}') {
          if (tokens[key] !== undefined) buf.push(tokens[key])
          i = j
          break
        } else {
          key += d
        }
        j++
      }
      if (j > value.length) buf.push(c)
    } else {
      buf.push(c)
    }
    i++
  }
  return buf.join('')
}

function parseLiteral(baseDir, literal, vars, plainConverter) {
  if (!literal) return null
  if (literal.startsWith('{') && literal.endsWith('}')) {
    return vars[literal.slice(1, -1)] ?? null
  } else if (literal.startsWith("'") && literal.endsWith("'")) {
    return literal.slice(1, -1)
  } else if (literal.startsWith('[') && literal.endsWith(']')) {
    const libPath = mavenToPath(literal.slice(1, -1))
    return libPath ? path.join(baseDir, 'libraries', libPath) : null
  }
  const converted = replaceTokens(vars, literal)
  return plainConverter ? plainConverter(converted) : converted
}

function parseOptions(baseDir, args, vars) {
  const options = {}
  let currentOpt = null
  for (const arg of args) {
    if (arg.startsWith('--')) {
      if (currentOpt !== null) options[currentOpt] = ''
      currentOpt = arg.slice(2)
    } else if (currentOpt !== null) {
      options[currentOpt] = parseLiteral(baseDir, arg, vars) || arg
      currentOpt = null
    }
  }
  if (currentOpt !== null) options[currentOpt] = ''
  return options
}

async function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { headers: { 'User-Agent': 'VoxelXLauncher/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGetJson(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${url}`))
        try { resolve(JSON.parse(data)) } catch { reject(new Error(`Invalid JSON from ${url}`)) }
      })
    }).on('error', reject)
  })
}

async function downloadMojangMappings(mcVersion, outputPath) {
  const manifest = await httpGetJson(MANIFEST_URL)
  const entry = manifest.versions.find(v => v.id === mcVersion)
  if (!entry) throw new Error(`MC version ${mcVersion} not found in manifest`)
  const versionJson = await httpGetJson(entry.url)
  const mappings = versionJson.downloads?.clientMappings
  if (!mappings) throw new Error(`No clientMappings for ${mcVersion}`)
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  await downloadFile(mappings.url, outputPath)
}

async function installNeoForgeHMCL(installerPath, instanceRoot, versionJsonPath, versionId, clientJar, javaPath, neoVersion, onProgress) {
  const zip = new AdmZip(installerPath)

  const installProfileStr = zip.readAsText('install_profile.json')
  const installProfile = JSON.parse(installProfileStr)
  const versionStr = zip.readAsText('version.json')

  const versionDir = path.dirname(versionJsonPath)
  if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })
  fs.writeFileSync(versionJsonPath, versionStr)

  const tempDir = path.join(instanceRoot, '.temp', 'neoforge_installer_cache')
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

  const vars = {}
  const data = installProfile.data
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && value.client) {
        const literal = value.client
        if (literal.startsWith('{') && literal.endsWith('}')) {
          continue
        } else if (literal.startsWith("'") && literal.endsWith("'")) {
          vars[key] = literal.slice(1, -1)
        } else {
          const cleanPath = literal.replace(/^[\\/]+/, '').replace(/\\/g, '/')
          const entry = zip.getEntry(cleanPath)
          if (entry) {
            const destPath = path.join(tempDir, `mapping_${key}`)
            fs.writeFileSync(destPath, entry.getData())
            vars[key] = destPath
          }
        }
      }
    }
  }

  vars.SIDE = 'client'
  vars.MINECRAFT_JAR = clientJar
  vars.MINECRAFT_VERSION = clientJar
  vars.ROOT = instanceRoot
  vars.INSTALLER = installerPath
  vars.LIBRARY_DIR = path.join(instanceRoot, 'libraries')

  const libDir = path.join(instanceRoot, 'libraries')
  const entries = zip.getEntries()
  for (const entry of entries) {
    if (entry.entryName.startsWith('maven/')) {
      const relPath = entry.entryName.slice(6)
      if (!relPath) continue
      const destPath = path.join(libDir, relPath)
      if (entry.isDirectory) {
        if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true })
      } else {
        const parent = path.dirname(destPath)
        if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true })
        if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
          zip.extractEntryTo(entry.entryName, path.dirname(destPath), false, true)
        }
      }
    }
  }

  const processors = installProfile.processors
  if (Array.isArray(processors) && processors.length > 0) {
    for (let i = 0; i < processors.length; i++) {
      const proc = processors[i]
      if (proc.sides && !proc.sides.includes('client')) continue

      const procArgs = proc.args || []
      const options = parseOptions(instanceRoot, procArgs, vars)

      if (options.task === 'DOWNLOAD_MOJMAPS' && options.side === 'client') {
        if (options.version && options.output) {
          onProgress?.({ phase: 'neoforge_process', log: `[${i + 1}/${processors.length}] Downloading Mojang mappings for ${options.version}...` })
          try {
            await downloadMojangMappings(options.version, options.output)
            onProgress?.({ phase: 'neoforge_process', log: `[${i + 1}/${processors.length}] Mojang mappings downloaded.` })
          } catch (e) {
            onProgress?.({ phase: 'neoforge_process', log: `[WARN] Failed to download mappings: ${e.message}` })
          }
        }
        continue
      }

      const outputs = proc.outputs || {}
      const outputKeys = Object.keys(outputs)
      if (outputKeys.length > 0) {
        let allExist = true
        for (const outKey of outputKeys) {
          const outPath = parseLiteral(instanceRoot, outKey, vars)
          if (!outPath || !fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
            allExist = false
            break
          }
        }
        if (allExist) continue
      }

      const jarCoord = proc.jar
      const jarLibPath = mavenToPath(jarCoord)
      if (!jarLibPath) throw new Error(`Invalid processor jar coordinate: ${jarCoord}`)
      const jarPath = path.join(libDir, jarLibPath)
      if (!fs.existsSync(jarPath)) {
        onProgress?.({ phase: 'neoforge_process', log: `[WARN] Processor jar not found: ${jarPath}, skipping.` })
        continue
      }

      const mainClass = getMainClassFromJar(jarPath)
      if (!mainClass) {
        onProgress?.({ phase: 'neoforge_process', log: `[WARN] No Main-Class in ${jarPath}, skipping.` })
        continue
      }

      const classpathEntries = []
      if (Array.isArray(proc.classpath)) {
        for (const cpCoord of proc.classpath) {
          const cpPath = mavenToPath(cpCoord)
          if (cpPath) {
            const fullCp = path.join(libDir, cpPath)
            if (fs.existsSync(fullCp)) classpathEntries.push(fullCp)
          }
        }
      }
      classpathEntries.push(jarPath)

      const resolvedArgs = procArgs.map(arg => parseLiteral(instanceRoot, arg, vars) || arg)

      const spawnArgs = ['-cp', classpathEntries.join(path.delimiter), mainClass, ...resolvedArgs]

      onProgress?.({ phase: 'neoforge_process', log: `[${i + 1}/${processors.length}] Running ${path.basename(jarCoord)}...`, done: i, total: processors.length })

      const result = spawnSync(javaPath, spawnArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 300000,
        maxBuffer: 64 * 1024 * 1024,
      })

      if (result.error) throw new Error(`Processor ${jarCoord} failed: ${result.error.message}`)
      if (result.status !== 0) {
        const errOutput = (result.stderr?.toString() || result.stdout?.toString() || '').slice(-500)
        throw new Error(`Processor ${jarCoord} exited with code ${result.status}: ${errOutput}`)
      }

      onProgress?.({ phase: 'neoforge_process', log: `[${i + 1}/${processors.length}] ${path.basename(jarCoord)} done.`, done: i + 1, total: processors.length })
    }
  }
}

function progressIgnoreList(versionJsonPath) {
  let content
  try { content = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8')) } catch { return }

  const libs = content.libraries
  if (!Array.isArray(libs)) return

  const hasNewBSL = libs.some(lib => {
    if (!lib || !lib.name) return false
    const parts = parseLibraryComponents(lib.name)
    return parts && parts.group === 'cpw.mods' && parts.artifact === 'bootstraplauncher'
      && compareVersions(parts.version, '0.1.17') >= 0
  })
  if (!hasNewBSL) return

  const jvmArray = content.arguments?.jvm
  if (!Array.isArray(jvmArray)) return

  let ignoreIdx = -1
  for (let i = jvmArray.length - 1; i >= 0; i--) {
    if (typeof jvmArray[i] === 'string' && jvmArray[i].startsWith('-DignoreList=')) {
      ignoreIdx = i
      break
    }
  }
  if (ignoreIdx === -1) return

  jvmArray[ignoreIdx] = jvmArray[ignoreIdx] + ',${primary_jar_name}'

  fs.writeFileSync(versionJsonPath, JSON.stringify(content, null, 2))
}

async function setupNeoForge(mcVersion, neoVersion, librariesDir, clientJar, javaPath, instanceRoot, onProgress) {
  const installerName = `neoforge-${neoVersion}-installer.jar`
  const installerDir  = path.join(librariesDir, 'net', 'neoforged', 'neoforge', neoVersion)
  const installerPath = path.join(installerDir, installerName)
  const installerUrl  = `${NEOFORGE_MAVEN}/net/neoforged/neoforge/${neoVersion}/${installerName}`

  if (!fs.existsSync(installerDir)) fs.mkdirSync(installerDir, { recursive: true })

  if (!fs.existsSync(installerPath) || fs.statSync(installerPath).size === 0) {
    onProgress?.({ phase: 'neoforge_download', log: `Downloading NeoForge ${neoVersion} installer...`, done: 0, total: 1 })
    try {
      await downloadFile(installerUrl, installerPath)
      if (!fs.existsSync(installerPath) || fs.statSync(installerPath).size === 0) {
        throw new Error('Downloaded file is empty')
      }
    } catch (e) {
      try { fs.unlinkSync(installerPath) } catch {}
      throw new Error(`Failed to download NeoForge installer: ${e.message}`)
    }
    onProgress?.({ phase: 'neoforge_download', log: 'NeoForge installer downloaded.', done: 1, total: 1 })
  } else {
    onProgress?.({ phase: 'neoforge_download', log: 'NeoForge installer already cached.', done: 1, total: 1 })
  }

  const vanillaVersionDir = path.join(instanceRoot, 'versions', mcVersion)
  const vanillaJarDest    = path.join(vanillaVersionDir, `${mcVersion}.jar`)
  if (!fs.existsSync(vanillaJarDest) && clientJar && fs.existsSync(clientJar)) {
    if (!fs.existsSync(vanillaVersionDir)) fs.mkdirSync(vanillaVersionDir, { recursive: true })
    fs.copyFileSync(clientJar, vanillaJarDest)
    onProgress?.({ phase: 'neoforge_install', log: 'Placed vanilla client.jar for installer.' })
  }

  const versionId       = `neoforge-${neoVersion}`
  const versionDir      = path.join(instanceRoot, 'versions', versionId)
  const versionJsonPath = path.join(versionDir, `${versionId}.json`)

  if (!fs.existsSync(versionJsonPath)) {
    onProgress?.({ phase: 'neoforge_install', log: 'Installing NeoForge via HMCL method...', done: 0, total: 1 })

    await installNeoForgeHMCL(installerPath, instanceRoot, versionJsonPath, versionId, vanillaJarDest, javaPath, neoVersion, onProgress)

    try { progressIgnoreList(versionJsonPath) } catch (e) {
      onProgress?.({ phase: 'neoforge_install', log: `[WARN] Bootstraplauncher fix: ${e.message}` })
    }

    onProgress?.({ phase: 'neoforge_install', log: 'NeoForge installation complete.', done: 1, total: 1 })
  } else {
    onProgress?.({ phase: 'neoforge_install', log: 'NeoForge already installed.', done: 1, total: 1 })
  }

  if (!fs.existsSync(versionJsonPath)) throw new Error(`NeoForge version JSON not found: ${versionJsonPath}`)
  const profile   = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'))
  const mainClass = profile.mainClass
  if (!mainClass) throw new Error('NeoForge version JSON missing mainClass')

  const instLibDir = path.join(instanceRoot, 'libraries')
  const extraLibraries = []
  for (const lib of (profile.libraries || [])) {
    const relPath = lib.downloads?.artifact?.path || mavenToPath(lib.name)
    if (!relPath) continue
    const instPath   = path.join(instLibDir, relPath)
    const sharedPath = path.join(librariesDir, relPath)
    if (fs.existsSync(instPath) && fs.statSync(instPath).size > 0) {
      extraLibraries.push(instPath)
    } else if (fs.existsSync(sharedPath) && fs.statSync(sharedPath).size > 0) {
      extraLibraries.push(sharedPath)
    } else {
      onProgress?.({ phase: 'neoforge_libraries', log: `[WARN] Library not found: ${relPath}` })
    }
  }

  const effectiveLibDir = fs.existsSync(instLibDir) ? instLibDir : librariesDir
  const versionName     = profile.id || `neoforge-${neoVersion}`
  const jvmArgs         = resolveJvmArgs(profile.arguments?.jvm || [], effectiveLibDir, versionName)

  const gameArgs = Array.isArray(profile.arguments?.game)
    ? profile.arguments.game.filter(a => typeof a === 'string')
    : []

  onProgress?.({ phase: 'neoforge_ready', log: `NeoForge ${neoVersion} ready. Main: ${mainClass}`, done: 1, total: 1 })

  return {
    mainClass,
    extraLibraries,
    jvmArgs,
    gameArgs,
    shimJar:              null,
    customClientJar:      null,
    needsVanillaClasspath: true,
  }
}

module.exports = { setupNeoForge }
