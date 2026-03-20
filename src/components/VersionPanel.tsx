/**
 * NovelForge - 章节版本历史面板
 *
 * 附加到章节编辑页面，提供：
 * - 手动保存版本快照（带可选标签）
 * - 版本列表（时间 + 标签）
 * - 选中两个版本做 diff 对比（逐行比较）
 *
 * 低耦合：通过 props 传入 chapterId + 当前内容即可。
 */
import { useEffect, useState, useCallback } from 'react'
import { Button, Space, Tag, Empty, Modal, Input, message, Popconfirm } from 'antd'
import {
  SaveOutlined,
  HistoryOutlined,
  DiffOutlined,
  DeleteOutlined,
} from '@ant-design/icons'

interface Version {
  id: number
  chapter_id: number
  content: string
  label: string
  created_at: string
}

interface VersionPanelProps {
  chapterId: number
  currentContent: string  // 当前编辑器内容（TipTap JSON 字符串）
}

/** 从 TipTap JSON 中提取纯文本用于 diff */
function extractTextFromTipTap(json: string): string {
  try {
    const doc = JSON.parse(json)
    if (doc?.type === 'doc' && Array.isArray(doc.content)) {
      return walkNodes(doc.content)
    }
  } catch { /* not JSON */ }
  return json
}

function walkNodes(nodes: any[]): string {
  const parts: string[] = []
  for (const n of nodes) {
    if (n.type === 'text') parts.push(n.text || '')
    else if (n.type === 'hardBreak') parts.push('\n')
    else if (Array.isArray(n.content)) {
      parts.push(walkNodes(n.content))
      if (n.type === 'paragraph' || n.type === 'heading') parts.push('\n')
    }
  }
  return parts.join('')
}

/** 简单逐行 diff */
function simpleDiff(oldText: string, newText: string): { type: 'same' | 'add' | 'del'; text: string }[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const result: { type: 'same' | 'add' | 'del'; text: string }[] = []
  const maxLen = Math.max(oldLines.length, newLines.length)

  // 使用最长公共子序列的简化版（逐行匹配）
  let oi = 0, ni = 0
  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
      result.push({ type: 'same', text: oldLines[oi] })
      oi++; ni++
    } else if (ni < newLines.length && (oi >= oldLines.length || !oldLines.includes(newLines[ni]))) {
      result.push({ type: 'add', text: newLines[ni] })
      ni++
    } else if (oi < oldLines.length) {
      result.push({ type: 'del', text: oldLines[oi] })
      oi++
    }
  }
  return result
}

export default function VersionPanel({ chapterId, currentContent }: VersionPanelProps): JSX.Element {
  const [versions, setVersions] = useState<Version[]>([])
  const [diffModalOpen, setDiffModalOpen] = useState(false)
  const [diffResult, setDiffResult] = useState<{ type: 'same' | 'add' | 'del'; text: string }[]>([])
  const [diffTitle, setDiffTitle] = useState('')
  const [saveLabel, setSaveLabel] = useState('')

  const api = (window as any).api

  const loadVersions = useCallback(async () => {
    try {
      const rows = await api.dbQuery(
        'SELECT * FROM chapter_versions WHERE chapter_id = ? ORDER BY created_at DESC',
        [chapterId]
      )
      setVersions(rows as Version[])
    } catch { setVersions([]) }
  }, [chapterId, api])

  useEffect(() => { loadVersions() }, [loadVersions])

  /** 保存当前内容为新版本 */
  const handleSaveVersion = async () => {
    await api.dbRun(
      'INSERT INTO chapter_versions (chapter_id, content, label) VALUES (?, ?, ?)',
      [chapterId, currentContent, saveLabel.trim() || `v${versions.length + 1}`]
    )
    setSaveLabel('')
    await loadVersions()
    message.success('版本快照已保存')
  }

  /** 删除版本 */
  const handleDelete = async (id: number) => {
    await api.dbRun('DELETE FROM chapter_versions WHERE id = ?', [id])
    await loadVersions()
  }

  /** 对比版本与当前内容 */
  const handleDiffWithCurrent = (ver: Version) => {
    const oldText = extractTextFromTipTap(ver.content)
    const newText = extractTextFromTipTap(currentContent)
    setDiffResult(simpleDiff(oldText, newText))
    setDiffTitle(`${ver.label || ver.created_at} → 当前`)
    setDiffModalOpen(true)
  }

  /** 对比两个版本 */
  const handleDiffTwoVersions = (older: Version, newer: Version) => {
    const oldText = extractTextFromTipTap(older.content)
    const newText = extractTextFromTipTap(newer.content)
    setDiffResult(simpleDiff(oldText, newText))
    setDiffTitle(`${older.label || older.created_at} → ${newer.label || newer.created_at}`)
    setDiffModalOpen(true)
  }

  const formatTime = (t: string) => {
    try { return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
    catch { return t }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <HistoryOutlined style={{ color: 'var(--accent-secondary)' }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>版本历史</span>
      </div>

      {/* 保存新版本 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <Input
          value={saveLabel}
          onChange={(e) => setSaveLabel(e.target.value)}
          placeholder="版本标签（可选）"
          size="small"
          style={{ flex: 1, fontSize: 12 }}
          maxLength={30}
        />
        <Button size="small" icon={<SaveOutlined />} onClick={handleSaveVersion}>
          保存版本
        </Button>
      </div>

      {/* 版本列表 */}
      {versions.length === 0 ? (
        <Empty description="暂无历史版本" image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: '8px 0' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
          {versions.map((ver, idx) => (
            <div key={ver.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 6px', borderRadius: 4,
              background: 'rgba(100, 181, 246, 0.06)',
              border: '1px solid rgba(100, 181, 246, 0.15)',
            }}>
              <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{ver.label || `v${versions.length - idx}`}</Tag>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>
                {formatTime(ver.created_at)}
              </span>
              <Space size={2}>
                <Button size="small" type="text" icon={<DiffOutlined />}
                  title="与当前内容对比"
                  onClick={() => handleDiffWithCurrent(ver)} />
                {idx < versions.length - 1 && (
                  <Button size="small" type="text"
                    title="与上一版本对比"
                    onClick={() => handleDiffTwoVersions(versions[idx + 1], ver)}>
                    ↔
                  </Button>
                )}
                <Popconfirm title="删除此版本？" onConfirm={() => handleDelete(ver.id)}
                  okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            </div>
          ))}
        </div>
      )}

      {/* Diff 弹窗 */}
      <Modal
        title={`📊 版本对比：${diffTitle}`}
        open={diffModalOpen}
        onCancel={() => setDiffModalOpen(false)}
        footer={null}
        width={700}
      >
        <div style={{
          maxHeight: 500, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12,
          background: 'var(--bg-secondary)', borderRadius: 6, padding: 12,
        }}>
          {diffResult.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>两个版本内容相同</div>
          ) : (
            diffResult.map((line, i) => (
              <div key={i} style={{
                padding: '1px 4px',
                background: line.type === 'add' ? 'rgba(76, 175, 80, 0.15)'
                  : line.type === 'del' ? 'rgba(244, 67, 54, 0.15)' : 'transparent',
                color: line.type === 'add' ? '#66bb6a'
                  : line.type === 'del' ? '#ef5350' : 'var(--text-primary)',
                borderLeft: line.type !== 'same' ? `3px solid ${line.type === 'add' ? '#4caf50' : '#f44336'}` : '3px solid transparent',
              }}>
                {line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  '}
                {line.text || ' '}
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}
