<div align="center">

<br/>

<!-- Logo -->
<img src="https://raw.githubusercontent.com/foxstudio-201/VoxelXClient/main/public/icon.png" width="80" height="80" alt="VoxelXClient Logo" />

<h1>VoxelXClient</h1>

<p><strong>The Ultimate Minecraft Launcher</strong><br/>
Manage profiles, install mods, and launch any Minecraft version — all in one place.</p>

<p>
  <img src="https://img.shields.io/badge/version-1.0.0-4ade80?style=flat-square&labelColor=0a0a0a" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square&labelColor=0a0a0a" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-42-47848F?style=flat-square&labelColor=0a0a0a&logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=flat-square&labelColor=0a0a0a&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square&labelColor=0a0a0a" alt="License" />
</p>

<p>
  <a href="https://voxelxclient.vercel.app">🌐 Website</a> &nbsp;·&nbsp;
  <a href="https://join.foxstudio.site">💬 Discord</a> &nbsp;·&nbsp;
  <a href="#-download">⬇️ Download</a>
</p>

<br/>

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗂️ **Multi-Profile** | Create unlimited profiles — each with its own loader, version, mods and settings |
| 🔐 **Microsoft Login** | Secure OAuth2 authentication, tokens auto-refreshed |
| 📦 **Mod Support** | Import modpacks from CurseForge & Modrinth via drag-and-drop |
| 📋 **Real-Time Logs** | Color-coded game logs (INFO / WARN / ERROR / DEBUG) with copy support |
| 🎮 **Discord RPC** | Rich Presence shows your current profile and playtime automatically |
| ☕ **Java Auto-Install** | Detects and downloads the correct Java runtime per Minecraft version |
| 📊 **Play Stats** | Tracks hours played, world count, and mod count per profile |
| 🔔 **Notifications** | Toast notifications with sound for launch events |

---

## 🧩 Loader Support

<table>
  <tr>
    <td align="center"><b>Vanilla</b><br/><sub>Official</sub></td>
    <td align="center"><b>Fabric</b><br/><sub>Supported</sub></td>
    <td align="center"><b>Forge</b><br/><sub>Supported</sub></td>
    <td align="center"><b>NeoForge</b><br/><sub>Supported</sub></td>
    <td align="center"><b>CurseForge</b><br/><sub>Import</sub></td>
    <td align="center"><b>Modrinth</b><br/><sub>Import</sub></td>
  </tr>
</table>

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **UI Framework** | React 19 + Vite 8 |
| **Styling** | Tailwind CSS 4 |
| **Desktop Shell** | Electron 42 |
| **3D Rendering** | Three.js + React Three Fiber |
| **Auth** | Microsoft OAuth2 (MSAL) |
| **IPC** | Electron contextBridge / ipcMain |
| **Build** | electron-builder → NSIS installer |

---

## 📁 Project Structure

```
VoxelXClient/
├── electron/                  # Main process (Node.js)
│   ├── main.cjs               # App entry, window management
│   ├── preload.cjs            # Context bridge (IPC API)
│   ├── msAuth.cjs             # Microsoft OAuth2 flow
│   ├── profileManager.cjs     # Profile CRUD & persistence
│   ├── discordRPC.cjs         # Discord Rich Presence
│   └── launcher/
│       ├── index.cjs          # Launch orchestrator
│       ├── ipcHandlers.cjs    # All IPC event handlers
│       ├── logWindow.cjs      # Floating log window
│       ├── statsTracker.cjs   # Playtime & stats tracking
│       ├── vanilla/           # Vanilla asset/version management
│       ├── fabric/            # Fabric loader installer
│       ├── forge/             # Forge installer
│       ├── neoforge/          # NeoForge installer
│       ├── java/              # Java runtime manager
│       ├── curseforge/        # CurseForge modpack importer
│       └── modrinth/          # Modrinth modpack importer
│
├── src/                       # Renderer process (React)
│   ├── App.jsx                # Root component + routing
│   ├── components/
│   │   ├── HomePage.jsx       # Dashboard with news & launch
│   │   ├── TitleBar.jsx       # Custom window chrome
│   │   ├── SplashScreen.jsx   # Boot loading screen
│   │   ├── Sidebar.jsx        # Navigation sidebar
│   │   ├── account/           # Account management UI
│   │   ├── play/              # Profile management UI
│   │   ├── settings/          # Settings pages & tabs
│   │   └── ui/                # Shared UI components
│   ├── hooks/                 # Custom React hooks
│   └── utils/                 # Utility functions
│
├── public/                    # Static assets
└── scripts/                   # Build & icon generation scripts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **Git** — [git-scm.com](https://git-scm.com)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/foxstudio-201/VoxelXClient.git
cd VoxelXClient

# Install dependencies
npm install

# Start in development mode (Vite + Electron)
npm run electron:dev
```

### Build Installer

```bash
# Build production .exe installer (Windows)
npm run electron:build
# Output: dist-electron/
```

### Other Scripts

```bash
npm run dev          # Vite dev server only (browser preview)
npm run build        # Vite production build
npm run lint         # ESLint check
npm run patch:icon   # Regenerate app icon
```

---

## ⬇️ Download

> **Windows 10/11 (64-bit)** — Java is managed automatically, no manual setup needed.

Head to the [Releases](https://github.com/foxstudio-201/VoxelXClient/releases) page to download the latest `.exe` installer.

---

## 🤝 Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add something"`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request

---

## 📄 License

Released under the [MIT License](LICENSE).

---

<div align="center">

Made with ❤️ by **FoxStudio**

<a href="https://voxelxclient.vercel.app">voxelxclient.vercel.app</a> &nbsp;·&nbsp; <a href="https://join.foxstudio.site">Discord</a>

</div>
