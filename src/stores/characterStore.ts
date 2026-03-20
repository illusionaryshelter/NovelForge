/**
 * NovelForge - 角色与阵营状态管理 (Zustand)
 *
 * 管理角色 CRUD、别名、阵营、阵营变更历史、境界/战力、动机。
 * 所有操作通过 window.api.dbQuery / dbRun 与 SQLite 交互。
 */
import { create } from 'zustand'

// ==========================================
// 类型定义
// ==========================================

export interface Character {
  id: number
  name: string
  description: string
  avatar_path: string | null
  created_at: string
  updated_at: string
}

export interface CharacterAlias {
  id: number
  character_id: number
  alias: string
}

export interface Faction {
  id: number
  name: string
  color: string
  description: string
}

export interface CharacterFaction {
  id: number
  character_id: number
  faction_id: number
  faction_name?: string
  faction_color?: string
  start_year: number | null
  start_month: number | null
  start_day: number | null
  end_year: number | null
  end_month: number | null
  end_day: number | null
}

export interface CharacterPowerLevel {
  id: number
  character_id: number
  level_name: string
  description: string
  start_year: number | null
  start_month: number | null
  start_day: number | null
  end_year: number | null
  end_month: number | null
  end_day: number | null
}

export interface CharacterMotivation {
  id: number
  character_id: number
  motivation: string
  start_year: number | null
  start_month: number | null
  start_day: number | null
  end_year: number | null
  end_month: number | null
  end_day: number | null
}

/** 用于列表显示的角色+附加信息 */
export interface CharacterWithDetails extends Character {
  aliases: string[]
  currentFactions: { name: string; color: string }[]
  currentPowerLevel: string
}

// ==========================================
// Store
// ==========================================

interface CharacterState {
  characters: Character[]
  factions: Faction[]
  searchText: string
  selectedFactionIds: number[]  // 多选阵营筛选
  loading: boolean

  // 角色 CRUD
  loadCharacters: () => Promise<void>
  createCharacter: (name: string, description: string) => Promise<number>
  updateCharacter: (id: number, data: { name?: string; description?: string }) => Promise<void>
  deleteCharacter: (id: number) => Promise<void>

  // 别名
  getAliases: (characterId: number) => Promise<CharacterAlias[]>
  addAlias: (characterId: number, alias: string) => Promise<void>
  removeAlias: (aliasId: number) => Promise<void>

  // 阵营 CRUD
  loadFactions: () => Promise<void>
  createFaction: (name: string, color: string, description: string) => Promise<number>
  updateFaction: (id: number, data: { name?: string; color?: string; description?: string }) => Promise<void>
  deleteFaction: (id: number) => Promise<void>

  // 角色阵营关联
  getCharacterFactions: (characterId: number) => Promise<CharacterFaction[]>
  addCharacterFaction: (characterId: number, factionId: number, start?: { year?: number; month?: number; day?: number }) => Promise<void>
  removeCharacterFaction: (id: number) => Promise<void>

  // 境界/战力
  getCharacterPowerLevels: (characterId: number) => Promise<CharacterPowerLevel[]>
  addPowerLevel: (characterId: number, levelName: string, description: string, start?: { year?: number; month?: number; day?: number }) => Promise<void>
  removePowerLevel: (id: number) => Promise<void>

  // 动机
  getCharacterMotivations: (characterId: number) => Promise<CharacterMotivation[]>
  addMotivation: (characterId: number, motivation: string, start?: { year?: number; month?: number; day?: number }) => Promise<void>
  removeMotivation: (id: number) => Promise<void>

  // 筛选
  setSearchText: (text: string) => void
  setSelectedFactionIds: (ids: number[]) => void

  // 获取带详情的角色列表（带筛选）
  getFilteredCharacters: () => Promise<CharacterWithDetails[]>
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  factions: [],
  searchText: '',
  selectedFactionIds: [],
  loading: false,

  // ==========================================
  // 角色 CRUD
  // ==========================================

  loadCharacters: async () => {
    set({ loading: true })
    try {
      const chars = await window.api.dbQuery(
        'SELECT * FROM characters WHERE COALESCE(is_deleted,0)=0 ORDER BY updated_at DESC'
      ) as Character[]
      set({ characters: chars, loading: false })
    } catch (err) {
      console.error('加载角色失败:', err)
      set({ loading: false })
    }
  },

