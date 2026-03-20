/**
 * NovelForge - 人物关系图谱页面
 *
 * 使用 Cytoscape.js 渲染交互式关系网络图。
 * 布局：上方图谱 + 右侧编辑面板 + 下方关系列表
 *
 * 交互：
 * - 从列表中点击关系 → 打开编辑面板 + 显示共同事件
 * - 图谱中单击边 → 同上
 * - 双击节点 → 跳转角色页
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Button, Input, InputNumber, Select, Modal, Popconfirm, Space, Tag, Divider, Slider, Switch, message } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  ThunderboltOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import cytoscape, { type Core, type EventObject } from 'cytoscape'
import { useRelationshipStore, type Relationship } from '../stores/relationshipStore'

const { TextArea } = Input

/** 常用关系类型 */
const RELATION_TYPES = [
  '师徒', '同门', '情侣', '夫妻', '亲子', '兄弟', '姐妹',
  '朋友', '敌对', '主仆', '盟友', '宿敌', '同事', '其他',
]

/** 关系类型对应的边颜色 */
function getEdgeColor(type: string): string {
  const map: Record<string, string> = {
    '师徒': '#4fc3f7', '同门': '#81c784', '情侣': '#f48fb1', '夫妻': '#ef5350',
    '亲子': '#ffb74d', '兄弟': '#90caf9', '姐妹': '#ce93d8',
    '朋友': '#a5d6a7', '敌对': '#e53935', '主仆': '#78909c',
    '盟友': '#66bb6a', '宿敌': '#d32f2f', '同事': '#9e9e9e',
  }
  return map[type] || '#888888'
}

