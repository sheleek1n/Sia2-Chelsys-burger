const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const database = require('./database.cjs')

const DIST_INDEX = path.join(__dirname, '..', 'dist', 'index.html')

function getAppIcon() {
  // Icons must be read from outside the asar (asarUnpack) so the OS can access them.
  // Try ICO first (best for Windows), fall back to PNG.
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'chelsys-burger-logo.ico'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'chelsys-burger-logo-icon.png'),
      ]
    : [
        path.join(__dirname, 'chelsys-burger-logo.ico'),
        path.join(__dirname, 'chelsys-burger-logo-icon.png'),
      ]

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p)
      if (!img.isEmpty()) return img
    }
  }
  return undefined // Electron will use its default if nothing loads
}

function createWindow() {
  const icon = getAppIcon()

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
    icon,
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
    return win
  }

  if (preferDev) {
    // Explicit dev mode (launched via npm run electron:dev)
    win.loadURL('http://localhost:5173').catch((err) => {
      console.warn('[Chelsys] Dev server unreachable, falling back to dist/:', err.message)
      loadDist()
    })
    return win
  }

  // Default for `npx electron .` — prefer built file if it exists
  if (distExists) {
    loadDist()
  } else {
    win.loadURL('http://localhost:5173').catch(() => loadDist())
  }

  return win
}

// ── IPC Handlers ──────────────────────────────────────────────
ipcMain.handle('db:load', () => {
  return database.load()
})

// Synchronous save — renderer blocks until this returns, so no data is ever
// lost between a save() call and the window being destroyed.
ipcMain.on('db:save', (event, data) => {
  try {
    database.save(data)
  } catch (err) {
    console.error('[Chelsys] db:save failed:', err.message)
  }
  event.returnValue = true
})

ipcMain.handle('db:getPath', () => {
  return database.getDbPath()
})

// ── App Lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  const win = createWindow()

  // Confirm before closing
  if (win) {
    win.on('close', (e) => {
      e.preventDefault()
      dialog.showMessageBox(win, {
        type: 'question',
        buttons: ['Exit', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        title: "Exit Chelsy's Burger POS",
        message: 'Are you sure you want to exit?',
        detail: 'Any unsaved changes will be lost.',
      }).then(({ response }) => {
        if (response === 0) {
          win.destroy() // bypass the close event and force quit
        }
      })
    })
  }

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
