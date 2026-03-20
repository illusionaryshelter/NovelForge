/**
 * NovelForge - 时间线管理页面
 *
 * 布局：
 * - 顶部：时间线选择 + 管理
 * - 中间：可视化时间轴（水平事件条）
 * - 底部：选中事件的编辑面板
 */
import { useEffect, useState } from 'react'
import { Button, Input, InputNumber, Modal, Select, Popconfirm, Tag, Space, Empty, message } from 'antd'
import {
  PlusOutlined,
  BookOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import {
  useTimelineStore,
  formatTimelineDate,
  type Timeline,
  type TimelineEvent,
} from '../stores/timelineStore'

const { TextArea } = Input

export default function TimelinePage(): JSX.Element {
  const store = useTimelineStore()

  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editYear, setEditYear] = useState<number>(1)
  const [editMonth, setEditMonth] = useState<number | null>(null)
  const [editDay, setEditDay] = useState<number | null>(null)

  // 时间线管理弹窗
  const [tlModalOpen, setTlModalOpen] = useState(false)
  const [tlName, setTlName] = useState('')
  const [tlEra, setTlEra] = useState('')
  const [tlDesc, setTlDesc] = useState('')
  const [editingTl, setEditingTl] = useState<Timeline | null>(null)

  // 事件新建弹窗
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventYear, setNewEventYear] = useState<number>(1)
  const [newEventMonth, setNewEventMonth] = useState<number | null>(null)
  const [newEventDay, setNewEventDay] = useState<number | null>(null)

  // 事件↔章节关联 Map: eventId → [{volTitle, chTitle}]
  const [eventChapterMap, setEventChapterMap] = useState<Map<number, {vol: string; ch: string}[]>>(new Map())

  /** 加载事件↔章节关联数据 */
  const loadEventChapters = async () => {
    try {
      const rows = await (window as any).api.dbQuery(`
        SELECT ce.event_id, v.title as vol_title, c.title as ch_title
        FROM chapter_events ce
        JOIN chapters c ON c.id = ce.chapter_id
        JOIN volumes v ON v.id = c.volume_id
        ORDER BY v.sort_order, c.sort_order
      `) as { event_id: number; vol_title: string; ch_title: string }[]
      const map = new Map<number, {vol: string; ch: string}[]>()
      for (const r of rows) {
        if (!map.has(r.event_id)) map.set(r.event_id, [])
        map.get(r.event_id)!.push({ vol: r.vol_title, ch: r.ch_title })
      }
      setEventChapterMap(map)
    } catch { /* 静默 */ }
  }

  useEffect(() => {
    store.loadTimelines()
    loadEventChapters()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeTimeline = store.timelines.find(t => t.id === store.activeTimelineId)

  /** 选中事件 */
  const handleSelectEvent = (ev: TimelineEvent) => {
    setSelectedEvent(ev)
    setEditTitle(ev.title)
    setEditDesc(ev.description)
    setEditYear(ev.year)
    setEditMonth(ev.month)
    setEditDay(ev.day)
  }

  /** 保存事件编辑 */
  const handleSaveEvent = async () => {
    if (!selectedEvent) return
    await store.updateEvent(selectedEvent.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
      year: editYear,
      month: editMonth,
      day: editDay,
    })
    message.success('事件已保存')
  }

  /** 删除事件 */
  const handleDeleteEvent = async (id: number) => {
    await store.deleteEvent(id)
    if (selectedEvent?.id === id) setSelectedEvent(null)
    message.success('事件已删除')
  }

  /** 新建事件 */
  const handleCreateEvent = async () => {
    if (!newEventTitle.trim() || !store.activeTimelineId) {
      message.warning('请输入事件标题')
      return
    }
    await store.createEvent(
      store.activeTimelineId,
      newEventTitle.trim(),
      newEventYear,
      newEventMonth,
      newEventDay
    )
    setEventModalOpen(false)
    setNewEventTitle('')
    setNewEventYear(1)
    setNewEventMonth(null)
    setNewEventDay(null)
    message.success('事件已创建')
  }

  /** 打开新建/编辑时间线弹窗 */
  const handleOpenTlModal = (tl?: Timeline) => {
    if (tl) {
      setEditingTl(tl)
      setTlName(tl.name)
      setTlEra(tl.era_name)
      setTlDesc(tl.description)
    } else {
      setEditingTl(null)
      setTlName('')
      setTlEra('')
      setTlDesc('')
    }
    setTlModalOpen(true)
  }

  /** 保存时间线 */
  const handleSaveTimeline = async () => {
    if (!tlName.trim() || !tlEra.trim()) {
      message.warning('请填写时间线名称和纪元名称')
      return
    }
    if (editingTl) {
      await store.updateTimeline(editingTl.id, {
        name: tlName.trim(),
        era_name: tlEra.trim(),
        description: tlDesc.trim(),
      })
      message.success('时间线已更新')
    } else {
      const id = await store.createTimeline(tlName.trim(), tlEra.trim(), tlDesc.trim())
      store.setActiveTimeline(id)
      message.success('时间线已创建')
    }
    setTlModalOpen(false)
  }

  /** 删除时间线 */
  const handleDeleteTimeline = async (id: number) => {
    await store.deleteTimeline(id)
    message.success('时间线已删除')
  }

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12, flexShrink: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>⏳ 时间线管理</h2>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => handleOpenTlModal()}>
            新建时间线
          </Button>
        </Space>
      </div>

      {/* 时间线选择 */}
      {store.timelines.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          marginBottom: 16, flexShrink: 0, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>时间线：</span>
          <Select
            value={store.activeTimelineId}
            onChange={(id) => { store.setActiveTimeline(id); setSelectedEvent(null) }}
            style={{ minWidth: 200 }}
            options={store.timelines.map(t => ({
              value: t.id,
              label: `${t.name}（${t.era_name}）`,
            }))}
          />
          {activeTimeline && (
            <>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenTlModal(activeTimeline)}
              />
              <Popconfirm
                title="删除此时间线？"
                description="关联的事件也会被删除"
                onConfirm={() => handleDeleteTimeline(activeTimeline.id)}
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
          {activeTimeline && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setEventModalOpen(true)}
            >
              添加事件
            </Button>
          )}
        </div>
      )}

      {/* 无时间线提示 */}
      {store.timelines.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="创建第一条时间线开始" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenTlModal()}>
              新建时间线
            </Button>
          </Empty>
        </div>
      )}

      {/* 可视化时间轴 */}
      {activeTimeline && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            flex: selectedEvent ? 0.5 : 1,
            overflowY: 'auto',
            transition: 'flex 250ms ease',
          }}>
            {store.events.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Empty description="暂无事件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 24 }}>
                {/* 时间轴竖线 */}
                <div style={{
                  position: 'absolute', left: 11, top: 0, bottom: 0,
                  width: 2, background: 'var(--accent-primary)', opacity: 0.3,
                }} />

                {store.events.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => handleSelectEvent(ev)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      marginBottom: 12, cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    {/* 时间轴圆点 */}
                    <div style={{
                      position: 'absolute', left: -19,
                      width: 12, height: 12, borderRadius: '50%',
                      background: selectedEvent?.id === ev.id
                        ? 'var(--accent-primary)'
                        : 'var(--bg-elevated)',
                      border: `2px solid ${selectedEvent?.id === ev.id ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                      marginTop: 4, transition: 'all 150ms',
                    }} />

                    {/* 事件卡片 */}
                    <div style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: selectedEvent?.id === ev.id
                        ? 'rgba(124, 58, 237, 0.08)'
                        : 'var(--bg-secondary)',
                      border: selectedEvent?.id === ev.id
                        ? '1px solid var(--border-accent)'
                        : '1px solid var(--border-subtle)',
                      transition: 'all 150ms',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{ev.title}</span>
                        <Tag color="purple" style={{ fontSize: 11, margin: 0 }}>
                          {formatTimelineDate(activeTimeline.era_name, ev.year, ev.month, ev.day)}
                        </Tag>
                      </div>
                      {ev.description && (
                        <div style={{
                          fontSize: 12, color: 'var(--text-muted)', marginTop: 4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {ev.description}
                        </div>
                      )}
                      {/* 章节关联标注 */}
                      {eventChapterMap.has(ev.id) && (
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {eventChapterMap.get(ev.id)!.map((c, i) => (
                            <Tag key={i} color="cyan" style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>
                              <BookOutlined /> {c.vol} · {c.ch}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 删除按钮 */}
                    <Popconfirm
                      title="删除此事件？"
                      onConfirm={(e) => { e?.stopPropagation(); handleDeleteEvent(ev.id) }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        type="text" size="small" danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: 6 }}
                      />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 事件编辑面板 */}
          {selectedEvent && (
            <div className="glass-panel fade-in" style={{
              flex: 0.5, overflow: 'auto', marginTop: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>📝 编辑事件</span>
                <Space>
                  <Button type="primary" size="small" icon={<SaveOutlined />} onClick={handleSaveEvent}>
                    保存
                  </Button>
                  <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setSelectedEvent(null)} />
                </Space>
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="事件标题"
                  style={{ flex: 1 }}
                />
                <InputNumber
                  value={editYear}
                  onChange={(v) => setEditYear(v ?? 1)}
                  min={-99999}
                  max={99999}
                  addonAfter="年"
                  style={{ width: 120 }}
                />
                <InputNumber
                  value={editMonth}
                  onChange={(v) => setEditMonth(v)}
                  min={1}
                  max={12}
                  placeholder="月"
                  style={{ width: 80 }}
                />
                <InputNumber
                  value={editDay}
                  onChange={(v) => setEditDay(v)}
                  min={1}
                  max={31}
                  placeholder="日"
                  style={{ width: 80 }}
                />
              </div>

              <TextArea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="事件详细描述..."
                rows={4}
                maxLength={5000}
              />
            </div>
          )}
        </div>
      )}

      {/* 新建时间线弹窗 */}
      <Modal
        title={editingTl ? '编辑时间线' : '新建时间线'}
        open={tlModalOpen}
        onCancel={() => setTlModalOpen(false)}
        onOk={handleSaveTimeline}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Input
            value={tlName}
            onChange={(e) => setTlName(e.target.value)}
            placeholder="时间线名称（如：主线时间线）"
            maxLength={50}
          />
          <Input
            value={tlEra}
            onChange={(e) => setTlEra(e.target.value)}
            placeholder="纪元名称（如：太初历）"
            maxLength={30}
          />
          <TextArea
            value={tlDesc}
            onChange={(e) => setTlDesc(e.target.value)}
            placeholder="时间线描述（可选）"
            rows={2}
          />
        </div>
      </Modal>

      {/* 新建事件弹窗 */}
      <Modal
        title="添加事件"
        open={eventModalOpen}
        onCancel={() => setEventModalOpen(false)}
        onOk={handleCreateEvent}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Input
            value={newEventTitle}
            onChange={(e) => setNewEventTitle(e.target.value)}
            placeholder="事件标题"
            maxLength={100}
            onPressEnter={handleCreateEvent}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <InputNumber
              value={newEventYear}
              onChange={(v) => setNewEventYear(v ?? 1)}
              min={-99999}
              max={99999}
              addonAfter="年"
              style={{ flex: 1 }}
            />
            <InputNumber
              value={newEventMonth}
              onChange={(v) => setNewEventMonth(v)}
              min={1}
              max={12}
              placeholder="月"
              style={{ width: 100 }}
            />
            <InputNumber
              value={newEventDay}
              onChange={(v) => setNewEventDay(v)}
              min={1}
              max={31}
              placeholder="日"
              style={{ width: 100 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
