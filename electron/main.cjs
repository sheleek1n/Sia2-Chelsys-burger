const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const database = require('./database.cjs')

const DIST_INDEX = path.join(__dirname, '..', 'dist', 'index.html')

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    title: "Chelsy's Burger POS",
    autoHideMenuBar: true,
  })

  // Load order:
  //   1. If packaged → always load built file
  //   2. If ELECTRON_DEV env set OR dev server explicitly requested → try Vite (with dist fallback on failure)
  //   3. Otherwise → load built dist/index.html if it exists, else try dev server
  const isPackaged = app.isPackaged
  const preferDev =
    process.env.ELECTRON_DEV === '1' ||
    process.env.NODE_ENV === 'development' ||
    process.argv.includes('--dev')
  const distExists = fs.existsSync(DIST_INDEX)

  const loadDist = () => {
    if (distExists) {
      win.loadFile(DIST_INDEX)
    } else {
      win.loadURL(
        `data:text/html,<h2 style="font-family:sans-serif;padding:2rem">` +
        `No built UI found.</h2>` +
        `<p style="font-family:sans-serif;padding:0 2rem">` +
        `Run <code>npm run build</code> to build the UI, or ` +
        `<code>npm run electron:dev</code> to launch with the Vite dev server.</p>`
      )
    }
  }

  if (isPackaged) {
    loadDist()
    return
  }

  if (preferDev) {
    // Explicit dev mode (launched via npm run electron:dev)
    win.loadURL('http://localhost:5173').catch((err) => {
      console.warn('[Chelsys] Dev server unreachable, falling back to dist/:', err.message)
      loadDist()
    })
    return
  }

  // Default for `npx electron .` — prefer built file if it exists
  if (distExists) {
    loadDist()
  } else {
    win.loadURL('http://localhost:5173').catch(() => loadDist())
  }
}

// ── IPC Handlers ──────────────────────────────────────────────
ipcMain.handle('db:load', () => {
  return database.load()
})

ipcMain.handle('db:save', (_event, data) => {
  database.save(data)
  return true
})

ipcMain.handle('db:getPath', () => {
  return database.getDbPath()
})

// ── App Lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Close SQLite connection cleanly on quit
app.on('will-quit', () => {
  database.close()
})
