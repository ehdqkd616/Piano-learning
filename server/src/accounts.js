const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { pool } = require('./db')

// 아이디: 영문/숫자/_/- 3~32자 (모든 프로젝트 공통 규칙)
const USERNAME_RE = /^[A-Za-z0-9_-]{3,32}$/
// 모든 프로젝트 공통 관리자 아이디 — 비밀번호는 .env의 ADMIN_PASSWORD로 관리
const ADMIN_USERNAME = 'admin'

const DEFAULT_SETTINGS = {
  inputMode: 'midi',
  bpm: 100,
  viewMode: 'falling',
  handSplit: 'both',
  micSensitivity: 0.5,
  timingTolerance: 100,
}

function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
  // bcrypt는 72바이트 이후를 무시하므로 그보다 긴 비밀번호는 받지 않는다
  if (Buffer.byteLength(pw) > 72) return '비밀번호가 너무 깁니다.'
  return null
}

function tempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('')
}

const clientIp = (req) => String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim() || null

async function audit(action, { actorId = null, targetId = null, detail = null, ip = null } = {}) {
  await pool.execute(
    'INSERT INTO audit_log (actor_id, action, target_id, detail, ip) VALUES (?, ?, ?, ?, ?)',
    [actorId, action, targetId, detail ? JSON.stringify(detail) : null, ip],
  )
}

/**
 * 기동할 때마다 .env의 ADMIN_PASSWORD로 공통 관리자 계정 admin을 맞춘다.
 * 없으면 만들고, 있으면 관리자·승인 상태와 비밀번호를 .env 값으로 되돌린다 — 비밀번호는 .env가 기준.
 */
async function ensureAdmin(password = process.env.ADMIN_PASSWORD) {
  if (!password) return null
  const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [ADMIN_USERNAME])
  const existing = rows[0]
  if (!existing) {
    await pool.execute(
      `INSERT INTO users (id, username, password_hash, nickname, role, status, approved_at, settings)
       VALUES (?, ?, ?, '관리자', 'admin', 'approved', NOW(3), ?)`,
      [crypto.randomUUID(), ADMIN_USERNAME, await bcrypt.hash(password, 10), JSON.stringify(DEFAULT_SETTINGS)],
    )
    return 'created'
  }
  const samePassword = await bcrypt.compare(password, existing.password_hash)
  if (samePassword && existing.role === 'admin' && existing.status === 'approved') return null
  await pool.execute(
    `UPDATE users SET role = 'admin', status = 'approved', approved_at = COALESCE(approved_at, NOW(3)),
       password_hash = ?, password_changed_at = IF(?, password_changed_at, NOW(3)) WHERE id = ?`,
    [samePassword ? existing.password_hash : await bcrypt.hash(password, 10), samePassword, existing.id],
  )
  return 'synced'
}

module.exports = { USERNAME_RE, ADMIN_USERNAME, DEFAULT_SETTINGS, passwordProblem, tempPassword, clientIp, audit, ensureAdmin }
