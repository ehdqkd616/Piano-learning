import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePracticeStore } from '@/store/usePracticeStore'
import { useAppStore } from '@/store/useAppStore'
import { midiEngine } from '@/engines/input/midiEngine'
import { micEngine } from '@/engines/input/micEngine'
import { judgeNote, matchesTarget } from '@/engines/judgment/judgmentEngine'
import { SheetScore } from '@/components/score/SheetScore'
import { FallingNotes } from '@/components/score/FallingNotes'
import { PianoKeyboard } from '@/components/piano/PianoKeyboard'
import { VerdictBadge } from '@/components/feedback/VerdictBadge'
import { db, saveSession } from '@/db'
import type { NoteEvent, ScoreNote, Verdict, PracticeSession } from '@/types'
import './PracticeScreen.css'

// MIDI 파일에서 ScoreNote 배열 생성하는 데모 함수 (실제 파싱은 @tonejs/midi 사용)
function buildDemoNotes(bpm: number): ScoreNote[] {
  const beatMs = (60 / bpm) * 1000
  // 도레미파솔라시도 (C4~C5)
  const melody = [60, 62, 64, 65, 67, 69, 71, 72]
  return melody.map((note, i) => ({
    index: i,
    noteNumber: note,
    startTimeMs: i * beatMs,
    durationMs: beatMs * 0.9,
    hand: 'right',
    measure: Math.floor(i / 4),
    beat: i % 4,
  }))
}

export function PracticeScreen() {
  const { songId } = useParams<{ songId: string }>()
  const navigate = useNavigate()
  const songs = useAppStore((s) => s.songs)
  const user = useAppStore((s) => s.user)
  const inputMode = user?.settings.inputMode ?? 'virtual'

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

  // 시간 타이머 (Play Mode)
  useEffect(() => {
    if (playbackState !== 'playing') {
      cancelAnimationFrame(rafRef.current)
      return
    }
    function tick() {
      setCurrentTimeMs(performance.now() - startTimeRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playbackState, setCurrentTimeMs])

  // 판정 배지 표시
  const showVerdictFor = useCallback((verdict: Verdict) => {
    setLastVerdict(verdict)
    setShowVerdict(true)
    if (verdictTimer.current) clearTimeout(verdictTimer.current)
    verdictTimer.current = setTimeout(() => setShowVerdict(false), 700)
  }, [])

  // 노트 이벤트 처리
  const handleNoteEvent = useCallback((event: NoteEvent) => {
    if (event.type === 'off') { releaseNote(event.noteNumber); return }

    pressNote(event)

    const target = scoreNotes[currentNoteIndex]
    if (!target) return

    if (mode === 'wait') {
      if (matchesTarget(event.noteNumber, target)) {
        const result = judgeNote(
          { ...event, timestamp: performance.now() },
          target,
          user?.settings.timingTolerance ?? 100,
        )
        recordResult(result)
        showVerdictFor(result.verdict)
        advanceNoteIndex()
      } else {
        showVerdictFor('miss')
      }
    } else {
      const result = judgeNote(
        { ...event, timestamp: performance.now() - startTimeRef.current },
        target,
        user?.settings.timingTolerance ?? 100,
      )
      recordResult(result)
      showVerdictFor(result.verdict)
      if (event.noteNumber === target.noteNumber) advanceNoteIndex()
    }
  }, [scoreNotes, currentNoteIndex, mode, user, pressNote, releaseNote, recordResult, advanceNoteIndex, showVerdictFor])

  // 입력 엔진 바인딩
  useEffect(() => {
    if (inputMode === 'midi') {
      midiEngine.init().catch(() => {}).then(() => {
        const inputs = midiEngine.getInputs()
        if (inputs.length > 0) midiEngine.connect(inputs[0])
      })
      midiEngine.on(handleNoteEvent)
      return () => midiEngine.off(handleNoteEvent)
    }
    if (inputMode === 'mic') {
      micEngine.start().catch(console.error)
      micEngine.on(handleNoteEvent)
      return () => { micEngine.off(handleNoteEvent); micEngine.stop() }
    }
  }, [inputMode, handleNoteEvent])

  // 가상 건반 이벤트도 판정에 반영
  useEffect(() => {
    const store = usePracticeStore.getState()
    const unsub = usePracticeStore.subscribe((state) => {
      // 가상 건반 pressNote는 store.pressNote에서 처리하므로
      // virtual 모드 판정은 직접 처리
    })
    return unsub
  }, [])

  const handleStart = () => {
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
      {/* 상단 헤더 */}
      <header className="practice-header">
        <button className="btn-icon" onClick={() => navigate(-1)}>←</button>
        <div className="practice-header__info">
          <h2>{currentSong.title}</h2>
          <span>{currentSong.artist}</span>
        </div>
        <div className="practice-header__controls">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'wait' | 'play')}
          >
            <option value="wait">대기 모드</option>
            <option value="play">자동 진행</option>
          </select>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'falling' | 'sheet')}
          >
            <option value="falling">폴링 노트</option>
            <option value="sheet">악보</option>
          </select>
          <span className="bpm-badge">♩ {bpm}</span>
        </div>
        <div className="practice-header__score">
          <div className="score-display">{liveScore}</div>
          {combo > 1 && <div className="combo-display">{combo}× 콤보!</div>}
        </div>
      </header>

      {/* 중앙: 악보 뷰 */}
      <main className="practice-main" style={{ position: 'relative' }}>
        {viewMode === 'falling'
          ? <FallingNotes notes={scoreNotes} />
          : <SheetScore notes={scoreNotes} />
        }
        {showVerdict && lastVerdict && (
          <VerdictBadge verdict={lastVerdict} />
        )}
      </main>

      {/* 하단: 피아노 + 컨트롤 */}
      <footer className="practice-footer">
        <div className="practice-piano">
          <PianoKeyboard />
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
