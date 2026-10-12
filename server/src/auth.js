const jwt = require('jsonwebtoken')
const { pool } = require('./db')

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET env var is required')
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' })
}

// 토큰이 유효해도 매 요청마다 계정 상태를 확인한다 — 정지·거절된 계정은 바로 막힌다.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: '인증이 필요합니다.' })
  }
  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    return res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' })
  }
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [payload.sub])
  const user = rows[0]
  // 비밀번호가 바뀌면(임시 비밀번호 발급·.env 관리자 비밀번호 변경) 그 전에 발급한 토큰은 무효
  if (!user || user.status !== 'approved' || (user.password_changed_at && payload.iat < Math.floor(user.password_changed_at.getTime() / 1000))) {
    return res.status(401).json({ error: '로그인이 필요합니다.' })
  }
  req.userId = user.id
  req.user = user
  next()
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '관리자만 접근할 수 있습니다.' })
  next()
}

module.exports = { signToken, requireAuth, requireAdmin }
