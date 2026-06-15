import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePracticeStore } from '@/store/usePracticeStore'
import { useAppStore } from '@/store/useAppStore'
import { midiEngine } from '@/engines/input/midiEngine'
import { micEngine } from '@/engines/input/micEngine'
import { audioEngine } from '@/engines/audio/audioEngine'
import { judgeNote, matchesTarget } from '@/engines/judgment/judgmentEngine'
import { SheetScore } from '@/components/score/SheetScore'
import { FallingNotes } from '@/components/score/FallingNotes'
import { PianoKeyboard } from '@/components/piano/PianoKeyboard'
import { VerdictBadge } from '@/components/feedback/VerdictBadge'
import { db, saveSession } from '@/db'
import type { NoteEvent, ScoreNote, Verdict, PracticeSession } from '@/types'
import './PracticeScreen.css'

function buildDemoNotes(bpm: number): ScoreNote[] {
  const beatMs = (60 / bpm) * 1000
  const melody = [60, 62, 64, 65, 67, 69, 71, 72]
  return melody.map((note, i) => ({
    index: i,
    noteNumber: note,
    startTimeMs: i * beatMs,
    durationMs: beatMs * 0.9,
    hand: 'right' as const,
    measure: Math.floor(i / 4),
    beat: i % 4,
  }))
}

