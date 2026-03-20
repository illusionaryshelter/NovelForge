/**
 * NovelForge - 世界观管理页面
 *
 * 布局：
 * - 顶部：七大类 Tab 切换
 * - 左侧：当前分类的元素列表（支持层级嵌套）
 * - 右侧：选中元素的编辑面板
 * - 底部：地图查看入口
 */
import { useEffect, useState } from 'react'
import { Tabs, Button, Input, Modal, Popconfirm, Empty, Space, message } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  PictureOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import {
  useWorldStore,
  CATEGORY_LABELS,
  type WorldCategory,
  type WorldElement,
} from '../stores/worldStore'
import MapViewer from '../components/world/MapViewer'

const { TextArea } = Input

export default function WorldPage(): JSX.Element {
  const store = useWorldStore()

  const [selectedElement, setSelectedElement] = useState<WorldElement | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [mapViewerOpen, setMapViewerOpen] = useState(false)

  useEffect(() => {
    store.loadElements()
    store.loadMaps()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const categoryElements = store.getCategoryElements()

  // 构建树状结构：顶层元素（parent_id = null）
  const topElements = categoryElements.filter(e => e.parent_id === null)
  const getChildren = (parentId: number) => categoryElements.filter(e => e.parent_id === parentId)

  /** 选中元素 */
  const handleSelect = (el: WorldElement) => {
    setSelectedElement(el)
    setEditTitle(el.title)
    setEditContent(el.content)
  }

  /** 保存编辑 */
  const handleSave = async () => {
    if (!selectedElement) return
    await store.updateElement(selectedElement.id, {
      title: editTitle.trim(),
      content: editContent.trim(),
    })
    message.success('已保存')
    // 更新选中对象
    const updated = store.elements.find(e => e.id === selectedElement.id)
    if (updated) setSelectedElement(updated)
  }

  /** 新建元素 */
  const handleCreate = async () => {
    if (!newTitle.trim()) {
      message.warning('请输入标题')
      return
    }
    await store.createElement(store.activeCategory, newTitle.trim(), newContent.trim())
    setCreateModalOpen(false)
    setNewTitle('')
    setNewContent('')
    message.success('已创建')
  }

  /** 删除元素 */
  const handleDelete = async (id: number) => {
    await store.deleteElement(id)
    if (selectedElement?.id === id) setSelectedElement(null)
    message.success('已删除')
  }

  /** Tab 切换 */
  const handleCategoryChange = (key: string) => {
    store.setActiveCategory(key as WorldCategory)
    setSelectedElement(null)
  }

  /** 渲染元素列表项（支持一层嵌套） */
  const renderElement = (el: WorldElement, depth = 0) => {
    const children = getChildren(el.id)
    return (
      <div key={el.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            paddingLeft: 12 + depth * 20,
            borderRadius: 6,
            cursor: 'pointer',
            background: selectedElement?.id === el.id ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
            border: selectedElement?.id === el.id ? '1px solid var(--border-accent)' : '1px solid transparent',
            transition: 'all 150ms',
            marginBottom: 4,
          }}
          onClick={() => handleSelect(el)}
        >
          <span style={{
            fontWeight: 500,
            fontSize: 14,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {el.title}
          </span>
          <Popconfirm
            title="确认删除？"
            description="子元素将失去父级关联"
            onConfirm={(e) => { e?.stopPropagation(); handleDelete(el.id) }}
            onCancel={(e) => e?.stopPropagation()}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text" size="small" danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </div>
        {children.map(child => renderElement(child, depth + 1))}
      </div>
    )
  }

  // Tab items
  const tabItems = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    key,
    label,
  }))

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12, flexShrink: 0
      }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>🌍 世界观管理</h2>
        <Space>
          <Button icon={<PictureOutlined />} onClick={() => setMapViewerOpen(true)}>
            地图
          </Button>
        </Space>
      </div>

      {/* 分类 Tab */}
      <Tabs
        activeKey={store.activeCategory}
        onChange={handleCategoryChange}
        items={tabItems}
        size="small"
        style={{ flexShrink: 0 }}
      />

      {/* 主内容区 */}
      <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>
        {/* 左侧列表 */}
        <div style={{
          width: selectedElement ? '35%' : '100%',
          transition: 'width 250ms ease',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {topElements.length === 0 ? (
            <div style={{ padding: '40px 0' }}>
              <Empty description="暂无内容" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              {topElements.map(el => renderElement(el))}
            </div>
          )}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            block
            style={{ marginTop: 8, flexShrink: 0 }}
          >
            新建 {CATEGORY_LABELS[store.activeCategory]}
          </Button>
        </div>

        {/* 右侧编辑面板 */}
        {selectedElement && (
          <div className="glass-panel fade-in" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                <EditOutlined /> 编辑
              </span>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                onClick={handleSave}
              >
                保存
              </Button>
            </div>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="标题"
              style={{ marginBottom: 12 }}
              maxLength={100}
            />
            <TextArea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="详细描述..."
              style={{ flex: 1, resize: 'none' }}
              maxLength={10000}
            />
          </div>
        )}
      </div>

      {/* 新建弹窗 */}
      <Modal
        title={`新建 ${CATEGORY_LABELS[store.activeCategory]}`}
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="标题"
            maxLength={100}
            onPressEnter={handleCreate}
          />
          <TextArea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="描述（可选）"
            rows={4}
            maxLength={5000}
          />
        </div>
      </Modal>

      {/* 地图查看器 */}
      <MapViewer
        open={mapViewerOpen}
        onClose={() => setMapViewerOpen(false)}
      />
    </div>
  )
}
