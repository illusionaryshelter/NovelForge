/**
 * NovelForge - 阵营筛选器
 *
 * 多选标签组，按颜色显示阵营，点击切换选中状态进行筛选。
 */
import { Tag } from 'antd'
import { useCharacterStore } from '../../stores/characterStore'

export default function FactionFilter(): JSX.Element {
  const { factions, selectedFactionIds, setSelectedFactionIds } = useCharacterStore()

  /** 切换阵营选中状态 */
  const toggleFaction = (factionId: number) => {
    if (selectedFactionIds.includes(factionId)) {
      setSelectedFactionIds(selectedFactionIds.filter(id => id !== factionId))
    } else {
      setSelectedFactionIds([...selectedFactionIds, factionId])
    }
  }

  if (factions.length === 0) return <></>

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      <Tag
        style={{
          cursor: 'pointer',
          opacity: selectedFactionIds.length === 0 ? 1 : 0.5,
          transition: 'opacity 150ms'
        }}
        onClick={() => setSelectedFactionIds([])}
      >
        全部
      </Tag>
      {factions.map((faction) => {
        const selected = selectedFactionIds.includes(faction.id)
        return (
          <Tag
            key={faction.id}
            color={selected ? faction.color : undefined}
            style={{
              cursor: 'pointer',
              opacity: selected ? 1 : 0.6,
              borderColor: selected ? faction.color : undefined,
              transition: 'all 150ms'
            }}
            onClick={() => toggleFaction(faction.id)}
          >
            {faction.name}
          </Tag>
        )
      })}
    </div>
  )
}
