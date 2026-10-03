import { describe, it, expect } from 'vitest'
import { toLocalDateString, currentStreak } from '@/utils/date'

describe('toLocalDateString', () => {
  it('현지 시각 기준 YYYY-MM-DD (UTC 변환 없음)', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05')
    expect(toLocalDateString(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })
})

describe('currentStreak', () => {
  it('오늘이나 어제 연습했으면 저장된 스트릭 그대로', () => {
    expect(currentStreak(5, '2026-10-03', '2026-10-03')).toBe(5)
    expect(currentStreak(5, '2026-10-02', '2026-10-03')).toBe(5)
  })
  it('이틀 이상 쉬었으면 끊긴 것이므로 0', () => {
    expect(currentStreak(5, '2026-10-01', '2026-10-03')).toBe(0)
  })
  it('연습한 적 없으면 0', () => {
    expect(currentStreak(0, '', '2026-10-03')).toBe(0)
  })
})
