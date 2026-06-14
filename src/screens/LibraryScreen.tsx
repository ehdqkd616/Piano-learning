import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import './LibraryScreen.css'

const GENRES = ['전체', '클래식', 'K-POP', '팝', '동요']

export function LibraryScreen() {
  const navigate = useNavigate()
  const { songs, toggleFavorite } = useAppStore()
  const [genre, setGenre] = useState('전체')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'title' | 'difficulty'>('title')

  const filtered = songs
    .filter((s) => genre === '전체' || s.genre === genre)
    .filter((s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sortBy === 'title'
        ? a.title.localeCompare(b.title)
        : a.difficulty - b.difficulty,
    )

  return (
    <div className="library-screen">
      <header className="library-header">
        <button className="btn-icon" onClick={() => navigate('/')}>← 홈</button>
        <h1>라이브러리</h1>
      </header>

      <div className="library-toolbar">
        <input
          className="search-input"
          placeholder="곡 또는 아티스트 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="genre-tabs">
          {GENRES.map((g) => (
            <button
              key={g}
              className={`genre-tab ${genre === g ? 'genre-tab--active' : ''}`}
              onClick={() => setGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>
        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'title' | 'difficulty')}
        >
          <option value="title">이름순</option>
          <option value="difficulty">난이도순</option>
        </select>
      </div>

      <div className="library-list">
        {filtered.length === 0 && (
          <p className="library-empty">검색 결과가 없습니다.</p>
        )}
        {filtered.map((song) => (
          <div key={song.songId} className="library-item">
            <div className="library-item__icon">🎵</div>
            <div className="library-item__info" onClick={() => navigate(`/practice/${song.songId}`)}>
              <h3>{song.title}</h3>
              <p>{song.artist} · {song.genre} · 난이도 {song.difficulty}/10 · ♩{song.bpm}</p>
            </div>
            <div className="library-item__actions">
              <button
                className={`btn-favorite ${song.isFavorite ? 'btn-favorite--active' : ''}`}
                onClick={() => toggleFavorite(song.songId)}
              >
                {song.isFavorite ? '★' : '☆'}
              </button>
              <button
                className="btn btn--primary"
                onClick={() => navigate(`/practice/${song.songId}`)}
              >
                연습
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
