import { apiFetch, setToken, clearToken, getToken } from './client'
import type { User, Song, PracticeSession, UserSettings } from '@/types'
import { toLocalDateString } from '@/utils/date'

export { getToken, clearToken }

export interface SignupInput {
  username: string
  password: string
  nickname: string
  signupNote?: string
  agreeTerms: boolean
  agreePrivacy: boolean
}

// 가입만 하고 토큰은 받지 않는다 — 관리자 승인 후 로그인
export async function signup(input: SignupInput): Promise<{ status: 'pending'; message: string }> {
  return apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(input) })
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const { token } = await apiFetch<{ token: string }>('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  setToken(token) // 다른 기기의 토큰은 무효가 되고 이 기기는 새 토큰으로 계속 쓴다
}

// ── 관리자 ─────────────────────────────────────────
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

export interface AdminUser {
  id: string
  username: string
  nickname: string
  role: 'user' | 'admin'
  status: UserStatus
  signupNote: string | null
  rejectReason: string | null
  level: number
  totalXP: number
  sessionCount?: number
  approvedAt: string | null
  lastLoginAt: string | null
  createdAt: string
}

export interface AuditItem {
  id: number
  action: string
  targetId: string | null
  detail: Record<string, unknown> | null
  ip: string | null
  createdAt: string
  actorUsername: string | null
  targetUsername: string | null
}

const post = <T,>(path: string, body: unknown = {}) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const adminApi = {
  stats: () => apiFetch<{ users: { total: number; pending: number; byStatus: Record<string, number> }; today: { signups: number; logins: number; sessions: number } }>('/admin/stats'),
  users: (status: string, q: string) =>
    apiFetch<{ items: AdminUser[] }>(`/admin/users?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) })}`),
  approve: (id: string) => post(`/admin/users/${id}/approve`),
  reject: (id: string, reason: string) => post(`/admin/users/${id}/reject`, { reason }),
  suspend: (id: string) => post(`/admin/users/${id}/suspend`),
  unsuspend: (id: string) => post(`/admin/users/${id}/unsuspend`),
  bulkApprove: (userIds: string[]) => post<{ approved: number }>('/admin/users/bulk-approve', { userIds }),
  tempPassword: (id: string) => post<{ tempPassword: string }>(`/admin/users/${id}/temp-password`),
  audit: (action: string) => apiFetch<{ items: AuditItem[] }>(`/admin/audit${action ? `?action=${encodeURIComponent(action)}` : ''}`),
}

export async function login(username: string, password: string): Promise<User> {
  const { token, user } = await apiFetch<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
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
