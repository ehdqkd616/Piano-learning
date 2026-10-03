import { describe, it, expect, afterAll } from 'vitest'
import { app, pool, request, signup, sessionBody, auth } from './helpers'

afterAll(() => pool.end())

const save = (token, body) => request(app).post('/api/sessions').set(auth(token)).send(body)

describe('POST /api/sessions', () => {
  it('세션과 음표별 결과를 저장하고 XP·레벨·스트릭을 갱신한다', async () => {
    const { token } = await signup()
    const body = sessionBody({ localDate: new Date().toISOString().slice(0, 10) })
    const res = await save(token, body)
    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({ totalXP: 40, level: 1, streak: 1, lastPracticeDate: body.localDate })
    expect(res.body.session).toMatchObject({ sessionId: body.sessionId, totalScore: 80, pitchAccuracy: 90 })

    const [rows] = await pool.query('SELECT seq, note_index, verdict FROM session_note_results WHERE session_id = ? ORDER BY seq', [body.sessionId])
    expect(rows).toEqual([
      { seq: 0, note_index: 0, verdict: 'perfect' },
      { seq: 1, note_index: 1, verdict: 'miss' },
      { seq: 2, note_index: 1, verdict: 'good' },
    ])
  })

  it('저장한 세션을 같은 순서의 음표 결과와 함께 조회한다', async () => {
    const { token } = await signup()
    const body = sessionBody()
    await save(token, body)
    const res = await request(app).get(`/api/sessions/${body.sessionId}`).set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.session.startedAt).toBe(body.startedAt)
    expect(res.body.session.noteResults.map((r) => r.verdict)).toEqual(['perfect', 'miss', 'good'])
  })

  it('같은 sessionId를 다시 보내면(재전송) 새로 저장하지 않고 XP도 다시 주지 않는다', async () => {
    const { token } = await signup()
    const body = sessionBody()
    const first = await save(token, body)
    const retry = await save(token, body)
    expect(first.status).toBe(201)
    expect(retry.status).toBe(200)
    expect(retry.body.user.totalXP).toBe(first.body.user.totalXP)
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM session_note_results WHERE session_id = ?', [body.sessionId])
    expect(n).toBe(3)
  })

  it('다른 사용자의 sessionId로 저장하면 409, 조회하면 404', async () => {
    const a = await signup()
    const b = await signup()
    const body = sessionBody()
    await save(a.token, body)
    expect((await save(b.token, body)).status).toBe(409)
    expect((await request(app).get(`/api/sessions/${body.sessionId}`).set(auth(b.token))).status).toBe(404)
  })

  it('동시에 여러 세션을 저장해도 XP가 빠짐없이 합산된다 (사용자 행 잠금)', async () => {
    const { token } = await signup()
    await Promise.all([1, 2, 3, 4, 5].map(() => save(token, sessionBody({ totalScore: 100, noteResults: [] }))))
    const me = await request(app).get('/api/auth/me').set(auth(token))
    expect(me.body.user.totalXP).toBe(250)
  })

  it('500 XP마다 레벨이 오른다', async () => {
    const { token } = await signup()
    let user
    for (let i = 0; i < 10; i++) user = (await save(token, sessionBody({ totalScore: 100, noteResults: [] }))).body.user
    expect(user).toMatchObject({ totalXP: 500, level: 2 })
  })

  it.each([
    [{ songId: 'no-such-song' }, '없는 곡'],
    [{ sessionId: 'not-a-uuid' }, 'UUID 아님'],
    [{ mode: 'fast' }, '알 수 없는 mode'],
    [{ totalScore: 101 }, '100점 초과'],
    [{ totalScore: 50.5 }, '정수 아님'],
    [{ pitchAccuracy: -1 }, '음수 정확도'],
    [{ startedAt: 'yesterday' }, '날짜 형식'],
    [{ endedAt: '2026-10-01T09:00:00.000Z' }, '종료가 시작보다 빠름'],
    [{ localDate: '2020-01-01' }, '말이 안 되는 현지 날짜'],
    [{ noteResults: [{ noteIndex: 0, noteNumber: 200, expectedTimeMs: 0, actualTimeMs: 0, timingDeltaMs: 0, verdict: 'perfect' }] }, 'MIDI 범위 밖'],
    [{ noteResults: [{ noteIndex: 0, noteNumber: 60, expectedTimeMs: 0, actualTimeMs: 0, timingDeltaMs: 0, verdict: 'great' }] }, '알 수 없는 판정'],
    [{ noteResults: 'nope' }, '배열 아님'],
    [{ noteResults: [{ noteIndex: 70000, noteNumber: 60, expectedTimeMs: 0, actualTimeMs: 0, timingDeltaMs: 0, verdict: 'perfect' }] }, 'noteIndex 범위 밖'],
    [{ noteResults: [{ noteIndex: 0, noteNumber: 60, expectedTimeMs: 0, actualTimeMs: 1e12, timingDeltaMs: 1e12, verdict: 'perfect' }] }, '시각 범위 밖'],
  ])('잘못된 입력은 400: %#', async (overrides) => {
    const { token } = await signup()
    const res = await save(token, sessionBody(overrides))
    expect(res.status).toBe(400)
  })
})
