import { useEffect, useRef } from 'react'
import type { ScoreNote, NoteResult } from '@/types'
import { usePracticeStore } from '@/store/usePracticeStore'
import './FallingNotes.css'

const FIRST_NOTE = 21
const TOTAL_KEYS = 88
const FALL_DURATION_MS = 2000
const LOOK_AHEAD_MS = 2600
const NOTE_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6']
const getNoteColor = (n: number) => NOTE_COLORS[n % NOTE_COLORS.length]

interface FallingNotesProps { notes: ScoreNote[] }

export function FallingNotes({ notes }: FallingNotesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  // 스토어 값들은 ref로 → RAF에서 항상 최신값 읽음
  const timeRef = useRef(0)
  const activeNotesRef = useRef<Set<number>>(new Set())
  const noteResultsRef = useRef<NoteResult[]>([])
  const highlightNotesRef = useRef<Set<number>>(new Set())
  const currentNoteIndexRef = useRef(0)
  const notesRef = useRef(notes)
  notesRef.current = notes

  // 스토어 구독
  useEffect(() => {
    return usePracticeStore.subscribe((state) => {
      timeRef.current = state.currentTimeMs
      activeNotesRef.current = state.activeNotes
      noteResultsRef.current = state.noteResults
      highlightNotesRef.current = state.highlightNotes
      currentNoteIndexRef.current = state.currentNoteIndex
    })
  }, [])

  // 단일 RAF 루프 (notes 변경 시만 재시작)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // ctx는 getContext가 매번 같은 인스턴스를 반환함
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
      // draw 내에서 직접 null 체크 → TypeScript가 narrowing 유지
      const el = canvasRef.current
      const ctx = el?.getContext('2d')
      if (!el || !ctx) { animRef.current = requestAnimationFrame(draw); return }

      const cssW = el.offsetWidth
      const cssH = el.offsetHeight
      if (cssW === 0 || cssH === 0) { animRef.current = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, cssW, cssH)
      ctx.fillStyle = '#0f0f1a'
      ctx.fillRect(0, 0, cssW, cssH)

      // 건반 안내선
      for (let i = 0; i < TOTAL_KEYS; i++) {
        const gx = (i / (TOTAL_KEYS - 1)) * cssW
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
      const keyW = cssW / TOTAL_KEYS
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

        const nx = ((sn.noteNumber - FIRST_NOTE) / (TOTAL_KEYS - 1)) * cssW
        const nw = Math.max(keyW * 0.8, 6)
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
        const ax = ((note - FIRST_NOTE) / (TOTAL_KEYS - 1)) * cssW
        ctx.fillStyle = 'rgba(96,184,255,0.6)'
        ctx.shadowColor = '#60b8ff'
        ctx.shadowBlur = 8
        ctx.fillRect(ax - 10, hitY - 8, 20, 16)
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
