// migrations/*.sql 중 아직 적용하지 않은 파일을 이름 순서대로 실행한다.
// 적용 기록은 schema_migrations 테이블에 남긴다. 서버 부팅 시 자동 실행되며, `npm run migrate`로 따로 실행할 수도 있다.
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations')

async function migrate() {
  // 마이그레이션 파일은 여러 문장으로 되어 있어 multipleStatements 연결을 따로 연다 (API용 풀에서는 끈다).
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'piano',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'piano_learning',
    multipleStatements: true,
  })
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    VARCHAR(100) NOT NULL PRIMARY KEY,
        applied_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB
    `)
    const [rows] = await conn.query('SELECT version FROM schema_migrations')
    const applied = new Set(rows.map((r) => r.version))

    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
    for (const file of files) {
      if (applied.has(file)) continue
      // MySQL은 DDL(CREATE TABLE 등)을 트랜잭션으로 되돌릴 수 없으므로, 파일 하나를 작게 유지한다.
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      await conn.query(sql)
      await conn.query('INSERT INTO schema_migrations (version) VALUES (?)', [file])
      console.log(`migration applied: ${file}`)
    }
  } finally {
    await conn.end()
  }
}

module.exports = { migrate }

if (require.main === module) {
  require('dotenv').config()
  migrate().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
