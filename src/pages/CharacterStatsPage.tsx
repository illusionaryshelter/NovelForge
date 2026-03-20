/**
 * NovelForge - 角色出场频率统计（增强版）
 *
 * 功能：
 * - 热力图表格（行=角色，列=卷，单元格=出场章节数）
 * - 角色名可点击跳转到档案页
 * - 点击单元格展开详情：显示具体出场事件和章节
 * - 总计列用条形图可视化
 * - 排序：按总出场次数降序
 */
import { useEffect, useState } from 'react'
import { Card, Empty, Tag, Tooltip, Button } from 'antd'
import { BarChartOutlined, UserOutlined, RightOutlined, DownOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

interface StatsRow {
  charId: number
  charName: string
  volCounts: Map<number, number>
  /** 卷→章节详情 */
  volDetails: Map<number, { chapterId: number; chapterTitle: string; events: string[] }[]>
  total: number
}

interface VolumeInfo {
  id: number
  title: string
}

export default function CharacterStatsPage(): JSX.Element {
  const [volumes, setVolumes] = useState<VolumeInfo[]>([])
  const [stats, setStats] = useState<StatsRow[]>([])
  const [expandedChar, setExpandedChar] = useState<number | null>(null)
  const [expandedVol, setExpandedVol] = useState<string | null>(null) // "charId-volId"
  const navigate = useNavigate()

  const api = (window as any).api

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const vols = await api.dbQuery(
        'SELECT id, title FROM volumes ORDER BY sort_order, id'
      ) as VolumeInfo[]
      setVolumes(vols)

      // 详细查询：角色→事件→章节，含标题
      const rows = await api.dbQuery(`
        SELECT DISTINCT ch.name as char_name, ch.id as char_id,
               v.id as vol_id, c.id as chapter_id, c.title as chapter_title,
               e.title as event_title
        FROM characters ch
        JOIN event_characters ec ON ec.character_id = ch.id
        JOIN events e ON e.id = ec.event_id
        JOIN chapter_events ce ON ce.event_id = ec.event_id
        JOIN chapters c ON c.id = ce.chapter_id
        JOIN volumes v ON v.id = c.volume_id
        WHERE COALESCE(ch.is_deleted, 0) = 0
          AND COALESCE(c.is_deleted, 0) = 0
      `) as {
        char_name: string; char_id: number; vol_id: number
        chapter_id: number; chapter_title: string; event_title: string
      }[]

      // 聚合
      const charMap = new Map<number, {
        name: string
        vols: Map<number, Map<number, { title: string; events: Set<string> }>>
      }>()

      for (const r of rows) {
        if (!charMap.has(r.char_id)) {
          charMap.set(r.char_id, { name: r.char_name, vols: new Map() })
        }
        const entry = charMap.get(r.char_id)!
        if (!entry.vols.has(r.vol_id)) entry.vols.set(r.vol_id, new Map())
        const volMap = entry.vols.get(r.vol_id)!
        if (!volMap.has(r.chapter_id)) {
          volMap.set(r.chapter_id, { title: r.chapter_title, events: new Set() })
        }
        volMap.get(r.chapter_id)!.events.add(r.event_title)
      }

      const result: StatsRow[] = []
      Array.from(charMap.entries()).forEach(([id, data]) => {
        const volCounts = new Map<number, number>()
        const volDetails = new Map<number, { chapterId: number; chapterTitle: string; events: string[] }[]>()
        let total = 0

        Array.from(data.vols.entries()).forEach(([vid, chapterMap]) => {
          volCounts.set(vid, chapterMap.size)
          total += chapterMap.size
          const details: { chapterId: number; chapterTitle: string; events: string[] }[] = []
          Array.from(chapterMap.entries()).forEach(([cid, info]) => {
            details.push({ chapterId: cid, chapterTitle: info.title, events: Array.from(info.events) })
          })
          volDetails.set(vid, details)
        })
        result.push({ charId: id, charName: data.name, volCounts, volDetails, total })
      })
      result.sort((a, b) => b.total - a.total)
      setStats(result)
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  }

  /** 热力色 */
  const heatColor = (count: number, max: number): string => {
    if (count === 0 || max === 0) return 'transparent'
    const ratio = count / max
    if (ratio > 0.7) return 'rgba(124, 58, 237, 0.5)'
    if (ratio > 0.4) return 'rgba(124, 58, 237, 0.3)'
    if (ratio > 0.1) return 'rgba(124, 58, 237, 0.15)'
    return 'rgba(124, 58, 237, 0.06)'
  }

  const maxCount = stats.reduce((m, s) => Math.max(m, ...Array.from(s.volCounts.values())), 0)
  const maxTotal = stats.reduce((m, s) => Math.max(m, s.total), 0)

  const toggleDetail = (charId: number, volId: number) => {
    const key = `${charId}-${volId}`
    setExpandedVol(expandedVol === key ? null : key)
  }

  return (
    <div className="fade-in" style={{ height: '100%', overflow: 'auto', padding: '0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <BarChartOutlined style={{ fontSize: 20, color: 'var(--accent-primary)' }} />
        <h2 style={{ margin: 0 }}>角色出场统计</h2>
        <Tag>{stats.length} 位角色</Tag>
        <Tag color="purple">{volumes.length} 卷</Tag>
      </div>

      {stats.length === 0 ? (
        <Empty description="暂无统计数据（请先将角色关联到事件，并将事件关联到章节）" />
      ) : (
        <Card size="small" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{
                  textAlign: 'left', padding: '6px 10px',
                  borderBottom: '2px solid var(--border-subtle)',
                  position: 'sticky', left: 0, background: 'var(--bg-glass)', zIndex: 1,
                  minWidth: 100,
                }}>
                  角色
                </th>
                {volumes.map(v => (
                  <th key={v.id} style={{
                    textAlign: 'center', padding: '6px 8px',
                    borderBottom: '2px solid var(--border-subtle)',
                    whiteSpace: 'nowrap',
                  }}>
                    {v.title}
                  </th>
                ))}
                <th style={{
                  textAlign: 'center', padding: '6px 8px',
                  borderBottom: '2px solid var(--border-subtle)',
                  fontWeight: 700, minWidth: 100,
                }}>
                  总计
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <>
                  <tr key={s.charId} style={{ cursor: 'pointer' }}
                    onClick={() => setExpandedChar(expandedChar === s.charId ? null : s.charId)}>
                    <td style={{
                      padding: '5px 10px', borderBottom: '1px solid var(--border-subtle)',
                      fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-glass)', zIndex: 1,
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {expandedChar === s.charId ? <DownOutlined style={{ fontSize: 9 }} /> : <RightOutlined style={{ fontSize: 9 }} />}
                        <Tooltip title="点击查看角色档案">
                          <Button type="link" size="small"
                            icon={<UserOutlined />}
                            onClick={(e) => { e.stopPropagation(); navigate(`/workspace/profile/${s.charId}`) }}
                            style={{ padding: 0, height: 'auto', fontSize: 12, fontWeight: 600 }}>
                            {s.charName}
                          </Button>
                        </Tooltip>
                      </span>
                    </td>
                    {volumes.map(v => {
                      const count = s.volCounts.get(v.id) || 0
                      return (
                        <td key={v.id} style={{
                          textAlign: 'center', padding: '5px 8px',
                          borderBottom: '1px solid var(--border-subtle)',
                          background: heatColor(count, maxCount),
                          transition: 'background 200ms', cursor: count > 0 ? 'pointer' : 'default',
                        }}
                          onClick={(e) => { e.stopPropagation(); if (count > 0) toggleDetail(s.charId, v.id) }}>
                          <Tooltip title={count > 0 ? `点击展开 ${s.charName} 在 ${v.title} 的出场详情` : ''}>
                            <span style={{ fontWeight: count > 0 ? 600 : 400 }}>
                              {count || '-'}
                            </span>
                          </Tooltip>
                        </td>
                      )
                    })}
                    <td style={{
                      padding: '5px 8px', borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* 条形图 */}
                        <div style={{
                          flex: 1, height: 14, borderRadius: 3,
                          background: 'var(--bg-secondary)', overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${maxTotal > 0 ? (s.total / maxTotal) * 100 : 0}%`,
                            height: '100%', borderRadius: 3,
                            background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                            transition: 'width 500ms ease',
                          }} />
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--accent-primary)', minWidth: 20, textAlign: 'right' }}>
                          {s.total}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* 展开行：显示详情 */}
                  {expandedChar === s.charId && (
                    <tr key={`${s.charId}-detail`}>
                      <td colSpan={volumes.length + 2} style={{
                        padding: '8px 16px', background: 'rgba(124,58,237,0.03)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11 }}>
                          {volumes.map(v => {
                            const details = s.volDetails.get(v.id)
                            if (!details || details.length === 0) return null
                            return (
                              <div key={v.id} style={{
                                flex: '1 1 200px', padding: 8, borderRadius: 6,
                                background: 'var(--bg-secondary)', minWidth: 180,
                              }}>
                                <div style={{ fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 4 }}>
                                  📚 {v.title}
                                </div>
                                {details.map(d => (
                                  <div key={d.chapterId} style={{ marginBottom: 4, paddingLeft: 8 }}>
                                    <div style={{ fontWeight: 600 }}>
                                      📄 {d.chapterTitle}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', paddingLeft: 12 }}>
                                      {d.events.map((ev, i) => (
                                        <Tag key={i} color="default" style={{ fontSize: 10, margin: '1px 2px' }}>
                                          ⚡ {ev}
                                        </Tag>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
