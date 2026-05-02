const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    load: () => ipcRenderer.invoke('db:load'),
    // sendSync blocks the renderer until the main process finishes writing to SQLite.
    // This guarantees every save is durable — no data is ever lost on close.
    save: (data) => ipcRenderer.sendSync('db:save', data),
    getPath: () => ipcRenderer.invoke('db:getPath'),
  },
  isElectron: true,
})
