const path = require('path')
const Database = require('better-sqlite3')
const { SEED_SONGS } = require('./seedSongs')

const db = new Database(path.join(__dirname, '..', 'data', 'piano.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    total_xp INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    last_practice_date TEXT NOT NULL DEFAULT '',
    settings TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS songs (
    song_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    genre TEXT NOT NULL,
    difficulty INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    bpm INTEGER NOT NULL,
    key_signature TEXT NOT NULL,
    time_signature TEXT NOT NULL,
    midi_data TEXT NOT NULL DEFAULT '',
    music_xml TEXT NOT NULL DEFAULT '',
    audio_preview TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    notes_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, song_id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    mode TEXT NOT NULL,
    total_score INTEGER NOT NULL,
    pitch_accuracy REAL NOT NULL DEFAULT 0,
    timing_accuracy REAL NOT NULL DEFAULT 0,
    completion_rate REAL NOT NULL DEFAULT 0,
    note_results TEXT NOT NULL DEFAULT '[]'
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS achievements (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    unlocked_at TEXT,
    PRIMARY KEY (id, user_id)
  );
`)

// 기존 DB에 notes_json 컬럼이 없으면 추가 (초기 배포 이후 스키마 변경 대응)
const songColumns = db.prepare('PRAGMA table_info(songs)').all().map((c) => c.name)
if (!songColumns.includes('notes_json')) {
  db.exec(`ALTER TABLE songs ADD COLUMN notes_json TEXT NOT NULL DEFAULT '[]'`)
}

// 곡 카탈로그는 서버가 소유하는 정적 데이터이므로, 부팅 시마다 seedSongs.js 내용으로 갱신한다.
const upsert = db.prepare(`
  INSERT INTO songs (song_id, title, artist, genre, difficulty, duration_ms, bpm, key_signature, time_signature, midi_data, music_xml, tags, notes_json)
  VALUES (@songId, @title, @artist, @genre, @difficulty, @durationMs, @bpm, @keySignature, @timeSignature, '', '', @tags, @notesJson)
  ON CONFLICT(song_id) DO UPDATE SET
    title = excluded.title, artist = excluded.artist, genre = excluded.genre,
    difficulty = excluded.difficulty, duration_ms = excluded.duration_ms, bpm = excluded.bpm,
    key_signature = excluded.key_signature, time_signature = excluded.time_signature,
    tags = excluded.tags, notes_json = excluded.notes_json
`)
const syncSongs = db.transaction((songs) => {
  for (const song of songs) {
    const totalBeats = song.notes.reduce((sum, n) => sum + n.beats, 0)
    const beatMs = (60 / song.bpm) * 1000
    upsert.run({
      ...song,
      durationMs: Math.round(totalBeats * beatMs),
      tags: JSON.stringify(song.tags),
      notesJson: JSON.stringify(song.notes),
    })
  }
  const keepIds = songs.map((s) => s.songId)
  const placeholders = keepIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM songs WHERE song_id NOT IN (${placeholders})`).run(...keepIds)
})
syncSongs(SEED_SONGS)

module.exports = { db }
