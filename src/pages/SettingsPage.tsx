/**
 * NovelForge - 设置页面
 *
 * 用户可配置：
 * - 主题切换（深色 / 浅色）— 通过 zustand store 实时同步 ConfigProvider
 * - 自定义背景图（选择图片 + 透明度调节）— 通过 zustand store 实时渲染
 * - 自定义数据存储路径（修改后需重启）
 * - 硬件加速（修改后需重启）
 */
import { useEffect, useState } from 'react'
import { Switch, Button, Card, Slider, Radio, Space, Divider, message, Alert } from 'antd'
import {
  ReloadOutlined,
  FolderOpenOutlined,
  PictureOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useUISettingsStore } from '../stores/uiSettingsStore'

interface AppSettings {
  hardwareAcceleration: boolean
  theme: 'dark' | 'light'
  customDataDir: string | null
  backgroundImage: string | null
  backgroundOpacity: number
}

const defaultSettings: AppSettings = {
  hardwareAcceleration: false,
  theme: 'dark',
  customDataDir: null,
  backgroundImage: null,
  backgroundOpacity: 30,
}

export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>({ ...defaultSettings })
  const [needsRestart, setNeedsRestart] = useState(false)
  const [originalHwAccel, setOriginalHwAccel] = useState(false)
  const [originalDataDir, setOriginalDataDir] = useState<string | null>(null)

  // 导出卷选择
  const [exportVolumes, setExportVolumes] = useState<{ id: number; title: string }[]>([])
  const [exportVolumeId, setExportVolumeId] = useState<number | undefined>(undefined)

  // zustand store 用于实时同步主题和背景
  const uiStore = useUISettingsStore()

  useEffect(() => {
    (window as any).api.getSettings().then((s: AppSettings) => {
      const merged = { ...defaultSettings, ...s }
      setSettings(merged)
      setOriginalHwAccel(merged.hardwareAcceleration)
      setOriginalDataDir(merged.customDataDir)
    });
    // 加载卷列表用于导出选择
    (window as any).api.dbQuery('SELECT id, title FROM volumes ORDER BY sort_order, id').then(
      (vols: { id: number; title: string }[]) => setExportVolumes(vols || [])
    ).catch(() => {})
  }, [])

  /** 保存设置到后端 */
  const saveToDisk = async (newSettings: AppSettings) => {
    setSettings(newSettings)
    await (window as any).api.saveSettings(newSettings)
  }

  /** 切换主题 — 通过 zustand store 实时同步 ConfigProvider */
  const handleThemeChange = async (theme: 'dark' | 'light') => {
    const s = { ...settings, theme }
    await saveToDisk(s)
    uiStore.setTheme(theme)
  }

  /** 选择背景图 */
  const handleSelectBackground = async () => {
    const dataUrl = await (window as any).api.selectBackgroundImage()
    if (!dataUrl) return
    const s = { ...settings, backgroundImage: dataUrl }
    await saveToDisk(s)
    uiStore.setBackground(dataUrl, settings.backgroundOpacity)
    message.success('背景图已设置')
  }

  /** 清除背景图 */
  const handleClearBackground = async () => {
    const s = { ...settings, backgroundImage: null }
    await saveToDisk(s)
    uiStore.setBackground(null)
    message.info('背景图已清除')
  }

  /** 调整透明度 */
  const handleOpacityChange = async (value: number) => {
    const s = { ...settings, backgroundOpacity: value }
    await saveToDisk(s)
    uiStore.setBackgroundOpacity(value)
  }

  /** 切换硬件加速 */
  const handleToggleHwAccel = async (checked: boolean) => {
    const s = { ...settings, hardwareAcceleration: checked }
    await saveToDisk(s)
    setNeedsRestart(checked !== originalHwAccel || s.customDataDir !== originalDataDir)
  }

  /** 选择存储路径 */
  const handleSelectFolder = async () => {
    const folder = await (window as any).api.selectFolder()
    if (!folder) return
    const s = { ...settings, customDataDir: folder }
    await saveToDisk(s)
    setNeedsRestart(true)
    message.success(`存储路径已更改: ${folder}`)
  }

  /** 重置为默认路径 */
  const handleResetDataDir = async () => {
    const s = { ...settings, customDataDir: null }
    await saveToDisk(s)
    setNeedsRestart(s.customDataDir !== originalDataDir)
    message.info('已恢复默认存储路径')
  }

  /** 重启应用 */
  const handleRelaunch = () => {
    (window as any).api.relaunch()
  }

  /**
   * 从 TipTap JSON 或 HTML 中提取纯文本
   * TipTap 存储格式: {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"..."}]}]}
   */
  const extractText = (content: string): string => {
    if (!content || content === '{}') return ''
    // 尝试解析为 TipTap JSON
    try {
      const doc = JSON.parse(content)
      if (doc && doc.type === 'doc' && Array.isArray(doc.content)) {
        return extractTipTapText(doc.content)
      }
    } catch {
      // 不是 JSON，尝试作为 HTML
    }
    // 回退：HTML 转纯文本
    const tmp = document.createElement('div')
    tmp.innerHTML = content
    return tmp.textContent || tmp.innerText || content
  }

  /** 递归提取 TipTap 节点树中的文本 */
  const extractTipTapText = (nodes: any[]): string => {
    const lines: string[] = []
    for (const node of nodes) {
      if (node.type === 'text') {
        lines.push(node.text || '')
      } else if (node.type === 'hardBreak') {
        lines.push('\n')
      } else if (Array.isArray(node.content)) {
        const inner = extractTipTapText(node.content)
        lines.push(inner)
        // 段落/标题后加换行
        if (node.type === 'paragraph' || node.type === 'heading') {
          lines.push('\n')
        }
      }
    }
    return lines.join('')
  }

  /** 获取导出数据：按卷→章顺序，可选单卷 */
  const getExportData = async (volumeId?: number) => {
    const api = (window as any).api
    const volumeSql = volumeId
      ? 'SELECT * FROM volumes WHERE id = ? ORDER BY sort_order, id'
      : 'SELECT * FROM volumes ORDER BY sort_order, id'
    const params = volumeId ? [volumeId] : []
    const volumes = await api.dbQuery(volumeSql, params) as { id: number; title: string }[]
    const result: { volTitle: string; chapters: { title: string; text: string }[] }[] = []
    for (const vol of volumes) {
      const chapters = await api.dbQuery(
        'SELECT title, content FROM chapters WHERE volume_id = ? ORDER BY sort_order, id',
        [vol.id]
      ) as { title: string; content: string }[]
      result.push({
        volTitle: vol.title,
        chapters: chapters.map(c => ({ title: c.title, text: extractText(c.content || '') })),
      })
    }
    return result
  }

  /** TXT 导出 */
  const handleExportTxt = async (volumeId?: number) => {
    try {
      const data = await getExportData(volumeId)
      let output = ''
      for (const vol of data) {
        output += `\n${'='.repeat(40)}\n${vol.volTitle}\n${'='.repeat(40)}\n\n`
        for (const ch of vol.chapters) {
          output += `【${ch.title}】\n\n${ch.text}\n\n`
        }
      }
      if (!output.trim()) { message.warning('没有可导出的章节内容'); return }
      const ok = await (window as any).api.saveTextFile('novel_export.txt', output.trim())
      if (ok) message.success('TXT 导出成功！')
    } catch (err: any) { message.error('导出失败: ' + (err.message || err)) }
  }

  /** Markdown 导出 */
  const handleExportMd = async (volumeId?: number) => {
    try {
      const data = await getExportData(volumeId)
      let output = ''
      for (const vol of data) {
        output += `\n# ${vol.volTitle}\n\n`
        for (const ch of vol.chapters) {
          output += `## ${ch.title}\n\n${ch.text}\n\n---\n\n`
        }
      }
      if (!output.trim()) { message.warning('没有可导出的章节内容'); return }
      const ok = await (window as any).api.saveTextFile('novel_export.md', output.trim())
      if (ok) message.success('Markdown 导出成功！')
    } catch (err: any) { message.error('导出失败: ' + (err.message || err)) }
  }

  /** EPUB 导出（通过主进程生成） */
  const handleExportEpub = async (volumeId?: number) => {
    try {
      const data = await getExportData(volumeId)
      if (data.every(v => v.chapters.length === 0)) {
        message.warning('没有可导出的章节内容'); return
      }
      // 将数据传给主进程生成 EPUB
      const res = await (window as any).api.exportEpub(data)
      if (res?.success) message.success('EPUB 导出成功！')
      else if (res?.error !== '取消') message.error('EPUB 导出失败: ' + (res?.error || ''))
    } catch (err: any) { message.error('导出失败: ' + (err.message || err)) }
  }

  /** 备份项目 */
  const handleBackup = async () => {
    const res = await (window as any).api.backupProject()
    if (res.success) {
      message.success('备份成功: ' + res.path)
    } else if (res.error !== '取消') {
      message.error('备份失败: ' + res.error)
    }
  }

  /** 恢复项目 */
  const handleRestore = async () => {
    const res = await (window as any).api.restoreProject()
    if (res.success) {
      message.success('恢复成功，即将重启应用…')
      setTimeout(() => (window as any).api.relaunch(), 1500)
    } else if (res.error !== '取消') {
      message.error('恢复失败: ' + res.error)
    }
  }

  const cardStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-subtle)',
    maxWidth: 560,
    marginBottom: 16,
  }

  return (
    <div className="fade-in" style={{ overflow: 'auto', height: '100%', padding: '0 4px' }}>
      <div className="page-header">
        <h2>⚙️ 设置</h2>
      </div>

      {needsRestart && (
        <Alert
          message="部分设置已变更，需要重启应用生效（硬件加速、存储路径）"
          type="warning"
          showIcon
          action={
            <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={handleRelaunch}>
              立即重启
            </Button>
          }
          style={{ marginBottom: 16, maxWidth: 560 }}
        />
      )}

      {/* 主题 */}
      <Card title="🎨 主题" size="small" style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 500 }}>外观主题</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              切换深色或浅色界面风格，即时生效。
            </div>
          </div>
          <Radio.Group
            value={settings.theme}
            onChange={(e) => handleThemeChange(e.target.value)}
            buttonStyle="solid"
            size="small"
          >
            <Radio.Button value="dark">🌙 深色</Radio.Button>
            <Radio.Button value="light">☀️ 浅色</Radio.Button>
          </Radio.Group>
        </div>
      </Card>

      {/* 背景图 */}
      <Card title="🖼️ 自定义背景" size="small" style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500 }}>背景图片</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {settings.backgroundImage ? '已设置自定义背景' : '未设置背景图片'}
              </div>
            </div>
            <Space>
              <Button size="small" icon={<PictureOutlined />} onClick={handleSelectBackground}>
                选择图片
              </Button>
              {settings.backgroundImage && (
                <Button size="small" danger icon={<DeleteOutlined />} onClick={handleClearBackground}>
                  清除
                </Button>
              )}
            </Space>
          </div>

          {settings.backgroundImage && (
            <>
              <Divider style={{ margin: '4px 0' }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                  背景透明度：{settings.backgroundOpacity}%
                </div>
                <Slider
                  value={settings.backgroundOpacity}
                  onChange={handleOpacityChange}
                  min={5}
                  max={100}
                  step={5}
                  tooltip={{ formatter: (v) => `${v}%` }}
                />
              </div>
              <div style={{
                height: 60, borderRadius: 6, overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                backgroundImage: `url(${settings.backgroundImage})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                opacity: settings.backgroundOpacity / 100,
              }} />
            </>
          )}
        </div>
      </Card>

      {/* 存储路径 */}
      <Card title="📁 数据存储" size="small" style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500 }}>存储路径</div>
              <div style={{
                fontSize: 12, color: 'var(--text-muted)', marginTop: 2,
                wordBreak: 'break-all', maxWidth: 350,
              }}>
                {settings.customDataDir || '(应用默认目录)'}
              </div>
            </div>
            <Space>
              <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSelectFolder}>
                更改
              </Button>
              {settings.customDataDir && (
                <Button size="small" onClick={handleResetDataDir}>
                  重置
                </Button>
              )}
            </Space>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            ⚠️ 更改存储路径后需重启应用。已有项目数据不会自动迁移，请手动复制文件。
          </div>
        </div>
      </Card>

      {/* 渲染 */}
      <Card title="⚡ 渲染" size="small" style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 500 }}>硬件加速</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              启用 GPU 硬件加速渲染。部分 Linux 系统可能不兼容，如遇黑屏请关闭。
            </div>
          </div>
          <Switch
            checked={settings.hardwareAcceleration}
            onChange={handleToggleHwAccel}
          />
        </div>
      </Card>

      {/* 多格式导出 */}
      <Card title="📄 导出" size="small" style={cardStyle}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          按卷→章顺序导出，自动提取纯文本。可选全部导出或指定单卷导出。
        </div>
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 12, marginRight: 8 }}>导出范围：</span>
          <select
            value={exportVolumeId ?? ''}
            onChange={(e) => setExportVolumeId(e.target.value ? Number(e.target.value) : undefined)}
            style={{
              padding: '2px 8px', borderRadius: 4,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              fontSize: 12,
            }}
          >
            <option value="">全部卷</option>
            {exportVolumes.map((v) => (
              <option key={v.id} value={v.id}>{v.title}</option>
            ))}
          </select>
        </div>
        <Space wrap>
          <Button size="small" onClick={() => handleExportTxt(exportVolumeId)}>
            导出 TXT
          </Button>
          <Button size="small" onClick={() => handleExportMd(exportVolumeId)}>
            导出 Markdown
          </Button>
          <Button size="small" onClick={() => handleExportEpub(exportVolumeId)}>
            导出 EPUB
          </Button>
        </Space>
      </Card>

      {/* 备份与恢复 */}
      <Card title="💾 数据备份与恢复" size="small" style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500 }}>备份项目</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                将当前项目数据库复制到指定位置。
              </div>
            </div>
            <Button size="small" onClick={handleBackup}>
              备份
            </Button>
          </div>
          <Divider style={{ margin: 0 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500 }}>恢复项目</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                从备份文件恢复。恢复后需重启应用。
              </div>
            </div>
            <Button size="small" danger onClick={handleRestore}>
              恢复
            </Button>
          </div>
        </div>
      </Card>

      {/* 保存为模板 */}
      <Card title="📋 模板管理" size="small" style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 500 }}>保存当前项目为模板</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              提取当前项目的阵营、世界观设定、卷结构，保存为可复用的模板。新建项目时可选用。
            </div>
          </div>
          <Button size="small" onClick={async () => {
            const name = prompt('请输入模板名称：')
            if (!name?.trim()) return
            const desc = prompt('请输入模板描述（可选）：') || ''
            const res = await (window as any).api.saveTemplate(name.trim(), desc.trim())
            if (res?.success) message.success('模板保存成功！')
            else message.error('保存失败: ' + (res?.error || ''))
          }}>
            保存为模板
          </Button>
        </div>
      </Card>
    </div>
  )
}
