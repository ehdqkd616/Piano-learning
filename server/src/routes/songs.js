const express = require('express')
const { db } = require('../db')
const { requireAuth } = require('../auth')
const { serializeSong } = require('../serializers')

const router = express.Router()
router.use(requireAuth)

function favoriteSet(userId) {
  const rows = db.prepare('SELECT song_id FROM favorites WHERE user_id = ?').all(userId)
  return new Set(rows.map((r) => r.song_id))
}

router.get('/', (req, res) => {
  const favorites = favoriteSet(req.userId)
  const rows = db.prepare('SELECT * FROM songs').all()
  res.json({ songs: rows.map((row) => serializeSong(row, favorites.has(row.song_id))) })
})

router.get('/:songId', (req, res) => {
  const row = db.prepare('SELECT * FROM songs WHERE song_id = ?').get(req.params.songId)
  if (!row) return res.status(404).json({ error: '곡을 찾을 수 없습니다.' })
  const isFavorite = Boolean(db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND song_id = ?').get(req.userId, row.song_id))
  res.json({ song: serializeSong(row, isFavorite) })
})

router.post('/:songId/favorite', (req, res) => {
  const song = db.prepare('SELECT song_id FROM songs WHERE song_id = ?').get(req.params.songId)
  if (!song) return res.status(404).json({ error: '곡을 찾을 수 없습니다.' })

  const existing = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND song_id = ?').get(req.userId, song.song_id)
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND song_id = ?').run(req.userId, song.song_id)
    return res.json({ isFavorite: false })
  }
  db.prepare('INSERT INTO favorites (user_id, song_id) VALUES (?, ?)').run(req.userId, song.song_id)
  res.json({ isFavorite: true })
})

module.exports = router
