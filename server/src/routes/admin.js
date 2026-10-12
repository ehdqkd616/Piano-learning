const express = require('express')
const bcrypt = require('bcryptjs')
const { pool } = require('../db')
const { requireAuth, requireAdmin } = require('../auth')
const { ADMIN_USERNAME, tempPassword, clientIp, audit } = require('../accounts')

const router = express.Router()
router.use(requireAuth, requireAdmin)

const USER_STATUSES = ['pending', 'approved', 'rejected', 'suspended']
const like = (q) => `%${String(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`
const limitOf = (v, d) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Math.min(Number(v), 500) : d)

function userOut(u) {
  return {
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    role: u.role,
    status: u.status,
    signupNote: u.signup_note,
    rejectReason: u.reject_reason,
    level: u.level,
    totalXP: u.total_xp,
    sessionCount: u.session_count ?? undefined,
    approvedAt: u.approved_at,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  }
}

async function getUser(id) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [String(id)])
  return rows[0]
}

class Conflict extends Error {}

async function changeStatus(req, user, next, reason = null) {
  if (user.id === req.user.id) throw new Conflict('자기 자신의 상태는 바꿀 수 없습니다.')
  if (user.role === 'admin' && next !== 'approved') throw new Conflict('관리자 계정은 거절·정지할 수 없습니다.')
  await pool.execute(
    `UPDATE users SET status = ?,
       approved_at = IF(? = 'approved', NOW(3), approved_at),
       reject_reason = CASE WHEN ? = 'rejected' THEN ? WHEN ? = 'approved' THEN NULL ELSE reject_reason END
     WHERE id = ?`,
    [next, next, next, reason, next, user.id],
  )
  const action = next === 'approved' ? (user.status === 'suspended' ? 'unsuspend' : 'approve') : next === 'rejected' ? 'reject' : 'suspend'
  await audit(`admin.user.${action}`, {
    actorId: req.user.id, targetId: user.id,
    detail: { from: user.status, to: next, ...(reason ? { reason } : {}) }, ip: clientIp(req),
  })
  return getUser(user.id)
}

// 상태 변경 라우트 공통: 대상 조회 → 허용 상태 확인 → 변경
function statusRoute(allowedFrom, next, message) {
  return async (req, res) => {
    const user = await getUser(req.params.id)
    if (!user) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' })
    if (!allowedFrom.includes(user.status)) return res.status(409).json({ error: message })
    const reason = next === 'rejected' && typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) || null : null
    try {
      res.json({ user: userOut(await changeStatus(req, user, next, reason)) })
    } catch (err) {
      if (err instanceof Conflict) return res.status(409).json({ error: err.message })
      throw err
    }
  }
}

router.get('/stats', async (_req, res) => {
  const [byStatusRows] = await pool.query('SELECT status, COUNT(*) AS n FROM users GROUP BY status')
  const byStatus = Object.fromEntries(byStatusRows.map((r) => [r.status, r.n]))
  const [[today]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE created_at >= UTC_DATE()) AS signups,
      (SELECT COUNT(*) FROM audit_log WHERE action = 'login.success' AND created_at >= UTC_DATE()) AS logins,
      (SELECT COUNT(*) FROM sessions WHERE started_at >= UTC_DATE()) AS sessions`)
  res.json({
    users: { total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus, pending: byStatus.pending ?? 0 },
    today,
  })
})

router.get('/users', async (req, res) => {
  const { status, q } = req.query
  const where = []
  const params = []
  if (USER_STATUSES.includes(status)) where.push('u.status = ?'), params.push(status)
  if (q) where.push("(u.username LIKE ? OR u.nickname LIKE ?)"), params.push(like(q), like(q))
  const [rows] = await pool.query(
    `SELECT u.*, (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS session_count FROM users u
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY (u.status = 'pending') DESC, u.created_at DESC LIMIT ?`,
    [...params, limitOf(req.query.limit, 200)],
  )
  res.json({ items: rows.map(userOut) })
})

router.get('/users/:id', async (req, res) => {
  const user = await getUser(req.params.id)
  if (!user) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' })
  const [logins] = await pool.query(
    `SELECT action, ip, created_at AS createdAt FROM audit_log
     WHERE target_id = ? AND action LIKE 'login.%' ORDER BY id DESC LIMIT 20`, [user.id])
  res.json({ user: userOut(user), logins })
})

router.post('/users/:id/approve', statusRoute(['pending', 'rejected'], 'approved', '대기 또는 거절 상태의 회원만 승인할 수 있습니다.'))
router.post('/users/:id/reject', statusRoute(['pending'], 'rejected', '승인 대기 중인 회원만 거절할 수 있습니다.'))
router.post('/users/:id/suspend', statusRoute(['approved'], 'suspended', '승인된 회원만 정지할 수 있습니다.'))
router.post('/users/:id/unsuspend', statusRoute(['suspended'], 'approved', '정지된 회원만 해제할 수 있습니다.'))

router.post('/users/bulk-approve', async (req, res) => {
  const ids = Array.isArray(req.body?.userIds) ? req.body.userIds.filter((v) => typeof v === 'string').slice(0, 200) : []
  if (!ids.length) return res.status(400).json({ error: '승인할 회원을 선택하세요.' })
  let approved = 0
  for (const id of ids) {
    const user = await getUser(id)
    if (user?.status === 'pending') {
      await changeStatus(req, user, 'approved')
      approved++
    }
  }
  res.json({ approved })
})

// 임시 비밀번호 발급 — 응답으로 한 번만 보여 준다. 기존 토큰은 모두 무효
router.post('/users/:id/temp-password', async (req, res) => {
  const user = await getUser(req.params.id)
  if (!user) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' })
  if (user.id === req.user.id) return res.status(409).json({ error: '본인 비밀번호는 설정에서 변경하세요.' })
  if (user.username === ADMIN_USERNAME) return res.status(409).json({ error: '관리자 비밀번호는 서버 .env의 ADMIN_PASSWORD로 관리합니다.' })
  const pw = tempPassword()
  await pool.execute('UPDATE users SET password_hash = ?, password_changed_at = NOW(3) WHERE id = ?', [await bcrypt.hash(pw, 10), user.id])
  await audit('admin.user.temp_password', { actorId: req.user.id, targetId: user.id, ip: clientIp(req) })
  res.json({ tempPassword: pw })
})

router.get('/audit', async (req, res) => {
  const action = typeof req.query.action === 'string' ? req.query.action.trim() : ''
  const [rows] = await pool.query(
    `SELECT a.id, a.action, a.target_id AS targetId, a.detail, a.ip, a.created_at AS createdAt,
            actor.username AS actorUsername, target.username AS targetUsername
     FROM audit_log a
     LEFT JOIN users actor ON actor.id = a.actor_id
     LEFT JOIN users target ON target.id = a.target_id
     ${action ? 'WHERE a.action LIKE ?' : ''} ORDER BY a.id DESC LIMIT ?`,
    [...(action ? [`${action.replace(/[\\%_]/g, (c) => `\\${c}`)}%`] : []), limitOf(req.query.limit, 200)],
  )
  res.json({ items: rows })
})

module.exports = router
