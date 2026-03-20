/**
 * NovelForge - Preload API 类型声明
 *
 * 让渲染进程中 window.api 拥有类型提示
 */
import { ElectronAPI } from '@electron-toolkit/preload'

interface NovelForgeAPI {
  // 项目管理
  listProjects: () => Promise<Array<{
    id: number
    name: string
    description: string
    file_path: string
    created_at: string
    updated_at: string
  }>>
  createProject: (name: string, description: string) => Promise<{
    id: number
    name: string
    description: string
    file_path: string
    created_at: string
    updated_at: string
  }>
  openProject: (projectId: number) => Promise<boolean>
  deleteProject: (projectId: number) => Promise<boolean>
  getCurrentProject: () => Promise<{
    id: number
    name: string
    description: string
    file_path: string
    created_at: string
    updated_at: string
  } | null>

  // 通用数据库操作
  dbQuery: (sql: string, params?: unknown[]) => Promise<unknown[]>
  dbRun: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number | bigint }>
  dbGet: (sql: string, params?: unknown[]) => Promise<unknown>

  // 文件对话框
  openImageDialog: () => Promise<string | null>
  readImageAsDataUrl: (filePath: string) => Promise<string | null>

  // 用户设置
  getSettings: () => Promise<{ hardwareAcceleration: boolean }>
  saveSettings: (settings: Record<string, unknown>) => Promise<{ hardwareAcceleration: boolean }>

  // 应用控制
  relaunch: () => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: NovelForgeAPI
  }
}
