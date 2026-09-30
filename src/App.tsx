import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { HomeScreen } from '@/screens/HomeScreen'
import { LibraryScreen } from '@/screens/LibraryScreen'
import { PracticeScreen } from '@/screens/PracticeScreen'
import { ResultsScreen } from '@/screens/ResultsScreen'
import { CurriculumScreen } from '@/screens/CurriculumScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { FreePlayScreen } from '@/screens/FreePlayScreen'
import { LoginScreen } from '@/screens/LoginScreen'
import { SignupScreen } from '@/screens/SignupScreen'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { audioEngine } from '@/engines/audio/audioEngine'

export function App() {
  const [audioReady, setAudioReady] = useState(false)

  useEffect(() => {
    const handle = async () => {
      await audioEngine.init()
      setAudioReady(true)
      document.removeEventListener('click', handle)
      document.removeEventListener('touchstart', handle)
      document.removeEventListener('keydown', handle)
    }
    document.addEventListener('click', handle)
    document.addEventListener('touchstart', handle)
    document.addEventListener('keydown', handle)
    return () => {
      document.removeEventListener('click', handle)
      document.removeEventListener('touchstart', handle)
      document.removeEventListener('keydown', handle)
    }
  }, [])

  return (
    <>
      {!audioReady && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#1e3a5f', color: '#93c5fd', textAlign: 'center',
          padding: '6px', fontSize: '0.8rem', cursor: 'pointer',
        }}>
          🔊 화면 어디든 클릭하면 소리가 활성화됩니다 (MIDI 포함)
        </div>
      )}
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        <Route path="/" element={<RequireAuth><HomeScreen /></RequireAuth>} />
        <Route path="/library" element={<RequireAuth><LibraryScreen /></RequireAuth>} />
        <Route path="/practice/:songId" element={<RequireAuth><PracticeScreen /></RequireAuth>} />
        <Route path="/results/:sessionId" element={<RequireAuth><ResultsScreen /></RequireAuth>} />
        <Route path="/curriculum" element={<RequireAuth><CurriculumScreen /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsScreen /></RequireAuth>} />
        <Route path="/freeplay" element={<RequireAuth><FreePlayScreen /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
