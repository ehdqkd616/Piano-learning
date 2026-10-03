require('dotenv').config()
const app = require('./app')
const { migrate } = require('./migrate')
const { syncSongs } = require('./db')

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
