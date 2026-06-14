// ─── 입력 레이어 (Layer 1-2) ───────────────────────────────────────────────

export interface NoteEvent {
  noteNumber: number;              // 0~127 (가운데 도 = 60)
  velocity: number;                // 0~127
  timestamp: DOMHighResTimeStamp;  // ms 단위 고해상도
  type: 'on' | 'off';
  channel: number;                 // 0~15
  source: 'midi' | 'mic' | 'virtual';
}

// ─── 판정 결과 ────────────────────────────────────────────────────────────

export type Verdict = 'perfect' | 'good' | 'late' | 'early' | 'miss' | 'skip';

export interface NoteResult {
  noteIndex: number;
  noteNumber: number;
  expectedTimeMs: number;
  actualTimeMs: number;
  timingDeltaMs: number;
  verdict: Verdict;
}

// ─── 악보 데이터 ──────────────────────────────────────────────────────────

export interface ScoreNote {
  index: number;
  noteNumber: number;        // MIDI 번호
  startTimeMs: number;       // BPM 기준 시작 시각
  durationMs: number;
  hand: 'left' | 'right' | 'both';
  measure: number;
  beat: number;
}

// ─── 데이터 모델 (설계서 6장) ─────────────────────────────────────────────

export interface UserSettings {
  inputMode: 'midi' | 'mic' | 'virtual';
  bpm: number;
  viewMode: 'falling' | 'sheet' | 'hybrid';
  handSplit: 'both' | 'left' | 'right';
  midiDeviceId?: string;
  micSensitivity: number;    // 0~1
  timingTolerance: number;   // ms (기본 100ms)
}

export interface User {
  userId: string;
  nickname: string;
  level: number;
  totalXP: number;
  streak: number;
  lastPracticeDate: string;
  settings: UserSettings;
}

export interface Song {
  songId: string;
  title: string;
  artist: string;
  genre: string;
  difficulty: number;        // 1~10
  durationMs: number;
  bpm: number;
  keySignature: string;
  timeSignature: string;
  midiData: string;          // Base64 encoded MIDI
  musicXML: string;
  audioPreview?: string;
  tags: string[];
  isFavorite?: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

export interface PracticeSession {
  sessionId: string;
  userId: string;
  songId: string;
  startedAt: string;
  endedAt: string;
  mode: 'wait' | 'play';
  totalScore: number;
  pitchAccuracy: number;
  timingAccuracy: number;
  completionRate: number;
  noteResults: NoteResult[];
}

// ─── 진행 제어 ────────────────────────────────────────────────────────────

export type PracticeMode = 'wait' | 'play';
export type PlaybackState = 'idle' | 'playing' | 'paused' | 'finished';

export interface LoopRegion {
  startMs: number;
  endMs: number;
}

// ─── 게이미피케이션 ───────────────────────────────────────────────────────

export interface ScoreBreakdown {
  pitchAccuracy: number;     // 0~100
  timingAccuracy: number;    // 0~100
  completionRate: number;    // 0~100
  total: number;             // 가중 합산
}

export type StarRating = 0 | 1 | 2 | 3;

// ─── 커리큘럼 ─────────────────────────────────────────────────────────────

export interface CurriculumLevel {
  level: number;
  title: string;
  description: string;
  songs: string[];           // songId 배열
  requiredXP: number;
  isUnlocked: boolean;
}
