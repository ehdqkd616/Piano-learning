import { describe, it, expect, afterAll } from 'vitest'
import { pool, withTransaction } from '../src/db'
import { signup } from './helpers'

afterAll(() => pool.end())

describe('withTransaction', () => {
  it('중간에 예외가 나면 앞서 실행한 쿼리까지 모두 롤백한다', async () => {
    const { user } = await signup()
    const sessionId = crypto.randomUUID()
    await expect(withTransaction(async (conn) => {
      await conn.execute(`
        INSERT INTO sessions (session_id, user_id, song_id, started_at, ended_at, mode, total_score)
        VALUES (?, ?, 'song-1', NOW(3), NOW(3), 'play', 50)`, [sessionId, user.userId])
      await conn.query(`
        INSERT INTO session_note_results (session_id, seq, note_index, note_number, expected_time_ms, actual_time_ms, timing_delta_ms, verdict)
        VALUES (?, 0, 0, 60, 0, 0, 0, 'perfect')`, [sessionId])
      throw new Error('중간 실패')
    })).rejects.toThrow('중간 실패')

    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM sessions WHERE session_id = ?', [sessionId])
    const [[{ m }]] = await pool.query('SELECT COUNT(*) AS m FROM session_note_results WHERE session_id = ?', [sessionId])
    expect([n, m]).toEqual([0, 0])
  })

  it('성공하면 커밋되고 fn의 반환값을 돌려준다', async () => {
    const result = await withTransaction(async (conn) => {
      const [[row]] = await conn.query('SELECT 1 + 1 AS two')
      return row.two
    })
    expect(result).toBe(2)
  })
})
