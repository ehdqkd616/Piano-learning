// 테스트 시작 전 한 번: 테스트 DB의 테이블을 모두 지우고 마이그레이션·곡 시드를 새로 적용한다
const mysql = require('mysql2/promise')

module.exports = async function setup({ provide: _provide }) {
  const env = {
    host: process.env.TEST_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.TEST_DB_PORT ?? 3306),
    user: process.env.TEST_DB_USER ?? 'piano',
    password: process.env.TEST_DB_PASSWORD ?? 'pianopass',
    database: 'piano_learning_test',
  }
  Object.assign(process.env, {
    DB_HOST: env.host, DB_PORT: String(env.port), DB_USER: env.user, DB_PASSWORD: env.password, DB_NAME: env.database,
  })
  const conn = await mysql.createConnection(env)
  const [tables] = await conn.query('SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ?', [env.database])
  await conn.query('SET FOREIGN_KEY_CHECKS = 0')
  for (const { name } of tables) await conn.query(`DROP TABLE \`${name}\``)
  await conn.query('SET FOREIGN_KEY_CHECKS = 1')
  await conn.end()

  const { migrate } = require('../src/migrate')
  const { pool, syncSongs } = require('../src/db')
  await migrate()
  await syncSongs()
  await pool.end()
}
