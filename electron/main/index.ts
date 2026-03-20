/**
 * NovelForge - Electron 主进程入口
 *
 * 负责：
 * - 创建主窗口
 * - 注册所有 IPC handlers（数据库操作）
 * - 管理应用生命周期
 */
import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { DatabaseManager } from './database/connection'

let mainWindow: BrowserWindow | null = null
const dbManager = new DatabaseManager()

// ==========================================
// 用户设置管理
// ==========================================

interface AppSettings {
  /** 是否启用硬件加速 */
  hardwareAcceleration: boolean
  /** 主题：dark / light */
  theme: 'dark' | 'light'
  /** 自定义数据存储目录（null = 默认目录） */
  customDataDir: string | null
  /** 背景图数据（base64 data URL 或 null） */
  backgroundImage: string | null
  /** 背景图透明度 0-100 */
  backgroundOpacity: number
}

const defaultSettings: AppSettings = {
  hardwareAcceleration: false,
  theme: 'dark',
  customDataDir: null,
  backgroundImage: null,
  backgroundOpacity: 30,
}

/** 读取用户设置，不存在则创建默认文件 */
function loadSettings(): AppSettings {
  const settingsPath = join(app.getPath('userData'), 'settings.json')
  try {
    if (existsSync(settingsPath)) {
      const raw = readFileSync(settingsPath, 'utf-8')
      return { ...defaultSettings, ...JSON.parse(raw) }
    }
  } catch (err) {
    console.warn('读取设置失败，使用默认值:', err)
  }
  // 首次运行：写入默认设置文件
  try {
    writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf-8')
  } catch { /* 忽略写入失败 */ }
  return { ...defaultSettings }
}

/** 保存用户设置 */
function saveSettings(settings: AppSettings): void {
  const settingsPath = join(app.getPath('userData'), 'settings.json')
  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
  } catch (err) {
    console.error('保存设置失败:', err)
  }
}

const settings = loadSettings()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'NovelForge - 网文创作工具',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // 外部链接在浏览器打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发环境用 HMR，生产环境加载打包文件
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ==========================================
// IPC Handlers - 项目管理
// ==========================================

/** 获取所有项目列表 */
ipcMain.handle('project:list', () => {
  return dbManager.listProjects()
})

/** 创建新项目 */
ipcMain.handle('project:create', (_event, name: string, description: string) => {
  return dbManager.createProject(name, description)
})

/** 打开项目（切换数据库） */
ipcMain.handle('project:open', (_event, projectId: number) => {
  return dbManager.openProject(projectId)
})

/** 删除项目 */
ipcMain.handle('project:delete', (_event, projectId: number) => {
  return dbManager.deleteProject(projectId)
})

/** 获取当前项目信息 */
ipcMain.handle('project:getCurrent', () => {
  return dbManager.getCurrentProject()
})

// ==========================================
// IPC Handlers - 通用 CRUD（供各模块使用）
// ==========================================

/** 执行查询（SELECT） */
ipcMain.handle('db:query', (_event, sql: string, params: unknown[] = []) => {
  return dbManager.query(sql, params)
})

/** 执行写入（INSERT/UPDATE/DELETE），返回 { changes, lastInsertRowid } */
ipcMain.handle('db:run', (_event, sql: string, params: unknown[] = []) => {
  return dbManager.run(sql, params)
})

/** 执行单行查询 */
ipcMain.handle('db:get', (_event, sql: string, params: unknown[] = []) => {
  return dbManager.get(sql, params)
})

// ==========================================
// IPC Handlers - 文件对话框
// ==========================================

