import { useEffect, useRef } from 'react'
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow'
import type { ScoreNote } from '@/types'
import { usePracticeStore } from '@/store/usePracticeStore'
import './SheetScore.css'

// MIDI 노트번호 → VexFlow 음이름 변환
const NOTE_NAMES = ['c', 'c', 'd', 'd', 'e', 'f', 'f', 'g', 'g', 'a', 'a', 'b']
const IS_SHARP =   [false, true, false, true, false, false, true, false, true, false, true, false]

function midiToVex(noteNumber: number): { key: string; accidental: string | null } {
  const octave = Math.floor(noteNumber / 12) - 1
  const idx = noteNumber % 12
  const name = NOTE_NAMES[idx]
  const accidental = IS_SHARP[idx] ? '#' : null
  return { key: `${name}/${octave}`, accidental }
}

interface SheetScoreProps {
  notes: ScoreNote[]
  visibleCount?: number    // 한 번에 표시할 음표 수
}

export function SheetScore({ notes, visibleCount = 8 }: SheetScoreProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const currentIndex = usePracticeStore((s) => s.currentNoteIndex)
  const noteResults = usePracticeStore((s) => s.noteResults)

  useEffect(() => {
    if (!containerRef.current || notes.length === 0) return

    const el = containerRef.current
    el.innerHTML = ''

    const width = el.clientWidth || 800
    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(width, 160)
    const ctx = renderer.getContext()

    const startIdx = Math.max(0, currentIndex - 2)
    const slice = notes.slice(startIdx, startIdx + visibleCount)

    if (slice.length === 0) return

    const stave = new Stave(10, 20, width - 20)
    stave.addClef('treble').addTimeSignature('4/4')
    stave.setContext(ctx).draw()

    const vexNotes = slice.map((sn) => {
      const { key, accidental } = midiToVex(sn.noteNumber)
      const staveNote = new StaveNote({ keys: [key], duration: 'q' })
      if (accidental) staveNote.addModifier(new Accidental(accidental))

      // 판정 결과에 따라 색상
      const result = noteResults.find((r) => r.noteIndex === sn.index)
      if (result) {
        const color = result.verdict === 'perfect' || result.verdict === 'good'
          ? '#4ade80'
          : result.verdict === 'miss' || result.verdict === 'skip'
          ? '#f87171'
          : '#facc15'
        staveNote.setStyle({ fillStyle: color, strokeStyle: color })
      } else if (sn.index === currentIndex) {
        staveNote.setStyle({ fillStyle: '#60b8ff', strokeStyle: '#60b8ff' })
      }

      return staveNote
    })

    try {
      const voice = new Voice({ numBeats: vexNotes.length, beatValue: 4 })
      voice.setStrict(false)
      voice.addTickables(vexNotes)
      new Formatter().joinVoices([voice]).format([voice], width - 60)
      voice.draw(ctx, stave)
    } catch {
      // 음표 수가 박자와 맞지 않는 경우 무시
    }
  }, [notes, currentIndex, noteResults, visibleCount])

  return (
    <div className="sheet-score">
      <div ref={containerRef} className="sheet-score__canvas" />
    </div>
  )
}
