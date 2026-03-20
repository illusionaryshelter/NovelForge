/**
 * NovelForge - 角色档案页
 *
 * 独立全屏页面，展示一个角色的所有信息：
 * - 基础信息（头像、名称、别名、描述）
 * - 阵营归属（含时间段）
 * - 境界/战力变化
 * - 动机变化
 * - 参与事件时间轴（可跳转到事件管理）
 * - 持有物品（可跳转到道具管理）
 * - 角色关系列表（可跳转到其他角色档案/关系图谱）
 */
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Card, Tag, Timeline, Empty, Avatar, Space } from 'antd'
import {
  ArrowLeftOutlined,
  UserOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  AimOutlined,
  ToolOutlined,
  HeartOutlined,
  ClockCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useCharacterStore } from '../stores/characterStore'
import type {
  Character,
  CharacterAlias,
  CharacterFaction,
  CharacterPowerLevel,
  CharacterMotivation,
} from '../stores/characterStore'

// ---- 辅助类型 ----
interface EventRow {
  id: number
  title: string
  year: number
  month: number | null
  day: number | null
  description: string
  timeline_name: string
}

interface ItemRow {
  id: number
  name: string
  description: string
  start_year: number | null
  end_year: number | null
}

interface RelRow {
  id: number
  other_id: number
  other_name: string
  rel_type: string
  description: string
}

/** 格式化年月日 */
function fmtDate(y: number | null, m?: number | null, d?: number | null): string {
  if (y == null) return ''
  let s = `${y}年`
  if (m) s += `${m}月`
  if (d) s += `${d}日`
  return s
}

