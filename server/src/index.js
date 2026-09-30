require('dotenv').config()
const express = require('express')
const cors = require('cors')

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

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: '서버 오류가 발생했습니다.' })
})

const PORT = process.env.PORT || 4001
app.listen(PORT, '127.0.0.1', () => {
  console.log(`piano-learning API listening on 127.0.0.1:${PORT}`)
})
