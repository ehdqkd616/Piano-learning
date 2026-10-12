import { describe, it, expect, afterAll } from 'vitest'
import { app, pool, request, signup, signupBody, newUsername, auth } from './helpers'
import { ensureAdmin } from '../src/accounts'

afterAll(() => pool.end())

describe('POST /api/auth/signup', () => {
  it('가입하면 승인 대기 상태가 되고 토큰은 주지 않는다 — 승인 후 로그인하면 기본 설정이 담긴 사용자', async () => {
    const { res, username, user } = await signup({ signupNote: '연습용' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ status: 'pending' })
    expect(res.body.token).toBeUndefined()
    expect(user).toMatchObject({ username, nickname: '테스터', role: 'user', level: 1, totalXP: 0, streak: 0, lastPracticeDate: '' })
    expect(user.settings.inputMode).toBe('midi')
    expect(user).not.toHaveProperty('passwordHash')
    const [[row]] = await pool.query('SELECT signup_note FROM users WHERE username = ?', [username])
    expect(row.signup_note).toBe('연습용')
  })

  it('승인 전에는 로그인할 수 없다', async () => {
    const username = newUsername()
    await request(app).post('/api/auth/signup').send(signupBody(username))
    const res = await request(app).post('/api/auth/login').send({ username, password: 'password123' })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('ACCOUNT_PENDING')
  })

  it('약관에 동의하지 않으면 400', async () => {
    const res = await request(app).post('/api/auth/signup').send(signupBody(newUsername(), { agreePrivacy: false }))
    expect(res.status).toBe(400)
  })

  it('아이디는 소문자로 정규화되고, 대소문자만 다른 중복 가입은 409', async () => {
    const { username } = await signup()
    const res = await request(app).post('/api/auth/signup').send(signupBody(username.toUpperCase()))
    expect(res.status).toBe(409)
  })

  it('같은 아이디로 동시에 가입해도 하나만 성공하고 나머지는 409 (500 아님)', async () => {
    const username = newUsername()
    const results = await Promise.all([1, 2, 3].map(() =>
      request(app).post('/api/auth/signup').send(signupBody(username))))
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual([201, 409, 409])
  })

  it.each([
    [{ username: 'abc', password: 'short' }, '8자 미만 비밀번호'],
    [{ username: 'ab', password: 'password123' }, '3자 미만 아이디'],
    [{ username: 'a@b.com', password: 'password123' }, '허용하지 않는 문자 (이메일)'],
    [{ username: 'x'.repeat(33), password: 'password123' }, '32자 초과 아이디'],
    [{ username: 'abc', password: 'x'.repeat(73) }, '72바이트 초과 비밀번호'],
    [{ username: 'abc', password: 'password123', nickname: '가'.repeat(51) }, '51자 닉네임'],
  ])('잘못된 입력은 400: %#', async (body) => {
    const res = await request(app).post('/api/auth/signup').send({ agreeTerms: true, agreePrivacy: true, ...body })
    expect(res.status).toBe(400)
  })

  it('JSON 문법 오류는 500이 아니라 400', async () => {
    const res = await request(app).post('/api/auth/signup').set('Content-Type', 'application/json').send('{bad json')
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login, GET /api/auth/me', () => {
  it('맞는 비밀번호로 로그인하고 토큰으로 내 정보를 조회한다', async () => {
    const { username } = await signup()
    const login = await request(app).post('/api/auth/login').send({ username, password: 'password123' })
    expect(login.status).toBe(200)
    const me = await request(app).get('/api/auth/me').set(auth(login.body.token))
    expect(me.status).toBe(200)
    expect(me.body.user.username).toBe(username)
  })

  it('예전에 이메일로 가입한 계정도 그 이메일을 아이디로 로그인한다', async () => {
    const { username } = await signup()
    const legacy = `legacy-${Date.now()}@example.com`
    await pool.execute('UPDATE users SET username = ? WHERE username = ?', [legacy, username])
    const login = await request(app).post('/api/auth/login').send({ username: legacy, password: 'password123' })
    expect(login.status).toBe(200)
  })

  it('틀린 비밀번호와 없는 아이디는 같은 401 메시지 (가입 여부를 알려주지 않음)', async () => {
    const { username } = await signup()
    const wrong = await request(app).post('/api/auth/login').send({ username, password: 'wrong-password' })
    const unknown = await request(app).post('/api/auth/login').send({ username: 'nobody', password: 'password123' })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body.error).toBe(unknown.body.error)
  })

  it('토큰이 없거나 잘못되면 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401)
    expect((await request(app).get('/api/auth/me').set(auth('garbage'))).status).toBe(401)
  })
})

