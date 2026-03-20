/**
 * NovelForge - 时间线状态管理 (Zustand)
 *
 * 管理：
 * - 自定义纪年系统（纪元名 + 年/月/日）
 * - 多条时间线
 * - 时间线上的事件（关联角色与章节）
 */
import { create } from 'zustand'

// ==========================================
// 类型定义
// ==========================================

export interface Timeline {
  id: number
  name: string
  era_name: string      // 纪元名称，如"太初历"
  description: string
  sort_order: number
}

export interface TimelineEvent {
  id: number
  timeline_id: number
  title: string
  description: string
  year: number
  month: number | null
  day: number | null
  sort_order: number
}

/** 事件绑定的角色 */
export interface EventCharacter {
  event_id: number
  character_id: number
  character_name: string
  role: string  // 角色在事件中的身份（主角、配角等）
}

// ==========================================
// Store
// ==========================================

interface TimelineState {
  timelines: Timeline[]
  events: TimelineEvent[]
  activeTimelineId: number | null
  loading: boolean

  setActiveTimeline: (id: number | null) => void

  // 时间线 CRUD
  loadTimelines: () => Promise<void>
  createTimeline: (name: string, eraName: string, description: string) => Promise<number>
  updateTimeline: (id: number, data: { name?: string; era_name?: string; description?: string }) => Promise<void>
  deleteTimeline: (id: number) => Promise<void>

  // 事件 CRUD
  loadEvents: (timelineId: number) => Promise<void>
  createEvent: (timelineId: number, title: string, year: number, month?: number | null, day?: number | null) => Promise<number>
  updateEvent: (id: number, data: { title?: string; description?: string; year?: number; month?: number | null; day?: number | null }) => Promise<void>
  deleteEvent: (id: number) => Promise<void>

  // 事件-角色关联
  getEventCharacters: (eventId: number) => Promise<EventCharacter[]>
  addEventCharacter: (eventId: number, characterId: number, role: string) => Promise<void>
  removeEventCharacter: (eventId: number, characterId: number) => Promise<void>
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  timelines: [],
  events: [],
  activeTimelineId: null,
  loading: false,

  setActiveTimeline: (id) => {
    set({ activeTimelineId: id })
    if (id) get().loadEvents(id)
  },

  // ==========================================
  // 时间线 CRUD
  // ==========================================

  loadTimelines: async () => {
    set({ loading: true })
    try {
      const timelines = await window.api.dbQuery(
        'SELECT * FROM timelines ORDER BY sort_order, id'
      ) as Timeline[]
      set({ timelines, loading: false })
      // 自动选中第一条 / 刷新已选中时间线的事件
      if (timelines.length > 0 && !get().activeTimelineId) {
        get().setActiveTimeline(timelines[0].id)
      } else if (get().activeTimelineId) {
        // 已有选中时间线时也要刷新事件（可能在其他页面新增了事件）
        await get().loadEvents(get().activeTimelineId!)
      }
    } catch (err) {
      console.error('加载时间线失败:', err)
      set({ loading: false })
    }
  },

  createTimeline: async (name, eraName, description) => {
    const result = await window.api.dbRun(
      'INSERT INTO timelines (name, era_name, description) VALUES (?, ?, ?)',
      [name, eraName, description]
    )
    await get().loadTimelines()
    return Number(result.lastInsertRowid)
  },

  updateTimeline: async (id, data) => {
    const sets: string[] = []
    const params: unknown[] = []
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name) }
    if (data.era_name !== undefined) { sets.push('era_name = ?'); params.push(data.era_name) }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description) }
    params.push(id)
    await window.api.dbRun(`UPDATE timelines SET ${sets.join(', ')} WHERE id = ?`, params)
    await get().loadTimelines()
  },

  deleteTimeline: async (id) => {
    await window.api.dbRun('DELETE FROM timelines WHERE id = ?', [id])
    if (get().activeTimelineId === id) {
      set({ activeTimelineId: null, events: [] })
    }
    await get().loadTimelines()
  },

  // ==========================================
  // 事件 CRUD
  // ==========================================

  loadEvents: async (timelineId) => {
    try {
      const events = await window.api.dbQuery(
        'SELECT * FROM events WHERE timeline_id = ? ORDER BY year, month, day, sort_order',
        [timelineId]
      ) as TimelineEvent[]
      set({ events })
    } catch (err) {
      console.error('加载事件失败:', err)
    }
  },

  createEvent: async (timelineId, title, year, month = null, day = null) => {
    const result = await window.api.dbRun(
      'INSERT INTO events (timeline_id, title, year, month, day) VALUES (?, ?, ?, ?, ?)',
      [timelineId, title, year, month, day]
    )
    await get().loadEvents(timelineId)
    return Number(result.lastInsertRowid)
  },

  updateEvent: async (id, data) => {
    const sets: string[] = []
    const params: unknown[] = []
    if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title) }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description) }
    if (data.year !== undefined) { sets.push('year = ?'); params.push(data.year) }
    if (data.month !== undefined) { sets.push('month = ?'); params.push(data.month) }
    if (data.day !== undefined) { sets.push('day = ?'); params.push(data.day) }
    params.push(id)
    await window.api.dbRun(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, params)
    const tid = get().activeTimelineId
    if (tid) await get().loadEvents(tid)
  },

  deleteEvent: async (id) => {
    await window.api.dbRun('DELETE FROM events WHERE id = ?', [id])
    const tid = get().activeTimelineId
    if (tid) await get().loadEvents(tid)
  },

  // ==========================================
  // 事件-角色关联
  // ==========================================

  getEventCharacters: async (eventId) => {
    return await window.api.dbQuery(
      `SELECT ec.event_id, ec.character_id, c.name as character_name, ec.role
       FROM event_characters ec
       JOIN characters c ON ec.character_id = c.id
       WHERE ec.event_id = ?`,
      [eventId]
    ) as EventCharacter[]
  },

  addEventCharacter: async (eventId, characterId, role) => {
    await window.api.dbRun(
      'INSERT OR IGNORE INTO event_characters (event_id, character_id, role) VALUES (?, ?, ?)',
      [eventId, characterId, role]
    )
  },

  removeEventCharacter: async (eventId, characterId) => {
    await window.api.dbRun(
      'DELETE FROM event_characters WHERE event_id = ? AND character_id = ?',
      [eventId, characterId]
    )
  },
}))

/** 格式化虚拟日期显示 */
export function formatTimelineDate(eraName: string, year: number, month?: number | null, day?: number | null): string {
  let s = `${eraName} ${year}年`
  if (month) s += `${month}月`
  if (day) s += `${day}日`
  return s
}
