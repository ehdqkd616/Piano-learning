const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('launcherAPI', {
  startElectron: () => ipcRenderer.send('dev-start-electron'),
  startWeb: () => ipcRenderer.send('dev-start-web'),
  stop: () => ipcRenderer.send('dev-stop'),
  restart: () => ipcRenderer.send('dev-restart'),
  build: () => ipcRenderer.send('run-build'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  onProcLog: (cb) => ipcRenderer.on('proc-log', (_, data) => cb(data)),
  onAppLog: (cb) => ipcRenderer.on('app-log', (_, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('dev-status', (_, data) => cb(data)),
})
