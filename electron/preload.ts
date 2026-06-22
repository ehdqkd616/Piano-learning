import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  /** 로그 메시지를 메인 프로세스로 전송 */
  sendLog: (level: string, message: string) =>
    ipcRenderer.send('log-send', { level, message }),
})
