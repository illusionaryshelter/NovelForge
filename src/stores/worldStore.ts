/**
 * NovelForge - 世界观状态管理 (Zustand)
 *
 * 管理世界观元素（7 个分类）和地图图片。
 * 支持树状层级嵌套。
 */
import { create } from 'zustand'

// ==========================================
// 类型定义
// ==========================================

/** 世界观分类 */
export type WorldCategory =
  | 'geography'     // 地理
  | 'environment'   // 环境
  | 'faction'       // 势力
  | 'power_system'  // 力量体系
  | 'race'          // 种族
  | 'politics'      // 政治
  | 'culture'       // 人文风俗

export const CATEGORY_LABELS: Record<WorldCategory, string> = {
  geography: '🌍 地理',
  environment: '🌿 环境',
  faction: '⚔️ 势力',
  power_system: '💫 力量体系',
  race: '👤 种族',
  politics: '🏛️ 政治',
  culture: '🎭 人文风俗',
}

export interface WorldElement {
  id: number
  category: WorldCategory
  title: string
  content: string
  parent_id: number | null
  sort_order: number
}

export interface MapImage {
  id: number
  name: string
  image_path: string
  description: string
}

// ==========================================
// Store
// ==========================================

interface WorldState {
  elements: WorldElement[]
  maps: MapImage[]
  activeCategory: WorldCategory
  loading: boolean

  setActiveCategory: (category: WorldCategory) => void

  // 元素 CRUD
  loadElements: () => Promise<void>
  createElement: (category: WorldCategory, title: string, content: string, parentId?: number | null) => Promise<number>
  updateElement: (id: number, data: { title?: string; content?: string }) => Promise<void>
  deleteElement: (id: number) => Promise<void>

  // 地图 CRUD
  loadMaps: () => Promise<void>
  addMap: (name: string, imagePath: string, description: string) => Promise<void>
  deleteMap: (id: number) => Promise<void>

  // 获取分类下的元素树
  getCategoryElements: () => WorldElement[]
}

export const useWorldStore = create<WorldState>((set, get) => ({
  elements: [],
  maps: [],
  activeCategory: 'geography',
  loading: false,

  setActiveCategory: (category) => set({ activeCategory: category }),

  loadElements: async () => {
    set({ loading: true })
    try {
      const elements = await window.api.dbQuery(
        'SELECT * FROM world_elements ORDER BY sort_order, id'
      ) as WorldElement[]
      set({ elements, loading: false })
    } catch (err) {
      console.error('加载世界观失败:', err)
      set({ loading: false })
    }
  },

  createElement: async (category, title, content, parentId = null) => {
    const result = await window.api.dbRun(
      'INSERT INTO world_elements (category, title, content, parent_id) VALUES (?, ?, ?, ?)',
      [category, title, content, parentId]
    )
    await get().loadElements()
    return Number(result.lastInsertRowid)
  },

  updateElement: async (id, data) => {
    const sets: string[] = []
    const params: unknown[] = []
    if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title) }
    if (data.content !== undefined) { sets.push('content = ?'); params.push(data.content) }
    params.push(id)
    await window.api.dbRun(`UPDATE world_elements SET ${sets.join(', ')} WHERE id = ?`, params)
    await get().loadElements()
  },

  deleteElement: async (id) => {
    await window.api.dbRun('DELETE FROM world_elements WHERE id = ?', [id])
    await get().loadElements()
  },

  loadMaps: async () => {
    const maps = await window.api.dbQuery('SELECT * FROM map_images ORDER BY id') as MapImage[]
    set({ maps })
  },

  addMap: async (name, imagePath, description) => {
    await window.api.dbRun(
      'INSERT INTO map_images (name, image_path, description) VALUES (?, ?, ?)',
      [name, imagePath, description]
    )
    await get().loadMaps()
  },

  deleteMap: async (id) => {
    await window.api.dbRun('DELETE FROM map_images WHERE id = ?', [id])
    await get().loadMaps()
  },

  getCategoryElements: () => {
    const { elements, activeCategory } = get()
    return elements.filter(e => e.category === activeCategory)
  },
}))
