/**
 * NovelForge - 项目状态管理 (Zustand)
 *
 * 管理项目列表、当前项目、项目 CRUD 操作。
 */
import { create } from 'zustand'

export interface ProjectInfo {
  id: number
  name: string
  description: string
  file_path: string
  created_at: string
  updated_at: string
}

interface ProjectState {
  /** 项目列表 */
  projects: ProjectInfo[]
  /** 当前打开的项目 */
  currentProject: ProjectInfo | null
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null

  /** 加载项目列表 */
  loadProjects: () => Promise<void>
  /** 创建新项目 */
  createProject: (name: string, description: string) => Promise<ProjectInfo>
  /** 打开项目 */
  openProject: (project: ProjectInfo) => Promise<void>
  /** 删除项目 */
  deleteProject: (projectId: number) => Promise<void>
  /** 关闭当前项目（返回项目选择页） */
  closeProject: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,
  error: null,

  loadProjects: async () => {
    set({ loading: true, error: null })
    try {
      const projects = await window.api.listProjects()
      set({ projects, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载项目列表失败'
      set({ error: message, loading: false })
      console.error('loadProjects 失败:', err)
    }
  },

  createProject: async (name: string, description: string) => {
    set({ error: null })
    try {
      const project = await window.api.createProject(name, description)
      // 刷新列表
      await get().loadProjects()
      return project
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建项目失败'
      set({ error: message })
      throw err
    }
  },

  openProject: async (project: ProjectInfo) => {
    set({ loading: true, error: null })
    try {
      await window.api.openProject(project.id)
      set({ currentProject: project, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : '打开项目失败'
      set({ error: message, loading: false })
      console.error('openProject 失败:', err)
    }
  },

  deleteProject: async (projectId: number) => {
    set({ error: null })
    try {
      await window.api.deleteProject(projectId)
      // 如果删除的是当前打开的项目，清除当前项目
      if (get().currentProject?.id === projectId) {
        set({ currentProject: null })
      }
      // 刷新列表
      await get().loadProjects()
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除项目失败'
      set({ error: message })
      console.error('deleteProject 失败:', err)
    }
  },

  closeProject: () => {
    set({ currentProject: null })
  }
}))
