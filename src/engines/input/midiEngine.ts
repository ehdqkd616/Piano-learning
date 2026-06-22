import type { NoteEvent } from '@/types'
import { logger } from '@/utils/logger'

type NoteCallback = (event: NoteEvent) => void
type ConnectionCallback = (inputs: MIDIInput[]) => void

class MidiEngine {
  private access: MIDIAccess | null = null
  private listeners: NoteCallback[] = []
  private connectionListeners: ConnectionCallback[] = []
  // null = 모든 기기 활성 / Set = 선택된 기기만 활성
  private selectedIds: Set<string> | null = null

  async init(): Promise<MIDIInput[]> {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API가 지원되지 않습니다.')
    }
    if (this.access) {
      this.ensureHandlers()
      return this.getInputs()
    }
    this.access = await navigator.requestMIDIAccess({ sysex: false })
    this.access.onstatechange = () => {
      this.ensureHandlers()
      this.connectionListeners.forEach((cb) => cb(this.getInputs()))
    }
    this.ensureHandlers()
    return this.getInputs()
  }

  getInputs(): MIDIInput[] {
    if (!this.access) return []
    return Array.from(this.access.inputs.values())
  }

  /**
   * 각 MIDIInput에 핸들러를 한 번만 등록.
   * 핸들러 내부에서 selectedIds를 실시간 확인 → 별도의 disconnect 처리 불필요.
   */
  private ensureHandlers(): void {
    this.getInputs().forEach((input) => {
      if (input.onmidimessage) return  // 이미 등록됨
      const id = input.id
      logger.midi(`MIDI 기기 연결: ${input.name ?? id}`)
      input.onmidimessage = (event: MIDIMessageEvent) => {
        if (this.selectedIds !== null && !this.selectedIds.has(id)) return
        this.handleMessage(event)
      }
    })
  }

  /** 선택 기기 갱신 — 핸들러 재등록 없이 this.selectedIds만 업데이트 */
  setSelectedInputs(ids: Set<string>): void {
    this.selectedIds = new Set(ids)
    const names = this.getInputs()
      .filter((i) => ids.has(i.id))
      .map((i) => i.name ?? i.id)
      .join(', ')
    logger.midi(`MIDI 선택 변경: [${names || '없음'}]`)
  }

  getSelectedIds(): Set<string> | null {
    return this.selectedIds
  }

  connectAll(): void {
    this.selectedIds = null
    this.ensureHandlers()
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
      logger.note(`NOTE ON  ${note} vel=${velocity} ch=${channel}`)
      this.emit({ noteNumber: note, velocity, timestamp: event.timeStamp, type: 'on', channel, source: 'midi' })
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      logger.note(`NOTE OFF ${note} ch=${channel}`)
      this.emit({ noteNumber: note, velocity: 0, timestamp: event.timeStamp, type: 'off', channel, source: 'midi' })
    }
  }

  private emit(event: NoteEvent) {
    this.listeners.forEach((cb) => cb(event))
  }
}

export const midiEngine = new MidiEngine()
