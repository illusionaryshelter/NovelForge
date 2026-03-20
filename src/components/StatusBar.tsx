/**
 * NovelForge - 底部状态栏（性能优化版）
 *
 * 优化：
 * - 不再 SELECT content 全文，改用 COUNT + SUM(LENGTH())
 * - DOM 编辑器字数轮询改为 5 秒（减少 CPU）
 * - 数据库轮询改为 30 秒
 */
import { useEffect, useState, useCallback } from 'react'

interface StatusBarProps {
  saveStatus?: 'saved' | 'saving' | 'idle'
}

export default function StatusBar({ saveStatus = 'idle' }: StatusBarProps): JSX.Element {
  const [chapterCount, setChapterCount] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [currentChapterWords, setCurrentChapterWords] = useState(0)

  const api = (window as any).api

  /**
   * 用 SQL 聚合代替 JS 全量加载
   * LENGTH(content) 是对 JSON 的粗略字数估算（比精确解析 JSON 快 100 倍）
   * 系数 0.4 大致补偿 JSON 结构开销
   */
  const refresh = useCallback(async () => {
    try {
      const row = await api.dbGet(
        `SELECT COUNT(*) as cnt,
                COALESCE(SUM(LENGTH(content)), 0) as total_len
         FROM chapters WHERE COALESCE(is_deleted,0)=0`
      ) as { cnt: number; total_len: number }
      setChapterCount(row.cnt)
      // JSON 结构约占 60%，实际文字约 40%
      setTotalWords(Math.round(row.total_len * 0.4))
    } catch { /* 静默 */ }
  }, [api])

  // 监听当前活跃章节（通过 DOM 获取编辑器文本）
  useEffect(() => {
    const timer = setInterval(() => {
      const editor = document.querySelector('.ProseMirror')
      if (editor) {
        setCurrentChapterWords((editor.textContent || '').length)
      }
    }, 5000) // 5秒一次（原2秒，减少开销）
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000) // 30秒一次（原15秒）
    return () => clearInterval(interval)
  }, [refresh])

  const formatNum = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`

  return (
    <div style={{
      height: 24, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 12px',
      background: 'var(--bg-glass)', backdropFilter: 'blur(8px)',
      borderTop: '1px solid var(--border-subtle)',
      fontSize: 11, color: 'var(--text-muted)',
      userSelect: 'none',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: saveStatus === 'saved' ? '#4caf50'
            : saveStatus === 'saving' ? '#ff9800' : '#666',
          transition: 'background 300ms',
          boxShadow: saveStatus === 'saved' ? '0 0 4px #4caf50' : 'none',
        }} />
        {saveStatus === 'saved' ? '已保存' : saveStatus === 'saving' ? '保存中...' : '就绪'}
      </span>

      <span style={{ width: 1, height: 12, background: 'var(--border-subtle)' }} />

      <span>本章 {formatNum(currentChapterWords)} 字</span>
      <span>全书≈{formatNum(totalWords)} 字</span>
      <span>共 {chapterCount} 章</span>
    </div>
  )
}
