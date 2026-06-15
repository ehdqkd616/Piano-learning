import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { midiEngine } from '@/engines/input/midiEngine'
import { audioEngine } from '@/engines/audio/audioEngine'
import { usePracticeStore } from '@/store/usePracticeStore'
import { PianoKeyboard } from '@/components/piano/PianoKeyboard'
import type { NoteEvent } from '@/types'
import './FreePlayScreen.css'

function noteNumberToName(n: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(n / 12) - 1
  return names[n % 12] + octave
}

export function FreePlayScreen() {
  const navigate = useNavigate()
  const [midiDevices, setMidiDevices] = useState<MIDIInput[]>([])
  // null = 전체 연결(기본). 렌더 시작 즉시 midiEngine 상태를 읽어 초기화
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(
    () => midiEngine.getSelectedIds(),
  )
  const [pressedNames, setPressedNames] = useState<string[]>([])

  const pressNote = usePracticeStore((s) => s.pressNote)
  const releaseNote = usePracticeStore((s) => s.releaseNote)
  const activeNotes = usePracticeStore((s) => s.activeNotes)

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
        setMidiDevices(inputs)
        // 다른 화면에서 선택을 바꿨으면 반영
        const cur = midiEngine.getSelectedIds()
        if (cur !== null) setSelectedIds(new Set(cur))
        // null이면 전체 연결 — 그대로 유지
      })
      .catch(() => {})

    midiEngine.on(handleMidiEvent)
    const handleConnection = (inputs: MIDIInput[]) => setMidiDevices([...inputs])
    midiEngine.onConnection(handleConnection)

    return () => {
      midiEngine.off(handleMidiEvent)
      midiEngine.offConnection(handleConnection)
    }
  }, [handleMidiEvent])

  useEffect(() => {
    setPressedNames(Array.from(activeNotes).sort((a, b) => a - b).map(noteNumberToName))
  }, [activeNotes])

  // null = 전체 선택 / Set = 특정 선택
  const isDeviceOn = (id: string) => selectedIds === null || selectedIds.has(id)

  const toggleDevice = (id: string) => {
    setSelectedIds((prev) => {
      // prev가 null이면 전체에서 시작
      const base = prev !== null ? new Set(prev) : new Set(midiDevices.map((d) => d.id))
      if (base.has(id)) { base.delete(id) } else { base.add(id) }
      midiEngine.setSelectedInputs(base)
      return base
    })
  }

  const connectedCount = selectedIds === null
    ? midiDevices.length
    : Array.from(selectedIds).filter((id) => midiDevices.some((d) => d.id === id)).length

  return (
    <div className="freeplay-screen">
      <header className="freeplay-header">
        <button className="btn-icon" onClick={() => navigate('/')}>← 홈</button>
        <h1>자유 연주</h1>
        <div className={`freeplay-midi-status ${connectedCount > 0 ? 'freeplay-midi-status--connected' : ''}`}>
          <span className="freeplay-midi-dot" />
          <span>{connectedCount > 0 ? `${connectedCount}개 기기 활성` : 'MIDI 연결 없음'}</span>
        </div>
      </header>

      {/* MIDI 기기 선택 토글 */}
      {midiDevices.length > 0 && (
        <div className="freeplay-device-list">
          {midiDevices.map((d) => (
            <button
              key={d.id}
              className={`freeplay-device-chip ${isDeviceOn(d.id) ? 'freeplay-device-chip--on' : 'freeplay-device-chip--off'}`}
              onClick={() => toggleDevice(d.id)}
              title={isDeviceOn(d.id) ? '클릭하여 해제' : '클릭하여 연결'}
            >
              🎹 {d.name ?? 'Unknown'}
            </button>
          ))}
        </div>
      )}

      <main className="freeplay-main">
        <div className="freeplay-note-display">
          {pressedNames.length > 0
            ? <span className="freeplay-note-names">{pressedNames.join('  ·  ')}</span>
            : <span className="freeplay-note-hint">
                {midiDevices.length > 0 ? 'MIDI 건반 또는 화면 건반을 눌러보세요' : '화면 건반을 눌러보세요'}
              </span>
          }
        </div>
      </main>

      <footer className="freeplay-footer">
        <PianoKeyboard />
      </footer>
    </div>
  )
}
