import { describe, it, expect } from 'vitest'
import { calcScore, judgeNote, getStarRating } from '@/engines/judgment/judgmentEngine'
import type { NoteResult, ScoreNote, Verdict } from '@/types'

const result = (noteIndex: number, verdict: Verdict, timingDeltaMs = 0): NoteResult => ({
  noteIndex, noteNumber: 60, expectedTimeMs: 0, actualTimeMs: timingDeltaMs, timingDeltaMs, verdict,
})

describe('judgeNote', () => {
  const target: ScoreNote = { index: 0, noteNumber: 60, startTimeMs: 1000, durationMs: 500, hand: 'right', measure: 0, beat: 0 }
  const at = (noteNumber: number, timestamp: number) =>
    judgeNote({ noteNumber, timestamp, velocity: 100, type: 'on', channel: 0, source: 'virtual' }, target)

  it('오차 30ms 이내는 perfect, 허용 오차 이내는 good', () => {
    expect(at(60, 1020).verdict).toBe('perfect')
    expect(at(60, 1080).verdict).toBe('good')
  })
  it('허용 오차를 넘으면 늦으면 late, 빠르면 early', () => {
    expect(at(60, 1200).verdict).toBe('late')
    expect(at(60, 800).verdict).toBe('early')
  })
  it('다른 건반이면 시간과 상관없이 miss', () => {
    expect(at(61, 1000).verdict).toBe('miss')
  })
})

describe('calcScore', () => {
  it('곡 전체를 정확한 타이밍으로 치면 100점', () => {
    const results = [0, 1, 2, 3].map((i) => result(i, 'perfect'))
    expect(calcScore(results, 4)).toEqual({ pitchAccuracy: 100, timingAccuracy: 100, completionRate: 100, total: 100 })
  })

  it('중간에 끝내면 완주율이 낮아진다 (예전에는 결과 개수를 전체로 써서 항상 100%)', () => {
    const results = [0, 1].map((i) => result(i, 'perfect'))
    const score = calcScore(results, 8)
    expect(score.completionRate).toBe(25)
    expect(score.pitchAccuracy).toBe(100)
  })

  it('틀린 건반은 음정 정확도만 깎고, 같은 음표를 결국 맞히면 완주로 센다', () => {
    const results = [result(0, 'perfect'), result(1, 'miss'), result(1, 'good', 50)]
    const score = calcScore(results, 2)
    expect(score.pitchAccuracy).toBe(67)        // 누른 3번 중 2번 맞음
    expect(score.completionRate).toBe(100)      // 음표 2개 모두 맞힘
    expect(score.timingAccuracy).toBe(95)       // 평균 오차 25ms → 100 - 25/5
  })

  it('자동으로 지나간 skip은 음정 정확도에서 빼고 완주율에서만 깎는다', () => {
    const results = [result(0, 'perfect'), result(1, 'skip'), result(2, 'perfect'), result(3, 'skip')]
    const score = calcScore(results, 4)
    expect(score.pitchAccuracy).toBe(100)
    expect(score.completionRate).toBe(50)
  })

  it('하나도 못 맞히면 타이밍 점수도 0 (예전에는 오차 0으로 쳐서 100점)', () => {
    const score = calcScore([result(0, 'miss'), result(0, 'miss')], 4)
    expect(score).toEqual({ pitchAccuracy: 0, timingAccuracy: 0, completionRate: 0, total: 0 })
  })

  it('가중치: 음정 50% + 타이밍 30% + 완주율 20%', () => {
    // 음정 100, 타이밍 80(평균 오차 100ms), 완주율 50
    const results = [result(0, 'good', 100), result(1, 'good', -100)]
    expect(calcScore(results, 4).total).toBe(Math.round(100 * 0.5 + 80 * 0.3 + 50 * 0.2))
  })

  it('기록이 없거나 음표 수가 0이면 0점', () => {
    expect(calcScore([], 4).total).toBe(0)
    expect(calcScore([result(0, 'perfect')], 0).total).toBe(0)
  })
})

describe('getStarRating', () => {
  it('90/70/50점 경계', () => {
    expect([95, 90, 89, 70, 69, 50, 49].map(getStarRating)).toEqual([3, 3, 2, 2, 1, 1, 0])
  })
})
