// 날짜는 UTC가 아닌 사용자 현지 날짜 기준 'YYYY-MM-DD'로 다룬다 (스트릭 계산용)

export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dayNumber(dateStr: string): number {
  return Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / 86_400_000)
}

// 화면에 보여줄 현재 스트릭. 서버의 streak 값은 마지막 연습 때 계산된 값이라,
// 그 뒤로 하루 이상 쉬었으면 이미 끊긴 것으로 보고 0을 보여준다.
export function currentStreak(streak: number, lastPracticeDate: string, today: string = toLocalDateString()): number {
  if (!lastPracticeDate) return 0
  return dayNumber(today) - dayNumber(lastPracticeDate) <= 1 ? streak : 0
}
