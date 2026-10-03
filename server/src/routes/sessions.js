const express = require('express')
const { pool, withTransaction } = require('../db')
const { requireAuth } = require('../auth')
const { serializeSession, serializeUser } = require('../serializers')
const { isPlausibleLocalDate, nextStreak } = require('../streak')

const router = express.Router()
router.use(requireAuth)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MODES = ['wait', 'play']
const VERDICTS = ['perfect', 'good', 'late', 'early', 'miss', 'skip']
const MAX_NOTE_RESULTS = 5000

const isPercent = (v) => typeof v === 'number' && v >= 0 && v <= 100
// 곡 안의 시각(ms). 24시간 이내로 제한해 INT 컬럼 범위를 넘지 않게 한다
const MAX_TIME_MS = 24 * 60 * 60 * 1000
const isTimeMs = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_TIME_MS

// 요청 본문을 검사해 문제가 있으면 에러 메시지를, 없으면 null을 돌려준다
function validateSession(s) {
  const required = ['sessionId', 'songId', 'startedAt', 'endedAt', 'mode', 'totalScore']
  for (const field of required) {
    if (s[field] === undefined || s[field] === null) return `${field}는 필수입니다.`
  }
  if (typeof s.sessionId !== 'string' || !UUID_RE.test(s.sessionId)) return 'sessionId는 UUID여야 합니다.'
  if (typeof s.songId !== 'string') return 'songId가 올바르지 않습니다.'
  const startedAt = new Date(s.startedAt)
  const endedAt = new Date(s.endedAt)
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) return '시작·종료 시각이 올바르지 않습니다.'
  if (endedAt < startedAt) return '종료 시각이 시작 시각보다 빠릅니다.'
  if (!MODES.includes(s.mode)) return 'mode는 wait 또는 play여야 합니다.'
  if (!Number.isInteger(s.totalScore) || !isPercent(s.totalScore)) return 'totalScore는 0~100 정수여야 합니다.'
  for (const field of ['pitchAccuracy', 'timingAccuracy', 'completionRate']) {
    if (s[field] !== undefined && !isPercent(s[field])) return `${field}는 0~100 사이여야 합니다.`
  }
  if (s.localDate !== undefined && !isPlausibleLocalDate(s.localDate)) return 'localDate가 올바르지 않습니다.'
  if (s.noteResults !== undefined) {
    if (!Array.isArray(s.noteResults) || s.noteResults.length > MAX_NOTE_RESULTS) return 'noteResults가 올바르지 않습니다.'
    const bad = s.noteResults.some((r) => !r
      || !Number.isInteger(r.noteIndex) || r.noteIndex < 0 || r.noteIndex > 65535
      || !Number.isInteger(r.noteNumber) || r.noteNumber < 0 || r.noteNumber > 127
      || !isTimeMs(r.expectedTimeMs) || !isTimeMs(r.actualTimeMs) || !isTimeMs(r.timingDeltaMs)
      || !VERDICTS.includes(r.verdict))
    if (bad) return 'noteResults 항목이 올바르지 않습니다.'
  }
  return null
}

router.post('/', async (req, res) => {
  const s = req.body ?? {}
  const error = validateSession(s)
  if (error) return res.status(400).json({ error })
  const noteResults = s.noteResults ?? []
  // 스트릭은 사용자 현지 날짜 기준. 예전 앱처럼 localDate를 안 보내면 UTC 날짜로 대신한다.
  const today = s.localDate ?? new Date().toISOString().slice(0, 10)

  // songs FK 위반을 500으로 내보내지 않도록 미리 확인한다
  const [songs] = await pool.execute('SELECT 1 FROM songs WHERE song_id = ?', [s.songId])
  if (songs.length === 0) {
    return res.status(400).json({ error: '존재하지 않는 곡입니다.' })
  }

  // 세션 행과 음표별 결과 행, XP·스트릭 갱신이 함께 반영되어야 하므로 한 트랜잭션으로 묶는다.
  try {
    await withTransaction(async (conn) => {
      // 사용자 행을 가장 먼저 잠근다. 같은 사용자의 저장 요청은 여기서 줄을 서서 하나씩 처리된다.
      // (sessions INSERT가 FK 검사로 users 행에 공유 잠금을 먼저 건 뒤 FOR UPDATE를 요청하면,
      //  동시 요청끼리 서로의 공유 잠금을 기다리는 데드락이 났다)
      const [users] = await conn.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [req.userId])
      const user = users[0]

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
      const newStreak = nextStreak(user.streak, user.last_practice_date, today)
      // 시간대를 옮겨 다니며 날짜가 뒤로 가는 경우에도 마지막 연습일은 되돌리지 않는다
      const lastPracticeDate = user.last_practice_date && user.last_practice_date > today ? user.last_practice_date : today
      const newTotalXp = user.total_xp + xpGained
      const newLevel = Math.floor(newTotalXp / 500) + 1

      await conn.execute(`
        UPDATE users SET total_xp = ?, last_practice_date = ?, streak = ?, level = ? WHERE id = ?
      `, [newTotalXp, lastPracticeDate, newStreak, newLevel, req.userId])
    })
  } catch (err) {
    if (err.code !== 'ER_DUP_ENTRY') throw err
    // 같은 sessionId가 이미 있다 = 앱이 응답을 못 받고 재전송한 경우.
    // 다시 저장하지 않고(XP 중복 지급 없음) 저장된 결과를 그대로 돌려준다.
    const existing = await findSession(s.sessionId, req.userId)
    if (!existing) return res.status(409).json({ error: '이미 사용된 sessionId입니다.' })
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.userId])
    return res.status(200).json({ session: existing, user: serializeUser(rows[0]) })
  }

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
