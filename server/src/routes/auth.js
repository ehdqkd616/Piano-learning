const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { pool } = require('../db')
const { signToken, requireAuth } = require('../auth')
const { serializeUser } = require('../serializers')

const router = express.Router()

// 아이디: 영문/숫자/_/- 3~32자 (모든 프로젝트 공통 규칙)
const USERNAME_RE = /^[A-Za-z0-9_-]{3,32}$/
const MAX_NICKNAME = 50   // users.nickname VARCHAR(50)

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
  const { username, password, nickname } = req.body ?? {}
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || password.length < 8) {
    return res.status(400).json({ error: '아이디와 8자 이상의 비밀번호가 필요합니다.' })
  }
  const normalizedUsername = username.trim().toLowerCase()
  if (!USERNAME_RE.test(normalizedUsername)) {
    return res.status(400).json({ error: '아이디는 영문, 숫자, _, - 조합 3~32자여야 합니다.' })
  }
  // bcrypt는 72바이트 이후를 무시하므로 그보다 긴 비밀번호는 받지 않는다
  if (Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: '비밀번호가 너무 깁니다.' })
  }
  const finalNickname = (typeof nickname === 'string' && nickname.trim()) || '피아니스트'
  if (finalNickname.length > MAX_NICKNAME) {
    return res.status(400).json({ error: `닉네임은 ${MAX_NICKNAME}자 이하여야 합니다.` })
  }

  const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [normalizedUsername])
  if (existing.length > 0) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' })
  }

  const id = crypto.randomUUID()
  const passwordHash = await bcrypt.hash(password, 10)
  try {
    await pool.execute(`
      INSERT INTO users (id, username, password_hash, nickname, settings)
      VALUES (?, ?, ?, ?, ?)
    `, [id, normalizedUsername, passwordHash, finalNickname, JSON.stringify(DEFAULT_SETTINGS)])
  } catch (err) {
    // 위 중복 확인과 INSERT 사이에 같은 아이디 가입이 끼어든 경우 (UNIQUE 제약이 막아 준다)
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' })
    throw err
  }

  const row = await findUserById(id)
  res.status(201).json({ token: signToken(id), user: serializeUser(row) })
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {}
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: '아이디와 비밀번호가 필요합니다.' })
  }
  // 아이디 형식은 검사하지 않는다 — 예전 계정은 이메일이 아이디다
  const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username.trim().toLowerCase()])
  const row = rows[0]
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' })
  }
  res.json({ token: signToken(row.id), user: serializeUser(row) })
})

router.get('/me', requireAuth, async (req, res) => {
  const row = await findUserById(req.userId)
  if (!row) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
  res.json({ user: serializeUser(row) })
})

module.exports = router
