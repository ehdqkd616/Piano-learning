import { describe, it, expect, beforeEach } from 'vitest'
import { usePracticeStore } from '@/store/usePracticeStore'
import type { ScoreNote, Song } from '@/types'

const notes: ScoreNote[] = [60, 62, 64].map((noteNumber, index) => ({
  index, noteNumber, startTimeMs: index * 500, durationMs: 450, hand: 'right', measure: 0, beat: index,
}))

describe('usePracticeStore', () => {
  beforeEach(() => {
    usePracticeStore.getState().loadSong({ songId: 's', bpm: 120, notes: [] } as unknown as Song, notes)
  })

  it('jumpToNoteIndex: 차례를 옮기고 다음에 칠 음을 힌트로 표시', () => {
    usePracticeStore.getState().jumpToNoteIndex(2)
    const s = usePracticeStore.getState()
    expect(s.currentNoteIndex).toBe(2)
    expect([...s.highlightNotes]).toEqual([64])
  })

  it('resetSession: 다시 시작하면 첫 음 힌트로 돌아간다', () => {
    usePracticeStore.getState().jumpToNoteIndex(2)
    usePracticeStore.getState().resetSession()
    const s = usePracticeStore.getState()
    expect(s.currentNoteIndex).toBe(0)
    expect([...s.highlightNotes]).toEqual([60])
  })

  it('releaseAllNotes: 눌려 있는 음 표시를 모두 지운다', () => {
    const press = (noteNumber: number) => usePracticeStore.getState().pressNote({
      noteNumber, velocity: 80, timestamp: 0, type: 'on', channel: 0, source: 'midi',
    })
    press(60); press(64)
    usePracticeStore.getState().releaseAllNotes()
    expect(usePracticeStore.getState().activeNotes.size).toBe(0)
  })
})
