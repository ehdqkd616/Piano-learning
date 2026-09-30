const mysql = require('mysql2/promise')
const { SEED_SONGS } = require('./seedSongs')

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'piano',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'piano_learning',
  connectionLimit: 10,
  timezone: 'Z',              // DATETIME은 UTC로 저장·조회
  dateStrings: ['DATE'],      // DATE 컬럼은 'YYYY-MM-DD' 문자열로 받는다 (시간대 변환 방지)
  decimalNumbers: true,       // DECIMAL을 문자열이 아닌 숫자로 받는다
})

// fn(conn) 안의 쿼리를 한 트랜잭션으로 실행한다. 예외가 나면 롤백.
async function withTransaction(fn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// 곡 카탈로그는 서버가 소유하는 정적 데이터이므로, 부팅 시마다 seedSongs.js 내용으로 갱신한다.
// 카탈로그에서 빠진 곡은 연습 기록이 참조하고 있을 수 있어 지우지 않고 is_active = 0으로 숨긴다.
async function syncSongs(songs = SEED_SONGS) {
  await withTransaction(async (conn) => {
    for (const song of songs) {
      const totalBeats = song.notes.reduce((sum, n) => sum + n.beats, 0)
      const beatMs = (60 / song.bpm) * 1000
      await conn.execute(`
        INSERT INTO songs (song_id, title, artist, genre, difficulty, duration_ms, bpm, key_signature, time_signature, tags, notes, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) AS new
        ON DUPLICATE KEY UPDATE
          title = new.title, artist = new.artist, genre = new.genre,
          difficulty = new.difficulty, duration_ms = new.duration_ms, bpm = new.bpm,
          key_signature = new.key_signature, time_signature = new.time_signature,
          tags = new.tags, notes = new.notes, is_active = 1
      `, [
        song.songId, song.title, song.artist, song.genre, song.difficulty,
        Math.round(totalBeats * beatMs), song.bpm, song.keySignature, song.timeSignature,
        JSON.stringify(song.tags), JSON.stringify(song.notes),
      ])
    }
    const keepIds = songs.map((s) => s.songId)
    await conn.query('UPDATE songs SET is_active = 0 WHERE song_id NOT IN (?)', [keepIds])
  })
}

module.exports = { pool, withTransaction, syncSongs }
