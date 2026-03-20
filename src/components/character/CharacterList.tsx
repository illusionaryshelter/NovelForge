/**
 * NovelForge - 角色列表（虚拟滚动）
 *
 * 使用 @tanstack/react-virtual 实现虚拟滚动，支持上千角色流畅渲染。
 * 每个条目渲染为 CharacterCard。
 */
import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Empty } from 'antd'
import CharacterCard from './CharacterCard'
import type { CharacterWithDetails } from '../../stores/characterStore'

interface CharacterListProps {
  characters: CharacterWithDetails[]
  selectedId: number | null
  onSelect: (character: CharacterWithDetails) => void
}

export default function CharacterList({ characters, selectedId, onSelect }: CharacterListProps): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: characters.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,  // 估计每个卡片高度
    overscan: 10,            // 多渲染 10 条以提升滚动体验
  })

  if (characters.length === 0) {
    return (
      <div style={{ padding: '40px 0' }}>
        <Empty description="暂无角色" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      style={{
        height: '100%',
        overflowY: 'auto',
        contain: 'strict',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const char = characters[virtualItem.index]
          return (
            <div
              key={char.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
            >
              <CharacterCard
                character={char}
                selected={selectedId === char.id}
                onClick={() => onSelect(char)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
