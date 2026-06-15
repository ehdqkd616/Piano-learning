import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { db, initUserProfile } from '@/db'
import { DEMO_SONGS } from '@/data/demoSongs'
import './HomeScreen.css'

export function HomeScreen() {
  const navigate = useNavigate()
  const { user, songs, setUser, setSongs } = useAppStore()

  useEffect(() => {
    async function init() {
      const u = await initUserProfile()
      setUser(u)

      // 데모 곡이 없으면 시드
      const count = await db.songs.count()
      if (count === 0) {
        await db.songs.bulkPut(DEMO_SONGS)
      }
      const all = await db.songs.toArray()
      setSongs(all)
    }
    init()
  }, [setUser, setSongs])

  const todaySong = songs[0]
  const recentSongs = songs.slice(0, 3)

  return (
    <div className="home-screen">
      {/* 사이드바 */}
      <nav className="sidebar">
        <div className="sidebar__logo">🎹 Piano</div>
        <ul className="sidebar__menu">
          <li className="sidebar__item sidebar__item--active">홈</li>
          <li className="sidebar__item" onClick={() => navigate('/freeplay')}>자유 연주 🎹</li>
          <li className="sidebar__item" onClick={() => navigate('/library')}>라이브러리</li>
          <li className="sidebar__item" onClick={() => navigate('/curriculum')}>커리큘럼</li>
          <li className="sidebar__item" onClick={() => navigate('/settings')}>설정</li>
        </ul>
        {user && (
          <div className="sidebar__profile">
            <div className="profile-avatar">🎵</div>
            <div>
              <div className="profile-name">{user.nickname}</div>
              <div className="profile-level">Lv.{user.level}</div>
            </div>
          </div>
        )}
      </nav>

      {/* 메인 콘텐츠 */}
      <main className="home-main">
        <header className="home-header">
          <h1>안녕하세요, {user?.nickname ?? '피아니스트'}님 👋</h1>
          <p className="home-header__sub">오늘도 연습해 볼까요?</p>
        </header>

        {/* 통계 카드 */}
        <section className="stats-row">
          <div className="stat-card">
            <div className="stat-card__value">{user?.totalXP ?? 0}</div>
            <div className="stat-card__label">총 XP</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{user?.streak ?? 0}</div>
            <div className="stat-card__label">연속 연습일 🔥</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">Lv.{user?.level ?? 1}</div>
            <div className="stat-card__label">현재 레벨</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{songs.length}</div>
            <div className="stat-card__label">보유 곡</div>
          </div>
        </section>

        {/* 오늘의 추천 */}
        {todaySong && (
          <section className="today-section">
            <h2>오늘의 추천 연습</h2>
            <div
              className="today-card"
              onClick={() => navigate(`/practice/${todaySong.songId}`)}
            >
              <div className="today-card__info">
                <h3>{todaySong.title}</h3>
                <p>{todaySong.artist}</p>
                <div className="today-card__tags">
                  <span className="tag">난이도 {todaySong.difficulty}</span>
                  <span className="tag">{todaySong.genre}</span>
                  <span className="tag">♩ {todaySong.bpm}</span>
                </div>
              </div>
              <button className="btn btn--primary">시작하기 →</button>
            </div>
          </section>
        )}

        {/* 최근 곡 */}
        <section className="recent-section">
          <div className="section-header">
            <h2>곡 라이브러리</h2>
            <button className="btn-text" onClick={() => navigate('/library')}>전체 보기</button>
          </div>
          <div className="song-grid">
            {recentSongs.map((song) => (
              <div
                key={song.songId}
                className="song-card"
                onClick={() => navigate(`/practice/${song.songId}`)}
              >
                <div className="song-card__emoji">🎵</div>
                <h4>{song.title}</h4>
                <p>{song.artist}</p>
                <div className="difficulty-bar">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className={`difficulty-bar__dot ${i < song.difficulty ? 'difficulty-bar__dot--filled' : ''}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
