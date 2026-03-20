/**
 * NovelForge - 数据库连接管理器
 *
 * 策略：
 * - 项目索引：存储在用户数据目录的 index.db 中，记录所有项目信息
 * - 项目数据：每个项目独立的 .novelforge 文件（SQLite 数据库）
 * - 项目切换：关闭旧连接，打开新文件
 */
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import { getSchema } from './schema'
import { runMigrations, initNewProjectDb } from './migrations'

/** 项目基本信息（存储在 index.db） */
export interface ProjectInfo {
  id: number
  name: string
  description: string
  file_path: string
  created_at: string
  updated_at: string
}

export class DatabaseManager {
  /** 项目索引数据库（存储项目列表） */
  private indexDb: Database.Database | null = null
  /** 当前打开的项目数据库 */
  private projectDb: Database.Database | null = null
  /** 当前打开的项目 ID */
  private currentProjectId: number | null = null
  /** 用户自定义数据目录（默认 null = 使用 userData） */
  private _customDataDir: string | null = null
  /** Prepared statement 缓存（避免重复解析 SQL） */
  private stmtCache = new Map<string, Database.Statement>()

  /** 设置自定义数据存储目录 */
  setCustomDataDir(dir: string): void {
    this._customDataDir = dir
  }

  /** 数据存储目录 */
  private get dataDir(): string {
    const base = this._customDataDir || join(app.getPath('userData'), 'projects')
    if (!existsSync(base)) {
      mkdirSync(base, { recursive: true })
    }
    return base
  }

  /** 索引数据库路径 */
  private get indexDbPath(): string {
    return join(app.getPath('userData'), 'index.db')
  }

  // ==========================================
  // 初始化
  // ==========================================