export function PracticeScreen() {
  const { songId } = useParams<{ songId: string }>()
  const navigate = useNavigate()
  const songs = useAppStore((s) => s.songs)
  const user = useAppStore((s) => s.user)

  const {
    currentSong, scoreNotes, mode, playbackState, bpm,
    liveScore, combo, currentNoteIndex,
    loadSong, setMode, setPlaybackState, resetSession,
    pressNote, releaseNote, recordResult, advanceNoteIndex,
    setCurrentTimeMs,
  } = usePracticeStore()

  const [viewMode, setViewMode] = useState<'falling' | 'sheet'>('falling')
  const [lastVerdict, setLastVerdict] = useState<Verdict | null>(null)
  const [showVerdict, setShowVerdict] = useState(false)
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null)

  const verdictTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  const sessionStartRef = useRef<string>('')

  // 곡 로드
  useEffect(() => {
    const song = songs.find((s) => s.songId === songId)
    if (!song) return
    const notes = buildDemoNotes(song.bpm)
    loadSong(song, notes)
    sessionStartRef.current = new Date().toISOString()
  }, [songId, songs, loadSong])

  // 시간 타이머 — wait 모드에서는 타겟 노트가 히트라인 도달 시 시간 정지
  useEffect(() => {
    if (playbackState !== 'playing') {
      cancelAnimationFrame(rafRef.current)
      return
    }
    function tick() {
      const state = usePracticeStore.getState()
      const elapsed = performance.now() - startTimeRef.current

      if (state.mode === 'wait') {
        const target = state.scoreNotes[state.currentNoteIndex]
        if (target && elapsed >= target.startTimeMs) {
          // 히트라인에 도달 → 정지: startTimeRef를 밀어서 현재 시간을 고정
          startTimeRef.current = performance.now() - target.startTimeMs
          setCurrentTimeMs(target.startTimeMs)
        } else {
          setCurrentTimeMs(elapsed)
        }
      } else {
        setCurrentTimeMs(elapsed)
      }

      // 모든 노트 완료 확인
      if (
        state.scoreNotes.length > 0 &&
        state.currentNoteIndex >= state.scoreNotes.length &&
        state.playbackState === 'playing'
      ) {
        state.setPlaybackState('finished')
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playbackState, setCurrentTimeMs])

  const showVerdictFor = useCallback((verdict: Verdict) => {
    setLastVerdict(verdict)
    setShowVerdict(true)
    if (verdictTimer.current) clearTimeout(verdictTimer.current)
    verdictTimer.current = setTimeout(() => setShowVerdict(false), 700)
  }, [])

  // MIDI/Mic 이벤트 핸들러
  const handleExternalNoteEvent = useCallback((event: NoteEvent) => {
    if (event.type === 'off') {
      audioEngine.noteOff(event.noteNumber)
      releaseNote(event.noteNumber)
      return
    }

    audioEngine.noteOn(event.noteNumber, event.velocity)
    pressNote(event)

    if (playbackState !== 'playing') return  // 시작 전엔 소리만, 판정 없음

    const target = scoreNotes[currentNoteIndex]
    if (!target) return

    if (mode === 'wait') {
      if (matchesTarget(event.noteNumber, target)) {
        const result = judgeNote({ ...event, timestamp: performance.now() }, target, user?.settings.timingTolerance ?? 100)
        recordResult(result)
        showVerdictFor(result.verdict)
        advanceNoteIndex()
        // wait 모드: 다음 노트 향해 시간 재개 (startTimeRef를 현재 target 시각으로 보정)
        startTimeRef.current = performance.now() - target.startTimeMs
      } else {
        showVerdictFor('miss')
      }
    } else {
      const result = judgeNote({ ...event, timestamp: performance.now() - startTimeRef.current }, target, user?.settings.timingTolerance ?? 100)
      recordResult(result)
      showVerdictFor(result.verdict)
      if (event.noteNumber === target.noteNumber) advanceNoteIndex()
    }
  }, [playbackState, scoreNotes, currentNoteIndex, mode, user, pressNote, releaseNote, recordResult, advanceNoteIndex, showVerdictFor])

  // virtual 건반 판정 콜백 (audio/visual은 PianoKeyboard가 이미 처리)
  const handleVirtualNoteOn = useCallback((note: number, velocity: number) => {
    if (playbackState !== 'playing') return  // 시작 전엔 소리만

    const target = scoreNotes[currentNoteIndex]
    if (!target) return
    const event: NoteEvent = { noteNumber: note, velocity, timestamp: performance.now(), type: 'on', channel: 0, source: 'virtual' }

    if (mode === 'wait') {
      if (matchesTarget(note, target)) {
        const result = judgeNote(event, target, user?.settings.timingTolerance ?? 100)
        recordResult(result)
        showVerdictFor(result.verdict)
        advanceNoteIndex()
        startTimeRef.current = performance.now() - target.startTimeMs
      } else {
        showVerdictFor('miss')
      }
    } else {
      const result = judgeNote({ ...event, timestamp: performance.now() - startTimeRef.current }, target, user?.settings.timingTolerance ?? 100)
      recordResult(result)
      showVerdictFor(result.verdict)
      if (note === target.noteNumber) advanceNoteIndex()
    }
  }, [playbackState, scoreNotes, currentNoteIndex, mode, user, recordResult, advanceNoteIndex, showVerdictFor])

  // MIDI 초기화 — 모든 기기 동시 연결
  useEffect(() => {
    midiEngine.init()
      .then((inputs) => {
        if (inputs.length > 0) {
          setMidiDeviceName(inputs.map((i) => i.name ?? 'MIDI').join(', '))
        }
      })
      .catch(() => {})

    midiEngine.on(handleExternalNoteEvent)

    const handleConnection = (inputs: MIDIInput[]) => {
      if (inputs.length > 0) {
        setMidiDeviceName(inputs.map((i) => i.name ?? 'MIDI').join(', '))
      } else {
        setMidiDeviceName(null)
      }
    }
    midiEngine.onConnection(handleConnection)

    return () => {
      midiEngine.off(handleExternalNoteEvent)
      midiEngine.offConnection(handleConnection)
    }
  }, [handleExternalNoteEvent])

  // 마이크 입력
  useEffect(() => {
    if (user?.settings.inputMode !== 'mic') return
    micEngine.start().catch(console.error)
    micEngine.on(handleExternalNoteEvent)
    return () => { micEngine.off(handleExternalNoteEvent); micEngine.stop() }
  }, [user?.settings.inputMode, handleExternalNoteEvent])

  const handleStart = async () => {
    await audioEngine.init()
    resetSession()
    startTimeRef.current = performance.now()
    setPlaybackState('playing')
  }

  const handlePause = () => {
    setPlaybackState(playbackState === 'playing' ? 'paused' : 'playing')
  }

  const handleFinish = async () => {
    setPlaybackState('finished')
    if (!currentSong || !user) return
    const session: PracticeSession = {
      sessionId: crypto.randomUUID(),
      userId: user.userId,
      songId: currentSong.songId,
      startedAt: sessionStartRef.current,
      endedAt: new Date().toISOString(),
      mode,
      totalScore: liveScore,
      pitchAccuracy: 0,
      timingAccuracy: 0,
      completionRate: 0,
      noteResults: usePracticeStore.getState().noteResults,
    }
    await saveSession(session)
    navigate(`/results/${session.sessionId}`)
  }

  if (!currentSong) {
    return (
      <div className="practice-screen practice-screen--loading">
        <p>곡을 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="practice-screen">
      <header className="practice-header">
        <button className="btn-icon" onClick={() => navigate(-1)}>←</button>
        <div className="practice-header__info">
          <h2>{currentSong.title}</h2>
          <span>{currentSong.artist}</span>
        </div>
        <div className="practice-header__controls">
          <select value={mode} onChange={(e) => setMode(e.target.value as 'wait' | 'play')}>
            <option value="wait">대기 모드</option>
            <option value="play">자동 진행</option>
          </select>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as 'falling' | 'sheet')}>
            <option value="falling">폴링 노트</option>
            <option value="sheet">악보</option>
          </select>
          <span className="bpm-badge">♩ {bpm}</span>
          <span className={`midi-badge ${midiDeviceName ? 'midi-badge--connected' : ''}`}>
            {midiDeviceName ? `🎹 ${midiDeviceName}` : '🎹 MIDI 없음'}
          </span>
        </div>
        <div className="practice-header__score">
          <div className="score-display">{liveScore}</div>
          {combo > 1 && <div className="combo-display">{combo}× 콤보!</div>}
        </div>
      </header>

      <main className="practice-main" style={{ position: 'relative' }}>
        {viewMode === 'falling'
          ? <FallingNotes notes={scoreNotes} />
          : <SheetScore notes={scoreNotes} />
        }
        {showVerdict && lastVerdict && <VerdictBadge verdict={lastVerdict} />}
      </main>

      <footer className="practice-footer">
        <div className="practice-piano">
          <PianoKeyboard onNoteOn={handleVirtualNoteOn} />
        </div>
        <div className="practice-controls">
          {playbackState === 'idle' && (
            <button className="btn btn--primary" onClick={handleStart}>시작</button>
          )}
          {(playbackState === 'playing' || playbackState === 'paused') && (
            <>
              <button className="btn" onClick={handlePause}>
                {playbackState === 'playing' ? '일시정지' : '재개'}
              </button>
              <button className="btn btn--danger" onClick={handleFinish}>완료</button>
            </>
          )}
          {playbackState === 'finished' && (
            <button className="btn btn--primary" onClick={() => navigate(-1)}>홈으로</button>
          )}
        </div>
      </footer>
    </div>
  )
}
