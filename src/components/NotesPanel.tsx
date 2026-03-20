/**
 * NovelForge - 写作笔记/便签面板
 *
 * 可附加到任何章节或事件（entity_type + entity_id）。
 * 笔记不参与导出，仅供作者参考。
 * 低耦合：通过 props 传入 entityType + entityId 即可挂载。
 */
import { useEffect, useState, useCallback } from 'react'
import { Input, Button, Space, Empty, message, Popconfirm } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
} from '@ant-design/icons'

const { TextArea } = Input

interface Note {
  id: number
  content: string
  created_at: string
  updated_at: string
}

interface NotesPanelProps {
  entityType: 'chapter' | 'event'
  entityId: number
}

export default function NotesPanel({ entityType, entityId }: NotesPanelProps): JSX.Element {
  const [notes, setNotes] = useState<Note[]>([])
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')

  const api = (window as any).api

  const loadNotes = useCallback(async () => {
    try {
      const rows = await api.dbQuery(
        'SELECT * FROM notes WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
        [entityType, entityId]
      )
      setNotes(rows as Note[])
    } catch { setNotes([]) }
  }, [entityType, entityId, api])

  useEffect(() => { loadNotes() }, [loadNotes])

  const handleAdd = async () => {
    if (!newContent.trim()) return
    await api.dbRun(
      'INSERT INTO notes (entity_type, entity_id, content) VALUES (?, ?, ?)',
      [entityType, entityId, newContent.trim()]
    )
    setNewContent('')
    await loadNotes()
    message.success('笔记已添加')
  }

  const handleUpdate = async (id: number) => {
    if (!editContent.trim()) return
    await api.dbRun(
      'UPDATE notes SET content = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [editContent.trim(), id]
    )
    setEditingId(null)
    await loadNotes()
    message.success('笔记已更新')
  }

  const handleDelete = async (id: number) => {
    await api.dbRun('DELETE FROM notes WHERE id = ?', [id])
    await loadNotes()
    message.success('笔记已删除')
  }

  const formatTime = (t: string) => {
    try { return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
    catch { return t }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <FileTextOutlined style={{ color: 'var(--accent-secondary)' }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>写作笔记</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>（不参与导出）</span>
      </div>

      {/* 添加笔记 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <TextArea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="记录灵感、注意事项..."
          rows={2}
          maxLength={2000}
          style={{ flex: 1, fontSize: 12 }}
        />
        <Button size="small" icon={<PlusOutlined />} onClick={handleAdd} style={{ alignSelf: 'flex-end' }}>
          添加
        </Button>
      </div>

      {/* 笔记列表 */}
      {notes.length === 0 ? (
        <Empty description="暂无笔记" image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: '8px 0' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
          {notes.map((note) => (
            <div key={note.id} style={{
              padding: '6px 8px', borderRadius: 6,
              background: 'rgba(255, 193, 7, 0.06)',
              border: '1px solid rgba(255, 193, 7, 0.2)',
            }}>
              {editingId === note.id ? (
                <div>
                  <TextArea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} style={{ fontSize: 12, marginBottom: 4 }} />
                  <Space size={4}>
                    <Button size="small" type="primary" onClick={() => handleUpdate(note.id)}>保存</Button>
                    <Button size="small" onClick={() => setEditingId(null)}>取消</Button>
                  </Space>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginBottom: 4 }}>{note.content}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTime(note.updated_at)}</span>
                    <Space size={2}>
                      <Button size="small" type="text" icon={<EditOutlined />}
                        onClick={() => { setEditingId(note.id); setEditContent(note.content) }} />
                      <Popconfirm title="删除此笔记？" onConfirm={() => handleDelete(note.id)}
                        okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
