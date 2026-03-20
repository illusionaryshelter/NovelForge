/**
 * NovelForge - 地图查看器
 *
 * 功能：
 * - 导入 PNG/JPG 图片作为地图
 * - 缩放 / 平移浏览地图
 * - 管理多张地图
 *
 * 使用 CSS transform 实现缩放/平移，轻量级无额外依赖。
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { Modal, Button, Input, Empty, Tabs, Popconfirm, message } from 'antd'
import { PlusOutlined, DeleteOutlined, ZoomInOutlined, ZoomOutOutlined, AimOutlined } from '@ant-design/icons'
import { useWorldStore, type MapImage } from '../../stores/worldStore'

interface MapViewerProps {
  open: boolean
  onClose: () => void
}

export default function MapViewer({ open, onClose }: MapViewerProps): JSX.Element {
  const { maps, loadMaps, addMap, deleteMap } = useWorldStore()
  const [activeMapId, setActiveMapId] = useState<number | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [selectedPath, setSelectedPath] = useState('')

  // 缩放/平移状态
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // 缓存已加载的图片 Data URL
  const [imageDataUrls, setImageDataUrls] = useState<Record<number, string>>({})

  useEffect(() => {
    if (open) {
      loadMaps()
    }
  }, [open, loadMaps])

  useEffect(() => {
    if (maps.length > 0 && !activeMapId) {
      setActiveMapId(maps[0].id)
    }
  }, [maps, activeMapId])

  const activeMap = maps.find(m => m.id === activeMapId)

  // 当活跃地图变化时，加载图片
  useEffect(() => {
    if (!activeMap) return
    if (imageDataUrls[activeMap.id]) return // 已缓存
    window.api.readImageAsDataUrl(activeMap.image_path).then((dataUrl) => {
      if (dataUrl) {
        setImageDataUrls(prev => ({ ...prev, [activeMap.id]: dataUrl }))
      }
    })
  }, [activeMap, imageDataUrls])

  /** 重置视图 */
  const resetView = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  /** 导入图片 */
  const handleSelectImage = async () => {
    const path = await window.api.openImageDialog()
    if (path) setSelectedPath(path)
  }

  /** 添加地图 */
  const handleAdd = async () => {
    if (!newName.trim() || !selectedPath) {
      message.warning('请输入名称并选择图片')
      return
    }
    await addMap(newName.trim(), selectedPath, newDesc.trim())
    setAddModalOpen(false)
    setNewName('')
    setNewDesc('')
    setSelectedPath('')
    message.success('地图已添加')
  }

  /** 删除地图 */
  const handleDelete = async (id: number) => {
    await deleteMap(id)
    if (activeMapId === id) {
      setActiveMapId(maps.length > 1 ? maps.find(m => m.id !== id)?.id ?? null : null)
    }
    message.success('地图已删除')
  }

  // 缩放（鼠标滚轮）
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(s => Math.max(0.1, Math.min(5, s + delta)))
  }, [])

  // 拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }, [dragging, dragStart])

  const handleMouseUp = () => setDragging(false)

  /** Tab items for maps */
  const mapTabItems = maps.map(m => ({
    key: String(m.id),
    label: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {m.name}
        <Popconfirm
          title="删除此地图？"
          onConfirm={(e) => { e?.stopPropagation(); handleDelete(m.id) }}
          onCancel={(e) => e?.stopPropagation()}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <DeleteOutlined
            style={{ fontSize: 11, color: 'var(--text-muted)' }}
            onClick={(e) => e.stopPropagation()}
          />
        </Popconfirm>
      </span>
    ),
  }))

  return (
    <Modal
      title="🗺️ 地图查看器"
      open={open}
      onCancel={onClose}
      footer={null}
      width="80vw"
      style={{ top: 40 }}
      styles={{ body: { height: '70vh', padding: 0, overflow: 'hidden' } }}
    >
      {maps.length === 0 ? (
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <Empty description="暂无地图，导入图片开始" />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddModalOpen(true)}
            style={{ marginTop: 16 }}
          >
            导入地图
          </Button>
        </div>
      ) : (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* 地图 Tab + 工具栏 */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0 16px', borderBottom: '1px solid var(--border-subtle)'
          }}>
            <Tabs
              activeKey={String(activeMapId)}
              onChange={(key) => { setActiveMapId(Number(key)); resetView() }}
              items={mapTabItems}
              size="small"
              style={{ marginBottom: 0 }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <Button size="small" icon={<ZoomInOutlined />} onClick={() => setScale(s => Math.min(5, s + 0.2))} />
              <Button size="small" icon={<ZoomOutOutlined />} onClick={() => setScale(s => Math.max(0.1, s - 0.2))} />
              <Button size="small" icon={<AimOutlined />} onClick={resetView} title="重置视图" />
              <Button size="small" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)} title="添加地图" />
            </div>
          </div>

          {/* 地图画布 */}
          <div
            ref={containerRef}
            style={{
              flex: 1,
              overflow: 'hidden',
              cursor: dragging ? 'grabbing' : 'grab',
              background: '#0a0a1a',
              position: 'relative',
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {activeMap && imageDataUrls[activeMap.id] && (
              <img
                src={imageDataUrls[activeMap.id]}
                alt={activeMap.name}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  maxWidth: 'none',
                  transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: dragging ? 'none' : 'transform 100ms ease',
                  userSelect: 'none',
                }}
              />
            )}
            {/* 缩放比例显示 */}
            <div style={{
              position: 'absolute', bottom: 8, right: 12,
              fontSize: 11, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.5)',
              padding: '2px 8px', borderRadius: 4,
            }}>
              {Math.round(scale * 100)}%
            </div>
          </div>
        </div>
      )}

      {/* 添加地图弹窗 */}
      <Modal
        title="导入地图"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        onOk={handleAdd}
        okText="导入"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="地图名称"
            maxLength={50}
          />
          <div>
            <Button onClick={handleSelectImage}>
              {selectedPath ? '重新选择' : '选择图片'}
            </Button>
            {selectedPath && (
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                {selectedPath.split('/').pop()}
              </span>
            )}
          </div>
          <Input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="描述（可选）"
          />
        </div>
      </Modal>
    </Modal>
  )
}