/** 打开图片文件选择对话框（用于地图导入、角色头像等） */
ipcMain.handle('dialog:openImage', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

/** 读取图片文件为 base64 Data URL（解决 file:// 协议受限问题） */
ipcMain.handle('file:readImageAsDataUrl', (_event, filePath: string) => {
  try {
    if (!existsSync(filePath)) return null
    const buffer = readFileSync(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      webp: 'image/webp', bmp: 'image/bmp', gif: 'image/gif',
    }
    const mime = mimeMap[ext] || 'image/png'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch (err) {
    console.error('读取图片失败:', err)
    return null
  }
})

// ==========================================
// IPC Handlers - 用户设置
// ==========================================

ipcMain.handle('settings:get', () => {
  return loadSettings()
})

ipcMain.handle('settings:save', (_event, newSettings: Partial<AppSettings>) => {
  const current = loadSettings()
  const merged = { ...current, ...newSettings }
  saveSettings(merged)
  return merged
})

/** 重启应用（设置变更后使用） */
ipcMain.handle('app:relaunch', () => {
  app.relaunch()
  app.exit(0)
})

/** 选择文件夹（自定义存储路径） */
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择数据存储目录',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

/** 选择背景图片 */
ipcMain.handle('dialog:selectBackgroundImage', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择背景图片',
    filters: [
      { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] },
    ],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  try {
    const filePath = result.filePaths[0]
    const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
    const buf = readFileSync(filePath)
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
})

/** 保存文本文件（TXT 导出） */
ipcMain.handle('dialog:saveTextFile', async (_event, defaultName: string, content: string) => {
  const result = await dialog.showSaveDialog({
    title: '导出 TXT 文件',
    defaultPath: defaultName,
    filters: [{ name: '文本文件', extensions: ['txt'] }],
  })
  if (result.canceled || !result.filePath) return false
  try {
    writeFileSync(result.filePath, content, 'utf-8')
    return true
  } catch {
    return false
  }
})

/** 备份当前项目数据库 */
ipcMain.handle('project:backup', async () => {
  const dbPath = dbManager.getProjectDbPath()
  if (!dbPath) return { success: false, error: '未打开项目' }
  const result = await dialog.showSaveDialog({
    title: '备份项目数据',
    defaultPath: `novelforge_backup_${Date.now()}.db`,
    filters: [{ name: '数据库文件', extensions: ['db', 'novelforge'] }],
  })
  if (result.canceled || !result.filePath) return { success: false, error: '取消' }
  try {
    const { copyFileSync } = require('fs')
    copyFileSync(dbPath, result.filePath)
    return { success: true, path: result.filePath }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

/** 恢复项目数据库（替换当前项目） */
ipcMain.handle('project:restore', async () => {
  const dbPath = dbManager.getProjectDbPath()
  if (!dbPath) return { success: false, error: '未打开项目' }
  const result = await dialog.showOpenDialog({
    title: '选择备份文件恢复',
    filters: [{ name: '数据库文件', extensions: ['db', 'novelforge'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return { success: false, error: '取消' }
  try {
    const { copyFileSync } = require('fs')
    // 关闭当前数据库再替换文件
    dbManager.closeProjectDb()
    copyFileSync(result.filePaths[0], dbPath)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

/** EPUB 导出 */
ipcMain.handle('export:epub', async (_event, data: { volTitle: string; chapters: { title: string; text: string }[] }[]) => {
  const result = await dialog.showSaveDialog({
    title: '导出 EPUB',
    defaultPath: 'novel_export.epub',
    filters: [{ name: 'EPUB 电子书', extensions: ['epub'] }],
  })
  if (result.canceled || !result.filePath) return { success: false, error: '取消' }

  try {
    const { mkdtempSync, mkdirSync, rmSync } = require('fs')
    const { tmpdir } = require('os')
    const { execSync } = require('child_process')

    // 创建临时目录
    const tmpDir = mkdtempSync(join(tmpdir(), 'novelforge-epub-'))
    const metaDir = join(tmpDir, 'META-INF')
    const oebpsDir = join(tmpDir, 'OEBPS')
    mkdirSync(metaDir)
    mkdirSync(oebpsDir)

    // mimetype（必须是第一个文件且不压缩）
    writeFileSync(join(tmpDir, 'mimetype'), 'application/epub+zip')

    // container.xml
    writeFileSync(join(metaDir, 'container.xml'), `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

    // 收集章节
    const items: { id: string; file: string; title: string }[] = []
    let chIdx = 0
    for (const vol of data) {
      for (const ch of vol.chapters) {
        chIdx++
        const id = `ch${chIdx}`
        const file = `${id}.xhtml`
        items.push({ id, file, title: `${vol.volTitle} - ${ch.title}` })
        // 写 XHTML
        const escaped = ch.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
        writeFileSync(join(oebpsDir, file), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${ch.title}</title></head>
<body>
<h1>${ch.title}</h1>
<p>${escaped}</p>
</body></html>`)
      }
    }

    // content.opf
    const manifest = items.map(i => `    <item id="${i.id}" href="${i.file}" media-type="application/xhtml+xml"/>`).join('\n')
    const spine = items.map(i => `    <itemref idref="${i.id}"/>`).join('\n')
    writeFileSync(join(oebpsDir, 'content.opf'), `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">novelforge-${Date.now()}</dc:identifier>
    <dc:title>NovelForge 导出</dc:title>
    <dc:language>zh</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
  </metadata>
  <manifest>
${manifest}
    <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="toc">
${spine}
  </spine>
</package>`)

    // toc.ncx
    const navPoints = items.map((i, idx) =>
      `    <navPoint id="nav${idx+1}" playOrder="${idx+1}"><navLabel><text>${i.title}</text></navLabel><content src="${i.file}"/></navPoint>`
    ).join('\n')
    writeFileSync(join(oebpsDir, 'toc.ncx'), `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="novelforge-export"/></head>
  <docTitle><text>NovelForge 导出</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`)

    // 打包 ZIP（使用系统 zip 命令）
    const outPath = result.filePath
    try {
      // 先用 mimetype（无压缩），再添加其余文件
      execSync(`cd "${tmpDir}" && zip -0Xq "${outPath}" mimetype && zip -rq "${outPath}" META-INF OEBPS`)
    } catch {
      // 如果系统没有 zip 命令，尝试用 Node.js 自带方案
      // 简单回退：直接复制所有文件为 zip（可能某些阅读器不兼容但可用）
      const { createWriteStream } = require('fs')
      const archiver = require('archiver')
      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(outPath)
        const archive = archiver('zip', { zlib: { level: 9 } })
        output.on('close', resolve)
        archive.on('error', reject)
        archive.pipe(output)
        archive.file(join(tmpDir, 'mimetype'), { name: 'mimetype' })
        archive.directory(metaDir, 'META-INF')
        archive.directory(oebpsDir, 'OEBPS')
        archive.finalize()
      })
    }

    // 清理临时目录
    rmSync(tmpDir, { recursive: true, force: true })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// ==========================================
// IPC Handlers - 模板系统
// ==========================================

/** 预置模板 */
const PRESET_TEMPLATES: { name: string; description: string; data: any }[] = [
  {
    name: '玄幻修仙',
    description: '预置修仙境界体系、常见门派阵营、修真世界观',
    data: {
      factions: [
        { name: '正道联盟', color: '#4fc3f7', description: '以天道为尊的正道宗门联盟' },
        { name: '魔道', color: '#e53935', description: '追求力量不择手段的魔修势力' },
        { name: '散修', color: '#9e9e9e', description: '不属于任何宗门的独行修士' },
        { name: '妖族', color: '#ff9800', description: '化形妖兽组成的势力' },
      ],
      world_elements: [
        { category: '境界体系', name: '炼气期', description: '修仙入门，感知天地灵气' },
        { category: '境界体系', name: '筑基期', description: '凝聚灵力筑就根基' },
        { category: '境界体系', name: '金丹期', description: '灵力凝聚为金丹' },
        { category: '境界体系', name: '元婴期', description: '金丹孕育元婴，寿元大增' },
        { category: '境界体系', name: '化神期', description: '元婴化神，可操控天地法则' },
        { category: '境界体系', name: '渡劫期', description: '渡过天劫，飞升仙界' },
        { category: '地理', name: '东荒', description: '广袤的修仙者聚集地' },
        { category: '地理', name: '南域', description: '妖族盘踞的蛮荒之地' },
      ],
      volumes: [
        { title: '第一卷 · 初入仙途' },
        { title: '第二卷 · 宗门风云' },
        { title: '第三卷 · 生死逆转' },
      ],
    },
  },
  {
    name: '都市异能',
    description: '都市背景、异能等级、组织阵营',
    data: {
      factions: [
        { name: '守序者', color: '#2196f3', description: '维护城市秩序的官方异能组织' },
        { name: '暗影会', color: '#424242', description: '地下异能者联盟' },
        { name: '觉醒者同盟', color: '#66bb6a', description: '新觉醒异能者互助联盟' },
        { name: '普通人', color: '#9e9e9e', description: '尚未觉醒的普通市民' },
      ],
      world_elements: [
        { category: '异能等级', name: 'D 级', description: '刚觉醒，能力微弱' },
        { category: '异能等级', name: 'C 级', description: '可在战斗中发挥作用' },
        { category: '异能等级', name: 'B 级', description: '精英级异能者' },
        { category: '异能等级', name: 'A 级', description: '可单独对抗一支小队' },
        { category: '异能等级', name: 'S 级', description: '国宝级战力' },
        { category: '地点', name: '星城', description: '故事发生的主要城市' },
      ],
      volumes: [
        { title: '第一卷 · 觉醒之日' },
        { title: '第二卷 · 暗流涌动' },
      ],
    },
  },
  {
    name: '科幻星际',
    description: '星际文明、科技等级、星系势力',
    data: {
      factions: [
        { name: '联邦', color: '#42a5f5', description: '人类星际联邦政府' },
        { name: '帝国', color: '#ef5350', description: '星际帝国' },
        { name: '自由贸易联盟', color: '#ffa726', description: '星际商人组织' },
        { name: '虫族', color: '#388e3c', description: '外星生物集群' },
      ],
      world_elements: [
        { category: '科技等级', name: 'T1 行星文明', description: '掌握本星球资源' },
        { category: '科技等级', name: 'T2 恒星文明', description: '掌握恒星能量' },
        { category: '科技等级', name: 'T3 星系文明', description: '掌握星系级能量' },
        { category: '星系', name: '太阳系', description: '人类起源地' },
        { category: '星系', name: '半人马座', description: '联邦前线' },
      ],
      volumes: [
        { title: '第一卷 · 星海启航' },
        { title: '第二卷 · 银河战争' },
      ],
    },
  },
  {
    name: '历史架空',
    description: '朝代阵营、官职体系、历史世界观',
    data: {
      factions: [
        { name: '朝廷', color: '#f44336', description: '中央皇权势力' },
        { name: '江湖', color: '#4caf50', description: '武林门派联盟' },
        { name: '边军', color: '#795548', description: '戍守边疆的军队' },
        { name: '商会', color: '#ff9800', description: '富甲一方的商业势力' },
      ],
      world_elements: [
        { category: '官职', name: '丞相', description: '百官之首' },
        { category: '官职', name: '大将军', description: '统帅三军' },
        { category: '官职', name: '御史', description: '监察百官' },
        { category: '地理', name: '京都', description: '帝国都城' },
        { category: '地理', name: '江南', description: '富庶的南方' },
      ],
      volumes: [
        { title: '第一卷 · 乱世初现' },
        { title: '第二卷 · 群雄逐鹿' },
      ],
    },
  },
]

/** 获取用户自定义模板目录 */
function getUserTemplateDir(): string {
  const dir = join(app.getPath('userData'), 'templates')
  if (!existsSync(dir)) {
    const { mkdirSync } = require('fs')
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/** 列出所有模板（预置 + 用户） */
ipcMain.handle('template:list', () => {
  const presets = PRESET_TEMPLATES.map(t => ({ ...t, type: 'preset' as const }))
  // 读取用户模板
  const userDir = getUserTemplateDir()
  const { readdirSync } = require('fs')
  const userFiles = readdirSync(userDir).filter((f: string) => f.endsWith('.json'))
  const userTemplates = userFiles.map((f: string) => {
    try {
      const content = JSON.parse(readFileSync(join(userDir, f), 'utf-8'))
      return { name: content.name, description: content.description || '用户模板', data: content.data, type: 'user' as const, file: f }
    } catch { return null }
  }).filter(Boolean)
  return [...presets, ...userTemplates]
})

/** 应用模板到当前项目 */
ipcMain.handle('template:apply', async (_event, templateData: any) => {
  try {
    // 应用阵营
    if (templateData.factions) {
      for (const f of templateData.factions) {
        dbManager.run('INSERT INTO factions (name, color, description) VALUES (?, ?, ?)', [f.name, f.color, f.description])
      }
    }
    // 应用世界观元素
    if (templateData.world_elements) {
      for (const w of templateData.world_elements) {
        dbManager.run('INSERT INTO world_elements (category, name, description) VALUES (?, ?, ?)', [w.category, w.name, w.description])
      }
    }
    // 应用卷
    if (templateData.volumes) {
      for (let i = 0; i < templateData.volumes.length; i++) {
        dbManager.run('INSERT INTO volumes (title, sort_order) VALUES (?, ?)', [templateData.volumes[i].title, i + 1])
      }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

/** 保存当前项目为模板 */
ipcMain.handle('template:saveFromProject', async (_event, name: string, description: string) => {
  try {
    const factions = dbManager.query('SELECT name, color, description FROM factions') as any[]
    const worldElements = dbManager.query('SELECT category, name, description FROM world_elements') as any[]
    const volumes = dbManager.query('SELECT title FROM volumes ORDER BY sort_order') as any[]

    const template = {
      name,
      description,
      data: { factions, world_elements: worldElements, volumes },
      created_at: new Date().toISOString(),
    }

    const dir = getUserTemplateDir()
    const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    const filePath = join(dir, `${safeName}_${Date.now()}.json`)
    writeFileSync(filePath, JSON.stringify(template, null, 2), 'utf-8')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

/** 删除用户模板 */
ipcMain.handle('template:delete', (_event, fileName: string) => {
  try {
    const filePath = join(getUserTemplateDir(), fileName)
    if (existsSync(filePath)) {
      const { unlinkSync } = require('fs')
      unlinkSync(filePath)
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// ==========================================
// 应用生命周期
// ==========================================

// 根据用户设置决定是否禁用硬件加速
if (!settings.hardwareAcceleration) {
  app.disableHardwareAcceleration()
}

// 如果有自定义存储路径，传给 dbManager
if (settings.customDataDir) {
  dbManager.setCustomDataDir(settings.customDataDir)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.novelforge.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 初始化项目索引数据库
  dbManager.initIndex()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  dbManager.closeAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
