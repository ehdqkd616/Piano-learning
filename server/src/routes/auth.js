const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { pool } = require('../db')
const { signToken, requireAuth } = require('../auth')
const { serializeUser } = require('../serializers')

const router = express.Router()

const DEFAULT_SETTINGS = {
  inputMode: 'midi',
  bpm: 100,
  viewMode: 'falling',
  handSplit: 'both',
  micSensitivity: 0.5,
  timingTolerance: 100,
}

async function findUserById(id) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id])
  return rows[0]
}

router.post('/signup', async (req, res) => {
  const { email, password, nickname } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || password.length < 8) {
    return res.status(400).json({ error: '이메일과 8자 이상의 비밀번호가 필요합니다.' })
  }
  const normalizedEmail = email.trim().toLowerCase()

  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [normalizedEmail])
  if (existing.length > 0) {
    return res.status(409).json({ error: '이미 가입된 이메일입니다.' })
  }

  const id = crypto.randomUUID()
  const passwordHash = await bcrypt.hash(password, 10)
  await pool.execute(`
    INSERT INTO users (id, email, password_hash, nickname, settings)
    VALUES (?, ?, ?, ?, ?)
  `, [id, normalizedEmail, passwordHash, (nickname || '피아니스트').trim() || '피아니스트', JSON.stringify(DEFAULT_SETTINGS)])

  const row = await findUserById(id)
  res.status(201).json({ token: signToken(id), user: serializeUser(row) })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: '이메일과 비밀번호가 필요합니다.' })
  }
  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()])
  const row = rows[0]
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' })
  }
  res.json({ token: signToken(row.id), user: serializeUser(row) })
})

router.get('/me', requireAuth, async (req, res) => {
  const row = await findUserById(req.userId)
  if (!row) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
  res.json({ user: serializeUser(row) })
})

module.exports = router
