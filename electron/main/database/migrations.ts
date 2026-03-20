/**
 * NovelForge - 数据库自动迁移
 *
 * 使用 PRAGMA user_version 跟踪 Schema 版本。
 * 每次打开项目时自动检查并执行增量迁移。
 *
 * 策略：
 * - 新建项目：直接执行最新 schema + 设置最新版本号
 * - 旧项目：检查实际表结构，智能执行所需的 ALTER TABLE / CREATE TABLE
 */
import Database from 'better-sqlite3'
import { getSchema } from './schema'

/** 当前 Schema 版本号 */
export const CURRENT_SCHEMA_VERSION = 7

/** 检查表是否包含指定列 */
function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.pragma(`table_info(${table})`) as { name: string }[]
  return cols.some(c => c.name === column)
}

/** 检查表是否存在 */
function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare(
    "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name=?"
  ).get(table) as { cnt: number }
  return row.cnt > 0
}

/**
 * 对打开的项目数据库执行自动迁移。
 * 智能检查表结构，同时兼容：
 *  - 老 schema（有 timeline_year 列的 events 表）
 *  - 已修复 schema 但无版本号的数据库
 *  - 完全最新的数据库
 */
export function runMigrations(db: Database.Database): void {
  const currentVersion = (db.pragma('user_version', { simple: true }) as number) || 0

  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    return
  }

  console.log(`[DB Migration] 数据库版本 ${currentVersion} → ${CURRENT_SCHEMA_VERSION}，开始迁移...`)

  const migrate = db.transaction(() => {
    // ========================================
    // Migration to v2:
    // 1. timelines 表需要 name 列
    // 2. events 表需要 timeline_id + year/month/day（替代旧 timeline_year/month/day）
    // ========================================

    // --- timelines.name ---
    if (tableExists(db, 'timelines') && !hasColumn(db, 'timelines', 'name')) {
      console.log('[DB Migration] 添加 timelines.name 列')
      db.exec(`ALTER TABLE timelines ADD COLUMN name TEXT NOT NULL DEFAULT '默认时间线'`)
    }

    // --- events 表结构 ---
    if (tableExists(db, 'events')) {
      const hasOldColumns = hasColumn(db, 'events', 'timeline_year')
      const hasNewColumns = hasColumn(db, 'events', 'year') && hasColumn(db, 'events', 'timeline_id')

      if (hasOldColumns && !hasNewColumns) {
        // 老 schema: 需要完整迁移
        console.log('[DB Migration] 迁移 events 表 (旧 → 新)')
        db.exec(`CREATE TABLE IF NOT EXISTS events_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timeline_id INTEGER DEFAULT NULL,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          year INTEGER DEFAULT 1,
          month INTEGER DEFAULT NULL,
          day INTEGER DEFAULT NULL,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE SET NULL
        )`)
        db.exec(`INSERT OR IGNORE INTO events_new (id, title, description, year, month, day, created_at)
          SELECT id, title, description,
                 COALESCE(timeline_year, 1), timeline_month, timeline_day, created_at
          FROM events`)
        db.exec('DROP TABLE events')
        db.exec('ALTER TABLE events_new RENAME TO events')
        db.exec('CREATE INDEX IF NOT EXISTS idx_events_time ON events(year, month, day)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_events_timeline ON events(timeline_id)')
      } else if (!hasOldColumns && hasNewColumns) {
        // 已修复的 schema，无需迁移 events
        console.log('[DB Migration] events 表结构已是最新，跳过')
      }
      // else: 空表或异常情况，getSchema 的 CREATE TABLE IF NOT EXISTS 会处理
    }

    // 清理旧的 timeline_events 中转表
    if (tableExists(db, 'timeline_events')) {
      console.log('[DB Migration] 清理旧 timeline_events 表')
      db.exec('DROP TABLE timeline_events')
    }

    // ========================================
    // Migration to v3:
    // chapters 表新增 content 列（幕 Scene 合并到章节）
    // ========================================
    if (tableExists(db, 'chapters') && !hasColumn(db, 'chapters', 'content')) {
      console.log('[DB Migration] 添加 chapters.content 列')
      db.exec(`ALTER TABLE chapters ADD COLUMN content TEXT DEFAULT '{}'`)
    }

    // ========================================
    // Migration to v4:
    // 确保 chapter_events 表存在
    // ========================================
    // 通过 getSchema() 的 CREATE TABLE IF NOT EXISTS 处理

    // ========================================
    // Migration to v7:
    // 回收站（软删除 is_deleted 列）
    // ========================================
    for (const t of ['characters', 'events', 'chapters']) {
      if (tableExists(db, t) && !hasColumn(db, t, 'is_deleted')) {
        console.log(`[DB Migration] 添加 ${t}.is_deleted 列`)
        db.exec(`ALTER TABLE ${t} ADD COLUMN is_deleted INTEGER DEFAULT 0`)
      }
    }

    // 确保所有表都存在（CREATE TABLE IF NOT EXISTS 安全）
    db.exec(getSchema())

    // 更新版本号
    db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`)
  })

  migrate()
  console.log(`[DB Migration] 迁移完成，当前版本: ${CURRENT_SCHEMA_VERSION}`)
}

/**
 * 初始化新项目数据库：执行完整 schema 并设置版本号
 */
export function initNewProjectDb(db: Database.Database, schema: string): void {
  db.exec(schema)
  db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`)
}
