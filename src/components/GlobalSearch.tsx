/**
 * NovelForge - 全局搜索组件
 *
 * 在一个弹出模态框中搜索：角色、事件、章节、世界观、物品。
 * 搜索结果按类型分组显示，点击可跳转到对应模块。
 */
import { useState, useCallback } from 'react'
import { Modal, Input, Tag, Empty, Spin } from 'antd'
import {
  TeamOutlined,
  ThunderboltOutlined,
  BookOutlined,
  GlobalOutlined,
  ToolOutlined,
} from '@ant-design/icons'

const { Search } = Input

interface SearchResult {
  type: 'character' | 'event' | 'chapter' | 'world' | 'item'
  id: number
  title: string
  subtitle: string
}

const typeConfig = {
  character: { label: '角色', color: 'purple', icon: <TeamOutlined /> },
  event: { label: '事件', color: 'blue', icon: <ThunderboltOutlined /> },
  chapter: { label: '章节', color: 'green', icon: <BookOutlined /> },
  world: { label: '世界观', color: 'orange', icon: <GlobalOutlined /> },
  item: { label: '物品', color: 'cyan', icon: <ToolOutlined /> },
}

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
  onNavigate?: (path: string) => void
}

export default function GlobalSearch({ open, onClose, onNavigate }: GlobalSearchProps): JSX.Element {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')

  const doSearch = useCallback(async (value: string) => {
    const q = value.trim()
    setKeyword(q)
    if (!q) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const api = (window as any).api
      const like = `%${q}%`

      // 并行查询所有表
      const [characters, events, chapters, worlds, items] = await Promise.all([
        api.dbQuery(
          'SELECT id, name, description FROM characters WHERE name LIKE ? OR description LIKE ? LIMIT 10',
          [like, like]
        ),
        api.dbQuery(
          'SELECT id, title, description FROM events WHERE title LIKE ? OR description LIKE ? LIMIT 10',
          [like, like]
        ),
        api.dbQuery(
          'SELECT c.id, c.title, v.title as vol_title FROM chapters c LEFT JOIN volumes v ON c.volume_id = v.id WHERE c.title LIKE ? OR c.content LIKE ? LIMIT 10',
          [like, like]
        ),
        api.dbQuery(
          'SELECT id, name, description FROM world_settings WHERE name LIKE ? OR description LIKE ? LIMIT 10',
          [like, like]
        ),
        api.dbQuery(
          'SELECT id, name, description FROM items WHERE name LIKE ? OR description LIKE ? LIMIT 10',
          [like, like]
        ),
      ])

      const all: SearchResult[] = [
        ...(characters as any[]).map((r: any) => ({
          type: 'character' as const,
          id: r.id,
          title: r.name,
          subtitle: r.description?.slice(0, 50) || '',
        })),
        ...(events as any[]).map((r: any) => ({
          type: 'event' as const,
          id: r.id,
          title: r.title,
          subtitle: r.description?.slice(0, 50) || '',
        })),
        ...(chapters as any[]).map((r: any) => ({
          type: 'chapter' as const,
          id: r.id,
          title: r.title,
          subtitle: r.vol_title ? `📖 ${r.vol_title}` : '',
        })),
        ...(worlds as any[]).map((r: any) => ({
          type: 'world' as const,
          id: r.id,
          title: r.name,
          subtitle: r.description?.slice(0, 50) || '',
        })),
        ...(items as any[]).map((r: any) => ({
          type: 'item' as const,
          id: r.id,
          title: r.name,
          subtitle: r.description?.slice(0, 50) || '',
        })),
      ]
      setResults(all)
    } catch (err) {
      console.error('搜索失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  /** 点击结果跳转 */
  const handleClick = (item: SearchResult) => {
    const pathMap: Record<string, string> = {
      character: 'characters',
      event: 'events',
      chapter: 'chapters',
      world: 'world',
      item: 'items',
    }
    onNavigate?.(`/workspace/${pathMap[item.type]}`)
    onClose()
  }

  return (
    <Modal
      title="🔍 全局搜索"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      <Search
        placeholder="搜索角色、事件、章节、世界观、物品..."
        allowClear
        enterButton="搜索"
        onSearch={doSearch}
        style={{ marginBottom: 16 }}
        autoFocus
      />

      {loading && (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin />
        </div>
      )}

      {!loading && keyword && results.length === 0 && (
        <Empty description={`未找到与"${keyword}"相关的结果`} />
      )}

      {!loading && results.length > 0 && (
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {results.map((item, idx) => {
            const cfg = typeConfig[item.type]
            return (
              <div
                key={`${item.type}-${item.id}-${idx}`}
                onClick={() => handleClick(item)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Tag color={cfg.color} icon={cfg.icon} style={{ margin: 0, minWidth: 60, textAlign: 'center' }}>
                  {cfg.label}
                </Tag>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.subtitle}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
