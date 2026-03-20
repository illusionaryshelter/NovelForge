/**
 * NovelForge - 章节管理页面
 *
 * 两级结构：卷(Volume) → 章(Chapter)
 * 布局（三栏）：
 * - 左侧：卷/章 导航树
 * - 中间：正文编辑器（TipTap 富文本）
 * - 右侧面板（可收起）：大纲
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { Button, Input, Modal, Popconfirm, Empty, Space, Tooltip, Select, Tag, message } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  BookOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  LinkOutlined,
  HolderOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useChapterStore, type Volume, type Chapter } from '../stores/chapterStore'
import NovelEditor from '../components/chapter/NovelEditor'
import NotesPanel from '../components/NotesPanel'
import VersionPanel from '../components/VersionPanel'
import TagManager from '../components/TagManager'
import { trackEdit } from '../components/RecentEdits'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const { TextArea } = Input

/** 可拖拽排序的章节行 */
function SortableChapterItem({ chapter, isActive, onClick, onRename, onDelete }: {
  chapter: Chapter; isActive: boolean
  onClick: () => void; onRename: () => void; onDelete: () => void
  onDirty?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
    background: isActive ? 'rgba(124,58,237,0.12)' : 'transparent',
    border: isActive ? '1px solid var(--border-accent)' : '1px solid transparent',
    marginBottom: 2,
  }
  return (
    <div ref={setNodeRef} style={style} onClick={onClick}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--text-muted)' }}>
          <HolderOutlined />
        </span>
        <FileTextOutlined style={{ fontSize: 11 }} />{chapter.title}
      </span>
      <Space size={2}>
        <Button type="text" size="small" icon={<EditOutlined />} style={{ fontSize: 11 }}
          onClick={(e) => { e.stopPropagation(); onRename() }} />
        <Popconfirm title="删除此章节？"
          onConfirm={(e) => { e?.stopPropagation(); onDelete() }}
          onCancel={(e) => e?.stopPropagation()} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 11 }}
            onClick={(e) => e.stopPropagation()} />
        </Popconfirm>
      </Space>
    </div>
  )
}

