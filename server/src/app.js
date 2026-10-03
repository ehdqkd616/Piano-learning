const express = require('express')
const cors = require('cors')

const authRoutes = require('./routes/auth')
const songsRoutes = require('./routes/songs')
const sessionsRoutes = require('./routes/sessions')
const profileRoutes = require('./routes/profile')

// 서버 실행(index.js)과 분리해 두어 테스트에서 supertest로 바로 쓸 수 있게 한다
const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)
app.use('/api/songs', songsRoutes)
app.use('/api/sessions', sessionsRoutes)
app.use('/api/profile', profileRoutes)

// Express 5는 async 핸들러에서 던진 에러도 여기로 전달한다.
// 잘못된 JSON 본문처럼 status가 붙은 4xx 에러는 그대로 돌려준다.
app.use((err, _req, res, _next) => {
  const status = err.status ?? err.statusCode
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: '잘못된 요청입니다.' })
  }
  console.error(err)
  res.status(500).json({ error: '서버 오류가 발생했습니다.' })
})

module.exports = app
