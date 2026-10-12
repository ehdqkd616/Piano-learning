const crypto = require('crypto')
const request = require('supertest')
const app = require('../src/app')
const { pool } = require('../src/db')

// 매번 새 아이디로 가입해 테스트끼리 데이터가 섞이지 않게 한다
const newUsername = () => `t_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`

const signupBody = (username, overrides = {}) =>
  ({ username, password: 'password123', nickname: '테스터', agreeTerms: true, agreePrivacy: true, ...overrides })

// 가입 → 승인(관리자 대신 DB에서 바로) → 로그인까지 마친 회원. 가입 응답은 res로 돌려준다
async function signup(overrides = {}) {
  const username = newUsername()
  const res = await request(app).post('/api/auth/signup').send(signupBody(username, overrides))
  if (res.status !== 201) return { username, res }
  await pool.execute("UPDATE users SET status = 'approved' WHERE username = ?", [username])
  const login = await request(app).post('/api/auth/login').send({ username, password: overrides.password ?? 'password123' })
  return { username, token: login.body.token, user: login.body.user, res }
}

function sessionBody(overrides = {}) {
  return {
    sessionId: crypto.randomUUID(),
    songId: 'song-1',
    startedAt: '2026-10-01T10:00:00.000Z',
    endedAt: '2026-10-01T10:01:00.000Z',
    mode: 'play',
    totalScore: 80,
    pitchAccuracy: 90,
    timingAccuracy: 70,
    completionRate: 100,
    noteResults: [
      { noteIndex: 0, noteNumber: 60, expectedTimeMs: 0, actualTimeMs: 10.4, timingDeltaMs: 10.4, verdict: 'perfect' },
      { noteIndex: 1, noteNumber: 61, expectedTimeMs: 666, actualTimeMs: 700, timingDeltaMs: 34, verdict: 'miss' },
      { noteIndex: 1, noteNumber: 62, expectedTimeMs: 666, actualTimeMs: 760, timingDeltaMs: 94, verdict: 'good' },
    ],
    ...overrides,
  }
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

module.exports = { app, pool, request, signup, signupBody, newUsername, sessionBody, auth }
