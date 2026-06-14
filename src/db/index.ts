import Dexie, { type Table } from 'dexie'
import type { Song, PracticeSession, Achievement, User } from '@/types'

class PianoDatabase extends Dexie {
  songs!: Table<Song, string>
  sessions!: Table<PracticeSession, string>
  achievements!: Table<Achievement, string>
  userProfile!: Table<User, string>

  constructor() {
    super('PianoLearningDB')
    this.version(1).stores({
      songs: 'songId, title, artist, genre, difficulty, tags',
      sessions: 'sessionId, userId, songId, startedAt, totalScore',
      achievements: 'id, unlockedAt',
      userProfile: 'userId',
    })
  }
}

export const db = new PianoDatabase()

// ─── 기본 사용자 프로필 초기화 ────────────────────────────────────────────

export async function initUserProfile(): Promise<User> {
  const existing = await db.userProfile.toArray()
  if (existing.length > 0) return existing[0]

  const defaultUser: User = {
    userId: 'local-user',
    nickname: '피아니스트',
    level: 1,
    totalXP: 0,
    streak: 0,
    lastPracticeDate: '',
    settings: {
      inputMode: 'midi',
      bpm: 100,
      viewMode: 'falling',
      handSplit: 'both',
      micSensitivity: 0.5,
      timingTolerance: 100,
    },
  }
  await db.userProfile.add(defaultUser)
  return defaultUser
}

export async function updateUserSettings(settings: Partial<User['settings']>) {
  const user = await db.userProfile.get('local-user')
  if (!user) return
  await db.userProfile.update('local-user', {
    settings: { ...user.settings, ...settings },
  })
}

export async function saveSession(session: PracticeSession) {
  await db.sessions.put(session)
  // XP 부여: totalScore 기준 (100점 → 50 XP)
  const xpGained = Math.floor(session.totalScore / 2)
  const user = await db.userProfile.get('local-user')
  if (!user) return
  const today = new Date().toISOString().split('T')[0]
  const newStreak = user.lastPracticeDate === today ? user.streak : user.streak + 1
  await db.userProfile.update('local-user', {
    totalXP: user.totalXP + xpGained,
    lastPracticeDate: today,
    streak: newStreak,
    level: Math.floor((user.totalXP + xpGained) / 500) + 1,
  })
}