  createCharacter: async (name, description) => {
    const result = await window.api.dbRun(
      'INSERT INTO characters (name, description) VALUES (?, ?)',
      [name, description]
    )
    await get().loadCharacters()
    return Number(result.lastInsertRowid)
  },

  updateCharacter: async (id, data) => {
    const sets: string[] = []
    const params: unknown[] = []
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name) }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description) }
    sets.push("updated_at = datetime('now', 'localtime')")
    params.push(id)
    await window.api.dbRun(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`, params)
    await get().loadCharacters()
  },

  deleteCharacter: async (id) => {
    // 软删除 → 回收站
    await window.api.dbRun('UPDATE characters SET is_deleted = 1 WHERE id = ?', [id])
    await get().loadCharacters()
  },

  // ==========================================
  // 别名
  // ==========================================

  getAliases: async (characterId) => {
    return await window.api.dbQuery(
      'SELECT * FROM character_aliases WHERE character_id = ?',
      [characterId]
    ) as CharacterAlias[]
  },

  addAlias: async (characterId, alias) => {
    await window.api.dbRun(
      'INSERT INTO character_aliases (character_id, alias) VALUES (?, ?)',
      [characterId, alias]
    )
  },

  removeAlias: async (aliasId) => {
    await window.api.dbRun('DELETE FROM character_aliases WHERE id = ?', [aliasId])
  },

  // ==========================================
  // 阵营 CRUD
  // ==========================================

  loadFactions: async () => {
    const factions = await window.api.dbQuery('SELECT * FROM factions ORDER BY name') as Faction[]
    set({ factions })
  },

  createFaction: async (name, color, description) => {
    const result = await window.api.dbRun(
      'INSERT INTO factions (name, color, description) VALUES (?, ?, ?)',
      [name, color, description]
    )
    await get().loadFactions()
    return Number(result.lastInsertRowid)
  },

  updateFaction: async (id, data) => {
    const sets: string[] = []
    const params: unknown[] = []
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name) }
    if (data.color !== undefined) { sets.push('color = ?'); params.push(data.color) }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description) }
    params.push(id)
    await window.api.dbRun(`UPDATE factions SET ${sets.join(', ')} WHERE id = ?`, params)
    await get().loadFactions()
  },

  deleteFaction: async (id) => {
    await window.api.dbRun('DELETE FROM factions WHERE id = ?', [id])
    await get().loadFactions()
  },

  // ==========================================
  // 角色阵营关联
  // ==========================================

  getCharacterFactions: async (characterId) => {
    return await window.api.dbQuery(
      `SELECT cf.*, f.name as faction_name, f.color as faction_color
       FROM character_factions cf
       JOIN factions f ON cf.faction_id = f.id
       WHERE cf.character_id = ?
       ORDER BY cf.start_year, cf.start_month, cf.start_day`,
      [characterId]
    ) as CharacterFaction[]
  },

  addCharacterFaction: async (characterId, factionId, start) => {
    await window.api.dbRun(
      `INSERT INTO character_factions (character_id, faction_id, start_year, start_month, start_day)
       VALUES (?, ?, ?, ?, ?)`,
      [characterId, factionId, start?.year ?? null, start?.month ?? null, start?.day ?? null]
    )
  },

  removeCharacterFaction: async (id) => {
    await window.api.dbRun('DELETE FROM character_factions WHERE id = ?', [id])
  },

  // ==========================================
  // 境界/战力
  // ==========================================

  getCharacterPowerLevels: async (characterId) => {
    return await window.api.dbQuery(
      `SELECT * FROM character_power_levels WHERE character_id = ?
       ORDER BY start_year, start_month, start_day`,
      [characterId]
    ) as CharacterPowerLevel[]
  },

  addPowerLevel: async (characterId, levelName, description, start) => {
    // 结束前一个当前境界（end_year 为 NULL 的）
    await window.api.dbRun(
      `UPDATE character_power_levels
       SET end_year = ?, end_month = ?, end_day = ?
       WHERE character_id = ? AND end_year IS NULL`,
      [start?.year ?? null, start?.month ?? null, start?.day ?? null, characterId]
    )
    await window.api.dbRun(
      `INSERT INTO character_power_levels (character_id, level_name, description, start_year, start_month, start_day)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [characterId, levelName, description, start?.year ?? null, start?.month ?? null, start?.day ?? null]
    )
  },

  removePowerLevel: async (id) => {
    await window.api.dbRun('DELETE FROM character_power_levels WHERE id = ?', [id])
  },

  // ==========================================
  // 动机
  // ==========================================

  getCharacterMotivations: async (characterId) => {
    return await window.api.dbQuery(
      `SELECT * FROM character_motivations WHERE character_id = ?
       ORDER BY start_year, start_month, start_day`,
      [characterId]
    ) as CharacterMotivation[]
  },

  addMotivation: async (characterId, motivation, start) => {
    await window.api.dbRun(
      `INSERT INTO character_motivations (character_id, motivation, start_year, start_month, start_day)
       VALUES (?, ?, ?, ?, ?)`,
      [characterId, motivation, start?.year ?? null, start?.month ?? null, start?.day ?? null]
    )
  },

  removeMotivation: async (id) => {
    await window.api.dbRun('DELETE FROM character_motivations WHERE id = ?', [id])
  },

  // ==========================================
  // 筛选
  // ==========================================

  setSearchText: (text) => set({ searchText: text }),
  setSelectedFactionIds: (ids) => set({ selectedFactionIds: ids }),

  /** 获取带详情的角色列表（含筛选）- 性能优化版
   *
   * 优化前: 每个角色 3 次 DB 查询 → 500 角色 = 1500 次查询
   * 优化后: 固定 3 次批量 JOIN 查询 → 500 角色仍然只有 3 次查询
   */
  getFilteredCharacters: async () => {
    const { characters, searchText, selectedFactionIds } = get()
    if (characters.length === 0) return []

    // 批量查询 1: 所有别名
    const allAliases = await window.api.dbQuery(
      'SELECT character_id, alias FROM character_aliases'
    ) as { character_id: number; alias: string }[]
    const aliasMap = new Map<number, string[]>()
    for (const a of allAliases) {
      if (!aliasMap.has(a.character_id)) aliasMap.set(a.character_id, [])
      aliasMap.get(a.character_id)!.push(a.alias)
    }

    // 批量查询 2: 所有活跃阵营（end_year IS NULL）
    const allFactions = await window.api.dbQuery(
      `SELECT cf.character_id, f.name, f.color, f.id as faction_id
       FROM character_factions cf JOIN factions f ON cf.faction_id = f.id
       WHERE cf.end_year IS NULL`
    ) as { character_id: number; name: string; color: string; faction_id: number }[]
    const factionMap = new Map<number, { name: string; color: string; faction_id: number }[]>()
    for (const f of allFactions) {
      if (!factionMap.has(f.character_id)) factionMap.set(f.character_id, [])
      factionMap.get(f.character_id)!.push(f)
    }

    // 批量查询 3: 所有活跃境界（每个角色最新一条 end_year IS NULL）
    const allPower = await window.api.dbQuery(
      `SELECT character_id, level_name FROM character_power_levels
       WHERE end_year IS NULL
       ORDER BY id DESC`
    ) as { character_id: number; level_name: string }[]
    const powerMap = new Map<number, string>()
    for (const p of allPower) {
      if (!powerMap.has(p.character_id)) powerMap.set(p.character_id, p.level_name)
    }

    // 组装 + 筛选（纯内存操作，极快）
    const results: CharacterWithDetails[] = []
    for (const char of characters) {
      const aliases = aliasMap.get(char.id) || []
      const charFactions = factionMap.get(char.id) || []
      const currentPowerLevel = powerMap.get(char.id) || ''

      // 搜索过滤（名字 + 别名）
      if (searchText) {
        const s = searchText.toLowerCase()
        const nameMatch = char.name.toLowerCase().includes(s)
        const aliasMatch = aliases.some(a => a.toLowerCase().includes(s))
        if (!nameMatch && !aliasMatch) continue
      }

      // 阵营筛选
      if (selectedFactionIds.length > 0) {
        const charFactionIds = charFactions.map(f => f.faction_id)
        const hasMatch = selectedFactionIds.some(id => charFactionIds.includes(id))
        if (!hasMatch) continue
      }

      results.push({
        ...char,
        aliases,
        currentFactions: charFactions.map(f => ({ name: f.name, color: f.color })),
        currentPowerLevel,
      })
    }

    return results
  }
}))
