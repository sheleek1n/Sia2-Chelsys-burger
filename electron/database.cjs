/**
 * Electron local database — stores data as a JSON file on disk.
 * Located at: userData/chelsys-burger-data.json
 *
 * This replaces localStorage when running inside Electron.
 * Data survives browser cache clears, app reinstalls, and OS updates.
 */
const { app } = require('electron')
const path = require('path')
const fs = require('fs')

const DB_FILENAME = 'chelsys-burger-data.json'

function getDbPath() {
  return path.join(app.getPath('userData'), DB_FILENAME)
}

function load() {
  const dbPath = getDbPath()
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (err) {
    console.error('[Chelsys DB] Failed to read database file:', err.message)
    // Try to recover from backup
    const backupPath = dbPath + '.bak'
    if (fs.existsSync(backupPath)) {
      try {
        const raw = fs.readFileSync(backupPath, 'utf-8')
        console.log('[Chelsys DB] Recovered from backup file')
        return JSON.parse(raw)
      } catch { /* backup also corrupted */ }
    }
  }
  return null // signals to use default seed data
}

function save(data) {
  const dbPath = getDbPath()
  try {
    // Write to temp file first, then rename (atomic write)
    const tmpPath = dbPath + '.tmp'
    const json = JSON.stringify(data, null, 0)
    fs.writeFileSync(tmpPath, json, 'utf-8')

    // Keep a backup of the previous version
    if (fs.existsSync(dbPath)) {
      const backupPath = dbPath + '.bak'
      try { fs.copyFileSync(dbPath, backupPath) } catch { /* ignore backup failures */ }
    }

    fs.renameSync(tmpPath, dbPath)
  } catch (err) {
    console.error('[Chelsys DB] Failed to save database:', err.message)
  }
}

module.exports = { load, save, getDbPath }
