import { useCallback } from 'react'
import { usePracticeStore } from '@/store/usePracticeStore'
import './PianoKeyboard.css'

// 피아노 A0(21) ~ C8(108), 총 88건반
const FIRST_NOTE = 21
const LAST_NOTE = 108

const BLACK_KEY_PATTERN = [1, 3, 6, 8, 10] // 12음계 내 검은 건반 위치 (0=C 기준)

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

  const handleMouseDown = useCallback(() => onPress(noteNumber), [noteNumber, onPress])
  const handleMouseUp = useCallback(() => onRelease(noteNumber), [noteNumber, onRelease])

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
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={(e) => { e.preventDefault(); handleMouseDown() }}
      onTouchEnd={(e) => { e.preventDefault(); handleMouseUp() }}
    />
  )
}

export function PianoKeyboard() {
  const activeNotes = usePracticeStore((s) => s.activeNotes)
  const highlightNotes = usePracticeStore((s) => s.highlightNotes)
  const pressNote = usePracticeStore((s) => s.pressNote)
  const releaseNote = usePracticeStore((s) => s.releaseNote)

  const handlePress = useCallback((note: number) => {
    pressNote({
      noteNumber: note,
      velocity: 80,
      timestamp: performance.now(),
      type: 'on',
      channel: 0,
      source: 'virtual',
    })
  }, [pressNote])

  const handleRelease = useCallback((note: number) => {
    releaseNote(note)
  }, [releaseNote])

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
