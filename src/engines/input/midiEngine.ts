import type { NoteEvent } from '@/types'

type NoteCallback = (event: NoteEvent) => void
type ConnectionCallback = (inputs: MIDIInput[]) => void

class MidiEngine {
  private access: MIDIAccess | null = null
  private listeners: NoteCallback[] = []
  private connectionListeners: ConnectionCallback[] = []
  // null = 모든 기기 연결 / Set = 선택한 기기만 연결
  private selectedIds: Set<string> | null = null

  async init(): Promise<MIDIInput[]> {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API가 이 브라우저에서 지원되지 않습니다.')
    }
    if (this.access) return this.getInputs()
    this.access = await navigator.requestMIDIAccess({ sysex: false })
    this.access.onstatechange = () => {
      this.applyConnections()
      const inputs = this.getInputs()
      this.connectionListeners.forEach((cb) => cb(inputs))
    }
    this.applyConnections()
    return this.getInputs()
  }

  getInputs(): MIDIInput[] {
    if (!this.access) return []
    return Array.from(this.access.inputs.values())
  }

  /** 현재 selectedIds에 따라 메시지 핸들러 적용 */
  private applyConnections(): void {
    const ids = this.selectedIds
    this.getInputs().forEach((input) => {
      if (ids === null || ids.has(input.id)) {
        input.onmidimessage = (event: MIDIMessageEvent) => this.handleMessage(event)
      } else {
        input.onmidimessage = null
      }
    })
  }

  /** 선택된 기기 ID 목록으로 연결 업데이트 */
  setSelectedInputs(ids: Set<string>): void {
    this.selectedIds = new Set(ids)
    this.applyConnections()
  }

  /** 현재 선택 상태 반환 (null = 전체 선택) */
  getSelectedIds(): Set<string> | null {
    return this.selectedIds
  }

  /** 전체 연결 (선택 초기화) */
  connectAll(): void {
    this.selectedIds = null
    this.applyConnections()
  }

  disconnectAll(): void {
    this.getInputs().forEach((input) => { input.onmidimessage = null })
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
