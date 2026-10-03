import { describe, it, expect, afterAll } from 'vitest'
import { app, pool, request, signup, auth } from './helpers'
import { syncSongs } from '../src/db'
import { SEED_SONGS } from '../src/seedSongs'

afterAll(() => pool.end())

describe('곡 목록·즐겨찾기', () => {
  it('곡 목록은 시드 곡을 실제 음표와 함께 돌려준다', async () => {
    const { token } = await signup()
    const res = await request(app).get('/api/songs').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.songs).toHaveLength(SEED_SONGS.length)
    const twinkle = res.body.songs.find((s) => s.songId === 'song-2')
    expect(twinkle.notes).toHaveLength(42)
    expect(twinkle.isFavorite).toBe(false)
  })

  it('즐겨찾기는 누를 때마다 켜졌다 꺼졌다 하고, 사용자별로 따로 저장된다', async () => {
    const a = await signup()
    const b = await signup()
    const toggle = (t) => request(app).post('/api/songs/song-3/favorite').set(auth(t))
    expect((await toggle(a.token)).body.isFavorite).toBe(true)
    expect((await request(app).get('/api/songs/song-3').set(auth(a.token))).body.song.isFavorite).toBe(true)
    expect((await request(app).get('/api/songs/song-3').set(auth(b.token))).body.song.isFavorite).toBe(false)
    expect((await toggle(a.token)).body.isFavorite).toBe(false)
  })

  it('즐겨찾기를 동시에 여러 번 눌러도 500이 나지 않는다', async () => {
    const { token } = await signup()
    const results = await Promise.all([1, 2, 3, 4].map(() =>
      request(app).post('/api/songs/song-4/favorite').set(auth(token))))
    expect(results.every((r) => r.status === 200)).toBe(true)
  })

  it('없는 곡은 404', async () => {
    const { token } = await signup()
    expect((await request(app).get('/api/songs/nope').set(auth(token))).status).toBe(404)
    expect((await request(app).post('/api/songs/nope/favorite').set(auth(token))).status).toBe(404)
  })

  it('카탈로그에서 빠진 곡은 지우지 않고 숨긴다 (연습 기록이 참조 중일 수 있음)', async () => {
    const { token } = await signup()
    await syncSongs(SEED_SONGS.filter((s) => s.songId !== 'song-8'))
    try {
      const list = await request(app).get('/api/songs').set(auth(token))
      expect(list.body.songs.map((s) => s.songId)).not.toContain('song-8')
      const [[row]] = await pool.query('SELECT is_active FROM songs WHERE song_id = ?', ['song-8'])
      expect(row.is_active).toBe(0)
    } finally {
      await syncSongs(SEED_SONGS)
    }
  })
})
