import { describe, it, expect, afterAll } from 'vitest'
import { app, pool, request, signup, newUsername, auth } from './helpers'

afterAll(() => pool.end())

describe('POST /api/auth/signup', () => {
  it('가입하면 토큰과 기본 설정이 담긴 사용자를 돌려준다', async () => {
    const { res, username } = await signup()
    expect(res.status).toBe(201)
    expect(res.body.token).toBeTypeOf('string')
    expect(res.body.user).toMatchObject({ username, nickname: '테스터', level: 1, totalXP: 0, streak: 0, lastPracticeDate: '' })
    expect(res.body.user.settings.inputMode).toBe('midi')
    expect(res.body.user).not.toHaveProperty('passwordHash')
  })

  it('아이디는 소문자로 정규화되고, 대소문자만 다른 중복 가입은 409', async () => {
    const { username } = await signup()
    const res = await request(app).post('/api/auth/signup').send({ username: username.toUpperCase(), password: 'password123' })
    expect(res.status).toBe(409)
  })

  it('같은 아이디로 동시에 가입해도 하나만 성공하고 나머지는 409 (500 아님)', async () => {
    const username = newUsername()
    const results = await Promise.all([1, 2, 3].map(() =>
      request(app).post('/api/auth/signup').send({ username, password: 'password123' })))
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
