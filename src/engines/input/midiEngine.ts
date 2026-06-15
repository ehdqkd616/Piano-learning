import type { NoteEvent } from '@/types'

type NoteCallback = (event: NoteEvent) => void
type ConnectionCallback = (inputs: MIDIInput[]) => void

class MidiEngine {
  private access: MIDIAccess | null = null
  private listeners: NoteCallback[] = []
  private connectionListeners: ConnectionCallback[] = []

  async init(): Promise<MIDIInput[]> {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API가 이 브라우저에서 지원되지 않습니다.')
    }
    if (this.access) return this.getInputs()
    this.access = await navigator.requestMIDIAccess({ sysex: false })
    this.access.onstatechange = () => {
      this.connectAll()
      const inputs = this.getInputs()
      this.connectionListeners.forEach((cb) => cb(inputs))
    }
    // 초기화 시 모든 기기 연결
    this.connectAll()
    return this.getInputs()
  }

  getInputs(): MIDIInput[] {
    if (!this.access) return []
    return Array.from(this.access.inputs.values())
  }

  /** 현재 연결 가능한 모든 MIDI 입력에 메시지 핸들러 등록 */
  connectAll(): void {
    this.getInputs().forEach((input) => {
      input.onmidimessage = (event: MIDIMessageEvent) => this.handleMessage(event)
    })
  }

  /** 단일 기기 연결 (설정 화면 선택용) */
  connect(input: MIDIInput) {
    // 기존 전체 연결 해제 후 선택 기기만 연결
    this.disconnectAll()
    input.onmidimessage = (event: MIDIMessageEvent) => this.handleMessage(event)
  }

  disconnectAll(): void {
    this.getInputs().forEach((input) => {
      input.onmidimessage = null
    })
  }

  disconnect() { this.disconnectAll() }

  on(cb: NoteCallback) { this.listeners.push(cb) }
  off(cb: NoteCallback) { this.listeners = this.listeners.filter((l) => l !== cb) }
  onConnection(cb: ConnectionCallback) { this.connectionListeners.push(cb) }
  offConnection(cb: ConnectionCallback) {
    this.connectionListeners = this.connectionListeners.filter((l) => l !== cb)
  }

  private handleMessage(event: MIDIMessageEvent) {
    if (!event.data) return
    const [status, note, velocity] = Array.from(event.data)
    const command = status & 0xf0
    const channel = status & 0x0f
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