export default function RelationshipPage(): JSX.Element {
  const store = useRelationshipStore()
  const navigate = useNavigate()
  const cyRef = useRef<Core | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 选中的关系
  const [selectedRel, setSelectedRel] = useState<Relationship | null>(null)
  const [editType, setEditType] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // 两角色共同事件
  const [sharedEvents, setSharedEvents] = useState<{ id: number; title: string; year: number }[]>([])

  // 用 ref 避免 Cytoscape 回调闭包过期
  const selectRelRef = useRef<(rel: Relationship) => void>(() => {})

  // 新建关系弹窗
  const [createOpen, setCreateOpen] = useState(false)
  const [newCharA, setNewCharA] = useState<number | null>(null)
  const [newCharB, setNewCharB] = useState<number | null>(null)
  const [newType, setNewType] = useState('朋友')
  const [newDesc, setNewDesc] = useState('')
  const [newStartYear, setNewStartYear] = useState<number | null>(null)
  const [newEndYear, setNewEndYear] = useState<number | null>(null)

  // 时间线滑块
  const [timeFilterEnabled, setTimeFilterEnabled] = useState(false)
  const [filterYear, setFilterYear] = useState<number>(1)

  // 编辑面板时间
  const [editStartYear, setEditStartYear] = useState<number | null>(null)
  const [editEndYear, setEditEndYear] = useState<number | null>(null)

  useEffect(() => {
    store.loadAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** 选中关系 + 加载共同事件 */
  const selectRelationship = useCallback(async (rel: Relationship) => {
    setSelectedRel(rel)
    setEditType(rel.relation_type)
    setEditDesc(rel.description)
    setEditStartYear(rel.start_year)
    setEditEndYear(rel.end_year)
    try {
      const events = await window.api.dbQuery(
        `SELECT e.id, e.title, e.year FROM events e
         WHERE e.id IN (
           SELECT ec1.event_id FROM event_characters ec1
           WHERE ec1.character_id = ?
         ) AND e.id IN (
           SELECT ec2.event_id FROM event_characters ec2
           WHERE ec2.character_id = ?
         )
         ORDER BY e.year, e.month, e.day`,
        [rel.character_a_id, rel.character_b_id]
      ) as { id: number; title: string; year: number }[]
      setSharedEvents(events)
    } catch {
      setSharedEvents([])
    }
  }, [])

  // 保持 ref 同步
  selectRelRef.current = selectRelationship

  /** 计算时间范围 + 过滤关系 */
  const yearRange = useMemo(() => {
    const years: number[] = []
    store.relationships.forEach((r) => {
      if (r.start_year != null) years.push(r.start_year)
      if (r.end_year != null) years.push(r.end_year)
    })
    if (years.length === 0) return { min: 1, max: 100 }
    return { min: Math.min(...years), max: Math.max(...years) }
  }, [store.relationships])

  /** 时间过滤后的关系 */
  const filteredRelationships = useMemo(() => {
    if (!timeFilterEnabled) return store.relationships
    return store.relationships.filter((r) => {
      // 无时间信息的关系始终显示
      if (r.start_year == null && r.end_year == null) return true
      // 有开始无结束：year >= start
      if (r.start_year != null && r.end_year == null) return filterYear >= r.start_year
      // 有结束无开始：year <= end
      if (r.start_year == null && r.end_year != null) return filterYear <= r.end_year
      // 都有：start <= year <= end
      return filterYear >= r.start_year! && filterYear <= r.end_year!
    })
  }, [store.relationships, timeFilterEnabled, filterYear])

  /** 初始化 / 更新 Cytoscape 图 */
  useEffect(() => {
    if (!containerRef.current) return
    if (store.loading) return




    // 构建边数据（用过滤后的关系）
    const edges = filteredRelationships.map((r) => ({
      data: {
        id: `e${r.id}`,
        source: `n${r.character_a_id}`,
        target: `n${r.character_b_id}`,
        label: r.relation_type,
        relId: r.id,
        color: getEdgeColor(r.relation_type),
      },
    }))

    // 只显示有边连接的节点
    const connectedIds = new Set<number>()
    filteredRelationships.forEach((r) => {
      connectedIds.add(r.character_a_id)
      connectedIds.add(r.character_b_id)
    })
    const visibleNodes = timeFilterEnabled
      ? store.graphNodes.filter((n) => connectedIds.has(n.id))
      : store.graphNodes

    const nodes = visibleNodes.map((n) => ({
      data: {
        id: `n${n.id}`,
        label: n.name,
        charId: n.id,
        color: n.faction_color || '#666666',
        factionName: n.faction_name || '',
      },
    }))

    if (cyRef.current) {
      cyRef.current.destroy()
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': 'data(color)',
            'color': '#e0e0e0',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'font-size': 12,
            'width': 36,
            'height': 36,
            'border-width': 2,
            'border-color': '#444',
            'text-outline-width': 2,
            'text-outline-color': '#1a1a2e',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#7c3aed',
            'border-width': 3,
          },
        },
        {
          selector: 'edge',
          style: {
            'label': 'data(label)',
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'width': 3,
            'curve-style': 'bezier',
            'font-size': 10,
            'color': '#aaa',
            'text-outline-width': 1.5,
            'text-outline-color': '#1a1a2e',
            'text-rotation': 'autorotate',
            'overlay-padding': 8,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 5,
            'line-color': '#7c3aed',
            'color': '#fff',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        gravity: 0.3,
        padding: 40,
      },
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.2,
    })

    // 统一 tap 处理器
    cy.on('tap', (evt: EventObject) => {
      const target = evt.target
      if (target === cy) {
        // 点击背景清除选中
        setSelectedRel(null)
        setSharedEvents([])
      } else if (target.isEdge && target.isEdge()) {
        // 点击边 → 打开编辑面板
        const relId = target.data('relId') as number
        const rel = store.relationships.find((r) => r.id === relId)
        if (rel) selectRelRef.current(rel)
      }
    })

    // 双击节点跳转
    cy.on('dbltap', 'node', (evt: EventObject) => {
      const charId = evt.target.data('charId')
      if (charId) navigate('/workspace/characters')
    })

    cyRef.current = cy

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy()
        cyRef.current = null
      }
    }
  }, [store.graphNodes, filteredRelationships, store.loading]) // eslint-disable-line react-hooks/exhaustive-deps

  /** 保存关系 */
  const handleSave = async () => {
    if (!selectedRel) return
    await store.updateRelationship(selectedRel.id, {
      relation_type: editType,
      description: editDesc.trim(),
      start_year: editStartYear,
      end_year: editEndYear,
    })
    setSelectedRel(null)
    message.success('关系已保存')
  }

  /** 删除关系 */
  const handleDelete = async () => {
    if (!selectedRel) return
    await store.deleteRelationship(selectedRel.id)
    setSelectedRel(null)
    message.success('关系已删除')
  }

  /** 新建关系 */
  const handleCreate = async () => {
    if (!newCharA || !newCharB) { message.warning('请选择两个角色'); return }
    if (newCharA === newCharB) { message.warning('不能与自身建立关系'); return }
    await store.createRelationship(newCharA, newCharB, newType, newDesc.trim())
    // 如果有起止年，更新
    if (newStartYear != null || newEndYear != null) {
      const lastRel = store.relationships[store.relationships.length - 1]
      if (lastRel) {
        await store.updateRelationship(lastRel.id, {
          start_year: newStartYear,
          end_year: newEndYear,
        })
      }
    }
    setCreateOpen(false)
    setNewCharA(null)
    setNewCharB(null)
    setNewType('朋友')
    setNewDesc('')
    setNewStartYear(null)
    setNewEndYear(null)
    message.success('关系已创建')
  }

  /** 缩放控制 */
  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.3)
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() / 1.3)
  const handleFit = () => cyRef.current?.fit(undefined, 40)
  const handleRelayout = () => {
    cyRef.current?.layout({
      name: 'cose', animate: true, animationDuration: 500,
      nodeRepulsion: () => 8000, idealEdgeLength: () => 120, gravity: 0.3, padding: 40,
    }).run()
  }

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8, flexShrink: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>🕸️ 人物关系图谱</h2>
        <Space>
          <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} size="small" />
          <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} size="small" />
          <Button icon={<ExpandOutlined />} onClick={handleFit} size="small" title="适应画布" />
          <Button onClick={handleRelayout} size="small">重新布局</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建关系
          </Button>
        </Space>
      </div>

      {/* 时间线滑块 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 8, flexShrink: 0,
        padding: '4px 8px', borderRadius: 6,
        background: timeFilterEnabled ? 'rgba(124,58,237,0.06)' : 'transparent',
        border: timeFilterEnabled ? '1px solid var(--border-accent)' : '1px solid transparent',
        transition: 'all 200ms',
      }}>
        <Switch size="small" checked={timeFilterEnabled}
          onChange={(v) => { setTimeFilterEnabled(v); if (v && yearRange.min === yearRange.max) setFilterYear(yearRange.min) }} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>时间线过滤</span>
        {timeFilterEnabled && (
          <>
            <Slider
              value={filterYear}
              onChange={setFilterYear}
              min={yearRange.min}
              max={yearRange.max}
              style={{ flex: 1, margin: '0 8px' }}
              tooltip={{ formatter: (v) => `${v}年` }}
            />
            <Tag color="purple" style={{ margin: 0, fontSize: 12, minWidth: 50, textAlign: 'center' }}>
              {filterYear}年
            </Tag>
          </>
        )}
        {!timeFilterEnabled && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            开启后可按年份筛选关系（需设置关系的起止年份）
          </span>
        )}
      </div>

      {/* 主内容区 */}
      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden' }}>
        {/* 左侧：图谱 + 关系列表 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
          {/* 图谱画布 */}
          <div
            ref={containerRef}
            style={{
              flex: 1,
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              background: 'var(--bg-secondary)',
              minHeight: 200,
            }}
          />

          {/* 关系列表（可点击交互） */}
          <div style={{
            maxHeight: 180, overflowY: 'auto',
            border: '1px solid var(--border-subtle)', borderRadius: 8,
            background: 'var(--bg-secondary)', padding: '8px 12px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              关系列表（点击编辑）· 显示 {filteredRelationships.length} / {store.relationships.length} 条
            </div>
            {filteredRelationships.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
                {timeFilterEnabled ? '该时间点无活跃关系' : '暂无关系，点击「新建关系」添加'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredRelationships.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => selectRelationship(rel)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                      background: selectedRel?.id === rel.id ? 'rgba(124,58,237,0.12)' : 'transparent',
                      border: selectedRel?.id === rel.id ? '1px solid var(--border-accent)' : '1px solid transparent',
                      transition: 'all 150ms',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{rel.name_a}</span>
                    <Tag color={getEdgeColor(rel.relation_type)} style={{ fontSize: 11, margin: 0 }}>
                      {rel.relation_type}
                    </Tag>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{rel.name_b}</span>
                    {rel.description && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {rel.description.slice(0, 20)}{rel.description.length > 20 ? '...' : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧编辑面板 */}
        {selectedRel && (
          <div className="glass-panel fade-in" style={{
            width: 260, flexShrink: 0, overflow: 'auto',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>✏️ 编辑关系</span>
              <Space>
                <Button type="primary" size="small" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
                <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => { setSelectedRel(null); setSharedEvents([]) }} />
              </Space>
            </div>

            {/* 关系角色 */}
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <Tag color="purple">{selectedRel.name_a}</Tag>
              <span style={{ margin: '0 4px' }}>↔</span>
              <Tag color="purple">{selectedRel.name_b}</Tag>
            </div>

            {/* 关系类型 */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                关系类型
              </label>
              <Select
                value={editType}
                onChange={setEditType}
                style={{ width: '100%' }}
                size="small"
                options={RELATION_TYPES.map(t => ({ value: t, label: t }))}
              />
            </div>

            {/* 描述 */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                描述
              </label>
              <TextArea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="关系描述..."
                rows={3}
                maxLength={2000}
                style={{ fontSize: 12 }}
              />
            </div>

            {/* 起止年份 */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                起止年份（用于时间线过滤）
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <InputNumber
                  value={editStartYear}
                  onChange={setEditStartYear}
                  placeholder="开始年"
                  size="small"
                  style={{ flex: 1 }}
                  min={-99999}
                  max={99999}
                />
                <span style={{ lineHeight: '24px', color: 'var(--text-muted)' }}>~</span>
                <InputNumber
                  value={editEndYear}
                  onChange={setEditEndYear}
                  placeholder="结束年"
                  size="small"
                  style={{ flex: 1 }}
                  min={-99999}
                  max={99999}
                />
              </div>
            </div>

            {/* 删除 */}
            <Popconfirm title="删除此关系？" onConfirm={handleDelete}
              okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
              <Button danger block size="small" icon={<DeleteOutlined />}>删除关系</Button>
            </Popconfirm>

            <Divider style={{ margin: '8px 0' }} />

            {/* 共同事件时间轴 */}
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-secondary)' }}>
                <ThunderboltOutlined /> 共同事件时间轴
              </span>
              {sharedEvents.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  暂无共同事件（请在事件管理中将两个角色关联到同一事件）
                </div>
              ) : (
                <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {sharedEvents.map((ev, idx) => (
                    <div key={ev.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8,
                    }}>
                      {/* 时间轴线 */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: 'var(--accent-primary)', flexShrink: 0,
                        }} />
                        {idx < sharedEvents.length - 1 && (
                          <div style={{ width: 1, flex: 1, minHeight: 20, background: 'var(--border-subtle)' }} />
                        )}
                      </div>
                      {/* 事件内容 */}
                      <div style={{ flex: 1 }}>
                        <a onClick={() => navigate('/workspace/events')}
                          style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontSize: 12 }}>
                          <LinkOutlined /> {ev.title}
                        </a>
                        <Tag style={{ fontSize: 10, margin: '0 0 0 6px' }}>{ev.year}年</Tag>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 新建关系弹窗 */}
      <Modal
        title="新建关系"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="创建" cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Select
            value={newCharA}
            onChange={setNewCharA}
            placeholder="角色 A"
            showSearch
            optionFilterProp="label"
            options={store.graphNodes.map(n => ({ value: n.id, label: n.name }))}
          />
          <Select
            value={newCharB}
            onChange={setNewCharB}
            placeholder="角色 B"
            showSearch
            optionFilterProp="label"
            options={store.graphNodes
              .filter(n => n.id !== newCharA)
              .map(n => ({ value: n.id, label: n.name }))}
          />
          <Select
            value={newType}
            onChange={setNewType}
            options={RELATION_TYPES.map(t => ({ value: t, label: t }))}
          />
          <Input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="关系描述（可选）"
            maxLength={200}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <InputNumber
              value={newStartYear}
              onChange={setNewStartYear}
              placeholder="开始年"
              style={{ flex: 1 }}
              min={-99999}
              max={99999}
            />
            <InputNumber
              value={newEndYear}
              onChange={setNewEndYear}
              placeholder="结束年"
              style={{ flex: 1 }}
              min={-99999}
              max={99999}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
