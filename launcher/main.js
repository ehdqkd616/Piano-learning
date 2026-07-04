const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const PROJECT_ROOT = path.join(__dirname, '..')
const LOG_FILE = path.join(PROJECT_ROOT, 'logs', 'app.log')
const ICON_PATH = path.join(PROJECT_ROOT, 'electron', 'app-icon.ico')
const isWin = process.platform === 'win32'

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g
const stripAnsi = (s) => s.replace(ANSI_RE, '')

let win = null
let tray = null
let devProcess = null
let currentMode = null // 'electron' | 'web' | null
let browserOpened = false
let buildProcess = null
let appLogPos = 0
let appLogTimer = null
app.isQuitting = false

function send(channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
}

function sendProcLog(stream, text) {
  stripAnsi(text)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .forEach((line) => send('proc-log', { stream, line, time: Date.now() }))
}

function sendStatus() {
  send('dev-status', { running: !!devProcess, mode: currentMode })
}

function startDev(mode) {
  if (devProcess) {
    sendProcLog('warn', `⚠ 이미 ${currentMode === 'web' ? '웹 브라우저' : 'Electron'} 모드로 실행 중입니다. 먼저 "중지"를 눌러주세요.`)
    return
  }
  currentMode = mode
  browserOpened = false
  const npmCmd = isWin ? 'npm.cmd' : 'npm'
  const npmScript = mode === 'web' ? 'dev' : 'electron:dev'
  devProcess = spawn(npmCmd, ['run', npmScript], { cwd: PROJECT_ROOT, shell: true })
  sendProcLog('info', `▶ 개발 서버 시작 (npm run ${npmScript})`)
  sendStatus()

  devProcess.stdout.on('data', (d) => {
    const text = stripAnsi(d.toString())
    sendProcLog('stdout', text)
    if (mode === 'web' && !browserOpened) {
      const match = text.match(/https?:\/\/localhost:\d+\/?/)
      if (match) {
        browserOpened = true
        shell.openExternal(match[0])
        sendProcLog('info', `▶ 브라우저에서 열림: ${match[0]}`)
      }
    }
  })
  devProcess.stderr.on('data', (d) => sendProcLog('stderr', d.toString()))
  devProcess.on('exit', (code) => {
    sendProcLog('info', `■ 프로세스 종료 (code ${code})`)
    devProcess = null
    currentMode = null
    sendStatus()
  })
}

function stopDev() {
  if (!devProcess) return
  const pid = devProcess.pid
  if (isWin) {
    spawn('taskkill', ['/pid', String(pid), '/t', '/f'])
  } else {
    devProcess.kill('SIGTERM')
  }
  devProcess = null
  currentMode = null
  sendStatus()
}

function runBuild() {
  if (buildProcess) return
  const npmCmd = isWin ? 'npm.cmd' : 'npm'
  sendProcLog('info', '▶ 빌드 시작 (npm run build)')
  buildProcess = spawn(npmCmd, ['run', 'build'], { cwd: PROJECT_ROOT, shell: true })
  buildProcess.stdout.on('data', (d) => sendProcLog('stdout', d.toString()))
  buildProcess.stderr.on('data', (d) => sendProcLog('stderr', d.toString()))
  buildProcess.on('exit', (code) => {
    sendProcLog('info', `■ 빌드 종료 (code ${code})`)
    buildProcess = null
  })
}

function watchAppLog() {
  const dir = path.dirname(LOG_FILE)
  fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '')
  appLogPos = fs.statSync(LOG_FILE).size

  appLogTimer = setInterval(() => {
    fs.stat(LOG_FILE, (err, stats) => {
      if (err) return
      if (stats.size < appLogPos) appLogPos = 0 // 로그 파일이 새로 생성된 경우
      if (stats.size <= appLogPos) return

      const stream = fs.createReadStream(LOG_FILE, { start: appLogPos, end: stats.size })
      let buf = ''
      stream.on('data', (chunk) => { buf += chunk })
      stream.on('end', () => {
        appLogPos = stats.size
        buf
          .split('\n')
          .filter((line) => line.length > 0)
          .forEach((line) => {
            try {
              send('app-log', JSON.parse(line))
            } catch { /* 파싱 실패한 라인은 무시 */ }
          })
      })
    })
  }, 500)
}

function createWindow() {
  win = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 640,
    minHeight: 420,
    title: 'Piano Learning — 실행 제어',
    icon: ICON_PATH,
    backgroundColor: '#0f0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.setMenuBarVisibility(false)
  win.loadFile(path.join(__dirname, 'index.html'))

  // X 버튼 → 트레이로 최소화 (종료 아님)
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      win.hide()
      tray?.displayBalloon({
        title: 'Piano Learning — 실행 제어',
        content: '트레이에서 계속 실행 중입니다.',
        iconType: 'info',
        noSound: true,
      })
    }
  })
}

function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Piano Learning — 실행 제어')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '창 열기', click: () => { win?.show(); win?.focus() } },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ]))
  tray.on('double-click', () => {
    if (win?.isVisible()) win.hide()
    else { win?.show(); win?.focus() }
  })
}

app.whenReady().then(() => {
  createWindow()
  createTray()
  watchAppLog()
})

app.on('window-all-closed', () => {
  // 트레이로 계속 실행되므로 여기서 앱을 종료하지 않음
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (appLogTimer) clearInterval(appLogTimer)
  stopDev()
})

ipcMain.on('dev-start-electron', () => startDev('electron'))
ipcMain.on('dev-start-web', () => startDev('web'))
ipcMain.on('dev-stop', stopDev)
ipcMain.on('dev-restart', () => {
  const modeToResume = currentMode || 'electron'
  const wasRunning = !!devProcess
  stopDev()
  if (wasRunning) setTimeout(() => startDev(modeToResume), 1000)
  else startDev(modeToResume)
})
ipcMain.on('run-build', runBuild)
ipcMain.handle('get-status', () => ({ running: !!devProcess, mode: currentMode }))
