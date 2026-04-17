const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const database = require('./database.cjs')

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

  // In dev, load from Vite dev server; in production, load built files
  const isDev = !app.isPackaged
  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
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
