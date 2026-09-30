const express = require('express')
const { pool } = require('../db')
const { requireAuth } = require('../auth')
const { serializeUser } = require('../serializers')

const router = express.Router()
router.use(requireAuth)

router.patch('/', async (req, res) => {
  const { nickname, settings } = req.body ?? {}
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.userId])
  const current = rows[0]
  if (!current) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })

  // JSON 컬럼은 mysql2가 객체로 파싱해서 돌려준다
  const nextNickname = typeof nickname === 'string' && nickname.trim() ? nickname.trim() : current.nickname
  const nextSettings = settings ? { ...current.settings, ...settings } : current.settings

  await pool.execute('UPDATE users SET nickname = ?, settings = ? WHERE id = ?',
    [nextNickname, JSON.stringify(nextSettings), req.userId])

  const [updated] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.userId])
  res.json({ user: serializeUser(updated[0]) })
})

module.exports = router
