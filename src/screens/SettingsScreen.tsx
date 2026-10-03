import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { usePracticeStore } from '@/store/usePracticeStore'
import { midiEngine } from '@/engines/input/midiEngine'
import { audioEngine } from '@/engines/audio/audioEngine'
import { PianoKeyboard } from '@/components/piano/PianoKeyboard'
import { updateUserSettings, logout } from '@/api'
import type { UserSettings, NoteEvent } from '@/types'
import './SettingsScreen.css'

// 건반 테스트 음역: A3(57) ~ C6(84)
const KB_FIRST = 57
const KB_LAST = 84

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
  // null = 전체 연결(기본). 렌더 즉시 midiEngine 상태를 읽어 초기화
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(
    () => midiEngine.getSelectedIds(),
  )
  const [nickname, setNickname] = useState(user?.nickname ?? '피아니스트')
  const [saved, setSaved] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)

  const pressNote = usePracticeStore((s) => s.pressNote)
  const releaseNote = usePracticeStore((s) => s.releaseNote)

  const handleMidiEvent = useCallback(async (event: NoteEvent) => {
    if (event.type === 'on') {
      await audioEngine.init()
      audioEngine.noteOn(event.noteNumber, event.velocity)
      pressNote(event)
    } else {
      audioEngine.noteOff(event.noteNumber)
      releaseNote(event.noteNumber)
    }
  }, [pressNote, releaseNote])

  useEffect(() => {
    usePracticeStore.getState().resetSession()

    midiEngine.init()
      .then((inputs) => {
        setMidiInputs(inputs)
        const cur = midiEngine.getSelectedIds()
        if (cur !== null) setSelectedIds(new Set(cur))
      })
      .catch(() => {})

    midiEngine.on(handleMidiEvent)

    const handleConnection = (inputs: MIDIInput[]) => {
      setMidiInputs([...inputs])
    }
    midiEngine.onConnection(handleConnection)

    return () => {
      midiEngine.off(handleMidiEvent)
      midiEngine.offConnection(handleConnection)
      usePracticeStore.getState().resetSession()
    }
  }, [handleMidiEvent])

  const isDeviceOn = (id: string) => selectedIds === null || selectedIds.has(id)

  const toggleDevice = (id: string) => {
    setSelectedIds((prev) => {
      const base = prev !== null ? new Set(prev) : new Set(midiInputs.map((i) => i.id))
      if (base.has(id)) { base.delete(id) } else { base.add(id) }
      midiEngine.setSelectedInputs(base)
      return base
    })
  }

  const handleRescan = async () => {
    setScanning(true)
    setScanMessage(null)
    const before = new Set(midiInputs.map((i) => i.id))
    try {
      const inputs = await midiEngine.rescan()
      setMidiInputs(inputs)
      const addedIds = inputs.filter((i) => !before.has(i.id)).map((i) => i.id)
      const added = addedIds.length
      // 일부 기기를 꺼 둔 상태라면, 새로 찾은 기기는 켜진 상태로 추가한다 (안 그러면 목록엔 떠도 반응이 없다)
      const current = midiEngine.getSelectedIds()
      if (current !== null && added > 0) {
        const next = new Set([...current, ...addedIds])
        midiEngine.setSelectedInputs(next)
        setSelectedIds(next)
      }
      setScanMessage(added > 0 ? `새 기기 ${added}개를 찾았습니다.` : `기기 ${inputs.length}개 — 새로 찾은 기기가 없습니다.`)
    } catch (err) {
      setScanMessage(err instanceof Error ? err.message : 'MIDI 기기를 검색하지 못했습니다.')
    } finally {
      setScanning(false)
    }
  }

  const handleSave = async () => {
    const updated = await updateUserSettings({ nickname, settings })
    updateUser(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
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

          {/* MIDI 기기 선택 */}
          <div className="midi-device-list">
            <div className="midi-device-list__header">
              <p className="midi-device-list__label">MIDI 기기 선택</p>
              <button className="midi-rescan-btn" onClick={handleRescan} disabled={scanning}>
                {scanning ? '검색 중…' : '↻ 기기 다시 검색'}
              </button>
            </div>
            {scanMessage && <p className="midi-scan-message">{scanMessage}</p>}
            {midiInputs.length === 0 && (
              <p className="settings-hint">MIDI 기기가 감지되지 않았습니다. Chrome/Edge에서 실행하고 기기를 연결하세요.</p>
            )}
            {midiInputs.map((input) => {
              const on = isDeviceOn(input.id)
              return (
                <div key={input.id} className="midi-device-item">
                  <span className={`midi-device-dot ${on ? '' : 'midi-device-dot--off'}`} />
                  <span className="midi-device-name">{input.name ?? 'Unknown'}</span>
                  <button
                    className={`midi-device-toggle ${on ? 'midi-device-toggle--on' : ''}`}
                    onClick={() => toggleDevice(input.id)}
                  >
                    {on ? '연결됨' : '해제됨'}
                  </button>
                </div>
              )
            })}
            <details className="midi-help">
              <summary>건반이 목록에 없나요?</summary>
              <ul>
                <li>건반을 이 PC(브라우저를 실행 중인 PC)에 연결했는지 확인하세요. 서버 PC에 연결하면 인식되지 않습니다.</li>
                <li>DAW·건반 전용 프로그램 등 건반을 사용 중인 다른 프로그램을 닫으세요. Windows에서는 한 프로그램만 MIDI 기기를 쓸 수 있는 경우가 많습니다.</li>
                <li>브라우저를 켠 뒤 건반을 연결했다면, 브라우저 창을 모두 닫고 다시 열어 보세요.</li>
                <li>Windows 장치 관리자에 건반이 보이는지 확인하세요. 보이지 않으면 케이블(데이터용 USB), 건반의 USB to Host 단자, 제조사 드라이버를 확인하세요.</li>
                <li>가상 MIDI 장치가 많으면 Windows MIDI 장치 수 제한(약 10개)에 걸릴 수 있습니다. 쓰지 않는 가상 장치를 꺼 보세요.</li>
              </ul>
            </details>
          </div>

          {settings.inputMode === 'mic' && (
            <label className="settings-label" style={{ marginTop: '12px' }}>
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
          <button className="btn btn--danger" style={{ marginTop: '10px' }} onClick={handleLogout}>
            로그아웃
          </button>
        </section>

        {/* 건반 테스트 — A3(가온도 아래 라)부터 C6까지 */}
        <section className="settings-section settings-section--keyboard">
          <h2>건반 테스트</h2>
          <p className="settings-hint" style={{ marginBottom: '10px' }}>
            MIDI 건반이나 화면 건반을 눌러 연결 상태를 확인하세요 (라~C6)
          </p>
          <div className="settings-keyboard-wrap">
            <PianoKeyboard firstNote={KB_FIRST} lastNote={KB_LAST} />
          </div>
        </section>
      </div>
    </div>
  )
}
