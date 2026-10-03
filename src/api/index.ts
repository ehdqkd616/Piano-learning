import { apiFetch, setToken, clearToken, getToken } from './client'
import type { User, Song, PracticeSession, UserSettings } from '@/types'
import { toLocalDateString } from '@/utils/date'

export { getToken, clearToken }

export async function signup(email: string, password: string, nickname: string): Promise<User> {
  const { token, user } = await apiFetch<{ token: string; user: User }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, nickname }),
  })
  setToken(token)
  return user
}

export async function login(email: string, password: string): Promise<User> {
  const { token, user } = await apiFetch<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(token)
  return user
}

export function logout() {
  clearToken()
}

export async function fetchCurrentUser(): Promise<User> {
  const { user } = await apiFetch<{ user: User }>('/auth/me')
  return user
}

export async function updateUserSettings(partial: { nickname?: string; settings?: Partial<UserSettings> }): Promise<User> {
  const { user } = await apiFetch<{ user: User }>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(partial),
  })
  return user
}

export async function getSongs(): Promise<Song[]> {
  const { songs } = await apiFetch<{ songs: Song[] }>('/songs')
  return songs
}

export async function getSong(songId: string): Promise<Song> {
  const { song } = await apiFetch<{ song: Song }>(`/songs/${songId}`)
  return song
}

export async function toggleFavoriteSong(songId: string): Promise<boolean> {
  const { isFavorite } = await apiFetch<{ isFavorite: boolean }>(`/songs/${songId}/favorite`, { method: 'POST' })
  return isFavorite
}

export async function saveSession(session: PracticeSession): Promise<User> {
  const { user } = await apiFetch<{ session: PracticeSession; user: User }>('/sessions', {
    method: 'POST',
    // 스트릭은 서버 UTC가 아니라 사용자 현지 날짜 기준으로 센다
    body: JSON.stringify({ ...session, localDate: toLocalDateString() }),
  })
  return user
}

export async function getSession(sessionId: string): Promise<PracticeSession> {
  const { session } = await apiFetch<{ session: PracticeSession }>(`/sessions/${sessionId}`)
  return session
}
