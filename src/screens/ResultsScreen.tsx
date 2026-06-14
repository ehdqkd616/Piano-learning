import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '@/db'
import { calcScore, getStarRating } from '@/engines/judgment/judgmentEngine'
import type { PracticeSession, Song } from '@/types'
import './ResultsScreen.css'

const VERDICT_LABEL: Record<string, string> = {
  perfect: '완벽', good: '양호', late: '늦음', early: '빠름', miss: '오음', skip: '누락',
}

const VERDICT_COLOR: Record<string, string> = {
  perfect: '#4ade80', good: '#86efac', late: '#facc15',
  early: '#facc15', miss: '#f87171', skip: '#94a3b8',
}

export function ResultsScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [song, setSong] = useState<Song | null>(null)

  useEffect(() => {
    async function load() {
      if (!sessionId) return
      const s = await db.sessions.get(sessionId)
      if (!s) return
      setSession(s)
      const sg = await db.songs.get(s.songId)
      if (sg) setSong(sg)
    }
    load()
  }, [sessionId])

  if (!session || !song) {
    return (
      <div className="results-screen results-screen--loading">
        <p>결과를 불러오는 중...</p>
      </div>
    )
  }

  const score = calcScore(session.noteResults, session.noteResults.length || 1)
  const stars = getStarRating(score.total)

  const verdictCounts = session.noteResults.reduce<Record<string, number>>((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="results-screen">
      <header className="results-header">
        <button className="btn-icon" onClick={() => navigate('/')}>← 홈</button>
        <h1>연습 결과</h1>
      </header>

      <div className="results-content">
        {/* 곡 정보 */}
        <div className="results-song-info">
          <h2>{song.title}</h2>
          <p>{song.artist}</p>
        </div>

        {/* 별점 */}
        <div className="results-stars">
          {[1, 2, 3].map((i) => (
            <span key={i} className={`star ${i <= stars ? 'star--filled' : ''}`}>★</span>
          ))}
        </div>

        {/* 총점 */}
        <div className="results-total-score">
          <div className="results-total-score__value">{score.total}</div>
          <div className="results-total-score__label">총점</div>
        </div>

        {/* 세부 점수 */}
        <div className="score-breakdown">
          <ScoreBar label="음정 정확도" value={score.pitchAccuracy} color="#60b8ff" />
          <ScoreBar label="타이밍 정확도" value={score.timingAccuracy} color="#4ade80" />
          <ScoreBar label="완주율" value={score.completionRate} color="#facc15" />
        </div>

        {/* 판정 분포 */}
        <div className="verdict-breakdown">
          <h3>음표별 판정</h3>
          <div className="verdict-grid">
            {Object.entries(verdictCounts).map(([verdict, count]) => (
              <div key={verdict} className="verdict-chip" style={{ borderColor: VERDICT_COLOR[verdict] }}>
                <span style={{ color: VERDICT_COLOR[verdict] }}>{VERDICT_LABEL[verdict] ?? verdict}</span>
                <span className="verdict-chip__count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI 코멘트 */}
        <div className="ai-comment">
          <h3>💡 개선 포인트</h3>
          <p>{generateComment(score)}</p>
        </div>

        {/* 액션 버튼 */}
        <div className="results-actions">
          <button className="btn btn--primary" onClick={() => navigate(`/practice/${song.songId}`)}>
            다시 연습하기
          </button>
          <button className="btn" onClick={() => navigate('/library')}>
            다른 곡 선택
          </button>
          <button className="btn" onClick={() => navigate('/')}>
            홈으로
          </button>
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="score-bar">
      <div className="score-bar__label">
        <span>{label}</span>
        <span style={{ color }}>{value}점</span>
      </div>
      <div className="score-bar__track">
        <div className="score-bar__fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}

function generateComment(score: ReturnType<typeof calcScore>): string {
  if (score.total >= 90) return '훌륭합니다! 거의 완벽한 연주였어요. 더 빠른 템포에 도전해 보세요!'
  if (score.pitchAccuracy < 70) return '음정 정확도를 높이는 데 집중해 보세요. Wait Mode로 천천히 연습하면 도움이 됩니다.'
  if (score.timingAccuracy < 60) return '타이밍 연습이 필요합니다. 템포를 50%로 낮추고 메트로놈과 함께 연습해 보세요.'
  if (score.completionRate < 80) return '끝까지 완주하는 연습을 해 보세요. 구간 반복으로 어려운 부분을 집중 연습하세요.'
  return '좋은 연주였어요! 꾸준히 연습하면 더욱 향상될 거예요.'
}
