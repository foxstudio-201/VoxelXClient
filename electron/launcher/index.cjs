'use strict'
/**
 * launcher/index.cjs — Entry point cho Launcher module
 * Gọi từ main.cjs để đăng ký tất cả handlers.
 */

const { registerLauncherHandlers } = require('./ipcHandlers.cjs')

module.exports = { registerLauncherHandlers }
