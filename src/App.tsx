import { Routes, Route, Navigate } from 'react-router-dom'
import { HomeScreen } from '@/screens/HomeScreen'
import { LibraryScreen } from '@/screens/LibraryScreen'
import { PracticeScreen } from '@/screens/PracticeScreen'
import { ResultsScreen } from '@/screens/ResultsScreen'
import { CurriculumScreen } from '@/screens/CurriculumScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/library" element={<LibraryScreen />} />
      <Route path="/practice/:songId" element={<PracticeScreen />} />
      <Route path="/results/:sessionId" element={<ResultsScreen />} />
      <Route path="/curriculum" element={<CurriculumScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
