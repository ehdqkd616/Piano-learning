import { create } from 'zustand'
import type {
  Song, NoteEvent, NoteResult, PracticeMode,
  PlaybackState, LoopRegion, ScoreNote, Verdict,
} from '@/types'

interface PracticeState {
  // 현재 곡
  currentSong: Song | null
  scoreNotes: ScoreNote[]

  // 연주 제어
  mode: PracticeMode
  playbackState: PlaybackState
  currentTimeMs: number
  bpm: number
  loopRegion: LoopRegion | null
  handSplit: 'both' | 'left' | 'right'
  speedRatio: number     // 0.5 ~ 1.5

  // 입력 상태
  activeNotes: Set<number>       // 현재 눌린 MIDI 노트 번호
  highlightNotes: Set<number>    // 현재 눌러야 할 노트 (Wait Mode 힌트)

  // 판정 결과
  noteResults: NoteResult[]
  currentNoteIndex: number
  liveScore: number
  combo: number

  // 액션
  loadSong: (song: Song, notes: ScoreNote[]) => void
  setMode: (mode: PracticeMode) => void
  setPlaybackState: (state: PlaybackState) => void
  setCurrentTimeMs: (ms: number) => void
  setBpm: (bpm: number) => void
  setLoopRegion: (region: LoopRegion | null) => void
  setHandSplit: (hand: 'both' | 'left' | 'right') => void
  setSpeedRatio: (ratio: number) => void
  pressNote: (event: NoteEvent) => void
  releaseNote: (noteNumber: number) => void
  recordResult: (result: NoteResult) => void
  advanceNoteIndex: () => void
  resetSession: () => void
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  currentSong: null,
  scoreNotes: [],
  mode: 'wait',
  playbackState: 'idle',
  currentTimeMs: 0,
  bpm: 100,
  loopRegion: null,
  handSplit: 'both',
  speedRatio: 1.0,
  activeNotes: new Set(),
  highlightNotes: new Set(),
  noteResults: [],
  currentNoteIndex: 0,
  liveScore: 0,
  combo: 0,

  loadSong: (song, notes) => set({
    currentSong: song,
    scoreNotes: notes,
    bpm: song.bpm,
    noteResults: [],
    currentNoteIndex: 0,
    liveScore: 0,
    combo: 0,
    playbackState: 'idle',
    currentTimeMs: 0,
    highlightNotes: new Set(notes.length > 0 ? [notes[0].noteNumber] : []),
  }),

  setMode: (mode) => set({ mode }),
  setPlaybackState: (playbackState) => set({ playbackState }),
  setCurrentTimeMs: (currentTimeMs) => set({ currentTimeMs }),
  setBpm: (bpm) => set({ bpm }),
  setLoopRegion: (loopRegion) => set({ loopRegion }),
  setHandSplit: (handSplit) => set({ handSplit }),
  setSpeedRatio: (speedRatio) => set({ speedRatio }),

  pressNote: (event) => set((state) => {
    const next = new Set(state.activeNotes)
    next.add(event.noteNumber)
    return { activeNotes: next }
  }),

  releaseNote: (noteNumber) => set((state) => {
    const next = new Set(state.activeNotes)
    next.delete(noteNumber)
    return { activeNotes: next }
  }),

  recordResult: (result) => set((state) => {
    const verdictXP: Record<Verdict, number> = {
      perfect: 10, good: 7, late: 4, early: 4, miss: 0, skip: 0,
    }
    const gained = verdictXP[result.verdict]
    const newCombo = result.verdict === 'miss' || result.verdict === 'skip'
      ? 0 : state.combo + 1
    const comboBonus = newCombo > 0 && newCombo % 10 === 0 ? 20 : 0
    return {
      noteResults: [...state.noteResults, result],
      liveScore: Math.min(100, state.liveScore + gained + comboBonus),
      combo: newCombo,
    }
  }),

  advanceNoteIndex: () => set((state) => {
    const next = state.currentNoteIndex + 1
    const nextNote = state.scoreNotes[next]
    return {
      currentNoteIndex: next,
      highlightNotes: new Set(nextNote ? [nextNote.noteNumber] : []),
    }
  }),

  resetSession: () => set({
    noteResults: [],
    currentNoteIndex: 0,
    liveScore: 0,
    combo: 0,
    currentTimeMs: 0,
    playbackState: 'idle',
    activeNotes: new Set(),
  }),
}))
