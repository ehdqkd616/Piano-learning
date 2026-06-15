import { useCallback, useMemo } from 'react'
import { usePracticeStore } from '@/store/usePracticeStore'
import { audioEngine } from '@/engines/audio/audioEngine'
import './PianoKeyboard.css'

const FIRST_NOTE = 21
const LAST_NOTE = 108
const BLACK_IN_OCTAVE = new Set([1, 3, 6, 8, 10])
// 검은건반 너비 = 흰건반 1칸의 65%
const BLACK_W_RATIO = 0.65

function isBlack(noteNumber: number): boolean {
  return BLACK_IN_OCTAVE.has(noteNumber % 12)
}

/** 지정 범위 내 흰건반/검은건반 분리 및 각 노트 앞 흰건반 수 계산 */
function buildLayout(firstNote: number, lastNote: number) {
  const whites: number[] = []
  const blacks: number[] = []
  const wkb: number[] = [] // wkb[i] = 범위 안에서 note (firstNote+i) 앞의 흰건반 수
  let wc = 0
  for (let n = firstNote; n <= lastNote; n++) {
    wkb.push(wc)
    if (isBlack(n)) { blacks.push(n) }
    else { whites.push(n); wc++ }
  }
  return { whites, blacks, wkb, totalWhite: wc }
}

export interface PianoKeyboardProps {
  firstNote?: number
  lastNote?: number
  onNoteOn?: (noteNumber: number, velocity: number) => void
  onNoteOff?: (noteNumber: number) => void
  activeNotes?: Set<number>
  highlightNotes?: Set<number>
}

export function PianoKeyboard({
  firstNote = FIRST_NOTE,
  lastNote = LAST_NOTE,
  onNoteOn,
  onNoteOff,
  activeNotes: activeProp,
  highlightNotes: highlightProp,
}: PianoKeyboardProps) {
  const storeActive = usePracticeStore((s) => s.activeNotes)
  const storeHighlight = usePracticeStore((s) => s.highlightNotes)
  const pressNote = usePracticeStore((s) => s.pressNote)
  const releaseNote = usePracticeStore((s) => s.releaseNote)

  const activeNotes = activeProp ?? storeActive
  const highlightNotes = highlightProp ?? storeHighlight

  const { whites, blacks, wkb, totalWhite } = useMemo(
    () => buildLayout(firstNote, lastNote),
    [firstNote, lastNote],
  )

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

  const keyClass = (note: number, base: string) =>
    [
      base,
      activeNotes.has(note) ? 'piano-key--active' : '',
      highlightNotes.has(note) ? 'piano-key--highlight' : '',
    ].filter(Boolean).join(' ')

  return (
    <div className="piano-keyboard" role="group" aria-label="피아노 건반">
      {/* 흰건반: flex:1로 컨테이너를 균등 분할 → FallingNotes 비율과 일치 */}
      {whites.map((note) => (
        <div
          key={note}
          className={keyClass(note, 'piano-key piano-key--white')}
          data-note={note}
          onMouseDown={() => handlePress(note)}
          onMouseUp={() => handleRelease(note)}
          onMouseLeave={() => handleRelease(note)}
          onTouchStart={(e) => { e.preventDefault(); handlePress(note) }}
          onTouchEnd={(e) => { e.preventDefault(); handleRelease(note) }}
        />
      ))}

      {/* 검은건반: 절대 위치로 흰건반 경계선 위에 오버레이 */}
      <div className="piano-keyboard__blacks">
        {blacks.map((note) => {
          const wkbIdx = wkb[note - firstNote]
          const centerPct = (wkbIdx / totalWhite) * 100
          const halfW = (BLACK_W_RATIO / totalWhite) * 50
          return (
            <div
              key={note}
              className={keyClass(note, 'piano-key piano-key--black')}
              style={{
                left: `${centerPct - halfW}%`,
                width: `${(BLACK_W_RATIO / totalWhite) * 100}%`,
              }}
              data-note={note}
              onMouseDown={() => handlePress(note)}
              onMouseUp={() => handleRelease(note)}
              onMouseLeave={() => handleRelease(note)}
              onTouchStart={(e) => { e.preventDefault(); handlePress(note) }}
              onTouchEnd={(e) => { e.preventDefault(); handleRelease(note) }}
            />
          )
        })}
      </div>
    </div>
  )
}
