import { describe, it, expect } from 'vitest'
import { nextStreak, isPlausibleLocalDate } from '../src/streak'

describe('nextStreak', () => {
  it('처음 연습하면 1', () => {
    expect(nextStreak(0, null, '2026-10-01')).toBe(1)
  })
  it('오늘 이미 연습했으면 그대로', () => {
    expect(nextStreak(3, '2026-10-01', '2026-10-01')).toBe(3)
  })
  it('어제 연습했으면 +1', () => {
    expect(nextStreak(3, '2026-09-30', '2026-10-01')).toBe(4)
  })
  it('하루라도 쉬면 1부터 다시 (예전 코드는 계속 +1 되던 버그)', () => {
    expect(nextStreak(3, '2026-09-29', '2026-10-01')).toBe(1)
    expect(nextStreak(10, '2026-01-01', '2026-10-01')).toBe(1)
  })
  it('월말·연말을 넘어가도 연속으로 센다', () => {
    expect(nextStreak(5, '2026-09-30', '2026-10-01')).toBe(6)
    expect(nextStreak(5, '2026-12-31', '2027-01-01')).toBe(6)
  })
  it('날짜가 뒤로 가도(시간대 이동) 스트릭을 깨지 않는다', () => {
    expect(nextStreak(4, '2026-10-02', '2026-10-01')).toBe(4)
  })
})

describe('isPlausibleLocalDate', () => {
  const now = new Date('2026-10-01T23:30:00Z')
  it('UTC 기준 ±1일 안의 날짜만 받는다', () => {
    expect(isPlausibleLocalDate('2026-10-01', now)).toBe(true)
    expect(isPlausibleLocalDate('2026-10-02', now)).toBe(true)   // 한국은 이미 10/2 08:30
    expect(isPlausibleLocalDate('2026-09-30', now)).toBe(true)
    expect(isPlausibleLocalDate('2026-10-03', now)).toBe(false)
    expect(isPlausibleLocalDate('2026-09-29', now)).toBe(false)
  })
  it('형식이 틀리면 거부', () => {
    expect(isPlausibleLocalDate('2026/10/01', now)).toBe(false)
    expect(isPlausibleLocalDate('2026-13-45', now)).toBe(false)
    expect(isPlausibleLocalDate(20261001, now)).toBe(false)
  })
})
