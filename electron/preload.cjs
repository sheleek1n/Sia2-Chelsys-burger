const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    load: () => ipcRenderer.invoke('db:load'),
    save: (data) => ipcRenderer.invoke('db:save', data),
    getPath: () => ipcRenderer.invoke('db:getPath'),
  },
  isElectron: true,
})
