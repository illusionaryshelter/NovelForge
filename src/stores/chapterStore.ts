/**
 * NovelForge - 章节管理状态 (Zustand)
 *
 * 两级结构：卷(Volume) → 章(Chapter)
 * 章节直接包含正文内容（TipTap JSON）和大纲。
 */
import { create } from 'zustand'

// ==========================================
// 类型定义
// ==========================================

export interface Volume {
  id: number
  title: string
  sort_order: number
}

export interface Chapter {
  id: number
  volume_id: number
  title: string
  outline: string
  content: string  // TipTap JSON 字符串
  sort_order: number
}

// ==========================================
// Store
// ==========================================

interface ChapterState {
  volumes: Volume[]
  chapters: Chapter[]
  activeVolumeId: number | null
  activeChapterId: number | null
  loading: boolean

  setActiveVolume: (id: number | null) => void
  setActiveChapter: (id: number | null) => void

  // 卷 CRUD
  loadAll: () => Promise<void>
  createVolume: (title: string) => Promise<number>
  updateVolume: (id: number, title: string) => Promise<void>
  deleteVolume: (id: number) => Promise<void>

  // 章 CRUD
  createChapter: (volumeId: number, title: string) => Promise<number>
  updateChapter: (id: number, data: { title?: string; outline?: string; content?: string }) => Promise<void>
  deleteChapter: (id: number) => Promise<void>

  // 章节-事件关联
  getChapterEvents: (chapterId: number) => Promise<{ id: number; event_id: number; title: string }[]>
  addChapterEvent: (chapterId: number, eventId: number) => Promise<void>
  removeChapterEvent: (chapterId: number, eventId: number) => Promise<void>

  // 回收站
  restoreChapter: (id: number) => Promise<void>
  restoreVolume: (id: number) => Promise<void>
  getDeletedItems: () => Promise<{ type: string; id: number; title: string }[]>

  // 拖拽排序
  reorderVolumes: (orderedIds: number[]) => Promise<void>
  reorderChapters: (volumeId: number, orderedIds: number[]) => Promise<void>

  // 辅助
  getVolumeChapters: (volumeId: number) => Chapter[]
  getActiveChapter: () => Chapter | null
}

export const useChapterStore = create<ChapterState>((set, get) => ({
  volumes: [],
  chapters: [],
  activeVolumeId: null,
  activeChapterId: null,
  loading: false,

  setActiveVolume: (id) => set({ activeVolumeId: id, activeChapterId: null }),
  setActiveChapter: (id) => set({ activeChapterId: id }),

  loadAll: async () => {
    set({ loading: true })
    try {
      const [volumes, chapters] = await Promise.all([
        window.api.dbQuery('SELECT * FROM volumes ORDER BY sort_order, id') as Promise<Volume[]>,
        window.api.dbQuery('SELECT * FROM chapters WHERE COALESCE(is_deleted,0)=0 ORDER BY sort_order, id') as Promise<Chapter[]>,
      ])
      set({ volumes, chapters, loading: false })
    } catch (err) {
      console.error('加载章节失败:', err)
      set({ loading: false })
    }
  },

  createVolume: async (title) => {
    const maxOrder = get().volumes.length
    const result = await window.api.dbRun(
      'INSERT INTO volumes (title, sort_order) VALUES (?, ?)',
      [title, maxOrder]
    )
    await get().loadAll()
    return Number(result.lastInsertRowid)
  },

  updateVolume: async (id, title) => {
    await window.api.dbRun('UPDATE volumes SET title = ? WHERE id = ?', [title, id])
    await get().loadAll()
  },

  deleteVolume: async (id) => {
    // 软删除卷下所有章节
    await window.api.dbRun('UPDATE chapters SET is_deleted = 1 WHERE volume_id = ?', [id])
    await window.api.dbRun('DELETE FROM volumes WHERE id = ?', [id])
    if (get().activeVolumeId === id) set({ activeVolumeId: null, activeChapterId: null })
    await get().loadAll()
  },

  createChapter: async (volumeId, title) => {
    const chapters = get().getVolumeChapters(volumeId)
    const result = await window.api.dbRun(
      'INSERT INTO chapters (volume_id, title, sort_order) VALUES (?, ?, ?)',
      [volumeId, title, chapters.length]
    )
    await get().loadAll()
    return Number(result.lastInsertRowid)
  },

  updateChapter: async (id, data) => {
    const sets: string[] = []
    const params: unknown[] = []
    if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title) }
    if (data.outline !== undefined) { sets.push('outline = ?'); params.push(data.outline) }
    if (data.content !== undefined) { sets.push('content = ?'); params.push(data.content) }
    if (sets.length === 0) return
    params.push(id)
    await window.api.dbRun(`UPDATE chapters SET ${sets.join(', ')} WHERE id = ?`, params)
    // 直接更新 store 中的章节，不 reload（避免每次敲键盘都查数据库）
    set(state => ({
      chapters: state.chapters.map(c => c.id === id ? { ...c, ...data } : c)
    }))
  },

  deleteChapter: async (id) => {
    // 软删除 → 回收站
    await window.api.dbRun('UPDATE chapters SET is_deleted = 1 WHERE id = ?', [id])
    if (get().activeChapterId === id) set({ activeChapterId: null })
    await get().loadAll()
  },

  getChapterEvents: async (chapterId) => {
    return await window.api.dbQuery(
      `SELECT ce.id, ce.event_id, e.title FROM chapter_events ce
       JOIN events e ON ce.event_id = e.id
       WHERE ce.chapter_id = ?`,
      [chapterId]
    ) as { id: number; event_id: number; title: string }[]
  },

  addChapterEvent: async (chapterId, eventId) => {
    await window.api.dbRun(
      'INSERT OR IGNORE INTO chapter_events (chapter_id, event_id) VALUES (?, ?)',
      [chapterId, eventId]
    )
  },

  removeChapterEvent: async (chapterId, eventId) => {
    await window.api.dbRun(
      'DELETE FROM chapter_events WHERE chapter_id = ? AND event_id = ?',
      [chapterId, eventId]
    )
  },

  getVolumeChapters: (volumeId) => get().chapters.filter(c => c.volume_id === volumeId),
  getActiveChapter: () => {
    const { chapters, activeChapterId } = get()
    return chapters.find(c => c.id === activeChapterId) || null
  },

  // 回收站
  restoreChapter: async (id) => {
    await window.api.dbRun('UPDATE chapters SET is_deleted = 0 WHERE id = ?', [id])
    await get().loadAll()
  },
  restoreVolume: async (id) => {
    await window.api.dbRun('UPDATE chapters SET is_deleted = 0 WHERE volume_id = ?', [id])
    await get().loadAll()
  },
  getDeletedItems: async () => {
    const chapters = await window.api.dbQuery(
      'SELECT id, title FROM chapters WHERE is_deleted = 1'
    ) as { id: number; title: string }[]
    return chapters.map(c => ({ type: 'chapter', id: c.id, title: c.title }))
  },

  // 拖拽排序
  reorderVolumes: async (orderedIds) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await window.api.dbRun('UPDATE volumes SET sort_order = ? WHERE id = ?', [i, orderedIds[i]])
    }
    await get().loadAll()
  },
  reorderChapters: async (_volumeId, orderedIds) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await window.api.dbRun('UPDATE chapters SET sort_order = ? WHERE id = ?', [i, orderedIds[i]])
    }
    await get().loadAll()
  },
}))
