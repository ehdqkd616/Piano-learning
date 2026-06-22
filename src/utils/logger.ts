type LogLevel = 'info' | 'midi' | 'note' | 'warn' | 'error'

function send(level: LogLevel, message: string) {
  // Electron 환경에서는 메인 프로세스 로그 뷰어로 전송
  window.electronAPI?.sendLog(level, message)
}

export const logger = {
  info:  (msg: string) => send('info',  msg),
  midi:  (msg: string) => send('midi',  msg),
  note:  (msg: string) => send('note',  msg),
  warn:  (msg: string) => send('warn',  msg),
  error: (msg: string) => send('error', msg),
}
