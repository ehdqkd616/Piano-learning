import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from 'electron'
import path from 'path'
import fs from 'fs'

const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null
let logWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ──── 로그 저장소 ────────────────────────────────────────────────
interface LogEntry { level: string; message: string; time: number }
const logBuffer: LogEntry[] = []
const MAX_LOGS = 1000

function pushLog(level: string, message: string) {
  const entry: LogEntry = { level, message, time: Date.now() }
  logBuffer.push(entry)
  if (logBuffer.length > MAX_LOGS) logBuffer.shift()
  // 열려있는 로그 뷰어에 즉시 전송
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.webContents.send('log-entry', entry)
  }
}

// ──── 메인 윈도우 ─────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'tray-icon.png'),
    backgroundColor: '#0f0f0f',
    show: false,
    title: 'Piano Learning',
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    pushLog('info', '앱 시작됨')
  })

  // X 버튼 → 트레이로 최소화 (종료 아님)
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
      tray?.displayBalloon({
        title: 'Piano Learning',
        content: '앱이 트레이에서 계속 실행 중입니다.',
        iconType: 'info',
        noSound: true,
      })
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ──── 로그 뷰어 윈도우 ────────────────────────────────────────────
function createLogWindow() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus()
    return
  }

  logWindow = new BrowserWindow({
    width: 860,
    height: 580,
    minWidth: 600,
    minHeight: 400,
    title: 'Piano Learning — 로그',
    icon: path.join(__dirname, 'tray-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'log-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0f0f1a',
    show: false,
  })

  logWindow.loadFile(path.join(__dirname, 'log-viewer.html'))

  logWindow.once('ready-to-show', () => {
    logWindow?.show()
    // 기존 로그 전송
    logBuffer.forEach((entry) => {
      logWindow?.webContents.send('log-entry', entry)
    })
  })

  logWindow.on('closed', () => { logWindow = null })
  logWindow.setMenuBarVisibility(false)
}

// ──── 시스템 트레이 ───────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: 'Piano Learning 열기',
      click: () => { mainWindow?.show(); mainWindow?.focus() },
    },
    {
      label: '로그 뷰어',
      click: () => createLogWindow(),
    },
    { type: 'separator' },
    {
      label: '개발자 도구',
      visible: isDev,
      click: () => mainWindow?.webContents.openDevTools(),
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setToolTip('Piano Learning')
  tray.setContextMenu(buildMenu())

  // 더블클릭으로 창 열기/숨기기
  tray.on('double-click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

// ──── 앱 시작 ─────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Electron {
    interface App { isQuitting: boolean }
  }
}
app.isQuitting = false

app.whenReady().then(() => {
  createWindow()
  createTray()
})

// 모든 창이 닫혀도 트레이에 남음 (앱 종료 안 함)
app.on('window-all-closed', () => {
  /* no-op: 트레이에서 계속 실행 */
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else mainWindow?.show()
})

// ──── IPC 핸들러 ──────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion())

// 렌더러에서 보내는 로그 수신
ipcMain.on('log-send', (_, { level, message }: { level: string; message: string }) => {
  pushLog(level, message)
})

// 로그 지우기
ipcMain.on('log-clear', () => {
  logBuffer.length = 0
})
