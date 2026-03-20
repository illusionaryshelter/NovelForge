/**
 * NovelForge - UI 设置状态管理 (Zustand)
 *
 * 管理主题和背景图设置的响应式状态，使 Root 的 ConfigProvider
 * 能够实时响应 SettingsPage 的主题切换。
 */
import { create } from 'zustand'

interface UISettingsState {
  theme: 'dark' | 'light'
  backgroundImage: string | null
  backgroundOpacity: number
  /** 从后端加载设置 */
  loadSettings: () => Promise<void>
  /** 设置主题 */
  setTheme: (theme: 'dark' | 'light') => void
  /** 设置背景图 */
  setBackground: (image: string | null, opacity?: number) => void
  /** 设置背景透明度 */
  setBackgroundOpacity: (opacity: number) => void
}

export const useUISettingsStore = create<UISettingsState>((set) => ({
  theme: 'dark',
  backgroundImage: null,
  backgroundOpacity: 30,

  loadSettings: async () => {
    try {
      const s = await (window as any).api.getSettings()
      set({
        theme: s?.theme || 'dark',
        backgroundImage: s?.backgroundImage || null,
        backgroundOpacity: s?.backgroundOpacity ?? 30,
      })
    } catch {
      // 首次加载可能还没有 settings
    }
  },

  setTheme: (theme) => {
    set({ theme })
    document.documentElement.setAttribute('data-theme', theme)
  },

  setBackground: (image, opacity) => {
    const update: Partial<UISettingsState> = { backgroundImage: image }
    if (opacity !== undefined) update.backgroundOpacity = opacity
    set(update)
  },

  setBackgroundOpacity: (opacity) => {
    set({ backgroundOpacity: opacity })
  },
}))
