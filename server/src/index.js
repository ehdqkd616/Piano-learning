require('dotenv').config()
const app = require('./app')
const { migrate } = require('./migrate')
const { syncSongs } = require('./db')
const { ensureAdmin, ADMIN_USERNAME } = require('./accounts')

async function start() {
  await migrate()
  await syncSongs()
  const admin = await ensureAdmin()
  if (admin) console.log(`관리자 계정 ${admin === 'created' ? '생성' : '동기화'}: ${ADMIN_USERNAME}`)
  const PORT = process.env.PORT || 4001
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`piano-learning API listening on 127.0.0.1:${PORT}`)
  })
}

start().catch((err) => {
  console.error('서버 시작 실패:', err)
  process.exit(1)
})