describe('관리자', () => {
  const ADMIN_PW = 'AdminPass123'
  const adminToken = async () => {
    await ensureAdmin(ADMIN_PW)
    return (await request(app).post('/api/auth/login').send({ username: 'admin', password: ADMIN_PW })).body.token
  }

  it('기동 시 .env 비밀번호로 admin을 만들고, 다른 비밀번호가 오면 맞춘다 (예전 토큰은 무효)', async () => {
    const token = await adminToken()
    expect((await request(app).get('/api/auth/me').set(auth(token))).body.user.role).toBe('admin')
    await new Promise((r) => setTimeout(r, 1100)) // 토큰 발급 시각(초 단위)보다 뒤에 바꾸도록
    expect(await ensureAdmin('Changed1234')).toBe('synced')
    expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ username: 'admin', password: 'Changed1234' })).status).toBe(200)
    await ensureAdmin(ADMIN_PW)
  })

  it('일반 회원은 관리자 API에 접근할 수 없다', async () => {
    const { token } = await signup()
    expect((await request(app).get('/api/admin/users').set(auth(token))).status).toBe(403)
  })

  it('승인 대기 → 승인 → 로그인, 거절 사유 표시, 정지하면 기존 토큰도 바로 막힌다', async () => {
    const token = await adminToken()
    const username = newUsername()
    await request(app).post('/api/auth/signup').send(signupBody(username, { signupNote: '수업용' }))
    const list = await request(app).get(`/api/admin/users?status=pending&q=${username}`).set(auth(token))
    const u = list.body.items[0]
    expect(u).toMatchObject({ username, status: 'pending', signupNote: '수업용' })

    expect((await request(app).post(`/api/admin/users/${u.id}/approve`).set(auth(token))).body.user.status).toBe('approved')
    const login = await request(app).post('/api/auth/login').send({ username, password: 'password123' })
    expect(login.status).toBe(200)

    await request(app).post(`/api/admin/users/${u.id}/suspend`).set(auth(token))
    expect((await request(app).get('/api/auth/me').set(auth(login.body.token))).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ username, password: 'password123' })).body.code).toBe('ACCOUNT_SUSPENDED')
    await request(app).post(`/api/admin/users/${u.id}/unsuspend`).set(auth(token))

    const other = newUsername()
    await request(app).post('/api/auth/signup').send(signupBody(other))
    const o = (await request(app).get(`/api/admin/users?q=${other}`).set(auth(token))).body.items[0]
    await request(app).post(`/api/admin/users/${o.id}/reject`).set(auth(token)).send({ reason: '목적 불명확' })
    const rejected = await request(app).post('/api/auth/login').send({ username: other, password: 'password123' })
    expect(rejected.body).toMatchObject({ code: 'ACCOUNT_REJECTED', reason: '목적 불명확' })
  })

  it('임시 비밀번호 발급 — 예전 비밀번호·토큰은 무효, admin 비밀번호는 발급·변경 불가', async () => {
    const token = await adminToken()
    const { username, token: userToken } = await signup()
    const u = (await request(app).get(`/api/admin/users?q=${username}`).set(auth(token))).body.items[0]
    await new Promise((r) => setTimeout(r, 1100))
    const { body } = await request(app).post(`/api/admin/users/${u.id}/temp-password`).set(auth(token))
    expect(body.tempPassword).toHaveLength(12)
    expect((await request(app).get('/api/auth/me').set(auth(userToken))).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ username, password: body.tempPassword })).status).toBe(200)

    const adminRow = (await request(app).get('/api/admin/users?q=admin').set(auth(token))).body.items.find((x) => x.username === 'admin')
    expect((await request(app).post(`/api/admin/users/${adminRow.id}/temp-password`).set(auth(token))).status).toBe(409)
    expect((await request(app).patch('/api/auth/password').set(auth(token)).send({ currentPassword: ADMIN_PW, newPassword: 'Other1234' })).status).toBe(409)
  })

  it('감사 로그에 가입·로그인·관리자 조치가 남는다', async () => {
    const token = await adminToken()
    const { body } = await request(app).get('/api/admin/audit').set(auth(token))
    const actions = new Set(body.items.map((a) => a.action))
    for (const a of ['user.signup', 'login.success', 'admin.user.approve']) expect(actions.has(a)).toBe(true)
  })
})
