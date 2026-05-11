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

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow:    () => ipcRenderer.send('window-close'),

  // Accounts
  getAccounts:   ()        => ipcRenderer.invoke('accounts:get'),
  addAccount:    (account) => ipcRenderer.invoke('accounts:add', account),
  removeAccount: (id)      => ipcRenderer.invoke('accounts:remove', id),
  selectAccount: (id)      => ipcRenderer.invoke('accounts:select', id),

  // Updater
  checkUpdate:      () => ipcRenderer.invoke('updater:check'),
  downloadUpdate:   (opts) => ipcRenderer.invoke('updater:download', opts),
  installUpdate:    (opts) => ipcRenderer.invoke('updater:install', opts),
  onDownloadProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('updater:downloadProgress', handler)
    return () => ipcRenderer.removeListener('updater:downloadProgress', handler)
  },
  getVersion:  () => ipcRenderer.invoke('app:version'),

  // Settings
  getSettings:  ()       => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch)  => ipcRenderer.invoke('settings:save', patch),

  // Profiles
  getProfiles:    ()            => ipcRenderer.invoke('profiles:get'),
  createProfile:  (profileData) => ipcRenderer.invoke('profiles:create', profileData),
  deleteProfile:  (id)          => ipcRenderer.invoke('profiles:delete', id),
  selectProfile:  (id)          => ipcRenderer.invoke('profiles:select', id),
  browseFolder:      ()            => ipcRenderer.invoke('profiles:browse'),
  openProfileFolder: (id)          => ipcRenderer.invoke('profiles:openFolder', id),
  updateProfileRam:  (id, ramGb)   => ipcRenderer.invoke('profiles:updateRam', id, ramGb),

  // Fabric Meta API (proxied through main process to avoid CSP)
  fabricGetLoaderVersions: (gameVersion) => ipcRenderer.invoke('fabric:getLoaderVersions', gameVersion),

  // Forge Meta API (proxied through main process)
  forgeGetVersions: (gameVersion) => ipcRenderer.invoke('forge:getVersions', gameVersion),

  // NeoForge Meta API (proxied through main process)
  neoforgeGetVersions: (gameVersion) => ipcRenderer.invoke('neoforge:getVersions', gameVersion),

  // Minecraft version manifest (proxied to avoid CSP)
  minecraftListVersions: () => ipcRenderer.invoke('minecraft:listVersions'),

  // Modpack import
  importModpack: (opts) => ipcRenderer.invoke('profiles:importModpack', opts),
  onImportProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('import:progress', handler)
    return () => ipcRenderer.removeListener('import:progress', handler)
  },
  saveTempFile: (opts) => ipcRenderer.invoke('profiles:saveTempFile', opts),
  // Download modpack from URL, create profile, and import — used by Mods browser
  downloadAndImportModpack: (opts) => ipcRenderer.invoke('modpack:downloadAndImport', opts),
  // Open file dialog to select a modpack — returns path directly, no need to pass buffer
  browseModpack: ()         => ipcRenderer.invoke('modpack:browse'),
  readModpackMeta: (path)   => ipcRenderer.invoke('modpack:readMeta', path),
  // Get real path from File object (drag & drop) — uses webUtils
  getFilePath: (file) => {
    try {
      const { webUtils } = require('electron')
      return webUtils.getPathForFile(file)
    } catch {
      return null
    }
  },

  // Microsoft Auth
  msStartLogin:   ()   => ipcRenderer.invoke('ms:startLogin'),
  msCancelLogin:  ()   => ipcRenderer.invoke('ms:cancelLogin'),
  msRefreshToken: (id) => ipcRenderer.invoke('ms:refreshToken', id),
  onMsDeviceCode: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('ms:deviceCode', handler)
    return () => ipcRenderer.removeListener('ms:deviceCode', handler)
  },
  onMsLoginProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('ms:loginProgress', handler)
    return () => ipcRenderer.removeListener('ms:loginProgress', handler)
  },

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Modrinth
  modrinthSearch:          (opts)           => ipcRenderer.invoke('modrinth:search', opts),
  modrinthGetProject:      (idOrSlug)       => ipcRenderer.invoke('modrinth:getProject', idOrSlug),
  modrinthGetVersions:     (idOrSlug, f)    => ipcRenderer.invoke('modrinth:getVersions', idOrSlug, f),
  modrinthInstall:         (opts)           => ipcRenderer.invoke('modrinth:install', opts),
  modrinthGetGameVersions: ()               => ipcRenderer.invoke('modrinth:getGameVersions'),
  modrinthGetCategories:   ()               => ipcRenderer.invoke('modrinth:getCategories'),
  onModrinthInstallProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('modrinth:installProgress', handler)
    return () => ipcRenderer.removeListener('modrinth:installProgress', handler)
  },

  // CurseForge
  curseforgeSearch:          (opts)           => ipcRenderer.invoke('curseforge:search', opts),
  curseforgeGetProject:      (id)             => ipcRenderer.invoke('curseforge:getProject', id),
  curseforgeGetVersions:     (id, f)          => ipcRenderer.invoke('curseforge:getVersions', id, f),
  curseforgeGetCategories:   (type)           => ipcRenderer.invoke('curseforge:getCategories', type),
  curseforgeInstall:         (opts)           => ipcRenderer.invoke('curseforge:install', opts),
  onCurseForgeInstallProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('curseforge:installProgress', handler)
    return () => ipcRenderer.removeListener('curseforge:installProgress', handler)
  },

  // Technic
  technicSearch:          (opts)           => ipcRenderer.invoke('technic:search', opts),
  technicGetProject:      (id)             => ipcRenderer.invoke('technic:getProject', id),
  technicGetVersions:     (id)             => ipcRenderer.invoke('technic:getVersions', id),
  technicInstall:         (opts)           => ipcRenderer.invoke('technic:install', opts),
  onTechnicInstallProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('technic:installProgress', handler)
    return () => ipcRenderer.removeListener('technic:installProgress', handler)
  },

  // FTB
  ftbSearch:          (opts)  => ipcRenderer.invoke('ftb:search', opts),
  ftbGetProject:      (id)    => ipcRenderer.invoke('ftb:getProject', id),
  ftbGetVersions:     (id)    => ipcRenderer.invoke('ftb:getVersions', id),
  ftbInstall:         (opts)  => ipcRenderer.invoke('ftb:install', opts),
  onFtbInstallProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('ftb:installProgress', handler)
    return () => ipcRenderer.removeListener('ftb:installProgress', handler)
  },

  // Launcher
  launchGame:      (opts)       => ipcRenderer.invoke('launcher:launch', opts),
  stopGame:        (opts)       => ipcRenderer.invoke('launcher:stop', opts),
  isGameRunning:   (opts)       => ipcRenderer.invoke('launcher:isRunning', opts),
  listRunningGames: ()          => ipcRenderer.invoke('launcher:listRunning'),
  getProfileStats: (opts)       => ipcRenderer.invoke('launcher:getStats', opts),
  getLatestLog:    (opts)       => ipcRenderer.invoke('launcher:getLatestLog', opts),
  listLogs:        (opts)       => ipcRenderer.invoke('launcher:listLogs', opts),
  onLaunchProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('launcher:progress', handler)
    return () => ipcRenderer.removeListener('launcher:progress', handler)
  },
  onLaunchLog: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('launcher:log', handler)
    return () => ipcRenderer.removeListener('launcher:log', handler)
  },
  onLaunchLogUpdate: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('launcher:logUpdate', handler)
    return () => ipcRenderer.removeListener('launcher:logUpdate', handler)
  },
  onGameStopped: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('launcher:stopped', handler)
    return () => ipcRenderer.removeListener('launcher:stopped', handler)
  },

  // Groups
  getGroups:              ()                   => ipcRenderer.invoke('groups:get'),
  createGroup:            (data)               => ipcRenderer.invoke('groups:create', data),
  deleteGroup:            (id)                 => ipcRenderer.invoke('groups:delete', id),
  addProfileToGroup:      (groupId, profileId) => ipcRenderer.invoke('groups:addProfile', groupId, profileId),
  removeProfileFromGroup: (groupId, profileId) => ipcRenderer.invoke('groups:removeProfile', groupId, profileId),
  renameGroup:            (id, name)           => ipcRenderer.invoke('groups:rename', id, name),

  // VoxelXSkin preferences
  saveSkinPrefs: (opts) => ipcRenderer.invoke('skin:savePrefs', opts),
  getSkinPrefs:  (opts) => ipcRenderer.invoke('skin:getPrefs', opts),

  // Profile content (mods, worlds, shaders, resourcepacks)
  profileListMods:          (profileId)            => ipcRenderer.invoke('profile:listMods', profileId),
  profileToggleMod:         (profileId, fileName)  => ipcRenderer.invoke('profile:toggleMod', profileId, fileName),
  profileDeleteMod:         (profileId, fileName)  => ipcRenderer.invoke('profile:deleteMod', profileId, fileName),
  profileGetModMeta:        (profileId, fileName)  => ipcRenderer.invoke('profile:getModMeta', profileId, fileName),
  profileGetShaderMeta:     (profileId, fileName)  => ipcRenderer.invoke('profile:getShaderMeta', profileId, fileName),
  profileGetResourcePackMeta: (profileId, fileName) => ipcRenderer.invoke('profile:getResourcePackMeta', profileId, fileName),
  profileListShaders:       (profileId)            => ipcRenderer.invoke('profile:listShaders', profileId),
  profileDeleteShader:      (profileId, f, sub)    => ipcRenderer.invoke('profile:deleteShader', profileId, f, sub),
  profileListResourcePacks: (profileId)            => ipcRenderer.invoke('profile:listResourcePacks', profileId),
  profileDeleteResourcePack:(profileId, fileName)  => ipcRenderer.invoke('profile:deleteResourcePack', profileId, fileName),
  profileListWorlds:        (profileId)            => ipcRenderer.invoke('profile:listWorlds', profileId),
  profileDeleteWorld:       (profileId, folder)    => ipcRenderer.invoke('profile:deleteWorld', profileId, folder),
  profileUpdate:            (profileId, patch)     => ipcRenderer.invoke('profile:update', profileId, patch),
  profileListJavas:         ()                     => ipcRenderer.invoke('profile:listJavas'),

  // Java distro manager
  javaFetchDistros: (profileId) => ipcRenderer.invoke('java:fetchDistros', profileId),
  javaGetInstalled: (profileId) => ipcRenderer.invoke('java:getInstalled', profileId),
  javaInstall:      (pkg, profileId) => ipcRenderer.invoke('java:install', pkg, profileId),
  javaInstallToDir: (pkg, dir)       => ipcRenderer.invoke('java:installToDir', pkg, dir),
  javaDelete:       (profileId)      => ipcRenderer.invoke('java:delete', profileId),
  onJavaInstallProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('java:installProgress', handler)
    return () => ipcRenderer.removeListener('java:installProgress', handler)
  },
  // Server manager
  serverList:          ()                    => ipcRenderer.invoke('server:list'),
  serverCreate:        (opts)                => ipcRenderer.invoke('server:create', opts),
  serverDelete:        (id)                  => ipcRenderer.invoke('server:delete', id),
  serverUpdate:        (id, patch)           => ipcRenderer.invoke('server:update', id, patch),
  serverDownloadJar:   (id)                  => ipcRenderer.invoke('server:downloadJar', id),
  serverStart:         (id)                  => ipcRenderer.invoke('server:start', id),
  serverStop:          (id)                  => ipcRenderer.invoke('server:stop', id),
  serverRestart:       (id)                  => ipcRenderer.invoke('server:restart', id),
  serverSendCommand:   (id, cmd)             => ipcRenderer.invoke('server:sendCommand', id, cmd),
  serverGetLogs:       (id)                  => ipcRenderer.invoke('server:getLogs', id),
  serverGetStatus:     (id)                  => ipcRenderer.invoke('server:getStatus', id),
  serverListDir:       (id, sub)             => ipcRenderer.invoke('server:listDir', id, sub),
  serverListDirFull:   (id, sub)             => ipcRenderer.invoke('server:listDirFull', id, sub),
  serverListFiles:     (id)                  => ipcRenderer.invoke('server:listFiles', id),
  serverReadFile:      (id, filePath)        => ipcRenderer.invoke('server:readFile', id, filePath),
  serverWriteFile:     (id, filePath, content) => ipcRenderer.invoke('server:writeFile', id, filePath, content),
  serverDeleteItems:   (id, paths)           => ipcRenderer.invoke('server:deleteItems', id, paths),
  serverCompress:      (id, paths, zipName)  => ipcRenderer.invoke('server:compress', id, paths, zipName),
  serverExtract:       (id, filePath)        => ipcRenderer.invoke('server:extract', id, filePath),
  serverUploadFile:    (id, sub, name, b64)  => ipcRenderer.invoke('server:uploadFile', id, sub, name, b64),
  serverGetNetworkInfo:(id)                  => ipcRenderer.invoke('server:getNetworkInfo', id),
  serverStartTunnel:   (id, port)            => ipcRenderer.invoke('server:startTunnel', id, port),
  serverStopTunnel:    (id)                  => ipcRenderer.invoke('server:stopTunnel', id),
  onServerTunnelLog:   (cb) => {
    const handler = (_, data) => cb(data)
    require('electron').ipcRenderer.on('server:tunnelLog', handler)
    return () => require('electron').ipcRenderer.removeListener('server:tunnelLog', handler)
  },
  serverOpenFolder:    (id, sub)             => ipcRenderer.invoke('server:openFolder', id, sub),
  serverBrowse:        ()                    => ipcRenderer.invoke('server:browse'),
  serverInstallJava:   (pkg, id)             => ipcRenderer.invoke('server:installJava', pkg, id),
  serverGetVersions:   ()                    => ipcRenderer.invoke('server:getVersions'),
  onServerLog: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('server:log', handler)
    return () => ipcRenderer.removeListener('server:log', handler)
  },
  onServerStatus: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('server:status', handler)
    return () => ipcRenderer.removeListener('server:status', handler)
  },
  onServerDownloadProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('server:downloadProgress', handler)
    return () => ipcRenderer.removeListener('server:downloadProgress', handler)
  },
  onServerJavaProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('server:javaProgress', handler)
    return () => ipcRenderer.removeListener('server:javaProgress', handler)
  },
})
