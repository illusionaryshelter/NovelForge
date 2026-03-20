/**
 * NovelForge - 角色卡片
 *
 * 显示角色基本信息：名字、别名、当前阵营标签、当前境界。
 * 点击选中角色，打开详情编辑面板。
 */
import { Tag } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import type { CharacterWithDetails } from '../../stores/characterStore'

interface CharacterCardProps {
  character: CharacterWithDetails
  selected: boolean
  onClick: () => void
}

export default function CharacterCard({ character, selected, onClick }: CharacterCardProps): JSX.Element {
  return (
    <div
      className="character-card"
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        border: selected
          ? '1px solid var(--accent-primary)'
          : '1px solid var(--border-subtle)',
        background: selected
          ? 'rgba(124, 58, 237, 0.08)'
          : 'var(--bg-secondary)',
        cursor: 'pointer',
        transition: 'all 150ms ease',
        marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* 头像占位 */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {character.avatar_path ? (
            <img
              src={`file://${character.avatar_path}`}
              alt=""
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <UserOutlined />
          )}
        </div>

        {/* 信息区 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 名字 + 境界 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontWeight: 600,
              fontSize: 14,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {character.name}
            </span>
            {character.currentPowerLevel && (
              <Tag style={{ fontSize: 11, margin: 0, lineHeight: '16px' }} color="purple">
                {character.currentPowerLevel}
              </Tag>
            )}
          </div>

          {/* 别名 */}
          {character.aliases.length > 0 && (
            <div style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              又名：{character.aliases.join('、')}
            </div>
          )}

          {/* 阵营标签 */}
          {character.currentFactions.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {character.currentFactions.map((f, i) => (
                <Tag key={i} color={f.color} style={{ fontSize: 11, margin: 0, lineHeight: '16px' }}>
                  {f.name}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
