import type { NoteEvent, ScoreNote, NoteResult, Verdict, ScoreBreakdown } from '@/types'

const PERFECT_MS = 30
const GOOD_MS = 100

export function judgeNote(
  event: NoteEvent,
  target: ScoreNote,
  toleranceMs = GOOD_MS,
): NoteResult {
  const delta = event.timestamp - target.startTimeMs
  const absDelta = Math.abs(delta)

  let verdict: Verdict
  if (event.noteNumber !== target.noteNumber) {
    verdict = 'miss'
  } else if (absDelta <= PERFECT_MS) {
    verdict = 'perfect'
  } else if (absDelta <= toleranceMs) {
    verdict = 'good'
  } else if (delta > toleranceMs) {
    verdict = 'late'
  } else {
    verdict = 'early'
  }

  return {
    noteIndex: target.index,
    noteNumber: event.noteNumber,
    expectedTimeMs: target.startTimeMs,
    actualTimeMs: event.timestamp,
    timingDeltaMs: delta,
    verdict,
  }
}

/** 음표별 최종 판정. 틀린 건반(miss) 뒤에 맞히면 맞힌 판정이 최종이다 */
export function latestResultFor(results: NoteResult[], noteIndex: number): NoteResult | undefined {
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].noteIndex === noteIndex) return results[i]
  }
  return undefined
}

const isHit = (r: NoteResult) => r.verdict !== 'miss' && r.verdict !== 'skip'

// results: 연주 중 기록된 판정 전부 (틀린 건반은 같은 음표에 대해 여러 번 'miss'로 쌓일 수 있다)
// totalNotes: 곡의 전체 음표 수
// - 음정 정확도: 누른 건반 중 맞은 비율 (hit ÷ (hit + miss)). 자동으로 지나간 skip은 누른 게 아니므로 제외
// - 타이밍 정확도: 맞은 건반의 평균 타이밍 오차로 계산. 맞은 게 없으면 0
// - 완주율: 곡 전체 음표 중 맞게 친 음표의 비율. 중간에 끝내면 그만큼 낮아진다
export function calcScore(results: NoteResult[], totalNotes: number): ScoreBreakdown {
  if (results.length === 0 || totalNotes <= 0) return { pitchAccuracy: 0, timingAccuracy: 0, completionRate: 0, total: 0 }

  const hits = results.filter(isHit)
  const pressed = results.filter((r) => r.verdict !== 'skip').length
  const pitchAccuracy = pressed > 0 ? (hits.length / pressed) * 100 : 0

  const avgDelta = hits.length
    ? hits.reduce((sum, r) => sum + Math.abs(r.timingDeltaMs), 0) / hits.length
    : 0
  // avgDelta 0ms → 100점, 500ms+ → 0점
  const timingAccuracy = hits.length ? Math.max(0, 100 - (avgDelta / 5)) : 0

  const hitNotes = new Set(hits.map((r) => r.noteIndex)).size
  const completionRate = Math.min(100, (hitNotes / totalNotes) * 100)

  const totalScore = pitchAccuracy * 0.5 + timingAccuracy * 0.3 + completionRate * 0.2

  return {
    pitchAccuracy: Math.round(pitchAccuracy),
    timingAccuracy: Math.round(timingAccuracy),
    completionRate: Math.round(completionRate),
    total: Math.round(totalScore),
  }
}

export function getStarRating(score: number): 0 | 1 | 2 | 3 {
  if (score >= 90) return 3
  if (score >= 70) return 2
  if (score >= 50) return 1
  return 0
}

// 자동 진행 모드에서 누른 건반이 판정할 음표를 찾는 범위: 음표 시작 시각보다 이만큼 일찍 눌러도 그 음표로 본다
const EARLY_WINDOW_MS = 300

export interface PlayMatch {
  /** 판정할 음표 (없으면 null → 틀린 건반) */
  target: ScoreNote | null
  /** target 앞에 있어서 친 기회가 지나간 음표들 (skip 처리 대상) */
  skipped: ScoreNote[]
}

/**
 * 자동 진행 모드: 누른 건반을 어느 음표로 판정할지 고른다.
 * 현재 차례 음표 하나만 보던 예전 방식은, 한 음을 놓친 뒤 다음 음을 살짝 일찍 누르면
 * 아직 차례가 앞 음이라 '틀린 건반'이 되고 이후 음표까지 연달아 어긋났다.
 * 지금은 현재 차례부터 시작 시각이 (지금 + EARLY_WINDOW_MS) 이전인 음표 중 음높이가 같은 첫 음표를 고르고,
 * 그 앞의 음표들은 놓친 것으로 본다.
 */
export function matchPlayNote(
  scoreNotes: ScoreNote[],
  currentIndex: number,
  noteNumber: number,
  timeMs: number,
): PlayMatch {
  for (let i = currentIndex; i < scoreNotes.length; i++) {
    const note = scoreNotes[i]
    if (note.startTimeMs > timeMs + EARLY_WINDOW_MS) break
    if (note.noteNumber === noteNumber) {
      return { target: note, skipped: scoreNotes.slice(currentIndex, i) }
    }
  }
  return { target: null, skipped: [] }
}

// Wait Mode: 목표 노트 집합과 입력이 일치하는지 확인
export function matchesTarget(inputNote: number, targetNote: ScoreNote): boolean {
  return inputNote === targetNote.noteNumber
}
