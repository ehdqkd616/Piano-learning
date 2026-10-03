const crypto = require('crypto')
const request = require('supertest')
const app = require('../src/app')
const { pool } = require('../src/db')

// 매번 새 이메일로 가입해 테스트끼리 데이터가 섞이지 않게 한다
async function signup(overrides = {}) {
  const email = `t-${crypto.randomUUID()}@example.com`
  const res = await request(app).post('/api/auth/signup')
    .send({ email, password: 'password123', nickname: '테스터', ...overrides })
  return { email, token: res.body.token, user: res.body.user, res }
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

module.exports = { app, pool, request, signup, sessionBody, auth }
