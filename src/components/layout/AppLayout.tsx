/**
 * NovelForge - 主布局
 *
 * 功能：
 * - 侧边栏导航（可完全隐藏 / 拖拽缩放）
 * - 主内容区 + 可选分屏（分屏面板可拖拽调整比例）
 * - Ctrl+B 切换侧边栏显隐
 * - Ctrl+K 全局搜索
 * - Ctrl+1~8 快速切换模块
 */
import { useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Menu, Button, Tooltip, Select } from 'antd'
import {
  TeamOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  BookOutlined,
  GlobalOutlined,
  ToolOutlined,
  ShareAltOutlined,
  ArrowLeftOutlined,
  SettingOutlined,
  SearchOutlined,
  BarChartOutlined,
  SplitCellsOutlined,
  CloseOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useProjectStore } from '../../stores/projectStore'
import { useShortcuts } from '../../hooks/useShortcuts'
import CharacterPage from '../../pages/CharacterPage'
import WorldPage from '../../pages/WorldPage'
import TimelinePage from '../../pages/TimelinePage'
import EventPage from '../../pages/EventPage'
import ItemPage from '../../pages/ItemPage'
import ChapterPage from '../../pages/ChapterPage'
import RelationshipPage from '../../pages/RelationshipPage'
import SettingsPage from '../../pages/SettingsPage'
import CharacterProfilePage from '../../pages/CharacterProfilePage'
import CharacterStatsPage from '../../pages/CharacterStatsPage'
import GlobalSearch from '../GlobalSearch'
import StatusBar from '../StatusBar'
import ShortcutPanel from '../ShortcutPanel'
import RecentEdits from '../RecentEdits'
import { useChapterStore } from '../../stores/chapterStore'

/** 侧边栏导航项 */
const navItems = [
  { key: 'characters', label: '人物管理', icon: <TeamOutlined /> },
  { key: 'world', label: '世界观', icon: <GlobalOutlined /> },
  { key: 'timeline', label: '时间线', icon: <ClockCircleOutlined /> },
  { key: 'events', label: '事件管理', icon: <ThunderboltOutlined /> },
  { key: 'items', label: '道具管理', icon: <ToolOutlined /> },
  { key: 'chapters', label: '章节管理', icon: <BookOutlined /> },
  { key: 'relationships', label: '关系图谱', icon: <ShareAltOutlined /> },
  { key: 'stats', label: '出场统计', icon: <BarChartOutlined /> },
  { type: 'divider' as const },
  { key: 'settings', label: '设置', icon: <SettingOutlined /> },
]

/** 分屏可选模块 */
const splitModules = [
  { value: 'characters', label: '人物管理' },
  { value: 'world', label: '世界观' },
  { value: 'timeline', label: '时间线' },
  { value: 'events', label: '事件管理' },
  { value: 'items', label: '道具管理' },
  { value: 'chapters', label: '章节管理' },
  { value: 'relationships', label: '关系图谱' },
  { value: 'stats', label: '出场统计' },
]

/** 根据 key 返回对应模块 */
function renderModule(key: string): JSX.Element {
  switch (key) {
    case 'characters': return <CharacterPage />
    case 'world': return <WorldPage />
    case 'timeline': return <TimelinePage />
    case 'events': return <EventPage />
    case 'items': return <ItemPage />
    case 'chapters': return <ChapterPage />
    case 'relationships': return <RelationshipPage />
    case 'stats': return <CharacterStatsPage />
    case 'settings': return <SettingsPage />
    default: return <CharacterPage />
  }
}

