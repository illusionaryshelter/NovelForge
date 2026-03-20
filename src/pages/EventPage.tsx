/**
 * NovelForge - 事件管理页面
 *
 * 提供独立于时间线的事件管理视角：
 * - 事件 CRUD（标题、描述、时间点）
 * - 按时间线筛选
 * - 按角色筛选
 * - 事件-角色关联管理
 * - 点击事件可跳转编辑
 */
import { useEffect, useState, useCallback } from 'react'
import { Button, Input, InputNumber, Modal, Select, Popconfirm, Tag, Space, Empty, Table, message } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
  UserAddOutlined,
  FilterOutlined,
  LinkOutlined,
  ToolOutlined,
  BookOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  useTimelineStore,
  formatTimelineDate,
  type TimelineEvent,
  type EventCharacter,
} from '../stores/timelineStore'
import { useCharacterStore, type Character } from '../stores/characterStore'

const { TextArea } = Input

export default function EventPage(): JSX.Element {
  const tlStore = useTimelineStore()
  const charStore = useCharacterStore()
  const navigate = useNavigate()

  // 筛选
  const [filterTimelineId, setFilterTimelineId] = useState<number | null>(null)
  const [filterCharId, setFilterCharId] = useState<number | null>(null)
  const [searchText, setSearchText] = useState('')

  // 全部事件（跨时间线）
  const [allEvents, setAllEvents] = useState<TimelineEvent[]>([])
  const [filteredEvents, setFilteredEvents] = useState<TimelineEvent[]>([])

  // 选中事件
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editYear, setEditYear] = useState<number>(1)
  const [editMonth, setEditMonth] = useState<number | null>(null)
  const [editDay, setEditDay] = useState<number | null>(null)
  const [editTimelineId, setEditTimelineId] = useState<number | null>(null)

  // 事件角色
  const [eventChars, setEventChars] = useState<EventCharacter[]>([])

  // 反向关联：关联物品 + 关联章节
  const [relatedItems, setRelatedItems] = useState<{ id: number; item_name: string; action: string }[]>([])
  const [relatedChapters, setRelatedChapters] = useState<{ id: number; chapter_title: string }[]>([])
  const [addCharModalOpen, setAddCharModalOpen] = useState(false)
  const [newCharId, setNewCharId] = useState<number | null>(null)
  const [newCharRole, setNewCharRole] = useState('参与')

  // 新建事件
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newYear, setNewYear] = useState<number>(1)
  const [newMonth, setNewMonth] = useState<number | null>(null)
  const [newDay, setNewDay] = useState<number | null>(null)
  const [newTimelineId, setNewTimelineId] = useState<number | null>(null)

  /** 加载所有事件（跨时间线） */
  const loadAllEvents = useCallback(async () => {
    try {
      const events = await window.api.dbQuery(
        'SELECT * FROM events ORDER BY year, month, day, sort_order'
      ) as TimelineEvent[]
      setAllEvents(events)
    } catch (err) {
      console.error('加载事件失败:', err)
    }
  }, [])

  useEffect(() => {
    tlStore.loadTimelines()
    charStore.loadCharacters()
    loadAllEvents()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** 筛选事件 */
  useEffect(() => {
    let result = [...allEvents]

    // 按时间线筛选
    if (filterTimelineId !== null) {
      result = result.filter(e => e.timeline_id === filterTimelineId)
    }

    // 按搜索文本
    if (searchText) {
      const s = searchText.toLowerCase()
      result = result.filter(e => e.title.toLowerCase().includes(s))
    }

    // 按角色筛选（异步，先简单设置为全部，后面再过滤）
    if (filterCharId !== null) {
      // 需要异步查询，用 Promise
      window.api.dbQuery(
        'SELECT event_id FROM event_characters WHERE character_id = ?',
        [filterCharId]
      ).then((rows: unknown[]) => {
        const eventIds = new Set((rows as { event_id: number }[]).map(r => r.event_id))
        setFilteredEvents(result.filter(e => eventIds.has(e.id)))
      })
      return
    }

    setFilteredEvents(result)
  }, [allEvents, filterTimelineId, filterCharId, searchText])

  /** 选中事件 */
  const handleSelectEvent = async (ev: TimelineEvent) => {
    setSelectedEvent(ev)
    setEditTitle(ev.title)
    setEditDesc(ev.description)
    setEditYear(ev.year)
    setEditMonth(ev.month)
    setEditDay(ev.day)
    setEditTimelineId(ev.timeline_id)
    // 加载角色关联
    const chars = await tlStore.getEventCharacters(ev.id)
    setEventChars(chars)
    // 加载关联物品
    const items = await window.api.dbQuery(
      `SELECT ie.id, i.name as item_name, ie.action FROM item_events ie
       JOIN items i ON ie.item_id = i.id WHERE ie.event_id = ?`, [ev.id]
    ) as { id: number; item_name: string; action: string }[]
    setRelatedItems(items)
    // 加载关联章节
    const chapters = await window.api.dbQuery(
      `SELECT ce.id, c.title as chapter_title FROM chapter_events ce
       JOIN chapters c ON ce.chapter_id = c.id WHERE ce.event_id = ?`, [ev.id]
    ) as { id: number; chapter_title: string }[]
    setRelatedChapters(chapters)
  }

  /** 保存编辑 */
  const handleSave = async () => {
    if (!selectedEvent) return
    await tlStore.updateEvent(selectedEvent.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
      year: editYear,
      month: editMonth,
      day: editDay,
    })
    // 更新 timeline_id
    if (editTimelineId !== selectedEvent.timeline_id) {
      await window.api.dbRun(
        'UPDATE events SET timeline_id = ? WHERE id = ?',
        [editTimelineId, selectedEvent.id]
      )
    }
    await loadAllEvents()
    message.success('事件已保存')
  }

  /** 删除事件 */
  const handleDelete = async (id: number) => {
    await window.api.dbRun('DELETE FROM events WHERE id = ?', [id])
    if (selectedEvent?.id === id) setSelectedEvent(null)
    await loadAllEvents()
    message.success('事件已删除')
  }

  /** 新建事件 */
  const handleCreate = async () => {
    if (!newTitle.trim()) {
      message.warning('请输入事件标题')
      return
    }
    await window.api.dbRun(
      'INSERT INTO events (timeline_id, title, year, month, day) VALUES (?, ?, ?, ?, ?)',
      [newTimelineId, newTitle.trim(), newYear, newMonth, newDay]
    )
    setCreateModalOpen(false)
    setNewTitle('')
    setNewYear(1)
    setNewMonth(null)
    setNewDay(null)
    await loadAllEvents()
    message.success('事件已创建')
  }

  /** 添加角色到事件 */
  const handleAddChar = async () => {
    if (!selectedEvent || !newCharId) return
    await tlStore.addEventCharacter(selectedEvent.id, newCharId, newCharRole)
    setAddCharModalOpen(false)
    setNewCharId(null)
    setNewCharRole('参与')
    const chars = await tlStore.getEventCharacters(selectedEvent.id)
    setEventChars(chars)
    message.success('角色已关联')
  }

  /** 移除角色关联 */
  const handleRemoveChar = async (charId: number) => {
    if (!selectedEvent) return
    await tlStore.removeEventCharacter(selectedEvent.id, charId)
    const chars = await tlStore.getEventCharacters(selectedEvent.id)
    setEventChars(chars)
  }

  /** 获取事件所属时间线名称 */
  const getTimelineName = (tlId: number | null) => {
    if (!tlId) return '未分配'
    const tl = tlStore.timelines.find(t => t.id === tlId)
    return tl ? `${tl.name}` : '未知'
  }

  const getTimelineEra = (tlId: number | null) => {
    if (!tlId) return ''
    const tl = tlStore.timelines.find(t => t.id === tlId)
    return tl?.era_name || ''
  }

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12, flexShrink: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>⚡ 事件管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          新建事件
        </Button>
      </div>

      {/* 筛选栏 */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <FilterOutlined style={{ color: 'var(--text-muted)' }} />
        <Input
          placeholder="搜索事件标题..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ width: 200 }}
          size="small"
        />
        <Select
          value={filterTimelineId}
          onChange={setFilterTimelineId}
          placeholder="按时间线筛选"
          allowClear
          size="small"
          style={{ width: 180 }}
          options={[
            ...tlStore.timelines.map(t => ({ value: t.id, label: t.name }))
          ]}
        />
        <Select
          value={filterCharId}
          onChange={setFilterCharId}
          placeholder="按角色筛选"
          allowClear
          size="small"
          style={{ width: 180 }}
          showSearch
          optionFilterProp="label"
          options={charStore.characters.map(c => ({ value: c.id, label: c.name }))}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          共 {filteredEvents.length} 个事件
        </span>
      </div>

      {/* 主内容区 */}
      <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>
        {/* 左侧事件列表 */}
        <div style={{
          width: selectedEvent ? '45%' : '100%',
          transition: 'width 250ms ease',
          overflowY: 'auto',
        }}>
          {filteredEvents.length === 0 ? (
            <div style={{ padding: '40px 0' }}>
              <Empty description="暂无事件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : (
            filteredEvents.map((ev) => (
              <div
                key={ev.id}
                onClick={() => handleSelectEvent(ev)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', marginBottom: 6, borderRadius: 8, cursor: 'pointer',
                  background: selectedEvent?.id === ev.id ? 'rgba(124, 58, 237, 0.08)' : 'var(--bg-secondary)',
                  border: selectedEvent?.id === ev.id ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
                  transition: 'all 150ms',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{ev.title}</span>
                    <Tag color="purple" style={{ fontSize: 11, margin: 0 }}>
                      {formatTimelineDate(getTimelineEra(ev.timeline_id) || '?', ev.year, ev.month, ev.day)}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {getTimelineName(ev.timeline_id)}
                    {ev.description && ` · ${ev.description.slice(0, 40)}${ev.description.length > 40 ? '...' : ''}`}
                  </div>
                </div>
                <Popconfirm
                  title="删除此事件？"
                  onConfirm={(e) => { e?.stopPropagation(); handleDelete(ev.id) }}
                  onCancel={(e) => e?.stopPropagation()}
                  okText="删除" cancelText="取消" okButtonProps={{ danger: true }}
                >
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                </Popconfirm>
              </div>
            ))
          )}
        </div>

        {/* 右侧编辑面板 */}
        {selectedEvent && (
          <div className="glass-panel fade-in" style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>📝 编辑事件</span>
              <Space>
                <Button type="primary" size="small" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
                <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setSelectedEvent(null)} />
              </Space>
            </div>

            {/* 基本信息 */}
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="事件标题"
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <InputNumber value={editYear} onChange={(v) => setEditYear(v ?? 1)} min={-99999} max={99999} addonAfter="年" style={{ flex: 1 }} />
              <InputNumber value={editMonth} onChange={(v) => setEditMonth(v)} min={1} max={12} placeholder="月" style={{ width: 80 }} />
              <InputNumber value={editDay} onChange={(v) => setEditDay(v)} min={1} max={31} placeholder="日" style={{ width: 80 }} />
            </div>
            <TextArea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="事件详细描述..."
              rows={4}
              maxLength={5000}
              style={{ marginBottom: 8 }}
            />

            {/* 所属时间线 */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 8 }}>所属时间线：</span>
              <Select
                value={editTimelineId}
                onChange={setEditTimelineId}
                placeholder="未分配"
                allowClear
                size="small"
                style={{ width: 200 }}
                options={tlStore.timelines.map(t => ({ value: t.id, label: `${t.name}（${t.era_name}）` }))}
              />
            </div>

            {/* 关联角色 */}
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-secondary)' }}>
                👥 关联角色
              </span>
              <Button size="small" icon={<UserAddOutlined />} onClick={() => setAddCharModalOpen(true)}>
                添加
              </Button>
            </div>
            {eventChars.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无关联角色</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {eventChars.map((ec) => (
                  <div key={ec.character_id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <a onClick={() => navigate('/workspace/characters')}
                        style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: 13 }}>
                        <LinkOutlined /> {ec.character_name}
                      </a>
                      <Tag style={{ fontSize: 11, margin: 0 }}>{ec.role}</Tag>
                    </div>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />}
                      onClick={() => handleRemoveChar(ec.character_id)} />
                  </div>
                ))}
              </div>
            )}

            {/* 关联物品（反向） */}
            {relatedItems.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-secondary)' }}>
                  <ToolOutlined /> 关联物品
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                  {relatedItems.map((ri) => (
                    <div key={ri.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)',
                    }}>
                      <a onClick={() => navigate('/workspace/items')}
                        style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: 12 }}>
                        <LinkOutlined /> {ri.item_name}
                      </a>
                      <Tag style={{ fontSize: 11, margin: 0 }}>{ri.action}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 关联章节（反向） */}
            {relatedChapters.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-secondary)' }}>
                  <BookOutlined /> 关联章节
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                  {relatedChapters.map((rc) => (
                    <div key={rc.id} style={{
                      padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)',
                    }}>
                      <a onClick={() => navigate('/workspace/chapters')}
                        style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: 12 }}>
                        <LinkOutlined /> {rc.chapter_title}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 新建事件弹窗 */}
      <Modal
        title="新建事件"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        okText="创建" cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="事件标题" maxLength={100} />
          <Select
            value={newTimelineId}
            onChange={setNewTimelineId}
            placeholder="所属时间线（可选）"
            allowClear
            options={tlStore.timelines.map(t => ({ value: t.id, label: `${t.name}（${t.era_name}）` }))}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <InputNumber value={newYear} onChange={(v) => setNewYear(v ?? 1)} min={-99999} max={99999} addonAfter="年" style={{ flex: 1 }} />
            <InputNumber value={newMonth} onChange={(v) => setNewMonth(v)} min={1} max={12} placeholder="月" style={{ width: 100 }} />
            <InputNumber value={newDay} onChange={(v) => setNewDay(v)} min={1} max={31} placeholder="日" style={{ width: 100 }} />
          </div>
        </div>
      </Modal>

      {/* 添加角色弹窗 */}
      <Modal
        title="关联角色到事件"
        open={addCharModalOpen}
        onCancel={() => setAddCharModalOpen(false)}
        onOk={handleAddChar}
        okText="添加" cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Select
            value={newCharId}
            onChange={setNewCharId}
            placeholder="选择角色"
            showSearch
            optionFilterProp="label"
            options={charStore.characters.map(c => ({ value: c.id, label: c.name }))}
          />
          <Input
            value={newCharRole}
            onChange={(e) => setNewCharRole(e.target.value)}
            placeholder="角色身份（如：主角、配角、旁观者）"
            maxLength={30}
          />
        </div>
      </Modal>
    </div>
  )
}
