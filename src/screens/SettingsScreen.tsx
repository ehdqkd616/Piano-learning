import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { midiEngine } from '@/engines/input/midiEngine'
import { db } from '@/db'
import type { UserSettings } from '@/types'
import './SettingsScreen.css'

export function SettingsScreen() {
  const navigate = useNavigate()
  const { user, updateUser } = useAppStore()
  const [settings, setSettings] = useState<UserSettings>(
    user?.settings ?? {
      inputMode: 'midi', bpm: 100, viewMode: 'falling',
      handSplit: 'both', micSensitivity: 0.5, timingTolerance: 100,
    },
  )
  const [midiInputs, setMidiInputs] = useState<MIDIInput[]>([])
  const [nickname, setNickname] = useState(user?.nickname ?? '피아니스트')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    midiEngine.init()
      .then((inputs) => setMidiInputs(inputs))
      .catch(() => setMidiInputs([]))
  }, [])

  const handleSave = async () => {
    updateUser({ nickname, settings })
    await db.userProfile.update('local-user', { nickname, settings })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="settings-screen">
      <header className="settings-header">
        <button className="btn-icon" onClick={() => navigate('/')}>← 홈</button>
        <h1>설정</h1>
        <button className="btn btn--primary" onClick={handleSave}>
          {saved ? '저장됨 ✓' : '저장'}
        </button>
      </header>

      <div className="settings-content">
        {/* 프로필 */}
        <section className="settings-section">
          <h2>프로필</h2>
          <label className="settings-label">
            닉네임
            <input
              className="settings-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </label>
        </section>

        {/* 입력 기기 */}
        <section className="settings-section">
          <h2>입력 기기</h2>
          <div className="input-mode-group">
            {(['midi', 'mic', 'virtual'] as const).map((mode) => (
              <button
                key={mode}
                className={`input-mode-btn ${settings.inputMode === mode ? 'input-mode-btn--active' : ''}`}
                onClick={() => update('inputMode', mode)}
              >
                {mode === 'midi' ? '🎹 MIDI' : mode === 'mic' ? '🎤 마이크' : '🖥️ 가상'}
              </button>
            ))}
          </div>

          {settings.inputMode === 'midi' && (
            <label className="settings-label">
              MIDI 기기
              <select
                className="settings-select"
                value={settings.midiDeviceId ?? ''}
                onChange={(e) => update('midiDeviceId', e.target.value)}
              >
                <option value="">기기 선택...</option>
                {midiInputs.map((input) => (
                  <option key={input.id} value={input.id}>{input.name}</option>
                ))}
              </select>
              {midiInputs.length === 0 && (
                <p className="settings-hint">MIDI 기기가 감지되지 않았습니다. Chrome/Edge에서 실행하고 기기를 연결하세요.</p>
              )}
            </label>
          )}

          {settings.inputMode === 'mic' && (
            <label className="settings-label">
              마이크 감도 ({Math.round(settings.micSensitivity * 100)}%)
              <input
                type="range"
                min="0" max="1" step="0.05"
                value={settings.micSensitivity}
                onChange={(e) => update('micSensitivity', parseFloat(e.target.value))}
                className="settings-slider"
              />
            </label>
          )}
        </section>

        {/* 연습 설정 */}
        <section className="settings-section">
          <h2>연습 설정</h2>
          <label className="settings-label">
            기본 보기
            <select
              className="settings-select"
              value={settings.viewMode}
              onChange={(e) => update('viewMode', e.target.value as UserSettings['viewMode'])}
            >
              <option value="falling">폴링 노트</option>
              <option value="sheet">악보</option>
              <option value="hybrid">하이브리드</option>
            </select>
          </label>

          <label className="settings-label">
            타이밍 허용 오차 ({settings.timingTolerance}ms)
            <input
              type="range"
              min="30" max="300" step="10"
              value={settings.timingTolerance}
              onChange={(e) => update('timingTolerance', parseInt(e.target.value))}
              className="settings-slider"
            />
            <div className="settings-range-labels">
              <span>엄격 (30ms)</span>
              <span>관대 (300ms)</span>
            </div>
          </label>

          <label className="settings-label">
            손 분리
            <select
              className="settings-select"
              value={settings.handSplit}
              onChange={(e) => update('handSplit', e.target.value as UserSettings['handSplit'])}
            >
              <option value="both">양손</option>
              <option value="right">오른손</option>
              <option value="left">왼손</option>
            </select>
          </label>
        </section>

        {/* 정보 */}
        <section className="settings-section">
          <h2>정보</h2>
          <div className="settings-info">
            <p>Piano Learning v0.1.0</p>
            <p>Web MIDI API: {typeof navigator.requestMIDIAccess === 'function' ? '지원됨' : '미지원 (Chrome/Edge 권장)'}</p>
          </div>
        </section>
      </div>
    </div>
  )
}
