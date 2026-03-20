/**
 * NovelForge - 快捷键速查面板
 *
 * Ctrl+/ 打开，显示所有可用快捷键。
 */
import { Modal } from 'antd'

interface ShortcutPanelProps {
  open: boolean
  onClose: () => void
}

const shortcuts = [
  { category: '全局', items: [
    { keys: 'Ctrl + K', desc: '全局搜索' },
    { keys: 'Ctrl + B', desc: '切换侧边栏' },
    { keys: 'Ctrl + /', desc: '快捷键面板' },
    { keys: 'Ctrl + S', desc: '保存当前内容' },
  ]},
  { category: '导航', items: [
    { keys: 'Ctrl + 1', desc: '人物管理' },
    { keys: 'Ctrl + 2', desc: '世界观' },
    { keys: 'Ctrl + 3', desc: '时间线' },
    { keys: 'Ctrl + 4', desc: '事件管理' },
    { keys: 'Ctrl + 5', desc: '道具管理' },
    { keys: 'Ctrl + 6', desc: '章节管理' },
    { keys: 'Ctrl + 7', desc: '关系图谱' },
    { keys: 'Ctrl + 8', desc: '出场统计' },
  ]},
]

export default function ShortcutPanel({ open, onClose }: ShortcutPanelProps): JSX.Element {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="⌨️ 快捷键速查"
      width={400}
      centered
    >
      {shortcuts.map(group => (
        <div key={group.category} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 6 }}>
            {group.category}
          </div>
          {group.items.map(s => (
            <div key={s.keys} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 0', borderBottom: '1px solid var(--border-subtle)',
            }}>
              <span style={{ fontSize: 12 }}>{s.desc}</span>
              <kbd style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                fontFamily: 'monospace',
              }}>{s.keys}</kbd>
            </div>
          ))}
        </div>
      ))}
    </Modal>
  )
}
