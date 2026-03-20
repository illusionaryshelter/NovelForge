/**
 * NovelForge - 项目选择页
 *
 * 首页：展示项目列表，支持创建/打开/删除项目。
 * 创建项目时可选择模板（预置 + 用户自定义）。
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal, Input, Space, Popconfirm, Tag, message, Spin } from 'antd'
import {
  PlusOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  BookOutlined,
  CrownOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useProjectStore, type ProjectInfo } from '../stores/projectStore'

const { TextArea } = Input

interface TemplateItem {
  name: string
  description: string
  data: any
  type: 'preset' | 'user'
  file?: string
}

export default function ProjectSelectPage(): JSX.Element {
  const navigate = useNavigate()
  const { projects, loading, loadProjects, createProject, openProject, deleteProject } =
    useProjectStore()

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // 模板
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null)

  useEffect(() => { loadProjects() }, [loadProjects])

  /** 打开新建弹窗时加载模板 */
  const handleOpenCreateModal = useCallback(async () => {
    setCreateModalOpen(true)
    try {
      const list = await (window as any).api.listTemplates()
      setTemplates(list || [])
    } catch { setTemplates([]) }
  }, [])

  /** 创建新项目 */
  const handleCreate = async () => {
    if (!newName.trim()) { message.warning('请输入项目名称'); return }
    setCreating(true)
    try {
      const project = await createProject(newName.trim(), newDesc.trim())
      // 如果选了模板，打开项目后应用模板
      if (selectedTemplate) {
        await openProject(project)
        await (window as any).api.applyTemplate(selectedTemplate.data)
        message.success(`项目 "${project.name}" 创建成功（已应用 ${selectedTemplate.name} 模板）`)
      } else {
        message.success(`项目 "${project.name}" 创建成功`)
      }
      setCreateModalOpen(false)
      setNewName('')
      setNewDesc('')
      setSelectedTemplate(null)
      await loadProjects()
    } catch { message.error('创建项目失败') }
    finally { setCreating(false) }
  }

  const handleOpen = async (project: ProjectInfo) => {
    await openProject(project)
    navigate('/workspace')
  }

  const handleDelete = async (projectId: number) => {
    await deleteProject(projectId)
    message.success('项目已删除')
  }

  const formatTime = (timeStr: string): string => {
    try {
      return new Date(timeStr).toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    } catch { return timeStr }
  }

  /** 模板 emoji 映射 */
  const templateEmoji = (name: string) => {
    if (name.includes('修仙') || name.includes('玄幻')) return '⚔️'
    if (name.includes('都市')) return '🏙️'
    if (name.includes('科幻') || name.includes('星际')) return '🚀'
    if (name.includes('历史')) return '🏯'
    return '📄'
  }

  return (
    <div className="project-select-page">
      <div className="project-select-header">
        <h1>✦ NovelForge</h1>
        <p>网文创作工具 · 让灵感有迹可循</p>
      </div>

      <div className="project-select-content">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <Button type="primary" icon={<PlusOutlined />} size="large"
            onClick={handleOpenCreateModal} style={{ borderRadius: 8 }}>
            新建项目
          </Button>
        </div>

        {loading ? (
          <div className="empty-state"><Spin size="large" /></div>
        ) : projects.length === 0 ? (
          <div className="empty-state fade-in">
            <BookOutlined className="empty-state-icon" />
            <p>还没有项目，点击上方按钮创建你的第一部作品</p>
          </div>
        ) : (
          <div className="fade-in">
            {projects.map((project) => (
              <div key={project.id} className="project-card" onClick={() => handleOpen(project)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div className="project-card-name">
                      <FolderOpenOutlined style={{ marginRight: 8, color: 'var(--accent-secondary)' }} />
                      {project.name}
                    </div>
                    {project.description && <div className="project-card-desc">{project.description}</div>}
                    <div className="project-card-time">最近打开：{formatTime(project.updated_at)}</div>
                  </div>
                  <Space>
                    <Popconfirm title="确认删除"
                      description={`确定要删除项目 "${project.name}" 吗？此操作不可恢复。`}
                      onConfirm={(e) => { e?.stopPropagation(); handleDelete(project.id) }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                      <Button type="text" danger icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()} size="small" />
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新建项目弹窗（含模板选择） */}
      <Modal title="新建项目" open={createModalOpen} width={560}
        onCancel={() => { setCreateModalOpen(false); setSelectedTemplate(null) }}
        onOk={handleCreate} confirmLoading={creating}
        okText="创建" cancelText="取消">
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
              项目名称 *
            </label>
            <Input placeholder="例如：仙侠·青云志" value={newName}
              onChange={(e) => setNewName(e.target.value)} maxLength={50} onPressEnter={handleCreate} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
              简介（可选）
            </label>
            <TextArea placeholder="简单描述这部作品的主题..." value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)} maxLength={200} rows={2} />
          </div>

          {/* 模板选择 */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontWeight: 500 }}>
              选择模板（可选）
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
              {templates.map((tpl, idx) => (
                <div key={idx}
                  onClick={() => setSelectedTemplate(selectedTemplate?.name === tpl.name ? null : tpl)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: selectedTemplate?.name === tpl.name
                      ? '2px solid var(--accent-primary)'
                      : '1px solid var(--border-subtle)',
                    background: selectedTemplate?.name === tpl.name
                      ? 'rgba(124, 58, 237, 0.08)'
                      : 'var(--bg-secondary)',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 18 }}>{templateEmoji(tpl.name)}</span>
                    <strong style={{ fontSize: 13 }}>{tpl.name}</strong>
                    <Tag color={tpl.type === 'preset' ? 'purple' : 'blue'} style={{ fontSize: 10, margin: 0 }}>
                      {tpl.type === 'preset' ? <><CrownOutlined /> 预置</> : <><UserOutlined /> 自定义</>}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {tpl.description}
                  </div>
                </div>
              ))}
            </div>
            {templates.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>加载模板中...</div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
