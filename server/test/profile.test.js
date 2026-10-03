import { describe, it, expect, afterAll } from 'vitest'
import { app, pool, request, signup, auth } from './helpers'

afterAll(() => pool.end())

const patch = (token, body) => request(app).patch('/api/profile').set(auth(token)).send(body)

describe('PATCH /api/profile', () => {
  it('닉네임을 바꾸고 설정은 기존 값에 합친다', async () => {
    const { token } = await signup()
    const res = await patch(token, { nickname: '  새닉네임  ', settings: { bpm: 80 } })
    expect(res.status).toBe(200)
    expect(res.body.user.nickname).toBe('새닉네임')
    expect(res.body.user.settings).toMatchObject({ bpm: 80, inputMode: 'midi', viewMode: 'falling' })
  })

  it.each([
    [{ settings: { hacker: true } }, '알 수 없는 설정 키'],
    [{ settings: { bpm: 9999 } }, '범위 밖 BPM'],
    [{ settings: { inputMode: 'keyboard' } }, '알 수 없는 입력 방식'],
    [{ settings: [1, 2] }, '배열'],
    [{ nickname: '가'.repeat(51) }, '51자 닉네임'],
    [{ nickname: 123 }, '문자열 아님'],
  ])('잘못된 입력은 400: %#', async (body) => {
    const { token } = await signup()
    expect((await patch(token, body)).status).toBe(400)
  })
})
