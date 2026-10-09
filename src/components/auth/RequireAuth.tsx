import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getToken, fetchCurrentUser, getSongs } from '@/api'
import { ApiError } from '@/api/client'
import { useAppStore } from '@/store/useAppStore'

// 로그인이 필요한 화면의 입구.
// 사용자 정보·곡 목록을 홈 화면에서만 불러오던 때에는, 홈을 거치지 않고 다른 화면에서 새로고침하면
// 데이터가 비어 연습 화면이 "곡을 불러오는 중"에서 멈추고, 설정 화면은 기본값으로 덮어쓸 위험이 있었다.
// 그래서 어느 화면으로 들어오든 여기서 먼저 불러온 뒤 화면을 보여준다.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAppStore((s) => s.user)
  const songs = useAppStore((s) => s.songs)
  const setUser = useAppStore((s) => s.setUser)
  const setSongs = useAppStore((s) => s.setSongs)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)

  const hasToken = Boolean(getToken())
  const ready = user !== null && songs.length > 0

  const load = useCallback(async () => {
    setError(null)
    try {
      const [u, all] = await Promise.all([fetchCurrentUser(), getSongs()])
      setUser(u)
      setSongs(all)
    } catch (err) {
      // 401이면 apiFetch가 토큰을 지운다 → 로그인 화면으로
      if (err instanceof ApiError && err.status === 401) {
        setExpired(true)
        return
      }
      setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.')
    }
  }, [setUser, setSongs])

  useEffect(() => {
    if (hasToken && !ready) load()
  }, [hasToken, ready, load])

  if (!hasToken || expired) {
    return <Navigate to="/login" replace />
  }
  if (error) {
    return (
      <div className="app-loading">
        <p>{error}</p>
        <button className="btn btn--primary" onClick={load}>다시 시도</button>
      </div>
    )
  }
  if (!ready) {
    return <div className="app-loading"><p>불러오는 중...</p></div>
  }
  return <>{children}</>
}
