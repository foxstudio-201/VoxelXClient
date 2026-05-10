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
  checkUpdate: () => ipcRenderer.invoke('updater:check'),
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

  // Fabric Meta API (proxied qua main process để tránh CSP)
  fabricGetLoaderVersions: (gameVersion) => ipcRenderer.invoke('fabric:getLoaderVersions', gameVersion),

  // Forge Meta API (proxied qua main process)
  forgeGetVersions: (gameVersion) => ipcRenderer.invoke('forge:getVersions', gameVersion),

  // NeoForge Meta API (proxied qua main process)
  neoforgeGetVersions: (gameVersion) => ipcRenderer.invoke('neoforge:getVersions', gameVersion),

  // Minecraft version manifest (proxied để tránh CSP)
  minecraftListVersions: () => ipcRenderer.invoke('minecraft:listVersions'),

  // Modpack import
  importModpack: (opts) => ipcRenderer.invoke('profiles:importModpack', opts),
  onImportProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('import:progress', handler)
    return () => ipcRenderer.removeListener('import:progress', handler)
  },
  saveTempFile: (opts) => ipcRenderer.invoke('profiles:saveTempFile', opts),
  // Mở file dialog để chọn modpack — trả về path trực tiếp, không cần truyền buffer
  browseModpack: ()         => ipcRenderer.invoke('modpack:browse'),
  readModpackMeta: (path)   => ipcRenderer.invoke('modpack:readMeta', path),
  // Lấy đường dẫn thực từ File object (drag & drop) — dùng webUtils
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
})
