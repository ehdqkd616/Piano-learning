import { PitchDetector } from 'pitchy'
import type { NoteEvent } from '@/types'

type NoteCallback = (event: NoteEvent) => void

const RMS_THRESHOLD = 0.02     // 노이즈 게이팅 (약 -34 dBFS)
const DETECT_INTERVAL_MS = 30  // 검출 간격
const NOTE_ON_THRESHOLD = 3    // N번 연속 같은 음 검출 시 NoteOn

function freqToMidi(hz: number): number {
  return Math.round(69 + 12 * Math.log2(hz / 440))
}

function calcRMS(buffer: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
  return Math.sqrt(sum / buffer.length)
}

class MicEngine {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private detector: PitchDetector<Float32Array> | null = null
  private stream: MediaStream | null = null
  private rafId: number | null = null
  private listeners: NoteCallback[] = []

  private lastNote = -1
  private consecutiveCount = 0
  private currentNote = -1
  private lastDetectTime = 0

  async start() {
    this.context = new AudioContext({ sampleRate: 44100 })
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    const source = this.context.createMediaStreamSource(this.stream)
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 4096
    source.connect(this.analyser)

    this.detector = PitchDetector.forFloat32Array(this.analyser.fftSize)
    this.loop()
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.context?.close()
    this.context = null
    this.analyser = null
    this.stream = null
    this.lastNote = -1
    this.currentNote = -1
  }

  on(cb: NoteCallback) { this.listeners.push(cb) }
  off(cb: NoteCallback) { this.listeners = this.listeners.filter((l) => l !== cb) }

  private loop() {
    this.rafId = requestAnimationFrame(() => this.loop())
    const now = performance.now()
    if (now - this.lastDetectTime < DETECT_INTERVAL_MS) return
    this.lastDetectTime = now
    this.detect()
  }

  private detect() {
    if (!this.analyser || !this.detector) return
    const buffer = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(buffer)

    const rms = calcRMS(buffer)
    if (rms < RMS_THRESHOLD) {
      // 묵음 → NoteOff 처리
      if (this.currentNote >= 0) {
        this.emit({ noteNumber: this.currentNote, velocity: 0, timestamp: performance.now(), type: 'off', channel: 0, source: 'mic' })
        this.currentNote = -1
        this.lastNote = -1
        this.consecutiveCount = 0
      }
      return
    }

    const [frequency, clarity] = this.detector.findPitch(buffer, this.context!.sampleRate)
    if (clarity < 0.9 || frequency < 27.5) return  // 낮은 신뢰도 제외

    const midi = freqToMidi(frequency)
    if (midi < 21 || midi > 108) return  // 피아노 범위 외

    if (midi === this.lastNote) {
      this.consecutiveCount++
    } else {
      this.lastNote = midi
      this.consecutiveCount = 1
    }

    if (this.consecutiveCount === NOTE_ON_THRESHOLD) {
      if (this.currentNote !== midi) {
        if (this.currentNote >= 0) {
          this.emit({ noteNumber: this.currentNote, velocity: 0, timestamp: performance.now(), type: 'off', channel: 0, source: 'mic' })
        }
        const velocity = Math.min(127, Math.round(rms * 400))
        this.emit({ noteNumber: midi, velocity, timestamp: performance.now(), type: 'on', channel: 0, source: 'mic' })
        this.currentNote = midi
      }
    }
  }

  private emit(event: NoteEvent) {
    this.listeners.forEach((cb) => cb(event))
  }
}

export const micEngine = new MicEngine()
