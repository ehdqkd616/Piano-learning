export {}

declare global {
  interface Window {
    electronAPI?: {
      getAppVersion: () => Promise<string>
      sendLog: (level: string, message: string) => void
    }
    logAPI?: {
      onLog: (cb: (data: { level: string; message: string; time: number }) => void) => void
      clearLogs: () => void
    }
  }
}
