/**
 * NovelForge - 角色详情编辑表单
 *
 * 编辑选中角色的所有信息：
 * - 基本信息：姓名、描述
 * - 别名/外号列表
 * - 阵营归属历史（动态变更）
 * - 境界/战力变化
 * - 动机变化
 */
import { useEffect, useState, useCallback } from 'react'
import { Input, InputNumber, Button, Tag, Select, Space, Divider, Popconfirm, message } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  useCharacterStore,
  type Character,
  type CharacterAlias,
  type CharacterFaction,
  type CharacterPowerLevel,
  type CharacterMotivation,
} from '../../stores/characterStore'

const { TextArea } = Input

interface CharacterFormProps {
  character: Character
  onClose: () => void
}

export default function CharacterForm({ character, onClose }: CharacterFormProps): JSX.Element {
  const store = useCharacterStore()
  const navigate = useNavigate()

  // 基本信息
  const [name, setName] = useState(character.name)
  const [description, setDescription] = useState(character.description)

  // 子数据
  const [aliases, setAliases] = useState<CharacterAlias[]>([])
  const [charFactions, setCharFactions] = useState<CharacterFaction[]>([])
  const [powerLevels, setPowerLevels] = useState<CharacterPowerLevel[]>([])
  const [motivations, setMotivations] = useState<CharacterMotivation[]>([])

  // 输入框临时值
  const [newAlias, setNewAlias] = useState('')
  const [newFactionId, setNewFactionId] = useState<number | null>(null)
  const [newFactionYear, setNewFactionYear] = useState<number | null>(null)
  const [newPowerLevel, setNewPowerLevel] = useState('')
  const [newPowerYear, setNewPowerYear] = useState<number | null>(null)
  const [newMotivation, setNewMotivation] = useState('')
  const [newMotivationYear, setNewMotivationYear] = useState<number | null>(null)

  // 反向关联
  const [charEvents, setCharEvents] = useState<{ event_id: number; title: string; role: string }[]>([])
  const [charItems, setCharItems] = useState<{ item_id: number; name: string; acquire_method: string }[]>([])

  /** 加载角色子数据 */
  const loadDetails = useCallback(async () => {
    const [a, f, p, m] = await Promise.all([
      store.getAliases(character.id),
      store.getCharacterFactions(character.id),
      store.getCharacterPowerLevels(character.id),
      store.getCharacterMotivations(character.id),
    ])
    setAliases(a)
    setCharFactions(f)
    setPowerLevels(p)
    setMotivations(m)

    // 反向关联：参与事件
    const events = await window.api.dbQuery(
      `SELECT ec.event_id, e.title, ec.role FROM event_characters ec
       JOIN events e ON ec.event_id = e.id WHERE ec.character_id = ?`,
      [character.id]
    ) as { event_id: number; title: string; role: string }[]
    setCharEvents(events)

    // 反向关联：持有物品
    const items = await window.api.dbQuery(
      `SELECT io.item_id, i.name, io.acquire_method FROM item_ownerships io
       JOIN items i ON io.item_id = i.id WHERE io.character_id = ?`,
      [character.id]
    ) as { item_id: number; name: string; acquire_method: string }[]
    setCharItems(items)
  }, [character.id, store])

  useEffect(() => {
    setName(character.name)
    setDescription(character.description)
    loadDetails()
  }, [character.id, character.name, character.description, loadDetails])

  /** 保存基本信息 */
  const handleSaveBasic = async () => {
    if (!name.trim()) {
      message.warning('角色名称不能为空')
      return
    }
    await store.updateCharacter(character.id, {
      name: name.trim(),
      description: description.trim()
    })
    message.success('已保存')
  }

  /** 添加别名 */
  const handleAddAlias = async () => {
    if (!newAlias.trim()) return
    await store.addAlias(character.id, newAlias.trim())
    setNewAlias('')
    await loadDetails()
  }

  /** 删除别名 */
  const handleRemoveAlias = async (aliasId: number) => {
    await store.removeAlias(aliasId)
    await loadDetails()
  }

  const handleAddFaction = async () => {
    if (!newFactionId) return
    await store.addCharacterFaction(character.id, newFactionId, newFactionYear ? { year: newFactionYear } : undefined)
    setNewFactionId(null)
    setNewFactionYear(null)
    await loadDetails()
  }

  /** 移除阵营关联 */
  const handleRemoveFaction = async (id: number) => {
    await store.removeCharacterFaction(id)
    await loadDetails()
  }

  const handleAddPowerLevel = async () => {
    if (!newPowerLevel.trim()) return
    await store.addPowerLevel(character.id, newPowerLevel.trim(), '', newPowerYear ? { year: newPowerYear } : undefined)
    setNewPowerLevel('')
    setNewPowerYear(null)
    await loadDetails()
  }

  /** 删除境界 */
  const handleRemovePowerLevel = async (id: number) => {
    await store.removePowerLevel(id)
    await loadDetails()
  }

  const handleAddMotivation = async () => {
    if (!newMotivation.trim()) return
    await store.addMotivation(character.id, newMotivation.trim(), newMotivationYear ? { year: newMotivationYear } : undefined)
    setNewMotivation('')
    setNewMotivationYear(null)
    await loadDetails()
  }

  /** 删除动机 */
  const handleRemoveMotivation = async (id: number) => {
    await store.removeMotivation(id)
    await loadDetails()
  }

  /** 渲染可编辑列表段 */
  const SectionHeader = ({ title }: { title: string }) => (
    <div style={{
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--accent-secondary)',
      marginBottom: 8,
      marginTop: 4,
    }}>
      {title}
    </div>
  )

  return (
    <div className="glass-panel fade-in" style={{ height: '100%', overflowY: 'auto' }}>
      {/* 顶部操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>编辑角色</span>
        <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
      </div>

      {/* 基本信息 */}
      <SectionHeader title="📝 基本信息" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="角色姓名"
          maxLength={50}
        />
        <TextArea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="角色简介..."
          rows={3}
          maxLength={2000}
        />
        <Button
          type="primary"
          size="small"
          icon={<SaveOutlined />}
          onClick={handleSaveBasic}
          style={{ alignSelf: 'flex-end' }}
        >
          保存
        </Button>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 别名 */}
      <SectionHeader title="🏷️ 别名 / 外号" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {aliases.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>暂无别名</span>
        )}
        {aliases.map((a) => (
          <Tag
            key={a.id}
            closable
            onClose={(e) => { e.preventDefault(); handleRemoveAlias(a.id) }}
          >
            {a.alias}
          </Tag>
        ))}
      </div>
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Input
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          placeholder="添加别名..."
          onPressEnter={handleAddAlias}
          size="small"
        />
        <Button size="small" icon={<PlusOutlined />} onClick={handleAddAlias} />
      </Space.Compact>

      <Divider style={{ margin: '12px 0' }} />

      {/* 阵营 */}
      <SectionHeader title="⚔️ 阵营归属" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {charFactions.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>暂未加入任何阵营</span>
        )}
          {charFactions.map((cf) => (
            <div key={cf.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag color={cf.faction_color} style={{ margin: 0 }}>
                  {cf.faction_name}
                </Tag>
                {cf.start_year != null && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {cf.start_year}年起
                  </span>
                )}
                <span style={{ fontSize: 11, color: cf.end_year ? 'var(--text-muted)' : 'var(--accent-secondary)' }}>
                  {cf.end_year ? `→${cf.end_year}年离开` : '当前'}
                </span>
              </div>
              <Popconfirm
                title="移除此阵营关联？"
                onConfirm={() => handleRemoveFaction(cf.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <Select
          value={newFactionId}
          onChange={setNewFactionId}
          placeholder="选择阵营..."
          style={{ flex: 1 }}
          size="small"
          allowClear
          options={store.factions.map(f => ({ value: f.id, label: f.name }))}
        />
        <InputNumber
          value={newFactionYear}
          onChange={setNewFactionYear}
          placeholder="加入年"
          size="small"
          style={{ width: 80 }}
          min={-99999} max={99999}
        />
        <Button size="small" icon={<PlusOutlined />} onClick={handleAddFaction} disabled={!newFactionId} />
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 境界/战力 */}
      <SectionHeader title="💪 境界 / 战力等级" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {powerLevels.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>暂无记录</span>
        )}
        {powerLevels.map((pl, index) => (
          <div key={pl.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag color={index === powerLevels.length - 1 && !pl.end_year ? 'purple' : 'default'}
                   style={{ margin: 0 }}>
                {pl.level_name}
              </Tag>
              {pl.start_year != null && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pl.start_year}年起</span>
              )}
              {index === powerLevels.length - 1 && !pl.end_year && (
                <span style={{ fontSize: 11, color: 'var(--accent-secondary)' }}>当前</span>
              )}
              {pl.end_year != null && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>→{pl.end_year}年</span>
              )}
            </div>
            <Button
              type="text" size="small" danger icon={<DeleteOutlined />}
              onClick={() => handleRemovePowerLevel(pl.id)}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <Input
          value={newPowerLevel}
          onChange={(e) => setNewPowerLevel(e.target.value)}
          placeholder="新境界名称（如：元婴期）"
          onPressEnter={handleAddPowerLevel}
          size="small"
          style={{ flex: 1 }}
        />
        <InputNumber
          value={newPowerYear}
          onChange={setNewPowerYear}
          placeholder="起始年"
          size="small"
          style={{ width: 80 }}
          min={-99999} max={99999}
        />
        <Button size="small" icon={<PlusOutlined />} onClick={handleAddPowerLevel} />
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 动机 */}
      <SectionHeader title="🎯 动机" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {motivations.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>暂无记录</span>
        )}
        {motivations.map((m) => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>{m.motivation}</span>
              {m.start_year != null && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.start_year}年起</span>
              )}
              {m.end_year != null && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>→{m.end_year}年</span>
              )}
            </div>
            <Button
              type="text" size="small" danger icon={<DeleteOutlined />}
              onClick={() => handleRemoveMotivation(m.id)}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <Input
          value={newMotivation}
          onChange={(e) => setNewMotivation(e.target.value)}
          placeholder="角色动机（如：复仇、修炼…）"
          onPressEnter={handleAddMotivation}
          size="small"
          style={{ flex: 1 }}
        />
        <InputNumber
          value={newMotivationYear}
          onChange={setNewMotivationYear}
          placeholder="起始年"
          size="small"
          style={{ width: 80 }}
          min={-99999} max={99999}
        />
        <Button size="small" icon={<PlusOutlined />} onClick={handleAddMotivation} />
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 参与事件（反向关联） */}
      <SectionHeader title="⚡ 参与事件" />
      {charEvents.length === 0 ? (
        <span style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16, display: 'block' }}>暂无参与事件</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
          {charEvents.map((ce) => (
            <div key={ce.event_id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)',
            }}>
              <a onClick={() => navigate('/workspace/events')}
                style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: 12 }}>
                <LinkOutlined /> {ce.title}
              </a>
              <Tag style={{ fontSize: 11, margin: 0 }}>{ce.role}</Tag>
            </div>
          ))}
        </div>
      )}

      {/* 持有物品（反向关联） */}
      <SectionHeader title="🔧 持有物品" />
      {charItems.length === 0 ? (
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>暂无持有物品</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {charItems.map((ci) => (
            <div key={ci.item_id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)',
            }}>
              <a onClick={() => navigate('/workspace/items')}
                style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: 12 }}>
                <LinkOutlined /> {ci.name}
              </a>
              {ci.acquire_method && <Tag style={{ fontSize: 11, margin: 0 }}>{ci.acquire_method}</Tag>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
