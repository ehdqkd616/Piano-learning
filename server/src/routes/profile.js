const express = require('express')
const { db } = require('../db')
const { requireAuth } = require('../auth')
const { serializeUser } = require('../serializers')

const router = express.Router()
router.use(requireAuth)

router.patch('/', (req, res) => {
  const { nickname, settings } = req.body ?? {}
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)
  if (!current) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })

  const nextNickname = typeof nickname === 'string' && nickname.trim() ? nickname.trim() : current.nickname
  const nextSettings = settings ? { ...JSON.parse(current.settings), ...settings } : JSON.parse(current.settings)

  db.prepare('UPDATE users SET nickname = ?, settings = ? WHERE id = ?')
    .run(nextNickname, JSON.stringify(nextSettings), req.userId)

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)
  res.json({ user: serializeUser(row) })
})

module.exports = router
