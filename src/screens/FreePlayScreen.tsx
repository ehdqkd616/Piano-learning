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
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null)
  const [pressedNames, setPressedNames] = useState<string[]>([])

  const pressNote = usePracticeStore((s) => s.pressNote)
  const releaseNote = usePracticeStore((s) => s.releaseNote)
  const activeNotes = usePracticeStore((s) => s.activeNotes)

  // MIDI 이벤트 처리
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
    // 연습 스토어 초기화 (FreePlay용 빈 상태)
    usePracticeStore.getState().resetSession()

    midiEngine.init()
      .then((inputs) => {
        if (inputs.length > 0) {
          midiEngine.connect(inputs[0])
          setMidiDeviceName(inputs[0].name ?? 'MIDI 기기')
        }
      })
      .catch(() => {})

    midiEngine.on(handleMidiEvent)

    const handleConnection = (inputs: MIDIInput[]) => {
      if (inputs.length > 0) {
        midiEngine.connect(inputs[0])
        setMidiDeviceName(inputs[0].name ?? 'MIDI 기기')
      } else {
        midiEngine.disconnect()
        setMidiDeviceName(null)
      }
    }
    midiEngine.onConnection(handleConnection)

    return () => {
      midiEngine.off(handleMidiEvent)
      midiEngine.offConnection(handleConnection)
    }
  }, [handleMidiEvent])

  // 누르고 있는 음 이름 갱신
  useEffect(() => {
    setPressedNames(Array.from(activeNotes).sort((a, b) => a - b).map(noteNumberToName))
  }, [activeNotes])

  return (
    <div className="freeplay-screen">
      <header className="freeplay-header">
        <button className="btn-icon" onClick={() => navigate('/')}>← 홈</button>
        <h1>자유 연주</h1>
        <div className={`freeplay-midi-status ${midiDeviceName ? 'freeplay-midi-status--connected' : ''}`}>
          <span className="freeplay-midi-dot" />
          <span>{midiDeviceName ?? 'MIDI 연결 없음'}</span>
        </div>
      </header>

      <main className="freeplay-main">
        <div className="freeplay-note-display">
          {pressedNames.length > 0
            ? <span className="freeplay-note-names">{pressedNames.join('  ·  ')}</span>
            : <span className="freeplay-note-hint">건반을 눌러보세요</span>
          }
        </div>
      </main>

      <footer className="freeplay-footer">
        <PianoKeyboard />
      </footer>
    </div>
  )
}
