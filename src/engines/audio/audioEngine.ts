import * as Tone from 'tone'

class AudioEngine {
  private synth: Tone.PolySynth | null = null
  private ready = false
  // 실물 MIDI 건반은 노이즈나 빠른 재입력으로 동일 노트에 대해 note-on이 중복 전송되거나
  // note-off 없이 재입력되는 경우가 흔하다. 이때 같은 주파수에 triggerAttack/triggerRelease를
  // 겹쳐 호출하면 Tone.js PolySynth 내부 보이스 스케줄링이 깨져 비동기 예외가 발생하므로,
  // 눌려있는 노트를 직접 추적해 중복 호출을 막는다.
  private activeNotes = new Set<number>()

  async init(): Promise<void> {
    if (this.ready) return
    await Tone.start()
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.006, decay: 0.3, sustain: 0.6, release: 1.5 },
      volume: -8,
    }).toDestination()
    this.ready = true
  }

  noteOn(noteNumber: number, velocity = 80): void {
    if (!this.synth || this.activeNotes.has(noteNumber)) return
    try {
      const freq = Tone.Frequency(noteNumber, 'midi').toFrequency()
      this.synth.triggerAttack(freq, Tone.now(), velocity / 127)
      this.activeNotes.add(noteNumber)
    } catch { /* already active */ }
  }

  noteOff(noteNumber: number): void {
    if (!this.synth || !this.activeNotes.has(noteNumber)) return
    try {
      const freq = Tone.Frequency(noteNumber, 'midi').toFrequency()
      this.synth.triggerRelease(freq, Tone.now())
    } catch { /* ignore */ } finally {
      this.activeNotes.delete(noteNumber)
    }
  }

  isReady(): boolean { return this.ready }
}

export const audioEngine = new AudioEngine()
