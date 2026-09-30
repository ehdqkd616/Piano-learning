// 곡 카탈로그 시드 데이터 — 서버 부팅 시 항상 이 목록으로 upsert된다.
// notes: 저작권 문제가 없는(저작권 만료 고전곡 또는 한국 전래동요) 실제 멜로디를
// { noteNumber(MIDI), beats(4분음표 기준 박자 수) } 배열로 단순화해 담는다.
const q = (noteNumber) => ({ noteNumber, beats: 1 })

const SEED_SONGS = [
  {
    songId: 'song-1', title: '도레미 송', artist: '연습곡', genre: '동요', difficulty: 1,
    bpm: 90, keySignature: 'C', timeSignature: '4/4', tags: ['초보', '단음', '동요'],
    notes: [60, 62, 64, 65, 67, 69, 71, 72].map(q),
  },
  {
    songId: 'song-2', title: '반짝반짝 작은 별', artist: 'Traditional (Mozart 변주곡)', genre: '동요', difficulty: 1,
    bpm: 100, keySignature: 'C', timeSignature: '4/4', tags: ['초보', '동요'],
    notes: [
      60, 60, 67, 67, 69, 69, 67,
      65, 65, 64, 64, 62, 62, 60,
      67, 67, 65, 65, 64, 64, 62,
      67, 67, 65, 65, 64, 64, 62,
      60, 60, 67, 67, 69, 69, 67,
      65, 65, 64, 64, 62, 62, 60,
    ].map(q),
  },
  {
    songId: 'song-3', title: '엘리제를 위하여', artist: 'Beethoven', genre: '클래식', difficulty: 3,
    bpm: 70, keySignature: 'Am', timeSignature: '3/8', tags: ['클래식', '베토벤'],
    notes: [76, 75, 76, 75, 76, 71, 74, 72, 69, 60, 64, 69, 71].map(q),
  },
  {
    songId: 'song-4', title: '미뉴에트 G장조', artist: 'Bach/Petzold', genre: '클래식', difficulty: 2,
    bpm: 120, keySignature: 'G', timeSignature: '3/4', tags: ['클래식', '바흐'],
    notes: [74, 67, 69, 71, 72, 74, 67, 67, 76, 72, 74, 76, 78, 79, 67, 67].map(q),
  },
  {
    songId: 'song-5', title: '학교종', artist: '한국 전래동요', genre: '동요', difficulty: 2,
    bpm: 100, keySignature: 'C', timeSignature: '4/4', tags: ['동요', '전래', '한국'],
    notes: [
      67, 67, 67, 72, 74, 76,
      76, 74, 72, 74, 76,
      67, 67, 67, 72, 74, 76,
      76, 74, 72, 74, 72,
    ].map(q),
  },
  {
    songId: 'song-6', title: 'Greensleeves', artist: 'Traditional (English)', genre: '포크', difficulty: 4,
    bpm: 96, keySignature: 'Am', timeSignature: '4/4', tags: ['포크', '전통'],
    notes: [69, 72, 74, 76, 77, 76, 74, 71, 67, 69, 71, 72, 69].map(q),
  },
  {
    songId: 'song-7', title: '월광 소나타 (1악장 테마)', artist: 'Beethoven', genre: '클래식', difficulty: 6,
    bpm: 54, keySignature: 'C#m', timeSignature: '4/4', tags: ['클래식', '베토벤', '소나타'],
    notes: [61, 68, 64, 68, 61, 68, 64, 68, 61, 68, 64, 68, 59, 68, 64, 68].map(q),
  },
  {
    songId: 'song-8', title: '터키 행진곡', artist: 'Mozart', genre: '클래식', difficulty: 5,
    bpm: 144, keySignature: 'Am', timeSignature: '2/4', tags: ['클래식', '모차르트'],
    notes: [71, 72, 74, 72, 71, 69, 68, 69, 71, 72, 74, 72, 71, 69, 68, 69].map(q),
  },
]

module.exports = { SEED_SONGS }
