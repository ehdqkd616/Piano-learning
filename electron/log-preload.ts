import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('logAPI', {
  onLog: (cb: (data: { level: string; message: string; time: number }) => void) => {
    ipcRenderer.on('log-entry', (_, data) => cb(data))
  },
  clearLogs: () => ipcRenderer.send('log-clear'),
})
