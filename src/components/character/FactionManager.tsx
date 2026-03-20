/**
 * NovelForge - 阵营管理器
 *
 * 提供阵营的 CRUD 操作界面：
 * - 列表展示（颜色标签）
 * - 新建/编辑弹窗
 * - 删除确认
 */
import { useState } from 'react'
import { Button, Input, ColorPicker, Modal, Popconfirm, Tag, Space, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useCharacterStore, type Faction } from '../../stores/characterStore'

interface FactionManagerProps {
  onClose: () => void
  open: boolean
}

export default function FactionManager({ onClose, open }: FactionManagerProps): JSX.Element {
  const { factions, createFaction, updateFaction, deleteFaction } = useCharacterStore()

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingFaction, setEditingFaction] = useState<Faction | null>(null)
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState('#1890ff')
  const [formDesc, setFormDesc] = useState('')

  /** 打开新建弹窗 */
  const handleAdd = () => {
    setEditingFaction(null)
    setFormName('')
    setFormColor('#1890ff')
    setFormDesc('')
    setEditModalOpen(true)
  }

  /** 打开编辑弹窗 */
  const handleEdit = (faction: Faction) => {
    setEditingFaction(faction)
    setFormName(faction.name)
    setFormColor(faction.color)
    setFormDesc(faction.description)
    setEditModalOpen(true)
  }

  /** 保存（新建或更新） */
  const handleSave = async () => {
    if (!formName.trim()) {
      message.warning('请输入阵营名称')
      return
    }
    if (editingFaction) {
      await updateFaction(editingFaction.id, {
        name: formName.trim(),
        color: formColor,
        description: formDesc.trim()
      })
      message.success('阵营已更新')
    } else {
      await createFaction(formName.trim(), formColor, formDesc.trim())
      message.success('阵营已创建')
    }
    setEditModalOpen(false)
  }

  /** 删除阵营 */
  const handleDelete = async (id: number) => {
    await deleteFaction(id)
    message.success('阵营已删除')
  }

  return (
    <Modal
      title="阵营管理"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
    >
      {/* 阵营列表 */}
      <div style={{ marginBottom: 16 }}>
        {factions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
            暂无阵营，点击下方按钮创建
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {factions.map((faction) => (
              <div
                key={faction.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-elevated)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color={faction.color} style={{ margin: 0 }}>{faction.name}</Tag>
                  {faction.description && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {faction.description}
                    </span>
                  )}
                </div>
                <Space size="small">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(faction)}
                  />
                  <Popconfirm
                    title="确认删除此阵营？"
                    description="关联的角色阵营记录也会被删除"
                    onConfirm={() => handleDelete(faction.id)}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新增按钮 */}
      <Button type="dashed" onClick={handleAdd} block icon={<PlusOutlined />}>
        新建阵营
      </Button>

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingFaction ? '编辑阵营' : '新建阵营'}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        width={400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
              阵营名称 *
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="例如：正道盟"
              maxLength={30}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
              标记颜色
            </label>
            <ColorPicker
              value={formColor}
              onChange={(_, hex) => setFormColor(hex)}
              showText
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
              描述
            </label>
            <Input.TextArea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="阵营简介..."
              rows={2}
              maxLength={200}
            />
          </div>
        </div>
      </Modal>
    </Modal>
  )
}
