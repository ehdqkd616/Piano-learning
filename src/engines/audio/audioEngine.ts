import * as Tone from 'tone'

class AudioEngine {
  private synth: Tone.PolySynth | null = null
  private ready = false

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
    if (!this.synth) return
    try {
      const freq = Tone.Frequency(noteNumber, 'midi').toFrequency()
      this.synth.triggerAttack(freq, Tone.now(), velocity / 127)
    } catch { /* already active */ }
  }

  noteOff(noteNumber: number): void {
    if (!this.synth) return
    try {
      const freq = Tone.Frequency(noteNumber, 'midi').toFrequency()
      this.synth.triggerRelease(freq, Tone.now())
    } catch { /* ignore */ }
  }

  isReady(): boolean { return this.ready }
}

export const audioEngine = new AudioEngine()
