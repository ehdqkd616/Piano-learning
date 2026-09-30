const express = require('express')
const { pool, withTransaction } = require('../db')
const { requireAuth } = require('../auth')
const { serializeSession, serializeUser } = require('../serializers')

const router = express.Router()
router.use(requireAuth)

router.post('/', async (req, res) => {
  const s = req.body ?? {}
  const required = ['sessionId', 'songId', 'startedAt', 'endedAt', 'mode', 'totalScore']
  for (const field of required) {
    if (s[field] === undefined || s[field] === null) {
      return res.status(400).json({ error: `${field}는 필수입니다.` })
    }
  }
  const noteResults = Array.isArray(s.noteResults) ? s.noteResults : []

  // songs FK 위반을 500으로 내보내지 않도록 미리 확인한다
  const [songs] = await pool.execute('SELECT 1 FROM songs WHERE song_id = ?', [s.songId])
  if (songs.length === 0) {
    return res.status(400).json({ error: '존재하지 않는 곡입니다.' })
  }

  // 세션 행과 음표별 결과 행이 함께 저장되어야 하므로 한 트랜잭션으로 묶는다.
  await withTransaction(async (conn) => {
    await conn.execute(`
      INSERT INTO sessions (session_id, user_id, song_id, started_at, ended_at, mode, total_score, pitch_accuracy, timing_accuracy, completion_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      s.sessionId, req.userId, s.songId, new Date(s.startedAt), new Date(s.endedAt), s.mode, s.totalScore,
      s.pitchAccuracy ?? 0, s.timingAccuracy ?? 0, s.completionRate ?? 0,
    ])

    if (noteResults.length > 0) {
      // VALUES ? 에 2차원 배열을 넘기면 mysql2가 여러 행 INSERT 한 문장으로 만든다
      await conn.query(`
        INSERT INTO session_note_results
          (session_id, seq, note_index, note_number, expected_time_ms, actual_time_ms, timing_delta_ms, verdict)
        VALUES ?
      `, [noteResults.map((r, seq) => [
        s.sessionId, seq, r.noteIndex, r.noteNumber,
        Math.round(r.expectedTimeMs), Math.round(r.actualTimeMs), Math.round(r.timingDeltaMs), r.verdict,
      ])])
    }

    // XP 부여: totalScore 기준 (100점 → 50 XP), 연속 연습일 갱신
    const xpGained = Math.floor(s.totalScore / 2)
    const [users] = await conn.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [req.userId])
    const user = users[0]
    const today = new Date().toISOString().split('T')[0]
    const newStreak = user.last_practice_date === today ? user.streak : user.streak + 1
    const newTotalXp = user.total_xp + xpGained
    const newLevel = Math.floor(newTotalXp / 500) + 1

    await conn.execute(`
      UPDATE users SET total_xp = ?, last_practice_date = ?, streak = ?, level = ? WHERE id = ?
    `, [newTotalXp, today, newStreak, newLevel, req.userId])
  })

  const [updatedUser] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.userId])
  const savedSession = await findSession(s.sessionId, req.userId)
  res.status(201).json({ session: savedSession, user: serializeUser(updatedUser[0]) })
})

async function findSession(sessionId, userId) {
  const [rows] = await pool.execute('SELECT * FROM sessions WHERE session_id = ? AND user_id = ?', [sessionId, userId])
  if (rows.length === 0) return null
  const [noteRows] = await pool.execute('SELECT * FROM session_note_results WHERE session_id = ? ORDER BY seq', [sessionId])
  return serializeSession(rows[0], noteRows)
}

router.get('/:sessionId', async (req, res) => {
  const session = await findSession(req.params.sessionId, req.userId)
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' })
  res.json({ session })
})

module.exports = router
