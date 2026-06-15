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
      .then((inputs) => setMidiDevices(inputs))
      .catch(() => {})

    midiEngine.on(handleMidiEvent)

    const handleConnection = (inputs: MIDIInput[]) => {
      setMidiDevices([...inputs])
    }
    midiEngine.onConnection(handleConnection)

    return () => {
      midiEngine.off(handleMidiEvent)
      midiEngine.offConnection(handleConnection)
    }
  }, [handleMidiEvent])

  useEffect(() => {
    setPressedNames(Array.from(activeNotes).sort((a, b) => a - b).map(noteNumberToName))
  }, [activeNotes])

  const connectedCount = midiDevices.length

  return (
    <div className="freeplay-screen">
      <header className="freeplay-header">
        <button className="btn-icon" onClick={() => navigate('/')}>← 홈</button>
        <h1>자유 연주</h1>
        <div className={`freeplay-midi-status ${connectedCount > 0 ? 'freeplay-midi-status--connected' : ''}`}>
          <span className="freeplay-midi-dot" />
          <span>{connectedCount > 0 ? `${connectedCount}개 기기 연결됨` : 'MIDI 연결 없음'}</span>
        </div>
      </header>

      {/* MIDI 기기 목록 */}
      {midiDevices.length > 0 && (
        <div className="freeplay-device-list">
          {midiDevices.map((d) => (
            <span key={d.id} className="freeplay-device-chip">
              🎹 {d.name ?? 'Unknown'}
            </span>
          ))}
        </div>
      )}

      <main className="freeplay-main">
        <div className="freeplay-note-display">
          {pressedNames.length > 0
            ? <span className="freeplay-note-names">{pressedNames.join('  ·  ')}</span>
            : <span className="freeplay-note-hint">
                {connectedCount > 0 ? 'MIDI 건반 또는 화면 건반을 눌러보세요' : '화면 건반을 눌러보세요'}
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