export default function ChapterPage(): JSX.Element {
  const store = useChapterStore()
  const navigate = useNavigate()

  // 新建弹窗
  const [createType, setCreateType] = useState<'volume' | 'chapter' | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [createParentId, setCreateParentId] = useState<number>(0)

  // 重命名
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameType, setRenameType] = useState<'volume' | 'chapter'>('volume')
  const [renameTitle, setRenameTitle] = useState('')

  // 大纲编辑
  const [outlineText, setOutlineText] = useState('')

  // 右侧面板
  const [sidePanel, setSidePanel] = useState(true)

  // 事件关联
  const [chapterEvents, setChapterEvents] = useState<{ id: number; event_id: number; title: string }[]>([])
  const [allEvents, setAllEvents] = useState<{ id: number; title: string }[]>([])
  const [addEventId, setAddEventId] = useState<number | null>(null)

  // 自动保存状态
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  // 未保存警告
  const dirtyRef = useRef(false)

  // dnd-kit 传感器
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    store.loadAll()
    loadAllEvents()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadAllEvents = useCallback(async () => {
    const events = await window.api.dbQuery('SELECT id, title FROM events ORDER BY title') as { id: number; title: string }[]
    setAllEvents(events)
  }, [])

  useEffect(() => {
    if (store.activeChapterId) {
      const ch = store.chapters.find(c => c.id === store.activeChapterId)
      setOutlineText(ch?.outline || '')
      // 加载关联事件
      store.getChapterEvents(store.activeChapterId).then(setChapterEvents)
    }
  }, [store.activeChapterId, store.chapters])

  const activeChapter = store.getActiveChapter()

  /** 创建条目 */
  const handleCreate = async () => {
    if (!newTitle.trim()) { message.warning('请输入标题'); return }
    if (createType === 'volume') {
      const volumeId = await store.createVolume(newTitle.trim())
      store.setActiveVolume(volumeId)
    } else if (createType === 'chapter') {
      const chId = await store.createChapter(createParentId, newTitle.trim())
      store.setActiveVolume(createParentId)
      store.setActiveChapter(chId)
    }
    setCreateType(null)
    setNewTitle('')
    message.success('已创建')
  }

  /** 重命名 */
  const handleRename = async () => {
    if (!renameId || !renameTitle.trim()) return
    if (renameType === 'volume') await store.updateVolume(renameId, renameTitle.trim())
    else await store.updateChapter(renameId, { title: renameTitle.trim() })
    setRenameId(null)
    message.success('已重命名')
  }

  /** 保存大纲 */
  const handleSaveOutline = async () => {
    if (!store.activeChapterId) return
    await store.updateChapter(store.activeChapterId, { outline: outlineText })
    message.success('大纲已保存')
  }

  /** 保存正文 */
  const handleSaveContent = (content: string) => {
    if (!store.activeChapterId) return
    setSaveStatus('saving')
    dirtyRef.current = false
    store.updateChapter(store.activeChapterId, { content })
    // 记录最近编辑
    const ch = store.getActiveChapter()
    if (ch) trackEdit(ch.id, ch.title, ch.volume_id)
    setTimeout(() => {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 300)
  }

  /** 切换章节时检查未保存 */
  const handleSwitchChapter = (volId: number, chId: number) => {
    if (dirtyRef.current) {
      Modal.confirm({
        title: '未保存内容',
        content: '当前章节有未保存的修改。是否放弃修改并切换？',
        okText: '放弃切换',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: () => {
          dirtyRef.current = false
          store.setActiveVolume(volId)
          store.setActiveChapter(chId)
        },
      })
    } else {
      store.setActiveVolume(volId)
      store.setActiveChapter(chId)
    }
  }

  /** 拖拽排序完成 */
  const handleDragEnd = (volumeId: number) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const chapters = store.getVolumeChapters(volumeId)
    const oldIdx = chapters.findIndex(c => c.id === active.id)
    const newIdx = chapters.findIndex(c => c.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const newOrder = arrayMove(chapters, oldIdx, newIdx)
    store.reorderChapters(volumeId, newOrder.map(c => c.id))
  }

  /** 添加事件关联 */
  const handleAddEvent = async () => {
    if (!store.activeChapterId || !addEventId) return
    await store.addChapterEvent(store.activeChapterId, addEventId)
    setChapterEvents(await store.getChapterEvents(store.activeChapterId))
    setAddEventId(null)
    message.success('事件已关联')
  }

  /** 移除事件关联 */
  const handleRemoveEvent = async (eventId: number) => {
    if (!store.activeChapterId) return
    await store.removeChapterEvent(store.activeChapterId, eventId)
    setChapterEvents(await store.getChapterEvents(store.activeChapterId))
  }

  /** 打开重命名 */
  const openRename = (id: number, type: 'volume' | 'chapter', title: string) => {
    setRenameId(id)
    setRenameType(type)
    setRenameTitle(title)
  }

  /** 渲染卷/章树 */
  const renderTree = () => {
    if (store.volumes.length === 0) {
      return (
        <div style={{ padding: '24px 8px', textAlign: 'center' }}>
          <Empty description="创建第一卷开始" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )
    }

    return store.volumes.map((vol) => {
      const chapters = store.getVolumeChapters(vol.id)
      return (
        <div key={vol.id} style={{ marginBottom: 8 }}>
          {/* 卷标题 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 8px', borderRadius: 6,
            background: store.activeVolumeId === vol.id ? 'rgba(124,58,237,0.1)' : 'transparent',
            cursor: 'pointer',
          }}
            onClick={() => store.setActiveVolume(vol.id)}
          >
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              <BookOutlined style={{ marginRight: 6 }} />{vol.title}
            </span>
            <Space size={2}>
              <Tooltip title="添加章节">
                <Button type="text" size="small" icon={<PlusOutlined />}
                  onClick={(e) => { e.stopPropagation(); setCreateType('chapter'); setCreateParentId(vol.id) }} />
              </Tooltip>
              <Button type="text" size="small" icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); openRename(vol.id, 'volume', vol.title) }} />
              <Popconfirm title="删除此卷？" description="所有章节也会被删除"
                onConfirm={(e) => { e?.stopPropagation(); store.deleteVolume(vol.id) }}
                onCancel={(e) => e?.stopPropagation()} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()} />
              </Popconfirm>
            </Space>
          </div>

          {/* 章节列表（可拖拽） */}
          <div style={{ paddingLeft: 16 }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter}
              onDragEnd={handleDragEnd(vol.id)}>
              <SortableContext items={chapters.map(c => c.id)}
                strategy={verticalListSortingStrategy}>
                {chapters.map((ch) => (
                  <SortableChapterItem key={ch.id} chapter={ch}
                    isActive={store.activeChapterId === ch.id}
                    onClick={() => handleSwitchChapter(vol.id, ch.id)}
                    onRename={() => openRename(ch.id, 'chapter', ch.title)}
                    onDelete={() => store.deleteChapter(ch.id)}
                    onDirty={() => { dirtyRef.current = true }}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )
    })
  }

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8, flexShrink: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>📖 章节管理</h2>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setCreateType('volume')}>新建卷</Button>
          <Button type="text" icon={sidePanel ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={() => setSidePanel(!sidePanel)} />
        </Space>
      </div>

      {/* 主体 */}
      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden' }}>
        {/* 左侧导航树 */}
        <div style={{
          width: 240, flexShrink: 0, overflowY: 'auto',
          borderRight: '1px solid var(--border-subtle)', paddingRight: 8,
        }}>
          {renderTree()}
        </div>

        {/* 中间编辑器 */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid var(--border-subtle)', borderRadius: 8,
          background: 'var(--bg-secondary)',
        }}>
          {activeChapter ? (
            <>
              {/* 保存状态指示 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 8px', fontSize: 11, color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: saveStatus === 'saved' ? '#4caf50'
                    : saveStatus === 'saving' ? '#ff9800' : 'transparent',
                  transition: 'all 300ms',
                  boxShadow: saveStatus === 'saved' ? '0 0 6px #4caf5088' : 'none',
                }} />
                {saveStatus === 'saved' && '已保存'}
                {saveStatus === 'saving' && '保存中...'}
              </div>
            <NovelEditor
              key={activeChapter.id}
              content={activeChapter.content}
              onSave={handleSaveContent}
              placeholder="开始写作..."
            />
            </>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}>
              从左侧选择章节开始写作
            </div>
          )}
        </div>

        {/* 右侧大纲面板 */}
        {sidePanel && activeChapter && (
          <div className="fade-in" style={{
            width: 240, flexShrink: 0, overflowY: 'auto',
            borderLeft: '1px solid var(--border-subtle)', paddingLeft: 8,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
              }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>📋 章节大纲</span>
                <Button size="small" icon={<SaveOutlined />} onClick={handleSaveOutline}>保存</Button>
              </div>
              <TextArea
                value={outlineText}
                onChange={(e) => setOutlineText(e.target.value)}
                placeholder="记录本章大纲..."
                rows={8}
                maxLength={5000}
                style={{ fontSize: 12 }}
              />
            </div>

            {/* 关联事件 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}><ThunderboltOutlined /> 关联事件</span>
              </div>
              {chapterEvents.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {chapterEvents.map((ce) => (
                    <div key={ce.event_id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '3px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.03)',
                    }}>
                      <a onClick={() => navigate('/workspace/events')}
                        style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: 12 }}>
                        <LinkOutlined /> {ce.title}
                      </a>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />}
                        style={{ fontSize: 11 }} onClick={() => handleRemoveEvent(ce.event_id)} />
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 4 }}>
                <Select
                  value={addEventId}
                  onChange={setAddEventId}
                  placeholder="选择事件"
                  size="small"
                  showSearch
                  optionFilterProp="label"
                  style={{ flex: 1 }}
                  options={allEvents
                    .filter(e => !chapterEvents.some(ce => ce.event_id === e.id))
                    .map(e => ({ value: e.id, label: e.title }))}
                />
                <Button size="small" type="primary" icon={<PlusOutlined />}
                  onClick={handleAddEvent} disabled={!addEventId} />
              </div>
            </div>

            {/* 写作笔记 */}
            <NotesPanel entityType="chapter" entityId={activeChapter.id} />

            {/* 标签 */}
            <TagManager entityType="chapter" entityId={activeChapter.id} />

            {/* 版本历史 */}
            <VersionPanel chapterId={activeChapter.id} currentContent={activeChapter.content || '{}'} />
          </div>
        )}
      </div>

      {/* 新建弹窗 */}
      <Modal
        title={createType === 'volume' ? '新建卷' : '新建章节'}
        open={!!createType}
        onCancel={() => setCreateType(null)}
        onOk={handleCreate}
        okText="创建" cancelText="取消"
      >
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={createType === 'volume' ? '卷名（如：第一卷 起源篇）' : '章节名（如：第一章 初入江湖）'}
          maxLength={100}
          onPressEnter={handleCreate}
          style={{ marginTop: 16 }}
        />
      </Modal>

      {/* 重命名弹窗 */}
      <Modal
        title="重命名"
        open={!!renameId}
        onCancel={() => setRenameId(null)}
        onOk={handleRename}
        okText="保存" cancelText="取消"
      >
        <Input
          value={renameTitle}
          onChange={(e) => setRenameTitle(e.target.value)}
          onPressEnter={handleRename}
          style={{ marginTop: 16 }}
        />
      </Modal>
    </div>
  )
}
