import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import './CurriculumScreen.css'

const LEVELS = [
  {
    level: 1, title: '입문', description: '기본 자세와 도레미파솔',
    songs: ['song-1', 'song-2'], requiredXP: 0,
  },
  {
    level: 2, title: '초급', description: '양손 연습과 간단한 멜로디',
    songs: ['song-3', 'song-4'], requiredXP: 200,
  },
  {
    level: 3, title: '초중급', description: '화음과 리듬 패턴',
    songs: ['song-5', 'song-6'], requiredXP: 600,
  },
  {
    level: 4, title: '중급', description: '클래식 소품과 K-POP',
    songs: [], requiredXP: 1200,
  },
  {
    level: 5, title: '중고급', description: '소나타 형식과 반주 패턴',
    songs: [], requiredXP: 2500,
  },
]

export function CurriculumScreen() {
  const navigate = useNavigate()
  const user = useAppStore((s) => s.user)
  const xp = user?.totalXP ?? 0

  return (
    <div className="curriculum-screen">
      <header className="curriculum-header">
        <button className="btn-icon" onClick={() => navigate('/')}>← 홈</button>
        <h1>커리큘럼</h1>
        <span className="xp-badge">XP {xp}</span>
      </header>

      <div className="curriculum-content">
        <div className="curriculum-intro">
          <p>단계별로 체계적으로 배워나가세요.</p>
          <div className="xp-progress">
            <div className="xp-progress__label">
              <span>Lv.{user?.level ?? 1}</span>
              <span>{xp} XP</span>
            </div>
            <div className="xp-progress__track">
              <div
                className="xp-progress__fill"
                style={{ width: `${Math.min(100, (xp % 500) / 5)}%` }}
              />
            </div>
            <p className="xp-progress__hint">다음 레벨까지 {500 - (xp % 500)} XP</p>
          </div>
        </div>

        <div className="level-list">
          {LEVELS.map((lvl) => {
            const unlocked = xp >= lvl.requiredXP
            return (
              <div
                key={lvl.level}
                className={`level-card ${unlocked ? '' : 'level-card--locked'}`}
              >
                <div className="level-card__number">
                  {unlocked ? lvl.level : '🔒'}
                </div>
                <div className="level-card__info">
                  <h3>{lvl.title}</h3>
                  <p>{lvl.description}</p>
                  {!unlocked && (
                    <p className="level-card__req">필요 XP: {lvl.requiredXP}</p>
                  )}
                </div>
                <div className="level-card__action">
                  {unlocked ? (
                    <button
                      className="btn btn--primary"
                      onClick={() => navigate('/library')}
                    >
                      학습하기
                    </button>
                  ) : (
                    <span className="lock-badge">잠금</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
