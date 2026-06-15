import { useEffect, useRef } from 'react'
import type { ScoreNote, NoteResult } from '@/types'
import { usePracticeStore } from '@/store/usePracticeStore'
import './FallingNotes.css'

const FIRST_NOTE = 21
const LAST_NOTE = 108
const FALL_DURATION_MS = 2000
const LOOK_AHEAD_MS = 2600
const NOTE_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6']
const getNoteColor = (n: number) => NOTE_COLORS[n % NOTE_COLORS.length]

// 피아노 흰건반 기준 X 위치 계산 (PianoKeyboard 레이아웃과 일치)
const BLACK_IN_OCTAVE = new Set([1, 3, 6, 8, 10])
function isBlackKey(n: number): boolean { return BLACK_IN_OCTAVE.has(n % 12) }

// 각 노트 앞에 오는 흰건반 수 사전 계산
const WHITE_BEFORE: number[] = []
let _wc = 0
for (let n = FIRST_NOTE; n <= LAST_NOTE; n++) {
  WHITE_BEFORE.push(_wc)
  if (!isBlackKey(n)) _wc++
}
const TOTAL_WHITE_KEYS = _wc  // 52

/** 노트 번호 → 캔버스 너비 기준 X 비율 (0~1) */
function noteXFrac(noteNumber: number): number {
  const idx = noteNumber - FIRST_NOTE
  if (idx < 0 || idx >= WHITE_BEFORE.length) return 0
  const wkb = WHITE_BEFORE[idx]
  return isBlackKey(noteNumber)
    ? wkb / TOTAL_WHITE_KEYS                  // 검은건반: 흰건반 경계선 위치
    : (wkb + 0.5) / TOTAL_WHITE_KEYS          // 흰건반: 키 중앙
}

/** 노트 너비 비율 */
function noteWFrac(noteNumber: number): number {
  return isBlackKey(noteNumber)
    ? 0.55 / TOTAL_WHITE_KEYS   // 검은건반 ~62% 너비
    : 0.88 / TOTAL_WHITE_KEYS   // 흰건반 너비
}

interface FallingNotesProps { notes: ScoreNote[] }

export function FallingNotes({ notes }: FallingNotesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const timeRef = useRef(0)
  const activeNotesRef = useRef<Set<number>>(new Set())
  const noteResultsRef = useRef<NoteResult[]>([])
  const highlightNotesRef = useRef<Set<number>>(new Set())
  const currentNoteIndexRef = useRef(0)
  const notesRef = useRef(notes)
  notesRef.current = notes

  useEffect(() => {
    return usePracticeStore.subscribe((state) => {
      timeRef.current = state.currentTimeMs
      activeNotesRef.current = state.activeNotes
      noteResultsRef.current = state.noteResults
      highlightNotesRef.current = state.highlightNotes
      currentNoteIndexRef.current = state.currentNoteIndex
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        const c = canvas.getContext('2d')
        c?.scale(dpr, dpr)
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function draw() {
      const el = canvasRef.current
      const ctx = el?.getContext('2d')
      if (!el || !ctx) { animRef.current = requestAnimationFrame(draw); return }

      const cssW = el.offsetWidth
      const cssH = el.offsetHeight
      if (cssW === 0 || cssH === 0) { animRef.current = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, cssW, cssH)
      ctx.fillStyle = '#0f0f1a'
      ctx.fillRect(0, 0, cssW, cssH)

      // 흰건반 안내선 (52개)
      for (let i = 0; i < TOTAL_WHITE_KEYS; i++) {
        const gx = ((i + 0.5) / TOTAL_WHITE_KEYS) * cssW
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, cssH); ctx.stroke()
      }

      // 히트라인
      const hitY = cssH - 24
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(cssW, hitY); ctx.stroke()

      const now = timeRef.current
      const currentNotes = notesRef.current
      const results = noteResultsRef.current
      const activeNotes = activeNotesRef.current
      const highlightNotes = highlightNotesRef.current
      const currentIdx = currentNoteIndexRef.current

      currentNotes.forEach((sn) => {
        const timeToHit = sn.startTimeMs - now
        if (timeToHit < -300 || timeToHit > LOOK_AHEAD_MS) return

        const result = results.find((r) => r.noteIndex === sn.index)
        const progress = 1 - timeToHit / FALL_DURATION_MS
        const y = progress * hitY

        const nx = noteXFrac(sn.noteNumber) * cssW
        const nw = Math.max(noteWFrac(sn.noteNumber) * cssW, 5)
        const nh = Math.max((sn.durationMs / FALL_DURATION_MS) * hitY, 6)

        const isTarget = sn.index === currentIdx
        const isHighlighted = highlightNotes.has(sn.noteNumber)

        let color = getNoteColor(sn.noteNumber)
        let alpha = 0.85

        if (result) {
          color = (result.verdict === 'perfect' || result.verdict === 'good') ? '#4ade80' : '#f87171'
          alpha = 0.35
        } else if (isTarget || isHighlighted) {
          color = '#60b8ff'
          alpha = 1
          ctx.shadowColor = color
          ctx.shadowBlur = 14
        }

        ctx.globalAlpha = alpha
        ctx.fillStyle = color
        ctx.beginPath()
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(nx - nw / 2, y - nh, nw, nh, 3)
        } else {
          ctx.rect(nx - nw / 2, y - nh, nw, nh)
        }
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      })

      // 눌린 건반 히트라인 표시
      activeNotes.forEach((note) => {
        const ax = noteXFrac(note) * cssW
        const aw = Math.max(noteWFrac(note) * cssW, 12)
        ctx.fillStyle = 'rgba(96,184,255,0.6)'
        ctx.shadowColor = '#60b8ff'
        ctx.shadowBlur = 8
        ctx.fillRect(ax - aw / 2, hitY - 8, aw, 16)
        ctx.shadowBlur = 0
      })

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
    }
  }, [notes])

  return (
    <div className="falling-notes">
      <canvas ref={canvasRef} className="falling-notes__canvas" />
    </div>
  )
}
