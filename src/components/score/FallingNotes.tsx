import { useEffect, useRef } from 'react'
import type { ScoreNote, NoteResult } from '@/types'
import { usePracticeStore } from '@/store/usePracticeStore'
import './FallingNotes.css'

const FIRST_NOTE = 21
const TOTAL_KEYS = 88
const FALL_DURATION_MS = 2000   // 화면 위→아래 이동 시간
const LOOK_AHEAD_MS = 2500      // 미리 보여줄 시간 범위

const NOTE_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6']

function getNoteColor(noteNumber: number): string {
  return NOTE_COLORS[noteNumber % NOTE_COLORS.length]
}

function noteXPercent(noteNumber: number): number {
  return ((noteNumber - FIRST_NOTE) / (TOTAL_KEYS - 1)) * 100
}

interface FallingNotesProps {
  notes: ScoreNote[]
}

export function FallingNotes({ notes }: FallingNotesProps) {
  const currentTimeMs = usePracticeStore((s) => s.currentTimeMs)
  const noteResults = usePracticeStore((s) => s.noteResults)
  const activeNotes = usePracticeStore((s) => s.activeNotes)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function draw() {
      if (!canvas || !ctx) return
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // 배경
      ctx.fillStyle = '#0f0f1a'
      ctx.fillRect(0, 0, W, H)

      // 건반 안내선
      for (let i = 0; i < TOTAL_KEYS; i++) {
        const x = Math.round((i / (TOTAL_KEYS - 1)) * W)
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }

      // 히트 라인
      const hitY = H - 30
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, hitY)
      ctx.lineTo(W, hitY)
      ctx.stroke()

      const now = currentTimeMs
      const keyWidth = W / TOTAL_KEYS

      notes.forEach((sn) => {
        const timeToHit = sn.startTimeMs - now
        if (timeToHit < -200 || timeToHit > LOOK_AHEAD_MS) return

        const result = noteResults.find((r) => r.noteIndex === sn.index)
        const progress = 1 - timeToHit / FALL_DURATION_MS
        const y = progress * hitY

        const x = noteXPercent(sn.noteNumber) / 100 * W
        const w = Math.max(keyWidth * 0.85, 8)
        const h = Math.max((sn.durationMs / FALL_DURATION_MS) * hitY, 8)

        let color = getNoteColor(sn.noteNumber)
        if (result) {
          color = result.verdict === 'perfect' || result.verdict === 'good'
            ? '#4ade80' : '#f87171'
        }

        ctx.fillStyle = color
        ctx.globalAlpha = result ? 0.4 : 0.9
        ctx.beginPath()
        ctx.roundRect(x - w / 2, y - h, w, h, 3)
        ctx.fill()
        ctx.globalAlpha = 1
      })

      // 현재 활성 노트 하이라이트
      activeNotes.forEach((note) => {
        const x = noteXPercent(note) / 100 * W
        ctx.fillStyle = 'rgba(96,184,255,0.5)'
        ctx.fillRect(x - 10, hitY - 10, 20, 20)
      })

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [notes, currentTimeMs, noteResults, activeNotes])

  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  return (
    <div className="falling-notes">
      <canvas ref={canvasRef} className="falling-notes__canvas" />
    </div>
  )
}
