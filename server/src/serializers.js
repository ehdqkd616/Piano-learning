function serializeUser(row) {
  return {
    userId: row.id,
    email: row.email,
    nickname: row.nickname,
    level: row.level,
    totalXP: row.total_xp,
    streak: row.streak,
    lastPracticeDate: row.last_practice_date,
    settings: JSON.parse(row.settings),
  }
}

function serializeSong(row, isFavorite) {
  return {
    songId: row.song_id,
    title: row.title,
    artist: row.artist,
    genre: row.genre,
    difficulty: row.difficulty,
    durationMs: row.duration_ms,
    bpm: row.bpm,
    keySignature: row.key_signature,
    timeSignature: row.time_signature,
    midiData: row.midi_data,
    musicXML: row.music_xml,
    audioPreview: row.audio_preview ?? undefined,
    tags: JSON.parse(row.tags),
    notes: JSON.parse(row.notes_json),
    isFavorite: Boolean(isFavorite),
  }
}

function serializeSession(row) {
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    songId: row.song_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    mode: row.mode,
    totalScore: row.total_score,
    pitchAccuracy: row.pitch_accuracy,
    timingAccuracy: row.timing_accuracy,
    completionRate: row.completion_rate,
    noteResults: JSON.parse(row.note_results),
  }
}

module.exports = { serializeUser, serializeSong, serializeSession }
