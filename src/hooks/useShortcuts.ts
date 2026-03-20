/**
 * NovelForge - 全局快捷键 Hook
 *
 * 提供常用操作的快捷键：
 * - Ctrl+S : 保存当前章节
 * - Ctrl+K : 全局搜索（与已有搜索联动）
 * - Ctrl+B : 切换侧边栏
 * - Ctrl+1~7 : 快速切换模块
 * - Ctrl+N : 新建（当前上下文）
 * - Ctrl+E : 导出
 *
 * 低耦合：通过回调字典传入，不直接依赖任何 store/page。
 */
import { useEffect, useCallback} from 'react'

export interface ShortcutActions {
  onSave?: () => void
  onSearch?: () => void
  onToggleSidebar?: () => void
  onNewItem?: () => void
  onExport?: () => void
  onShortcutPanel?: () => void
  onNavigate?: (key: string) => void
}

const NAV_KEYS: Record<string, string> = {
  '1': 'characters',
  '2': 'world',
  '3': 'timeline',
  '4': 'events',
  '5': 'items',
  '6': 'chapters',
  '7': 'relationships',
  '8': 'stats',
}

export function useShortcuts(actions: ShortcutActions): void {
  const handler = useCallback((e: KeyboardEvent) => {
    const isCtrl = e.ctrlKey || e.metaKey
    if (!isCtrl) return

    switch (e.key.toLowerCase()) {
      case 's':
        e.preventDefault()
        actions.onSave?.()
        break
      case 'k':
        e.preventDefault()
        actions.onSearch?.()
        break
      case 'b':
        e.preventDefault()
        actions.onToggleSidebar?.()
        break
      case 'n':
        e.preventDefault()
        actions.onNewItem?.()
        break
      case 'e':
        e.preventDefault()
        actions.onExport?.()
        break
      case '/':
        e.preventDefault()
        actions.onShortcutPanel?.()
        break
      default:
        // Ctrl+1~8 快速导航
        if (NAV_KEYS[e.key]) {
          e.preventDefault()
          actions.onNavigate?.(NAV_KEYS[e.key])
        }
        break
    }
  }, [actions])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}
