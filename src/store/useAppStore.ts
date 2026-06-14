import { create } from 'zustand'
import type { User, Song } from '@/types'

interface AppState {
  user: User | null
  songs: Song[]
  isLoading: boolean
  error: string | null

  setUser: (user: User) => void
  updateUser: (partial: Partial<User>) => void
  setSongs: (songs: Song[]) => void
  addSong: (song: Song) => void
  toggleFavorite: (songId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  songs: [],
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  updateUser: (partial) => set((state) => ({
    user: state.user ? { ...state.user, ...partial } : null,
  })),
  setSongs: (songs) => set({ songs }),
  addSong: (song) => set((state) => ({ songs: [...state.songs, song] })),
  toggleFavorite: (songId) => set((state) => ({
    songs: state.songs.map((s) =>
      s.songId === songId ? { ...s, isFavorite: !s.isFavorite } : s,
    ),
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}))