export default function CharacterProfilePage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const store = useCharacterStore()
  const charId = Number(id)

  const [char, setChar] = useState<Character | null>(null)
  const [aliases, setAliases] = useState<CharacterAlias[]>([])
  const [factions, setFactions] = useState<CharacterFaction[]>([])
  const [powers, setPowers] = useState<CharacterPowerLevel[]>([])
  const [motivations, setMotivations] = useState<CharacterMotivation[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [relations, setRelations] = useState<RelRow[]>([])

  const api = (window as any).api

  const loadAll = useCallback(async () => {
    if (!charId) return
    const c = await api.dbGet('SELECT * FROM characters WHERE id = ?', [charId])
    setChar(c as Character)

    // 并行加载所有关联数据（使用正确的列名：character_a_id, character_b_id, relation_type）
    const [al, fa, pw, mo, ev, it, rel1, rel2] = await Promise.all([
      store.getAliases(charId),
      store.getCharacterFactions(charId),
      store.getCharacterPowerLevels(charId),
      store.getCharacterMotivations(charId),
      api.dbQuery(`
        SELECT e.id, e.title, e.year, e.month, e.day, e.description, t.name as timeline_name
        FROM events e
        JOIN event_characters ec ON ec.event_id = e.id
        LEFT JOIN timelines t ON t.id = e.timeline_id
        WHERE ec.character_id = ?
        ORDER BY e.year, e.month, e.day
      `, [charId]),
      api.dbQuery(`
        SELECT i.id, i.name, i.description, io.start_year, io.end_year
        FROM items i
        JOIN item_ownerships io ON io.item_id = i.id
        WHERE io.character_id = ?
        ORDER BY io.start_year
      `, [charId]),
      api.dbQuery(`
        SELECT cr.id, cr.character_b_id as other_id, c2.name as other_name,
               cr.relation_type as rel_type, cr.description
        FROM character_relationships cr
        JOIN characters c2 ON c2.id = cr.character_b_id
        WHERE cr.character_a_id = ?
      `, [charId]),
      api.dbQuery(`
        SELECT cr.id, cr.character_a_id as other_id, c2.name as other_name,
               cr.relation_type as rel_type, cr.description
        FROM character_relationships cr
        JOIN characters c2 ON c2.id = cr.character_a_id
        WHERE cr.character_b_id = ?
      `, [charId]),
    ])

    setAliases(al)
    setFactions(fa)
    setPowers(pw)
    setMotivations(mo)
    setEvents(ev as EventRow[])
    setItems(it as ItemRow[])
    setRelations([...(rel1 as RelRow[]), ...(rel2 as RelRow[])])
  }, [charId, store, api])

  useEffect(() => { loadAll() }, [loadAll])

  if (!char) return <div style={{ padding: 32 }}>加载中...</div>

  const cardStyle = {
    background: 'var(--bg-glass)',
    border: '1px solid var(--border-subtle)',
    marginBottom: 16,
  }

  return (
    <div className="fade-in" style={{ height: '100%', overflow: 'auto', padding: '0 4px' }}>
      {/* 顶部导航 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/workspace/characters')}>
          返回人物管理
        </Button>
        <Button type="link" onClick={() => navigate('/workspace/relationships')}>
          <LinkOutlined /> 查看关系图谱
        </Button>
        <h2 style={{ margin: 0, flex: 1 }}>📋 {char.name} 的档案</h2>
      </div>

      {/* 基础信息 */}
      <Card size="small" style={cardStyle}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <Avatar
            size={80}
            icon={<UserOutlined />}
            src={char.avatar_path || undefined}
            style={{ flexShrink: 0, background: 'var(--accent-primary)' }}
          />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0 }}>{char.name}</h2>
            {aliases.length > 0 && (
              <div style={{ margin: '4px 0' }}>
                {aliases.map((a) => (
                  <Tag key={a.id} style={{ marginBottom: 2 }}>{a.alias}</Tag>
                ))}
              </div>
            )}
            <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
              {char.description || '暂无描述'}
            </p>
          </div>
        </div>
      </Card>

      {/* 两列布局 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 左列 */}
        <div>
          {/* 阵营 */}
          <Card title={<><TeamOutlined /> 阵营归属</>} size="small" style={cardStyle}>
            {factions.length === 0 ? <Empty description="暂无阵营" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              factions.map((f) => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <Tag color={f.faction_color}>{f.faction_name}</Tag>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {fmtDate(f.start_year, f.start_month, f.start_day)}
                    {f.end_year ? ` → ${fmtDate(f.end_year, f.end_month, f.end_day)}` : f.start_year ? ' → 至今' : ''}
                  </span>
                </div>
              ))
            )}
          </Card>

          {/* 境界 */}
          <Card title={<><ThunderboltOutlined /> 境界变化</>} size="small" style={cardStyle}>
            {powers.length === 0 ? <Empty description="暂无境界记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <Timeline items={powers.map((p) => ({
                color: 'purple',
                children: (
                  <div>
                    <strong>{p.level_name}</strong>
                    {p.start_year && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{fmtDate(p.start_year)}</span>}
                    {p.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.description}</div>}
                  </div>
                ),
              }))} />
            )}
          </Card>

          {/* 动机 */}
          <Card title={<><AimOutlined /> 动机变化</>} size="small" style={cardStyle}>
            {motivations.length === 0 ? <Empty description="暂无动机记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <Timeline items={motivations.map((m) => ({
                color: 'blue',
                children: (
                  <div>
                    <strong>{m.motivation}</strong>
                    {m.start_year && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{fmtDate(m.start_year)}</span>}
                  </div>
                ),
              }))} />
            )}
          </Card>
        </div>

        {/* 右列 */}
        <div>
          {/* 事件时间轴（可跳转） */}
          <Card
            title={<><ClockCircleOutlined /> 参与事件</>}
            size="small"
            style={cardStyle}
            extra={<Button type="link" size="small" onClick={() => navigate('/workspace/events')}>事件管理 →</Button>}
          >
            {events.length === 0 ? <Empty description="暂无关联事件" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <Timeline items={events.map((ev) => ({
                color: 'green',
                children: (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <a style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}
                        onClick={() => navigate('/workspace/events')}>
                        <strong>{ev.title}</strong>
                      </a>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(ev.year, ev.month, ev.day)}</span>
                    </div>
                    {ev.timeline_name && <Tag style={{ fontSize: 10, marginTop: 2 }}>{ev.timeline_name}</Tag>}
                    {ev.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{ev.description.slice(0, 80)}</div>}
                  </div>
                ),
              }))} />
            )}
          </Card>

          {/* 持有物品（可跳转） */}
          <Card
            title={<><ToolOutlined /> 持有物品</>}
            size="small"
            style={cardStyle}
            extra={<Button type="link" size="small" onClick={() => navigate('/workspace/items')}>道具管理 →</Button>}
          >
            {items.length === 0 ? <Empty description="暂无物品" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              items.map((it) => (
                <div key={it.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                  <a style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}
                    onClick={() => navigate('/workspace/items')}>
                    <strong>{it.name}</strong>
                  </a>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {it.start_year ? `${it.start_year}年` : ''}{it.end_year ? ` → ${it.end_year}年` : ''}
                  </span>
                </div>
              ))
            )}
          </Card>

          {/* 关系（可跳转到对方档案） */}
          <Card
            title={<><HeartOutlined /> 角色关系</>}
            size="small"
            style={cardStyle}
            extra={<Button type="link" size="small" onClick={() => navigate('/workspace/relationships')}>关系图谱 →</Button>}
          >
            {relations.length === 0 ? <Empty description="暂无关系" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              relations.map((r, idx) => (
                <div key={`${r.id}-${idx}`} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    type="link" size="small"
                    onClick={() => navigate(`/workspace/profile/${r.other_id}`)}
                  >
                    {r.other_name}
                  </Button>
                  <Tag color="geekblue">{r.rel_type}</Tag>
                  {r.description && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.description.slice(0, 40)}</span>}
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
