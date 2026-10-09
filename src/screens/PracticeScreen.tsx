import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePracticeStore } from '@/store/usePracticeStore'
import { useAppStore } from '@/store/useAppStore'
import { midiEngine } from '@/engines/input/midiEngine'
import { micEngine } from '@/engines/input/micEngine'
import { audioEngine } from '@/engines/audio/audioEngine'
import { judgeNote, matchesTarget, matchPlayNote, calcScore } from '@/engines/judgment/judgmentEngine'
import { SheetScore } from '@/components/score/SheetScore'
import { FallingNotes } from '@/components/score/FallingNotes'
import { PianoKeyboard } from '@/components/piano/PianoKeyboard'
import { VerdictBadge } from '@/components/feedback/VerdictBadge'
import { saveSession } from '@/api'
import type { NoteEvent, ScoreNote, SongNote, Verdict, PracticeSession } from '@/types'
import './PracticeScreen.css'

function buildScoreNotes(notes: SongNote[], bpm: number): ScoreNote[] {
  const beatMs = (60 / bpm) * 1000
  let timeMs = 0
  return notes.map((n, i) => {
    const durationMs = n.beats * beatMs
    const scoreNote: ScoreNote = {
      index: i,
      noteNumber: n.noteNumber,
      startTimeMs: timeMs,
      durationMs: durationMs * 0.9,
      hand: 'right',
      measure: Math.floor(i / 4),
      beat: i % 4,
    }
    timeMs += durationMs
    return scoreNote
  })
}

