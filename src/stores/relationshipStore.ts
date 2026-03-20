/**
 * NovelForge - 角色关系状态管理 (Zustand)
 *
 * 管理 character_relationships 表的 CRUD 操作。
 * 同时提供加载角色+阵营颜色的方法，供关系图谱着色使用。
 */
import { create } from 'zustand'

// ==========================================
// 类型定义
// ==========================================

export interface Relationship {
  id: number
  character_a_id: number
  character_b_id: number
  relation_type: string   // 师徒、情侣、敌对、同门、主仆 等
  description: string
  start_year: number | null
  start_month: number | null
  start_day: number | null
  end_year: number | null
  end_month: number | null
  end_day: number | null
  // JOIN 字段
  name_a?: string
  name_b?: string
}

/** 图谱节点数据 */
export interface GraphNode {
  id: number
  name: string
  faction_color: string | null  // 当前阵营颜色
  faction_name: string | null
}

// ==========================================
// Store
// ==========================================

interface RelationshipState {
  relationships: Relationship[]
  graphNodes: GraphNode[]
  loading: boolean

  loadAll: () => Promise<void>
  createRelationship: (aId: number, bId: number, relType: string, desc: string) => Promise<number>
  updateRelationship: (id: number, data: {
    relation_type?: string; description?: string;
    start_year?: number | null; start_month?: number | null; start_day?: number | null;
    end_year?: number | null; end_month?: number | null; end_day?: number | null;
  }) => Promise<void>
  deleteRelationship: (id: number) => Promise<void>
}

export const useRelationshipStore = create<RelationshipState>((set, get) => ({
  relationships: [],
  graphNodes: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true })
    try {
      // 加载所有关系（含角色名）
      const rels = await window.api.dbQuery(
        `SELECT cr.*, ca.name as name_a, cb.name as name_b
         FROM character_relationships cr
         JOIN characters ca ON cr.character_a_id = ca.id
         JOIN characters cb ON cr.character_b_id = cb.id
         ORDER BY cr.id`
      ) as Relationship[]

      // 加载所有角色 + 当前阵营颜色（end_year IS NULL = 当前阵营）
      const nodes = await window.api.dbQuery(
        `SELECT c.id, c.name,
                f.color as faction_color, f.name as faction_name
         FROM characters c
         LEFT JOIN character_factions cf ON c.id = cf.character_id AND cf.end_year IS NULL
         LEFT JOIN factions f ON cf.faction_id = f.id
         GROUP BY c.id
         ORDER BY c.name`
      ) as GraphNode[]

      set({ relationships: rels, graphNodes: nodes, loading: false })
    } catch (err) {
      console.error('加载关系数据失败:', err)
      set({ loading: false })
    }
  },

  createRelationship: async (aId, bId, relType, desc) => {
    const result = await window.api.dbRun(
      `INSERT INTO character_relationships (character_a_id, character_b_id, relation_type, description)
       VALUES (?, ?, ?, ?)`,
      [aId, bId, relType, desc]
    )
    await get().loadAll()
    return Number(result.lastInsertRowid)
  },

  updateRelationship: async (id, data) => {
    const sets: string[] = []
    const params: unknown[] = []
    if (data.relation_type !== undefined) { sets.push('relation_type = ?'); params.push(data.relation_type) }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description) }
    if (data.start_year !== undefined) { sets.push('start_year = ?'); params.push(data.start_year) }
    if (data.start_month !== undefined) { sets.push('start_month = ?'); params.push(data.start_month) }
    if (data.start_day !== undefined) { sets.push('start_day = ?'); params.push(data.start_day) }
    if (data.end_year !== undefined) { sets.push('end_year = ?'); params.push(data.end_year) }
    if (data.end_month !== undefined) { sets.push('end_month = ?'); params.push(data.end_month) }
    if (data.end_day !== undefined) { sets.push('end_day = ?'); params.push(data.end_day) }
    if (sets.length === 0) return
    params.push(id)
    await window.api.dbRun(`UPDATE character_relationships SET ${sets.join(', ')} WHERE id = ?`, params)
    await get().loadAll()
  },

  deleteRelationship: async (id) => {
    await window.api.dbRun('DELETE FROM character_relationships WHERE id = ?', [id])
    await get().loadAll()
  },
}))
