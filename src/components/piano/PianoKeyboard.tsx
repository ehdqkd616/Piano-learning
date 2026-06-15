import { useCallback } from 'react'
import { usePracticeStore } from '@/store/usePracticeStore'
import { audioEngine } from '@/engines/audio/audioEngine'
import './PianoKeyboard.css'

const FIRST_NOTE = 21
const LAST_NOTE = 108
const BLACK_KEY_PATTERN = [1, 3, 6, 8, 10]

function isBlack(noteNumber: number): boolean {
  return BLACK_KEY_PATTERN.includes((noteNumber - 12) % 12)
}

function getNoteName(noteNumber: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(noteNumber / 12) - 1
  return names[noteNumber % 12] + octave
}

interface KeyProps {
  noteNumber: number
  isActive: boolean
  isHighlight: boolean
  onPress: (note: number) => void
  onRelease: (note: number) => void
}

function PianoKey({ noteNumber, isActive, isHighlight, onPress, onRelease }: KeyProps) {
  const black = isBlack(noteNumber)

  const handleDown = useCallback(() => onPress(noteNumber), [noteNumber, onPress])
  const handleUp = useCallback(() => onRelease(noteNumber), [noteNumber, onRelease])

  const className = [
    'piano-key',
    black ? 'piano-key--black' : 'piano-key--white',
    isActive ? 'piano-key--active' : '',
    isHighlight ? 'piano-key--highlight' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={className}
      data-note={noteNumber}
      data-name={getNoteName(noteNumber)}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
      onTouchStart={(e) => { e.preventDefault(); handleDown() }}
      onTouchEnd={(e) => { e.preventDefault(); handleUp() }}
    />
  )
}

export interface PianoKeyboardProps {
  /** 추가 판정 콜백 — 내부 visual/audio 처리 후 호출됨 */
  onNoteOn?: (noteNumber: number, velocity: number) => void
  onNoteOff?: (noteNumber: number) => void
  /** 외부에서 activeNotes를 직접 주입할 때 사용 (FreePlay 등) */
  activeNotes?: Set<number>
  highlightNotes?: Set<number>
}

export function PianoKeyboard({ onNoteOn, onNoteOff, activeNotes: activeProp, highlightNotes: highlightProp }: PianoKeyboardProps) {
  const storeActive = usePracticeStore((s) => s.activeNotes)
  const storeHighlight = usePracticeStore((s) => s.highlightNotes)
  const pressNote = usePracticeStore((s) => s.pressNote)
  const releaseNote = usePracticeStore((s) => s.releaseNote)

  const activeNotes = activeProp ?? storeActive
  const highlightNotes = highlightProp ?? storeHighlight

  const handlePress = useCallback(async (note: number) => {
    const velocity = 80
    await audioEngine.init()
    audioEngine.noteOn(note, velocity)
    pressNote({ noteNumber: note, velocity, timestamp: performance.now(), type: 'on', channel: 0, source: 'virtual' })
    onNoteOn?.(note, velocity)
  }, [pressNote, onNoteOn])

  const handleRelease = useCallback((note: number) => {
    audioEngine.noteOff(note)
    releaseNote(note)
    onNoteOff?.(note)
  }, [releaseNote, onNoteOff])

  const notes = Array.from({ length: LAST_NOTE - FIRST_NOTE + 1 }, (_, i) => i + FIRST_NOTE)

  return (
    <div className="piano-keyboard" role="group" aria-label="피아노 건반">
      {notes.map((note) => (
        <PianoKey
          key={note}
          noteNumber={note}
          isActive={activeNotes.has(note)}
          isHighlight={highlightNotes.has(note)}
          onPress={handlePress}
          onRelease={handleRelease}
        />
      ))}
    </div>
  )
}
