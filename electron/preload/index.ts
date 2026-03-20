/**
 * NovelForge - Preload 预加载脚本
 *
 * 通过 contextBridge 安全地暴露 IPC 方法给渲染进程。
 * 渲染进程通过 window.api 调用这些方法。
 */
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

/** 暴露给渲染进程的 API 接口 */
const api = {
  // ---- 项目管理 ----
  listProjects: () => ipcRenderer.invoke('project:list'),
  createProject: (name: string, description: string) =>
    ipcRenderer.invoke('project:create', name, description),
  openProject: (projectId: number) => ipcRenderer.invoke('project:open', projectId),
  deleteProject: (projectId: number) => ipcRenderer.invoke('project:delete', projectId),
  getCurrentProject: () => ipcRenderer.invoke('project:getCurrent'),

  // ---- 通用数据库操作 ----
  dbQuery: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:query', sql, params),
  dbRun: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:run', sql, params),
  dbGet: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:get', sql, params),

  // ---- 文件对话框 ----
  openImageDialog: () => ipcRenderer.invoke('dialog:openImage'),
  readImageAsDataUrl: (filePath: string) => ipcRenderer.invoke('file:readImageAsDataUrl', filePath),

  // ---- 用户设置 ----
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:save', settings),

  // ---- 对话框 ----
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  selectBackgroundImage: () => ipcRenderer.invoke('dialog:selectBackgroundImage'),
  saveTextFile: (name: string, content: string) => ipcRenderer.invoke('dialog:saveTextFile', name, content),

  // ---- 备份与恢复 ----
  backupProject: () => ipcRenderer.invoke('project:backup'),
  restoreProject: () => ipcRenderer.invoke('project:restore'),

  // ---- 导出 ----
  exportEpub: (data: any) => ipcRenderer.invoke('export:epub', data),

  // ---- 模板 ----
  listTemplates: () => ipcRenderer.invoke('template:list'),
  applyTemplate: (data: any) => ipcRenderer.invoke('template:apply', data),
  saveTemplate: (name: string, desc: string) => ipcRenderer.invoke('template:saveFromProject', name, desc),
  deleteTemplate: (file: string) => ipcRenderer.invoke('template:delete', file),

  // ---- 应用控制 ----
  relaunch: () => ipcRenderer.invoke('app:relaunch')
}

// 使用 contextBridge 安全暴露 API
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('contextBridge 暴露 API 失败:', error)
  }
} else {
  // @ts-ignore 非上下文隔离模式（开发用）
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