export function PracticeScreen() {
  const { songId } = useParams<{ songId: string }>()
  const navigate = useNavigate()
  const songs = useAppStore((s) => s.songs)
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)

  const {
    currentSong, scoreNotes, mode, playbackState, bpm,
    liveScore, combo, currentNoteIndex,
    loadSong, setMode, setPlaybackState, resetSession,
    pressNote, releaseNote, setCurrentTimeMs,
  } = usePracticeStore()

  const [viewMode, setViewMode] = useState<'falling' | 'sheet'>('falling')
  const [lastVerdict, setLastVerdict] = useState<Verdict | null>(null)
  const [showVerdict, setShowVerdict] = useState(false)
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null)

  const verdictTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  const sessionStartRef = useRef<string>('')
  const savingRef = useRef(false)
  const pausedAtRef = useRef<number | null>(null)

  // 곡 로드
  useEffect(() => {
    const song = songs.find((s) => s.songId === songId)
    if (!song) return
    const notes = buildScoreNotes(song.notes, song.bpm)
    loadSong(song, notes)
    sessionStartRef.current = new Date().toISOString()
  }, [songId, songs, loadSong])

  const showVerdictFor = useCallback((verdict: Verdict) => {
    setLastVerdict(verdict)
    setShowVerdict(true)
    if (verdictTimer.current) clearTimeout(verdictTimer.current)
    verdictTimer.current = setTimeout(() => setShowVerdict(false), 700)
  }, [])

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
        // 자동 진행 모드: 히트라인을 그냥 지나친 노트는 자동으로 스킵 처리해
        // currentNoteIndex가 실제로 흘러가는 시간(노트)과 계속 맞물리게 한다.
        // (이게 없으면 한 노트를 놓쳤을 때 이후 입력이 전부 옛 타겟과 비교되어 계속 MISS로 처리됨)
        // 유예 시간은 고정값이 아니라 "다음 노트가 시작되기 전까지"로 둬서, 느린 곡/빠른 곡
        // 모두에서 실제로 칠 수 있는 만큼의 시간을 보장한다.
        for (;;) {
          const s = usePracticeStore.getState()
          const target = s.scoreNotes[s.currentNoteIndex]
          if (!target) break
          const nextNote = s.scoreNotes[s.currentNoteIndex + 1]
          const deadline = nextNote ? nextNote.startTimeMs : target.startTimeMs + target.durationMs + 500
          if (elapsed <= deadline) break

          s.recordResult({
            noteIndex: target.index,
            noteNumber: target.noteNumber,
            expectedTimeMs: target.startTimeMs,
            actualTimeMs: elapsed,
            timingDeltaMs: elapsed - target.startTimeMs,
            verdict: 'skip',
          })
          s.advanceNoteIndex()
          showVerdictFor('skip')
        }
      }

      // 모든 노트 완료 확인 (위에서 자동 스킵으로 인덱스가 바뀌었을 수 있으므로 최신 상태를 다시 읽는다)
      // 마지막 음을 누르는 순간 끝내면 손을 떼기 전에 화면이 바뀌어 note-off를 못 받고 소리가 계속 났다.
      // 마지막 음의 길이만큼 기다렸다가 끝낸다.
      const latest = usePracticeStore.getState()
      const lastNote = latest.scoreNotes[latest.scoreNotes.length - 1]
      if (
        lastNote &&
        latest.currentNoteIndex >= latest.scoreNotes.length &&
        latest.playbackState === 'playing' &&
        performance.now() - startTimeRef.current >= lastNote.startTimeMs + lastNote.durationMs
      ) {
        latest.setPlaybackState('finished')
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playbackState, setCurrentTimeMs, showVerdictFor])

  // 모든 입력(MIDI·마이크·화면 건반)의 판정은 여기 한 곳을 거친다.
  // React 렌더 시점의 값이 아니라 store의 최신 상태를 읽는다. 렌더 값으로 판정하면 화면이 갱신되기 전에
  // 들어온 다음 입력이 이미 판정한 음표와 다시 비교되어, 같은 음을 두 번 맞힌 것으로 처리하고 다음 음표를 건너뛰었다.
  const judgeInput = useCallback((noteNumber: number) => {
    const s = usePracticeStore.getState()
    if (s.playbackState !== 'playing') return  // 시작 전엔 소리만, 판정 없음
    const target = s.scoreNotes[s.currentNoteIndex]
    if (!target) return

    const now = performance.now() - startTimeRef.current
    const tolerance = user?.settings.timingTolerance ?? 100
    const event: NoteEvent = { noteNumber, velocity: 0, timestamp: now, type: 'on', channel: 0, source: 'virtual' }

    if (s.mode === 'wait') {
      if (matchesTarget(noteNumber, target)) {
        const result = judgeNote(event, target, tolerance)
        s.recordResult(result)
        showVerdictFor(result.verdict)
        s.advanceNoteIndex()
        // wait 모드: 다음 노트 향해 시간 재개 (startTimeRef를 현재 target 시각으로 보정)
        startTimeRef.current = performance.now() - target.startTimeMs
      } else {
        showVerdictFor('miss')
      }
      return
    }

    // 자동 진행 모드: 현재 차례 음표만이 아니라 곧 칠 음표 중 음높이가 맞는 음표를 찾는다
    const { target: matched, skipped } = matchPlayNote(s.scoreNotes, s.currentNoteIndex, noteNumber, now)
    if (!matched) {
      const result = judgeNote(event, target, tolerance)  // 음높이가 달라 miss
      s.recordResult(result)
      showVerdictFor(result.verdict)
      return
    }
    skipped.forEach((n) => s.recordResult({
      noteIndex: n.index,
      noteNumber: n.noteNumber,
      expectedTimeMs: n.startTimeMs,
      actualTimeMs: now,
      timingDeltaMs: now - n.startTimeMs,
      verdict: 'skip',
    }))
    const result = judgeNote(event, matched, tolerance)
    s.recordResult(result)
    showVerdictFor(result.verdict)
    s.jumpToNoteIndex(matched.index + 1)
  }, [user, showVerdictFor])

  // MIDI/Mic 이벤트 핸들러
  const handleExternalNoteEvent = useCallback((event: NoteEvent) => {
    if (event.type === 'off') {
      audioEngine.noteOff(event.noteNumber)
      releaseNote(event.noteNumber)
      return
    }
    // 이미 눌려 있는 음의 note-on은 같은 신호가 다른 MIDI 포트(오디오 인터페이스·가상 포트)로
    // 한 번 더 들어온 것이다. 실제 건반은 떼지 않고 다시 누를 수 없으므로 무시한다.
    if (usePracticeStore.getState().activeNotes.has(event.noteNumber)) return

    audioEngine.noteOn(event.noteNumber, event.velocity)
    pressNote(event)
    judgeInput(event.noteNumber)
  }, [pressNote, releaseNote, judgeInput])

  // virtual 건반 판정 콜백 (audio/visual은 PianoKeyboard가 이미 처리)
  const handleVirtualNoteOn = useCallback((note: number) => {
    judgeInput(note)
  }, [judgeInput])

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
    savingRef.current = false
    pausedAtRef.current = null
    // 곡을 연 시각이 아니라 실제로 연주를 시작한 시각을 기록한다
    sessionStartRef.current = new Date().toISOString()
    startTimeRef.current = performance.now()
    setPlaybackState('playing')
  }

  const handlePause = () => {
    if (playbackState === 'playing') {
      pausedAtRef.current = performance.now()
      setPlaybackState('paused')
      return
    }
    // 멈춰 있던 시간만큼 시작 기준점을 미뤄야 곡 시간이 앞으로 튀지 않는다
    // (예전에는 재개하면 멈춘 시간만큼 곡이 건너뛰어 그 사이 음표가 모두 skip 처리됐다)
    if (pausedAtRef.current !== null) {
      startTimeRef.current += performance.now() - pausedAtRef.current
      pausedAtRef.current = null
    }
    setPlaybackState('playing')
  }

  // 연습 기록 저장. 완료 버튼을 누르거나 곡 끝까지 쳐서 자동으로 끝났을 때 한 번만 실행한다.
  // (예전에는 완료 버튼으로만 저장되어, 끝까지 친 연습은 기록이 남지 않았다)
  const saveAndShowResults = useCallback(async () => {
    const { currentSong: song, scoreNotes: notes, noteResults } = usePracticeStore.getState()
    if (!song || !user || savingRef.current) return
    savingRef.current = true
    const score = calcScore(noteResults, notes.length)
    const session: PracticeSession = {
      sessionId: crypto.randomUUID(),
      userId: user.userId,
      songId: song.songId,
      startedAt: sessionStartRef.current,
      endedAt: new Date().toISOString(),
      mode,
      totalScore: score.total,
      pitchAccuracy: score.pitchAccuracy,
      timingAccuracy: score.timingAccuracy,
      completionRate: score.completionRate,
      noteResults,
    }
    try {
      const updatedUser = await saveSession(session)
      setUser(updatedUser)
      navigate(`/results/${session.sessionId}`)
    } catch (err) {
      console.error('연습 기록 저장 실패:', err)
      savingRef.current = false
    }
  }, [user, mode, setUser, navigate])

  const handleFinish = () => {
    setPlaybackState('finished')
  }

  useEffect(() => {
    if (playbackState !== 'finished') return
    audioEngine.releaseAll()
    usePracticeStore.getState().releaseAllNotes()
    saveAndShowResults()
  }, [playbackState, saveAndShowResults])

  // 화면을 떠나면 눌려 있던 음을 모두 끈다 (떠난 뒤 들어오는 note-off는 받을 곳이 없다)
  useEffect(() => () => {
    audioEngine.releaseAll()
    usePracticeStore.getState().releaseAllNotes()
  }, [])

  // 곡 목록은 RequireAuth가 미리 불러오므로, 목록에 없으면 잘못된 주소다
  if (!songs.some((s) => s.songId === songId)) {
    return (
      <div className="practice-screen practice-screen--loading">
        <p>곡을 찾을 수 없습니다.</p>
        <button className="btn btn--primary" onClick={() => navigate('/library')}>곡 목록으로</button>
      </div>
    )
  }
  // 이전에 연습한 곡이 store에 남아 있을 수 있으므로 지금 주소의 곡이 로드됐는지 확인한다
  if (!currentSong || currentSong.songId !== songId) {
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
