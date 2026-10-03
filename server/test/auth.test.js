import { describe, it, expect, afterAll } from 'vitest'
import { app, pool, request, signup, auth } from './helpers'

afterAll(() => pool.end())

describe('POST /api/auth/signup', () => {
  it('가입하면 토큰과 기본 설정이 담긴 사용자를 돌려준다', async () => {
    const { res, email } = await signup()
    expect(res.status).toBe(201)
    expect(res.body.token).toBeTypeOf('string')
    expect(res.body.user).toMatchObject({ email, nickname: '테스터', level: 1, totalXP: 0, streak: 0, lastPracticeDate: '' })
    expect(res.body.user.settings.inputMode).toBe('midi')
    expect(res.body.user).not.toHaveProperty('passwordHash')
  })

  it('이메일은 소문자로 정규화되고, 대소문자만 다른 중복 가입은 409', async () => {
    const { email } = await signup()
    const res = await request(app).post('/api/auth/signup').send({ email: email.toUpperCase(), password: 'password123' })
    expect(res.status).toBe(409)
  })

  it('같은 이메일로 동시에 가입해도 하나만 성공하고 나머지는 409 (500 아님)', async () => {
    const email = `race-${Date.now()}@example.com`
    const results = await Promise.all([1, 2, 3].map(() =>
      request(app).post('/api/auth/signup').send({ email, password: 'password123' })))
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual([201, 409, 409])
  })

  it.each([
    [{ email: 'a@b.com', password: 'short' }, '8자 미만 비밀번호'],
    [{ email: 'not-an-email', password: 'password123' }, '이메일 형식'],
    [{ email: 'a@b.com', password: 'x'.repeat(73) }, '72바이트 초과 비밀번호'],
    [{ email: 'a@b.com', password: 'password123', nickname: '가'.repeat(51) }, '51자 닉네임'],
  ])('잘못된 입력은 400: %#', async (body) => {
    const res = await request(app).post('/api/auth/signup').send(body)
    expect(res.status).toBe(400)
  })

  it('JSON 문법 오류는 500이 아니라 400', async () => {
    const res = await request(app).post('/api/auth/signup').set('Content-Type', 'application/json').send('{bad json')
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login, GET /api/auth/me', () => {
  it('맞는 비밀번호로 로그인하고 토큰으로 내 정보를 조회한다', async () => {
    const { email } = await signup()
    const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' })
    expect(login.status).toBe(200)
    const me = await request(app).get('/api/auth/me').set(auth(login.body.token))
    expect(me.status).toBe(200)
    expect(me.body.user.email).toBe(email)
  })

  it('틀린 비밀번호와 없는 이메일은 같은 401 메시지 (가입 여부를 알려주지 않음)', async () => {
    const { email } = await signup()
    const wrong = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' })
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'password123' })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body.error).toBe(unknown.body.error)
  })

  it('토큰이 없거나 잘못되면 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401)
    expect((await request(app).get('/api/auth/me').set(auth('garbage'))).status).toBe(401)
  })
})
