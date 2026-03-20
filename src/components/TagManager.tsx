/**
 * NovelForge - 标签管理面板
 *
 * 可附加到任何实体（character / event / chapter）。
 * 支持：添加已有标签、创建新标签、移除标签。
 * 低耦合：通过 entityType + entityId props 挂载。
 */
import { useEffect, useState, useCallback } from 'react'
import { Tag, Select, Button, Space, Input, ColorPicker, message, Popconfirm } from 'antd'
import { PlusOutlined, TagOutlined, DeleteOutlined } from '@ant-design/icons'

interface TagItem {
  id: number
  name: string
  color: string
}

interface TagManagerProps {
  entityType: 'character' | 'event' | 'chapter'
  entityId: number
}

export default function TagManager({ entityType, entityId }: TagManagerProps): JSX.Element {
  const [entityTags, setEntityTags] = useState<TagItem[]>([])
  const [allTags, setAllTags] = useState<TagItem[]>([])
  const [addTagId, setAddTagId] = useState<number | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#7c3aed')
  const [showCreate, setShowCreate] = useState(false)

  const api = (window as any).api

  const loadTags = useCallback(async () => {
    try {
      const myTags = await api.dbQuery(`
        SELECT t.id, t.name, t.color
        FROM tags t
        JOIN entity_tags et ON et.tag_id = t.id
        WHERE et.entity_type = ? AND et.entity_id = ?
      `, [entityType, entityId]) as TagItem[]
      setEntityTags(myTags)
    } catch { setEntityTags([]) }

    try {
      const all = await api.dbQuery('SELECT id, name, color FROM tags ORDER BY name') as TagItem[]
      setAllTags(all)
    } catch { setAllTags([]) }
  }, [entityType, entityId, api])

  useEffect(() => { loadTags() }, [loadTags])

  /** 添加已有标签 */
  const handleAddTag = async () => {
    if (!addTagId) return
    try {
      await api.dbRun(
        'INSERT OR IGNORE INTO entity_tags (tag_id, entity_type, entity_id) VALUES (?, ?, ?)',
        [addTagId, entityType, entityId]
      )
      setAddTagId(null)
      await loadTags()
    } catch { message.error('添加标签失败') }
  }

  /** 创建新标签并关联 */
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    try {
      await api.dbRun('INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)', [newTagName.trim(), newTagColor])
      const tag = await api.dbGet('SELECT id FROM tags WHERE name = ?', [newTagName.trim()]) as { id: number }
      if (tag) {
        await api.dbRun(
          'INSERT OR IGNORE INTO entity_tags (tag_id, entity_type, entity_id) VALUES (?, ?, ?)',
          [tag.id, entityType, entityId]
        )
      }
      setNewTagName('')
      setShowCreate(false)
      await loadTags()
      message.success('标签已创建')
    } catch { message.error('创建失败') }
  }

  /** 移除标签关联 */
  const handleRemoveTag = async (tagId: number) => {
    await api.dbRun(
      'DELETE FROM entity_tags WHERE tag_id = ? AND entity_type = ? AND entity_id = ?',
      [tagId, entityType, entityId]
    )
    await loadTags()
  }

  const availableTags = allTags.filter(t => !entityTags.some(et => et.id === t.id))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <TagOutlined style={{ color: 'var(--accent-secondary)' }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>标签</span>
      </div>

      {/* 已关联标签 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {entityTags.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>暂无标签</span>
        )}
        {entityTags.map(t => (
          <Tag key={t.id} color={t.color} closable onClose={() => handleRemoveTag(t.id)}
            style={{ fontSize: 11, margin: 0 }}>
            {t.name}
          </Tag>
        ))}
      </div>

      {/* 添加已有标签 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <Select
          value={addTagId}
          onChange={setAddTagId}
          placeholder="选择标签"
          size="small"
          showSearch
          optionFilterProp="label"
          style={{ flex: 1, fontSize: 11 }}
          options={availableTags.map(t => ({ value: t.id, label: t.name }))}
          allowClear
        />
        <Button size="small" icon={<PlusOutlined />} onClick={handleAddTag} disabled={!addTagId} />
      </div>

      {/* 创建新标签 */}
      {showCreate ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Input size="small" value={newTagName} onChange={e => setNewTagName(e.target.value)}
            placeholder="标签名" maxLength={20} style={{ flex: 1, fontSize: 11 }}
            onPressEnter={handleCreateTag} />
          <ColorPicker size="small" value={newTagColor} onChange={(_, hex) => setNewTagColor(hex)} />
          <Button size="small" type="primary" onClick={handleCreateTag}>确定</Button>
          <Button size="small" onClick={() => setShowCreate(false)}>取消</Button>
        </div>
      ) : (
        <Button size="small" type="dashed" block onClick={() => setShowCreate(true)}
          style={{ fontSize: 11, marginTop: 2 }}>
          + 新建标签
        </Button>
      )}
    </div>
  )
}
