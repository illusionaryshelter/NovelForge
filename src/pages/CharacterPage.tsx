/**
 * NovelForge - 人物管理页面
 *
 * 布局：左侧角色列表 + 右侧角色详情编辑
 * 功能：
 * - 搜索角色（名字 + 别名）
 * - 按阵营筛选
 * - 新建/删除角色
 * - 选中角色后编辑详情
 * - 阵营管理入口
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Space, Modal, Popconfirm, message } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  TeamOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useCharacterStore, type Character, type CharacterWithDetails } from '../stores/characterStore'
import CharacterList from '../components/character/CharacterList'
import CharacterForm from '../components/character/CharacterForm'
import FactionFilter from '../components/character/FactionFilter'
import FactionManager from '../components/character/FactionManager'

export default function CharacterPage(): JSX.Element {
  const store = useCharacterStore()
  const navigate = useNavigate()

  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [filteredChars, setFilteredChars] = useState<CharacterWithDetails[]>([])
  const [factionModalOpen, setFactionModalOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [newCharDesc, setNewCharDesc] = useState('')

  /** 加载数据 */
  useEffect(() => {
    store.loadCharacters()
    store.loadFactions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** 刷新筛选后的列表 */
  const refreshList = useCallback(async () => {
    const chars = await store.getFilteredCharacters()
    setFilteredChars(chars)
  }, [store])

  // 当 characters、searchText、selectedFactionIds 变化时刷新列表
  useEffect(() => {
    refreshList()
  }, [store.characters, store.searchText, store.selectedFactionIds, refreshList])

  /** 新建角色 */
  const handleCreate = async () => {
    if (!newCharName.trim()) {
      message.warning('请输入角色名称')
      return
    }
    const id = await store.createCharacter(newCharName.trim(), newCharDesc.trim())
    setCreateModalOpen(false)
    setNewCharName('')
    setNewCharDesc('')
    // 选中新创建的角色
    const char = store.characters.find(c => c.id === id)
    if (char) setSelectedCharacter(char)
    message.success('角色已创建')
  }

  /** 删除选中角色 */
  const handleDelete = async () => {
    if (!selectedCharacter) return
    await store.deleteCharacter(selectedCharacter.id)
    setSelectedCharacter(null)
    message.success('角色已删除')
  }

  /** 选中角色 */
  const handleSelect = (char: CharacterWithDetails) => {
    setSelectedCharacter(char)
  }

  /** 关闭编辑 */
  const handleCloseForm = () => {
    setSelectedCharacter(null)
    refreshList()  // 编辑后刷新
  }

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 页面标题栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, flexShrink: 0
      }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>👥 人物管理</h2>
        <Space>
          <Button icon={<TeamOutlined />} onClick={() => setFactionModalOpen(true)}>
            阵营管理
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建角色
          </Button>
        </Space>
      </div>

      {/* 搜索 + 筛选栏 */}
      <div style={{ marginBottom: 12, flexShrink: 0 }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          placeholder="搜索角色（名字 / 别名）"
          value={store.searchText}
          onChange={(e) => store.setSearchText(e.target.value)}
          allowClear
          style={{ marginBottom: 8 }}
        />
        <FactionFilter />
      </div>

      {/* 角色数量提示 */}
      <div style={{
        fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, flexShrink: 0
      }}>
        共 {filteredChars.length} 个角色
        {store.searchText && ` · 搜索: "${store.searchText}"`}
        {store.selectedFactionIds.length > 0 && ` · 已筛选 ${store.selectedFactionIds.length} 个阵营`}
      </div>

      {/* 主内容区：左列表 + 右详情 */}
      <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>
        {/* 左侧列表 */}
        <div style={{ width: selectedCharacter ? '40%' : '100%', transition: 'width 250ms ease', overflow: 'hidden' }}>
          <CharacterList
            characters={filteredChars}
            selectedId={selectedCharacter?.id ?? null}
            onSelect={handleSelect}
          />
        </div>

        {/* 右侧详情 */}
        {selectedCharacter && (
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {/* 删除按钮 */}
            <Button
              type="text"
              icon={<UserOutlined />}
              style={{ position: 'absolute', top: 12, right: 84, zIndex: 10 }}
              onClick={() => navigate(`/workspace/profile/${selectedCharacter.id}`)}
              title="查看档案"
            />
            <Popconfirm
              title="确认删除此角色？"
              description="所有关联数据（别名、阵营、境界、动机）将一并删除"
              onConfirm={handleDelete}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                type="text"
                icon={<DeleteOutlined />}
                style={{ position: 'absolute', top: 12, right: 48, zIndex: 10 }}
              />
            </Popconfirm>
            <CharacterForm
              character={selectedCharacter}
              onClose={handleCloseForm}
            />
          </div>
        )}
      </div>

      {/* 新建角色弹窗 */}
      <Modal
        title="新建角色"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
              角色名称 *
            </label>
            <Input
              value={newCharName}
              onChange={(e) => setNewCharName(e.target.value)}
              placeholder="例如：叶凡"
              maxLength={50}
              onPressEnter={handleCreate}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
              简介
            </label>
            <Input.TextArea
              value={newCharDesc}
              onChange={(e) => setNewCharDesc(e.target.value)}
              placeholder="角色背景简介..."
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
      </Modal>

      {/* 阵营管理弹窗 */}
      <FactionManager
        open={factionModalOpen}
        onClose={() => { setFactionModalOpen(false); refreshList() }}
      />
    </div>
  )
}
