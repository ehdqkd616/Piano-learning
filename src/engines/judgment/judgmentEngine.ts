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

export function calcScore(results: NoteResult[], total: number): ScoreBreakdown {
  if (results.length === 0) return { pitchAccuracy: 0, timingAccuracy: 0, completionRate: 0, total: 0 }

  const hit = results.filter((r) => r.verdict !== 'miss' && r.verdict !== 'skip').length
  const pitchAccuracy = (hit / total) * 100

  const timingDeltas = results
    .filter((r) => r.verdict !== 'miss' && r.verdict !== 'skip')
    .map((r) => Math.abs(r.timingDeltaMs))
  const avgDelta = timingDeltas.length
    ? timingDeltas.reduce((a, b) => a + b, 0) / timingDeltas.length
    : 0
  // avgDelta 0ms → 100점, 500ms+ → 0점
  const timingAccuracy = Math.max(0, 100 - (avgDelta / 5))

  const completionRate = (results.length / total) * 100

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

// Wait Mode: 목표 노트 집합과 입력이 일치하는지 확인
export function matchesTarget(inputNote: number, targetNote: ScoreNote): boolean {
  return inputNote === targetNote.noteNumber
}