export default function AppLayout(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentProject, closeProject } = useProjectStore()

  const currentKey = location.pathname.split('/workspace/')[1] || 'characters'
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutPanelOpen, setShortcutPanelOpen] = useState(false)

  // 侧边栏：完全显示 / 完全隐藏
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(200)

  // 分屏
  const [splitModule, setSplitModule] = useState<string | null>(null)
  const [splitRatio, setSplitRatio] = useState(50) // 主面板占比 (%)

  // 拖拽 ref
  const dragging = useRef<'sidebar' | 'split' | null>(null)

  /** 拖拽侧边栏宽度 */
  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = 'sidebar'
    const startX = e.clientX
    const startW = sidebarWidth
    const onMove = (ev: MouseEvent) => {
      if (dragging.current !== 'sidebar') return
      setSidebarWidth(Math.min(360, Math.max(140, startW + ev.clientX - startX)))
    }
    const onUp = () => {
      dragging.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  /** 拖拽分屏比例 */
  const handleSplitDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = 'split'
    const container = (e.currentTarget as HTMLElement).parentElement!
    const rect = container.getBoundingClientRect()
    const onMove = (ev: MouseEvent) => {
      if (dragging.current !== 'split') return
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setSplitRatio(Math.min(80, Math.max(20, pct)))
    }
    const onUp = () => {
      dragging.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  /** 返回项目列表 */
  const handleBack = () => {
    closeProject()
    navigate('/')
  }

  const handleNav = ({ key }: { key: string }) => navigate(`/workspace/${key}`)

  /** 开启分屏时自动隐藏侧边栏 */
  const handleOpenSplit = (mod: string) => {
    setSplitModule(mod)
    setSidebarVisible(false) // 自动隐藏侧边栏腾出空间
  }

  // 快捷键
  const shortcutActions = useMemo(() => ({
    onSearch: () => setSearchOpen(true),
    onNavigate: (key: string) => navigate(`/workspace/${key}`),
    onToggleSidebar: () => setSidebarVisible(v => !v),
    onShortcutPanel: () => setShortcutPanelOpen(v => !v),
  }), [navigate])

  useShortcuts(shortcutActions)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <div className="app-layout" style={{ flex: 1, minHeight: 0 }}>
      {/* === 侧边栏（可完全隐藏） === */}
      {sidebarVisible && (
        <>
          <div className="app-sidebar" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
            {/* 头部 */}
            <div className="sidebar-header">
              <Tooltip title={currentProject?.name} placement="right">
                <div className="sidebar-project-name">
                  ✦ {currentProject?.name || '未命名'}
                </div>
              </Tooltip>
              <Button type="text" size="small" icon={<SearchOutlined />}
                onClick={() => setSearchOpen(true)}
                style={{ color: 'var(--text-secondary)', marginTop: 6 }} block>
                搜索 Ctrl+K
              </Button>
              <Button type="text" size="small"
                onClick={() => setShortcutPanelOpen(true)}
                style={{ color: 'var(--text-muted)', fontSize: 11 }} block>
                ⌨ 快捷键 Ctrl+/
              </Button>
            </div>

            {/* 导航菜单 */}
            <div className="sidebar-nav">
              <Menu mode="inline" selectedKeys={[currentKey]} onClick={handleNav}
                items={navItems} style={{ border: 'none', background: 'transparent' }} />
            </div>

            {/* 最近编辑 */}
            <RecentEdits onJump={(chId, volId) => {
              navigate('/workspace/chapters')
              const cs = useChapterStore.getState()
              cs.setActiveVolume(volId)
              cs.setActiveChapter(chId)
            }} />

            {/* 分屏选择 */}
            <div style={{ padding: '4px 12px' }}>
              {splitModule ? (
                <Button type="text" icon={<CloseOutlined />} onClick={() => setSplitModule(null)}
                  block style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: 12 }}>
                  关闭分屏
                </Button>
              ) : (
                <Select
                  placeholder={<><SplitCellsOutlined /> 分屏打开...</>}
                  size="small"
                  style={{ width: '100%', fontSize: 11 }}
                  options={splitModules}
                  value={null as any}
                  onChange={handleOpenSplit}
                  allowClear
                />
              )}
            </div>

            {/* 隐藏侧边栏 + 返回 */}
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button type="text" size="small" onClick={() => setSidebarVisible(false)}
                block style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-muted)' }}>
                ◀ 隐藏侧栏 (Ctrl+B)
              </Button>
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack} size="small"
                block style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                返回项目列表
              </Button>
            </div>
          </div>

          {/* 侧边栏拖拽手柄 */}
          <div
            className="resize-handle"
            onMouseDown={handleSidebarDragStart}
          />
        </>
      )}

      {/* === 浮动恢复按钮（侧边栏隐藏时显示） === */}
      {!sidebarVisible && (
        <Tooltip title="显示侧栏 (Ctrl+B)" placement="right">
          <Button
            type="text" size="small"
            icon={<MenuUnfoldOutlined />}
            onClick={() => setSidebarVisible(true)}
            style={{
              position: 'fixed', left: 4, top: '50%', transform: 'translateY(-50%)',
              zIndex: 100, background: 'var(--bg-glass)', backdropFilter: 'blur(8px)',
              border: '1px solid var(--border-subtle)', borderRadius: 6,
              width: 28, height: 48,
            }}
          />
        </Tooltip>
      )}

      {/* === 内容区 === */}
      <div className="app-content" style={{ display: 'flex', overflow: 'hidden' }}>
        {/* 主面板 */}
        <div style={{
          flex: splitModule ? `0 0 ${splitRatio}%` : '1 1 auto',
          overflow: 'auto', minWidth: 0,
        }}>
          <Routes>
            <Route path="/" element={<Navigate to="characters" replace />} />
            <Route path="characters" element={<CharacterPage />} />
            <Route path="world" element={<WorldPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="events" element={<EventPage />} />
            <Route path="items" element={<ItemPage />} />
            <Route path="chapters" element={<ChapterPage />} />
            <Route path="relationships" element={<RelationshipPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile/:id" element={<CharacterProfilePage />} />
            <Route path="stats" element={<CharacterStatsPage />} />
          </Routes>
        </div>

        {/* 分屏拖拽分割线 + 分屏面板 */}
        {splitModule && (
          <>
            <div
              className="resize-handle"
              onMouseDown={handleSplitDragStart}
            />
            <div className="fade-in" style={{
              flex: `0 0 ${100 - splitRatio}%`, overflow: 'auto', minWidth: 0,
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '3px 8px', background: 'rgba(124, 58, 237, 0.06)',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: 12, fontWeight: 600, flexShrink: 0,
              }}>
                <span>📑 {splitModules.find(m => m.value === splitModule)?.label}</span>
                <Button type="text" size="small" icon={<CloseOutlined />}
                  onClick={() => setSplitModule(null)} />
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {renderModule(splitModule)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 全局搜索 */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)}
        onNavigate={(path) => navigate(path)} />

      {/* 快捷键面板 */}
      <ShortcutPanel open={shortcutPanelOpen} onClose={() => setShortcutPanelOpen(false)} />
      </div>

      {/* 底部状态栏 */}
      <StatusBar />
    </div>
  )
}
