/**
 * NovelForge - 道具/物品管理页面
 *
 * 功能：
 * - 物品 CRUD（名称、类型、等级、状态）
 * - 持有者历史（历任主人、获取方式、起止时间）
 * - 关联事件
 * - 跨模块跳转：点击角色名 → 人物管理页，点击事件名 → 事件管理页
 */
import { useEffect, useState, useCallback } from 'react'
import { Button, Input, Select, Modal, Popconfirm, Tag, Space, Empty, message } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
  UserOutlined,
  ThunderboltOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useItemStore, type Item, type ItemOwnership, type ItemEvent } from '../stores/itemStore'
import { useCharacterStore } from '../stores/characterStore'

const { TextArea } = Input

/** 常用物品类型 */
const ITEM_TYPES = ['武器', '防具', '法宝', '丹药', '材料', '秘籍', '金手指', '其他']

export default function ItemPage(): JSX.Element {
  const store = useItemStore()
  const charStore = useCharacterStore()
  const navigate = useNavigate()

  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editRank, setEditRank] = useState('')
  const [editStatus, setEditStatus] = useState('完好')

  // 持有者
  const [ownerships, setOwnerships] = useState<ItemOwnership[]>([])
  const [addOwnerOpen, setAddOwnerOpen] = useState(false)
  const [newOwnerId, setNewOwnerId] = useState<number | null>(null)
  const [newOwnerMethod, setNewOwnerMethod] = useState('')
  const [newOwnerYear, setNewOwnerYear] = useState<number | null>(null)

  // 关联事件
  const [itemEvents, setItemEvents] = useState<ItemEvent[]>([])
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [newEventId, setNewEventId] = useState<number | null>(null)
  const [newEventAction, setNewEventAction] = useState('相关')
  const [allEvents, setAllEvents] = useState<{ id: number; title: string }[]>([])

  // 新建物品
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('其他')
  const [newRank, setNewRank] = useState('')

  useEffect(() => {
    store.loadItems()
    charStore.loadCharacters()
    loadAllEvents()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadAllEvents = useCallback(async () => {
    const events = await window.api.dbQuery('SELECT id, title FROM events ORDER BY title') as { id: number; title: string }[]
    setAllEvents(events)
  }, [])

  const filteredItems = store.getFilteredItems()

  /** 选中物品 */
  const handleSelect = async (item: Item) => {
    setSelectedItem(item)
    setEditName(item.name)
    setEditType(item.item_type)
    setEditDesc(item.description)
    setEditRank(item.rank)
    setEditStatus(item.status)
    const owns = await store.getOwnerships(item.id)
    setOwnerships(owns)
    const evts = await store.getItemEvents(item.id)
    setItemEvents(evts)
  }

  /** 保存物品 */
  const handleSave = async () => {
    if (!selectedItem) return
    await store.updateItem(selectedItem.id, {
      name: editName.trim(),
      item_type: editType,
      description: editDesc.trim(),
      rank: editRank.trim(),
      status: editStatus.trim(),
    })
    message.success('已保存')
  }

  /** 删除物品 */
  const handleDelete = async (id: number) => {
    await store.deleteItem(id)
    if (selectedItem?.id === id) setSelectedItem(null)
    message.success('已删除')
  }

  /** 新建物品 */
  const handleCreate = async () => {
    if (!newName.trim()) { message.warning('请输入名称'); return }
    await store.createItem(newName.trim(), newType, '', newRank.trim())
    setCreateOpen(false)
    setNewName('')
    setNewType('其他')
    setNewRank('')
    message.success('物品已创建')
  }

  /** 添加持有者 */
  const handleAddOwner = async () => {
    if (!selectedItem || !newOwnerId) return
    await store.addOwnership(selectedItem.id, newOwnerId, newOwnerMethod, newOwnerYear)
    setAddOwnerOpen(false)
    setNewOwnerId(null)
    setNewOwnerMethod('')
    setNewOwnerYear(null)
    const owns = await store.getOwnerships(selectedItem.id)
    setOwnerships(owns)
    message.success('持有者已添加')
  }

  /** 移除持有者记录 */
  const handleRemoveOwner = async (id: number) => {
    await store.removeOwnership(id)
    if (selectedItem) {
      const owns = await store.getOwnerships(selectedItem.id)
      setOwnerships(owns)
    }
  }

  /** 添加关联事件 */
  const handleAddEvent = async () => {
    if (!selectedItem || !newEventId) return
    await store.addItemEvent(selectedItem.id, newEventId, newEventAction)
    setAddEventOpen(false)
    setNewEventId(null)
    setNewEventAction('相关')
    const evts = await store.getItemEvents(selectedItem.id)
    setItemEvents(evts)
    message.success('事件已关联')
  }

  /** 移除关联事件 */
  const handleRemoveEvent = async (id: number) => {
    await store.removeItemEvent(id)
    if (selectedItem) {
      const evts = await store.getItemEvents(selectedItem.id)
      setItemEvents(evts)
    }
  }

  /** 跳转到角色页面 */
  const goToCharacter = () => {
    navigate('/workspace/characters')
  }

  /** 跳转到事件页面 */
  const goToEvent = () => {
    navigate('/workspace/events')
  }

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12, flexShrink: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>🔧 道具管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          新建物品
        </Button>
      </div>

      {/* 搜索 */}
      <Input
        placeholder="搜索物品名称或类型..."
        value={store.searchText}
        onChange={(e) => store.setSearchText(e.target.value)}
        allowClear
        style={{ marginBottom: 12, flexShrink: 0 }}
      />

      {/* 主内容区 */}
      <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>
        {/* 左侧物品列表 */}
        <div style={{
          width: selectedItem ? '35%' : '100%',
          transition: 'width 250ms ease',
          overflowY: 'auto',
        }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: '40px 0' }}>
              <Empty description="暂无物品" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', marginBottom: 6, borderRadius: 8, cursor: 'pointer',
                  background: selectedItem?.id === item.id ? 'rgba(124, 58, 237, 0.08)' : 'var(--bg-secondary)',
                  border: selectedItem?.id === item.id ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
                  transition: 'all 150ms',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</span>
                    <Tag style={{ fontSize: 11, margin: 0 }}>{item.item_type}</Tag>
                    {item.rank && <Tag color="gold" style={{ fontSize: 11, margin: 0 }}>{item.rank}</Tag>}
                  </div>
                  {item.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.description.slice(0, 50)}
                    </div>
                  )}
                </div>
                <Popconfirm title="删除此物品？" onConfirm={(e) => { e?.stopPropagation(); handleDelete(item.id) }}
                  onCancel={(e) => e?.stopPropagation()} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                </Popconfirm>
              </div>
            ))
          )}
        </div>

        {/* 右侧编辑面板 */}
        {selectedItem && (
          <div className="glass-panel fade-in" style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>✏️ 编辑物品</span>
              <Space>
                <Button type="primary" size="small" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
                <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setSelectedItem(null)} />
              </Space>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="物品名称" style={{ flex: 1 }} />
              <Select value={editType} onChange={setEditType} style={{ width: 120 }}
                options={ITEM_TYPES.map(t => ({ value: t, label: t }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Input value={editRank} onChange={(e) => setEditRank(e.target.value)} placeholder="等级/品阶" style={{ flex: 1 }} />
              <Input value={editStatus} onChange={(e) => setEditStatus(e.target.value)} placeholder="状态" style={{ width: 120 }} />
            </div>
            <TextArea value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
              placeholder="物品描述..." rows={3} maxLength={5000} style={{ marginBottom: 16 }} />

            {/* 持有者历史 */}
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-secondary)' }}>
                <UserOutlined /> 持有者历史
              </span>
              <Button size="small" icon={<PlusOutlined />} onClick={() => setAddOwnerOpen(true)}>添加</Button>
            </div>
            {ownerships.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无持有记录</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                {ownerships.map((o) => (
                  <div key={o.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <a onClick={goToCharacter} style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: 13 }}>
                        <LinkOutlined /> {o.character_name}
                      </a>
                      {o.acquire_method && <Tag style={{ fontSize: 11, margin: 0 }}>{o.acquire_method}</Tag>}
                      {o.start_year && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {o.start_year}年{o.end_year ? ` → ${o.end_year}年` : ' 至今'}
                        </span>
                      )}
                    </div>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveOwner(o.id)} />
                  </div>
                ))}
              </div>
            )}

            {/* 关联事件 */}
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-secondary)' }}>
                <ThunderboltOutlined /> 关联事件
              </span>
              <Button size="small" icon={<PlusOutlined />} onClick={() => setAddEventOpen(true)}>添加</Button>
            </div>
            {itemEvents.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无关联事件</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {itemEvents.map((ie) => (
                  <div key={ie.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <a onClick={goToEvent} style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: 13 }}>
                        <LinkOutlined /> {ie.event_title}
                      </a>
                      <Tag style={{ fontSize: 11, margin: 0 }}>{ie.action}</Tag>
                    </div>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveEvent(ie.id)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 新建物品弹窗 */}
      <Modal title="新建物品" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={handleCreate}
        okText="创建" cancelText="取消">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="物品名称" maxLength={100} />
          <Select value={newType} onChange={setNewType} options={ITEM_TYPES.map(t => ({ value: t, label: t }))} />
          <Input value={newRank} onChange={(e) => setNewRank(e.target.value)} placeholder="等级/品阶（可选）" />
        </div>
      </Modal>

      {/* 添加持有者弹窗 */}
      <Modal title="添加持有者" open={addOwnerOpen} onCancel={() => setAddOwnerOpen(false)} onOk={handleAddOwner}
        okText="添加" cancelText="取消">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Select value={newOwnerId} onChange={setNewOwnerId} placeholder="选择角色" showSearch optionFilterProp="label"
            options={charStore.characters.map(c => ({ value: c.id, label: c.name }))} />
          <Input value={newOwnerMethod} onChange={(e) => setNewOwnerMethod(e.target.value)} placeholder="获取方式（如：夺取、赠送、继承）" />
          <Input type="number" value={newOwnerYear ?? ''} onChange={(e) => setNewOwnerYear(e.target.value ? Number(e.target.value) : null)}
            placeholder="获取年份（可选）" />
        </div>
      </Modal>

      {/* 关联事件弹窗 */}
      <Modal title="关联事件" open={addEventOpen} onCancel={() => setAddEventOpen(false)} onOk={handleAddEvent}
        okText="添加" cancelText="取消">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Select value={newEventId} onChange={setNewEventId} placeholder="选择事件" showSearch optionFilterProp="label"
            options={allEvents.map(e => ({ value: e.id, label: e.title }))} />
          <Input value={newEventAction} onChange={(e) => setNewEventAction(e.target.value)} placeholder="动作（如：易手、升级、损坏、丢失）" />
        </div>
      </Modal>
    </div>
  )
}
