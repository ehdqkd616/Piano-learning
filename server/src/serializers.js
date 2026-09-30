// DB 행(snake_case) → API 응답(camelCase). 응답 모양은 SQLite 버전과 같게 유지한다.
// JSON 컬럼(settings, tags, notes)은 mysql2가 이미 객체로 파싱해서 준다.

function serializeUser(row) {
  return {
    userId: row.id,
    email: row.email,
    nickname: row.nickname,
    level: row.level,
    totalXP: row.total_xp,
    streak: row.streak,
    lastPracticeDate: row.last_practice_date ?? '',
    settings: row.settings,
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
    midiData: row.midi_data ?? '',
    musicXML: row.music_xml ?? '',
    audioPreview: row.audio_preview ?? undefined,
    tags: row.tags,
    notes: row.notes,
    isFavorite: Boolean(isFavorite),
  }
}

function serializeNoteResult(row) {
  return {
    noteIndex: row.note_index,
    noteNumber: row.note_number,
    expectedTimeMs: row.expected_time_ms,
    actualTimeMs: row.actual_time_ms,
    timingDeltaMs: row.timing_delta_ms,
    verdict: row.verdict,
  }
}

function serializeSession(row, noteRows = []) {
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    songId: row.song_id,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at.toISOString(),
    mode: row.mode,
    totalScore: row.total_score,
    pitchAccuracy: row.pitch_accuracy,
    timingAccuracy: row.timing_accuracy,
    completionRate: row.completion_rate,
    noteResults: noteRows.map(serializeNoteResult),
  }
}

module.exports = { serializeUser, serializeSong, serializeSession }
