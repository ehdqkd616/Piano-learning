const express = require('express')
const { db } = require('../db')
const { requireAuth } = require('../auth')
const { serializeSession, serializeUser } = require('../serializers')

const router = express.Router()
router.use(requireAuth)

router.post('/', (req, res) => {
  const s = req.body ?? {}
  const required = ['sessionId', 'songId', 'startedAt', 'endedAt', 'mode', 'totalScore']
  for (const field of required) {
    if (s[field] === undefined || s[field] === null) {
      return res.status(400).json({ error: `${field}는 필수입니다.` })
    }
  }

  db.prepare(`
    INSERT INTO sessions (session_id, user_id, song_id, started_at, ended_at, mode, total_score, pitch_accuracy, timing_accuracy, completion_rate, note_results)
    VALUES (@sessionId, @userId, @songId, @startedAt, @endedAt, @mode, @totalScore, @pitchAccuracy, @timingAccuracy, @completionRate, @noteResults)
  `).run({
    sessionId: s.sessionId,
    userId: req.userId,
    songId: s.songId,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    mode: s.mode,
    totalScore: s.totalScore,
    pitchAccuracy: s.pitchAccuracy ?? 0,
    timingAccuracy: s.timingAccuracy ?? 0,
    completionRate: s.completionRate ?? 0,
    noteResults: JSON.stringify(s.noteResults ?? []),
  })

  // XP 부여: totalScore 기준 (100점 → 50 XP), 연속 연습일 갱신
  const xpGained = Math.floor(s.totalScore / 2)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)
  const today = new Date().toISOString().split('T')[0]
  const newStreak = user.last_practice_date === today ? user.streak : user.streak + 1
  const newTotalXp = user.total_xp + xpGained
  const newLevel = Math.floor(newTotalXp / 500) + 1

  db.prepare(`
    UPDATE users SET total_xp = ?, last_practice_date = ?, streak = ?, level = ? WHERE id = ?
  `).run(newTotalXp, today, newStreak, newLevel, req.userId)

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)
  const savedSession = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(s.sessionId)
  res.status(201).json({ session: serializeSession(savedSession), user: serializeUser(updatedUser) })
})

router.get('/:sessionId', (req, res) => {
  const row = db.prepare('SELECT * FROM sessions WHERE session_id = ? AND user_id = ?').get(req.params.sessionId, req.userId)
  if (!row) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' })
  res.json({ session: serializeSession(row) })
})

module.exports = router
