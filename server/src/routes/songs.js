const express = require('express')
const { pool } = require('../db')
const { requireAuth } = require('../auth')
const { serializeSong } = require('../serializers')

const router = express.Router()
router.use(requireAuth)

// 즐겨찾기 여부를 LEFT JOIN으로 한 번에 가져온다 (SQLite 버전은 즐겨찾기 목록을 따로 조회해 Set으로 비교)
const SELECT_SONG_WITH_FAVORITE = `
  SELECT s.*, (f.song_id IS NOT NULL) AS is_favorite
  FROM songs s
  LEFT JOIN favorites f ON f.song_id = s.song_id AND f.user_id = ?
`

router.get('/', async (req, res) => {
  const [rows] = await pool.execute(`${SELECT_SONG_WITH_FAVORITE} WHERE s.is_active = 1 ORDER BY s.song_id`, [req.userId])
  res.json({ songs: rows.map((row) => serializeSong(row, row.is_favorite)) })
})

router.get('/:songId', async (req, res) => {
  const [rows] = await pool.execute(`${SELECT_SONG_WITH_FAVORITE} WHERE s.song_id = ?`, [req.userId, req.params.songId])
  const row = rows[0]
  if (!row) return res.status(404).json({ error: '곡을 찾을 수 없습니다.' })
  res.json({ song: serializeSong(row, row.is_favorite) })
})

router.post('/:songId/favorite', async (req, res) => {
  const [songs] = await pool.execute('SELECT song_id FROM songs WHERE song_id = ?', [req.params.songId])
  const song = songs[0]
  if (!song) return res.status(404).json({ error: '곡을 찾을 수 없습니다.' })

  const [existing] = await pool.execute('SELECT 1 FROM favorites WHERE user_id = ? AND song_id = ?', [req.userId, song.song_id])
  if (existing.length > 0) {
    await pool.execute('DELETE FROM favorites WHERE user_id = ? AND song_id = ?', [req.userId, song.song_id])
    return res.json({ isFavorite: false })
  }
  await pool.execute('INSERT INTO favorites (user_id, song_id) VALUES (?, ?)', [req.userId, song.song_id])
  res.json({ isFavorite: true })
})

module.exports = router
