const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { pool } = require('../db')
const { signToken, requireAuth } = require('../auth')
const { serializeUser } = require('../serializers')
const { USERNAME_RE, ADMIN_USERNAME, DEFAULT_SETTINGS, passwordProblem, clientIp, audit } = require('../accounts')
const { sendSignupNotification } = require('../mailer')

const router = express.Router()

const MAX_NICKNAME = 50   // users.nickname VARCHAR(50)
const MAX_NOTE = 1000

const STATUS_ERRORS = {
  pending: '관리자 승인 대기 중입니다. 승인 후 이용할 수 있습니다.',
  rejected: '가입이 거절되었습니다.',
  suspended: '이용이 정지된 계정입니다. 관리자에게 문의하세요.',
}

// 가입만 해 두고 토큰은 주지 않는다 — 관리자 승인 전에는 로그인할 수 없다.
router.post('/signup', async (req, res) => {
  const { username, password, nickname, signupNote, agreeTerms, agreePrivacy } = req.body ?? {}
  if (typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: '아이디를 입력하세요.' })
  }
  const normalizedUsername = username.trim().toLowerCase()
  if (!USERNAME_RE.test(normalizedUsername)) {
    return res.status(400).json({ error: '아이디는 영문, 숫자, _, - 조합 3~32자여야 합니다.' })
  }
  const pwProblem = passwordProblem(password)
  if (pwProblem) return res.status(400).json({ error: pwProblem })
  const finalNickname = (typeof nickname === 'string' && nickname.trim()) || '피아니스트'
  if (finalNickname.length > MAX_NICKNAME) {
    return res.status(400).json({ error: `닉네임은 ${MAX_NICKNAME}자 이하여야 합니다.` })
  }
  const note = typeof signupNote === 'string' ? signupNote.trim().slice(0, MAX_NOTE) || null : null
  if (agreeTerms !== true || agreePrivacy !== true) {
    return res.status(400).json({ error: '이용약관과 개인정보 처리방침에 동의해 주세요.' })
  }

  const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [normalizedUsername])
  if (existing.length > 0) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' })
  }

  const id = crypto.randomUUID()
  const passwordHash = await bcrypt.hash(password, 10)
  try {
    await pool.execute(`
      INSERT INTO users (id, username, password_hash, nickname, status, signup_note, settings)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `, [id, normalizedUsername, passwordHash, finalNickname, note, JSON.stringify(DEFAULT_SETTINGS)])
  } catch (err) {
    // 위 중복 확인과 INSERT 사이에 같은 아이디 가입이 끼어든 경우 (UNIQUE 제약이 막아 준다)
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' })
    throw err
  }
  await audit('user.signup', { actorId: id, targetId: id, ip: clientIp(req) })
  res.status(201).json({ status: 'pending', message: '가입 신청이 완료되었습니다. 관리자 승인 후 이용할 수 있습니다.' })
  // 알림 메일은 응답과 분리해서 보낸다 — SMTP가 느리거나 실패해도 가입은 그대로 성공.
  void sendSignupNotification({ username: normalizedUsername, nickname: finalNickname, note, createdAt: Date.now() })
    .catch((err) => console.error(err))
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {}
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: '아이디와 비밀번호가 필요합니다.' })
  }
  const ip = clientIp(req)
  // 아이디 형식은 검사하지 않는다 — 예전 계정은 이메일이 아이디다
  const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username.trim().toLowerCase()])
  const row = rows[0]
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    await audit('login.failure', { actorId: row?.id ?? null, targetId: row?.id ?? null, detail: { username: username.slice(0, 64) }, ip })
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' })
  }
  // 비밀번호가 맞을 때만 계정 상태를 알려준다
  if (row.status !== 'approved') {
    await audit('login.blocked', { actorId: row.id, targetId: row.id, detail: { status: row.status }, ip })
    return res.status(403).json({
      error: STATUS_ERRORS[row.status] ?? '로그인할 수 없는 계정입니다.',
      code: `ACCOUNT_${row.status.toUpperCase()}`,
      ...(row.status === 'rejected' && row.reject_reason ? { reason: row.reject_reason } : {}),
    })
  }
  await pool.execute('UPDATE users SET last_login_at = NOW(3) WHERE id = ?', [row.id])
  await audit('login.success', { actorId: row.id, targetId: row.id, ip })
  res.json({ token: signToken(row.id), user: serializeUser(row) })
})

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: serializeUser(req.user) })
})

router.patch('/password', requireAuth, async (req, res) => {
  if (req.user.username === ADMIN_USERNAME) {
    return res.status(409).json({ error: '관리자 비밀번호는 서버 .env의 ADMIN_PASSWORD로 관리합니다.' })
  }
  const { currentPassword, newPassword } = req.body ?? {}
  if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, req.user.password_hash))) {
    return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' })
  }
  const problem = passwordProblem(newPassword)
  if (problem) return res.status(400).json({ error: problem })
  await pool.execute('UPDATE users SET password_hash = ?, password_changed_at = NOW(3) WHERE id = ?',
    [await bcrypt.hash(newPassword, 10), req.user.id])
  await audit('user.password_change', { actorId: req.user.id, targetId: req.user.id, ip: clientIp(req) })
  // 다른 기기의 토큰은 무효가 되므로 지금 기기에는 새 토큰을 준다
  res.json({ token: signToken(req.user.id) })
})

module.exports = router
