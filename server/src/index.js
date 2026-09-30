require('dotenv').config()
const express = require('express')
const cors = require('cors')

const { migrate } = require('./migrate')
const { syncSongs } = require('./db')
const authRoutes = require('./routes/auth')
const songsRoutes = require('./routes/songs')
const sessionsRoutes = require('./routes/sessions')
const profileRoutes = require('./routes/profile')

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)
app.use('/api/songs', songsRoutes)
app.use('/api/sessions', sessionsRoutes)
app.use('/api/profile', profileRoutes)

// Express 5는 async 핸들러에서 던진 에러도 여기로 전달한다.
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: '서버 오류가 발생했습니다.' })
})

async function start() {
  await migrate()
  await syncSongs()
  const PORT = process.env.PORT || 4001
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`piano-learning API listening on 127.0.0.1:${PORT}`)
  })
}

start().catch((err) => {
  console.error('서버 시작 실패:', err)
  process.exit(1)
})
