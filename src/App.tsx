import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { HomeScreen } from '@/screens/HomeScreen'
import { LibraryScreen } from '@/screens/LibraryScreen'
import { PracticeScreen } from '@/screens/PracticeScreen'
import { ResultsScreen } from '@/screens/ResultsScreen'
import { CurriculumScreen } from '@/screens/CurriculumScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { FreePlayScreen } from '@/screens/FreePlayScreen'
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
        <Route path="/" element={<HomeScreen />} />
        <Route path="/library" element={<LibraryScreen />} />
        <Route path="/practice/:songId" element={<PracticeScreen />} />
        <Route path="/results/:sessionId" element={<ResultsScreen />} />
        <Route path="/curriculum" element={<CurriculumScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/freeplay" element={<FreePlayScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
