// 연속 연습일(스트릭) 계산. 날짜는 모두 사용자 현지 기준 'YYYY-MM-DD' 문자열이다.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

function toDayNumber(dateStr) {
  return Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / DAY_MS)
}

function isValidDateString(value) {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

// 클라이언트가 보낸 현지 날짜가 서버 UTC 날짜 기준 ±1일 안에 있는지 확인한다.
// 전 세계 시간대(UTC-12 ~ UTC+14)는 이 범위 안에 들어오므로, 벗어나면 조작된 값으로 본다.
function isPlausibleLocalDate(localDate, now = new Date()) {
  if (!isValidDateString(localDate)) return false
  const utcToday = toDayNumber(now.toISOString().slice(0, 10))
  return Math.abs(toDayNumber(localDate) - utcToday) <= 1
}

// 오늘 연습을 기록한 뒤의 스트릭.
// - 오늘 이미 연습했으면 그대로
// - 마지막 연습이 어제면 +1
// - 그 외(처음이거나 하루 이상 쉬었으면) 1부터 다시
function nextStreak(currentStreak, lastPracticeDate, today) {
  if (!lastPracticeDate) return 1
  const gap = toDayNumber(today) - toDayNumber(lastPracticeDate)
  if (gap <= 0) return Math.max(currentStreak, 1)
  if (gap === 1) return currentStreak + 1
  return 1
}

module.exports = { isValidDateString, isPlausibleLocalDate, nextStreak }
