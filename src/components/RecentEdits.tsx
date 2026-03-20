/**
 * NovelForge - 最近编辑章节
 *
 * 显示最近编辑的前5个章节，点击可快速跳转。
 * 内部维护最近编辑列表（基于 store 章节更新时间戳）。
 */
import { useState, useEffect } from 'react'
import { useChapterStore } from '../stores/chapterStore'
import { Tooltip } from 'antd'
import { EditOutlined } from '@ant-design/icons'

interface RecentEditsProps {
  onJump: (chapterId: number, volumeId: number) => void
}

/** 最近编辑记录（本地内存，不入库） */
const recentList: { id: number; title: string; volumeId: number; ts: number }[] = []
const MAX = 5

export function trackEdit(chapterId: number, title: string, volumeId: number): void {
  const idx = recentList.findIndex(r => r.id === chapterId)
  if (idx >= 0) recentList.splice(idx, 1)
  recentList.unshift({ id: chapterId, title, volumeId, ts: Date.now() })
  if (recentList.length > MAX) recentList.pop()
}

export default function RecentEdits({ onJump }: RecentEditsProps): JSX.Element {
  const [, setTick] = useState(0)
  const chapters = useChapterStore(s => s.chapters)

  // 定时刷新显示
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 3000)
    return () => clearInterval(t)
  }, [])

  // 过滤已删除的章节
  const items = recentList.filter(r => chapters.some(c => c.id === r.id))

  if (items.length === 0) return <></>

  return (
    <div style={{ padding: '4px 12px 8px', fontSize: 11 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <EditOutlined /> 最近编辑
      </div>
      {items.map(r => (
        <Tooltip key={r.id} title="点击跳转" placement="right">
          <div
            onClick={() => onJump(r.id, r.volumeId)}
            style={{
              padding: '2px 6px', cursor: 'pointer', borderRadius: 4,
              color: 'var(--text-secondary)', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            📄 {r.title}
          </div>
        </Tooltip>
      ))}
    </div>
  )
}
