import type { NoteEvent } from '@/types'

type NoteCallback = (event: NoteEvent) => void

class MidiEngine {
  private access: MIDIAccess | null = null
  private listeners: NoteCallback[] = []
  private activeInput: MIDIInput | null = null

  async init(): Promise<MIDIInput[]> {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API가 이 브라우저에서 지원되지 않습니다.')
    }
    this.access = await navigator.requestMIDIAccess({ sysex: false })
    return Array.from(this.access.inputs.values())
  }

  getInputs(): MIDIInput[] {
    if (!this.access) return []
    return Array.from(this.access.inputs.values())
  }

  connect(input: MIDIInput) {
    if (this.activeInput) this.activeInput.onmidimessage = null
    this.activeInput = input
    input.onmidimessage = (event: MIDIMessageEvent) => this.handleMessage(event)
  }

  disconnect() {
    if (this.activeInput) {
      this.activeInput.onmidimessage = null
      this.activeInput = null
    }
  }

  on(cb: NoteCallback) {
    this.listeners.push(cb)
  }

  off(cb: NoteCallback) {
    this.listeners = this.listeners.filter((l) => l !== cb)
  }

  private handleMessage(event: MIDIMessageEvent) {
    if (!event.data) return
    const [status, note, velocity] = Array.from(event.data)
    const command = status & 0xf0
    const channel = status & 0x0f

    // NoteOn (velocity > 0) or NoteOff
    if (command === 0x90 && velocity > 0) {
      this.emit({ noteNumber: note, velocity, timestamp: event.timeStamp, type: 'on', channel, source: 'midi' })
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      this.emit({ noteNumber: note, velocity: 0, timestamp: event.timeStamp, type: 'off', channel, source: 'midi' })
    }
  }

  private emit(event: NoteEvent) {
    this.listeners.forEach((cb) => cb(event))
  }
}

export const midiEngine = new MidiEngine()
