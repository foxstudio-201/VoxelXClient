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

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initGlobalSmoothScroll } from './hooks/useSmoothScroll.js'

initGlobalSmoothScroll({ speed: 80, duration: 380 })

createRoot(document.getElementById('root')).render(
  <App />
)