  /** 初始化项目索引数据库 */
  initIndex(): void {
    this.indexDb = new Database(this.indexDbPath)
    this.indexDb.pragma('journal_mode = WAL')  // 提升并发性能
    this.indexDb.pragma('foreign_keys = ON')

    this.indexDb.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        file_path TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `)
  }

  // ==========================================
  // 项目管理
  // ==========================================

  /** 获取所有项目列表 */
  listProjects(): ProjectInfo[] {
    if (!this.indexDb) throw new Error('索引数据库未初始化')
    return this.indexDb.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as ProjectInfo[]
  }

  /** 创建新项目 */
  createProject(name: string, description: string): ProjectInfo {
    if (!this.indexDb) throw new Error('索引数据库未初始化')

    // 生成唯一文件名
    const timestamp = Date.now()
    const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    const fileName = `${safeName}_${timestamp}.novelforge`
    const filePath = join(this.dataDir, fileName)

    // 在索引中注册
    const stmt = this.indexDb.prepare(
      'INSERT INTO projects (name, description, file_path) VALUES (?, ?, ?)'
    )
    const result = stmt.run(name, description, filePath)

    // 创建项目数据库文件并初始化 schema
    const projectDb = new Database(filePath)
    this.applyPragmas(projectDb)
    initNewProjectDb(projectDb, getSchema()) // 执行 schema + 设置版本号
    projectDb.close()

    return this.indexDb.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid) as ProjectInfo
  }

  /** 打开项目（切换当前数据库连接） */
  openProject(projectId: number): boolean {
    if (!this.indexDb) throw new Error('索引数据库未初始化')

    const project = this.indexDb.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as ProjectInfo | undefined
    if (!project) throw new Error(`项目不存在: id=${projectId}`)
    if (!existsSync(project.file_path)) throw new Error(`项目文件不存在: ${project.file_path}`)

    // 关闭旧连接
    if (this.projectDb) {
      this.projectDb.close()
    }

    // 打开新连接
    this.projectDb = new Database(project.file_path)
    this.applyPragmas(this.projectDb)
    this.stmtCache.clear() // 清空旧缓存
    this.currentProjectId = projectId

    // 自动迁移：检查并升级旧版本数据库
    runMigrations(this.projectDb)

    // 更新最近使用时间
    this.indexDb.prepare('UPDATE projects SET updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(projectId)

    return true
  }

  /** 删除项目 */
  deleteProject(projectId: number): boolean {
    if (!this.indexDb) throw new Error('索引数据库未初始化')

    const project = this.indexDb.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as ProjectInfo | undefined
    if (!project) return false

    // 如果正在使用，先关闭
    if (this.currentProjectId === projectId && this.projectDb) {
      this.projectDb.close()
      this.projectDb = null
      this.currentProjectId = null
    }

    // 删除数据库文件
    if (existsSync(project.file_path)) {
      unlinkSync(project.file_path)
    }

    // 从索引中移除
    this.indexDb.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
    return true
  }

  /** 获取当前打开的项目信息 */
  getCurrentProject(): ProjectInfo | null {
    if (!this.indexDb || !this.currentProjectId) return null
    return this.indexDb.prepare('SELECT * FROM projects WHERE id = ?').get(this.currentProjectId) as ProjectInfo | null
  }

  // ==========================================
  // 通用数据库操作（操作当前项目数据库）
  // ==========================================

  /** SELECT 查询，返回数组 */
  query(sql: string, params: unknown[] = []): unknown[] {
    if (!this.projectDb) throw new Error('未打开任何项目')
    return this.getStmt(sql).all(...params)
  }

  /** INSERT/UPDATE/DELETE，返回 { changes, lastInsertRowid } */
  run(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number | bigint } {
    if (!this.projectDb) throw new Error('未打开任何项目')
    const result = this.getStmt(sql).run(...params)
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid }
  }

  /** 查询单行 */
  get(sql: string, params: unknown[] = []): unknown {
    if (!this.projectDb) throw new Error('未打开任何项目')
    return this.getStmt(sql).get(...params)
  }

  // ==========================================
  // 性能优化工具
  // ==========================================

  /**
   * 统一应用 SQLite 性能 PRAGMA
   *
   * - journal_mode=WAL: 写不阻塞读，并发性能极佳
   * - synchronous=NORMAL: 配合 WAL 模式时安全且快 (~4x faster writes)
   * - cache_size=-8000: 8MB 页缓存（默认 2MB）
   * - temp_store=MEMORY: 临时表存内存（避免磁盘 I/O）
   * - mmap_size=268435456: 256MB 内存映射（加速大文件读取）
   */
  private applyPragmas(db: Database.Database): void {
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    db.pragma('cache_size = -8000')
    db.pragma('temp_store = MEMORY')
    db.pragma('mmap_size = 268435456')
    db.pragma('foreign_keys = ON')
  }

  /**
   * Prepared statement 缓存
   *
   * better-sqlite3 的 prepare() 开销不大，但对于高频调用的热路径
   * （如 updateChapter 每 1.5 秒一次）仍然值得缓存。
   * 缓存上限 200 条，超过时 LRU 淘汰。
   */
  private getStmt(sql: string): Database.Statement {
    let stmt = this.stmtCache.get(sql)
    if (stmt) return stmt

    stmt = this.projectDb!.prepare(sql)
    this.stmtCache.set(sql, stmt)

    // LRU 淘汰
    if (this.stmtCache.size > 200) {
      const firstKey = this.stmtCache.keys().next().value as string
      this.stmtCache.delete(firstKey)
    }
    return stmt
  }

  // ==========================================
  // 生命周期
  // ==========================================

  /** 获取当前项目数据库文件路径（备份/恢复用） */
  getProjectDbPath(): string | null {
    if (!this.indexDb || !this.currentProjectId) return null
    const project = this.indexDb.prepare('SELECT file_path FROM projects WHERE id = ?').get(this.currentProjectId) as { file_path: string } | undefined
    return project?.file_path ?? null
  }

  /** 仅关闭项目数据库连接（恢复后需重新打开） */
  closeProjectDb(): void {
    if (this.projectDb) {
      this.projectDb.close()
      this.projectDb = null
      this.stmtCache.clear()
    }
  }

  /** 关闭所有数据库连接 */
  closeAll(): void {
    if (this.projectDb) {
      this.projectDb.close()
      this.projectDb = null
      this.stmtCache.clear()
    }
    if (this.indexDb) {
      this.indexDb.close()
      this.indexDb = null
    }
  }
}
