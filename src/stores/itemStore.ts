/**
 * NovelForge - 道具/物品状态管理 (Zustand)
 *
 * 管理：
 * - 物品 CRUD（名称、描述、类型、等级、状态）
 * - 持有者历史（历任主人 + 起止时间 + 获取方式）
 * - 物品关联事件
 */
import { create } from 'zustand'

// ==========================================
// 类型定义
// ==========================================

export interface Item {
  id: number
  name: string
  item_type: string
  description: string
  rank: string
  status: string
  created_at: string
}

export interface ItemOwnership {
  id: number
  item_id: number
  character_id: number
  character_name: string
  acquire_method: string
  start_year: number | null
  start_month: number | null
  start_day: number | null
  end_year: number | null
  end_month: number | null
  end_day: number | null
}

export interface ItemEvent {
  id: number
  item_id: number
  event_id: number
  event_title: string
  action: string
}

// ==========================================
// Store
// ==========================================

interface ItemState {
  items: Item[]
  loading: boolean
  searchText: string

  setSearchText: (text: string) => void

  // 物品 CRUD
  loadItems: () => Promise<void>
  createItem: (name: string, itemType: string, description: string, rank: string) => Promise<number>
  updateItem: (id: number, data: Partial<Pick<Item, 'name' | 'item_type' | 'description' | 'rank' | 'status'>>) => Promise<void>
  deleteItem: (id: number) => Promise<void>

  // 持有者管理
  getOwnerships: (itemId: number) => Promise<ItemOwnership[]>
  addOwnership: (itemId: number, characterId: number, method: string, startYear?: number | null) => Promise<void>
  removeOwnership: (id: number) => Promise<void>

  // 事件关联
  getItemEvents: (itemId: number) => Promise<ItemEvent[]>
  addItemEvent: (itemId: number, eventId: number, action: string) => Promise<void>
  removeItemEvent: (id: number) => Promise<void>

  // 筛选后的物品列表
  getFilteredItems: () => Item[]
}

export const useItemStore = create<ItemState>((set, get) => ({
  items: [],
  loading: false,
  searchText: '',

  setSearchText: (text) => set({ searchText: text }),

  loadItems: async () => {
    set({ loading: true })
    try {
      const items = await window.api.dbQuery(
        'SELECT * FROM items ORDER BY name'
      ) as Item[]
      set({ items, loading: false })
    } catch (err) {
      console.error('加载物品失败:', err)
      set({ loading: false })
    }
  },

  createItem: async (name, itemType, description, rank) => {
    const result = await window.api.dbRun(
      'INSERT INTO items (name, item_type, description, rank) VALUES (?, ?, ?, ?)',
      [name, itemType, description, rank]
    )
    await get().loadItems()
    return Number(result.lastInsertRowid)
  },

  updateItem: async (id, data) => {
    const sets: string[] = []
    const params: unknown[] = []
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name) }
    if (data.item_type !== undefined) { sets.push('item_type = ?'); params.push(data.item_type) }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description) }
    if (data.rank !== undefined) { sets.push('rank = ?'); params.push(data.rank) }
    if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status) }
    if (sets.length === 0) return
    params.push(id)
    await window.api.dbRun(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`, params)
    await get().loadItems()
  },

  deleteItem: async (id) => {
    await window.api.dbRun('DELETE FROM items WHERE id = ?', [id])
    await get().loadItems()
  },

  getOwnerships: async (itemId) => {
    return await window.api.dbQuery(
      `SELECT io.*, c.name as character_name
       FROM item_ownerships io
       JOIN characters c ON io.character_id = c.id
       WHERE io.item_id = ?
       ORDER BY io.start_year`,
      [itemId]
    ) as ItemOwnership[]
  },

  addOwnership: async (itemId, characterId, method, startYear = null) => {
    await window.api.dbRun(
      'INSERT INTO item_ownerships (item_id, character_id, acquire_method, start_year) VALUES (?, ?, ?, ?)',
      [itemId, characterId, method, startYear]
    )
  },

  removeOwnership: async (id) => {
    await window.api.dbRun('DELETE FROM item_ownerships WHERE id = ?', [id])
  },

  getItemEvents: async (itemId) => {
    return await window.api.dbQuery(
      `SELECT ie.*, e.title as event_title
       FROM item_events ie
       JOIN events e ON ie.event_id = e.id
       WHERE ie.item_id = ?`,
      [itemId]
    ) as ItemEvent[]
  },

  addItemEvent: async (itemId, eventId, action) => {
    await window.api.dbRun(
      'INSERT INTO item_events (item_id, event_id, action) VALUES (?, ?, ?)',
      [itemId, eventId, action]
    )
  },

  removeItemEvent: async (id) => {
    await window.api.dbRun('DELETE FROM item_events WHERE id = ?', [id])
  },

  getFilteredItems: () => {
    const { items, searchText } = get()
    if (!searchText) return items
    const s = searchText.toLowerCase()
    return items.filter(i => i.name.toLowerCase().includes(s) || i.item_type.toLowerCase().includes(s))
  },
}))
