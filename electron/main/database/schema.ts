/**
 * NovelForge - 数据库 Schema 定义
 *
 * 包含所有核心实体表：
 * - Timeline 时间线
 * - Character 角色 + Alias 别名 + Faction 阵营 + PowerLevel 境界 + Motivation 动机
 * - Event 事件 + EventCharacter 事件角色关联
 * - Item 物品 + ItemOwnership 持有历史 + ItemEvent 物品事件
 * - Volume/Chapter/Scene 卷/章/幕 + SceneEvent
 * - WorldElement 世界观 + MapImage 地图
 * - CharacterRelationship 角色关系
 * - CharacterStateSnapshot 状态快照（性能优化）
 */
export function getSchema(): string {
  return `
-- ==========================================
-- 时间线
-- ==========================================
CREATE TABLE IF NOT EXISTS timelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '默认时间线',
  era_name TEXT NOT NULL DEFAULT '默认纪元',
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0
);

-- ==========================================
-- 角色
-- ==========================================
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  avatar_path TEXT DEFAULT NULL,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);

-- 角色别名/外号
CREATE TABLE IF NOT EXISTS character_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_character_aliases_cid ON character_aliases(character_id);

-- ==========================================
-- 阵营
-- ==========================================
CREATE TABLE IF NOT EXISTS factions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#1890ff',
  description TEXT DEFAULT ''
);

-- 角色阵营历史（动态变更）
CREATE TABLE IF NOT EXISTS character_factions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  faction_id INTEGER NOT NULL,
  start_year INTEGER DEFAULT NULL,
  start_month INTEGER DEFAULT NULL,
  start_day INTEGER DEFAULT NULL,
  end_year INTEGER DEFAULT NULL,
  end_month INTEGER DEFAULT NULL,
  end_day INTEGER DEFAULT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cf_character ON character_factions(character_id);
CREATE INDEX IF NOT EXISTS idx_cf_faction ON character_factions(faction_id);

-- ==========================================
-- 角色境界/战力等级（动态变化）
-- ==========================================
CREATE TABLE IF NOT EXISTS character_power_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  level_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_year INTEGER DEFAULT NULL,
  start_month INTEGER DEFAULT NULL,
  start_day INTEGER DEFAULT NULL,
  end_year INTEGER DEFAULT NULL,
  end_month INTEGER DEFAULT NULL,
  end_day INTEGER DEFAULT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cpl_character ON character_power_levels(character_id);

-- ==========================================
-- 角色动机（随时间线变化）
-- ==========================================
CREATE TABLE IF NOT EXISTS character_motivations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  motivation TEXT NOT NULL,
  start_year INTEGER DEFAULT NULL,
  start_month INTEGER DEFAULT NULL,
  start_day INTEGER DEFAULT NULL,
  end_year INTEGER DEFAULT NULL,
  end_month INTEGER DEFAULT NULL,
  end_day INTEGER DEFAULT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cm_character ON character_motivations(character_id);

-- ==========================================
-- 角色关系
-- ==========================================
CREATE TABLE IF NOT EXISTS character_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_a_id INTEGER NOT NULL,
  character_b_id INTEGER NOT NULL,
  relation_type TEXT NOT NULL DEFAULT '关联',
  description TEXT DEFAULT '',
  start_year INTEGER DEFAULT NULL,
  start_month INTEGER DEFAULT NULL,
  start_day INTEGER DEFAULT NULL,
  end_year INTEGER DEFAULT NULL,
  end_month INTEGER DEFAULT NULL,
  end_day INTEGER DEFAULT NULL,
  FOREIGN KEY (character_a_id) REFERENCES characters(id) ON DELETE CASCADE,
  FOREIGN KEY (character_b_id) REFERENCES characters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cr_a ON character_relationships(character_a_id);
CREATE INDEX IF NOT EXISTS idx_cr_b ON character_relationships(character_b_id);

-- ==========================================
-- 事件
-- ==========================================
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timeline_id INTEGER DEFAULT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  year INTEGER DEFAULT 1,
  month INTEGER DEFAULT NULL,
  day INTEGER DEFAULT NULL,
  sort_order INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(year, month, day);
CREATE INDEX IF NOT EXISTS idx_events_timeline ON events(timeline_id);

-- 事件与角色的关联
CREATE TABLE IF NOT EXISTS event_characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  character_id INTEGER NOT NULL,
  role TEXT DEFAULT '参与',
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE(event_id, character_id)
);
CREATE INDEX IF NOT EXISTS idx_ec_event ON event_characters(event_id);
CREATE INDEX IF NOT EXISTS idx_ec_character ON event_characters(character_id);

-- ==========================================
-- 物品/道具
-- ==========================================
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  item_type TEXT DEFAULT '其他',
  description TEXT DEFAULT '',
  rank TEXT DEFAULT '',
  status TEXT DEFAULT '完好',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);

-- 物品持有历史
CREATE TABLE IF NOT EXISTS item_ownerships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  character_id INTEGER NOT NULL,
  acquire_method TEXT DEFAULT '',
  start_year INTEGER DEFAULT NULL,
  start_month INTEGER DEFAULT NULL,
  start_day INTEGER DEFAULT NULL,
  end_year INTEGER DEFAULT NULL,
  end_month INTEGER DEFAULT NULL,
  end_day INTEGER DEFAULT NULL,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_io_item ON item_ownerships(item_id);
CREATE INDEX IF NOT EXISTS idx_io_character ON item_ownerships(character_id);

-- 物品事件关联
CREATE TABLE IF NOT EXISTS item_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  action TEXT DEFAULT '相关',
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- ==========================================
-- 卷 / 章 / 幕
-- ==========================================
CREATE TABLE IF NOT EXISTS volumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '第一卷',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  volume_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '新章节',
  outline TEXT DEFAULT '',
  content TEXT DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chapters_volume ON chapters(volume_id);

CREATE TABLE IF NOT EXISTS scenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL,
  title TEXT DEFAULT '',
  content TEXT DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_scenes_chapter ON scenes(chapter_id);

-- 章节与事件关联
CREATE TABLE IF NOT EXISTS chapter_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE(chapter_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_ce_chapter ON chapter_events(chapter_id);
CREATE INDEX IF NOT EXISTS idx_ce_event ON chapter_events(event_id);

-- ==========================================
-- 世界观
-- ==========================================
CREATE TABLE IF NOT EXISTS world_elements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'geography',
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  parent_id INTEGER DEFAULT NULL,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (parent_id) REFERENCES world_elements(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_we_category ON world_elements(category);
CREATE INDEX IF NOT EXISTS idx_we_parent ON world_elements(parent_id);

-- 地图图片
CREATE TABLE IF NOT EXISTS map_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  image_path TEXT NOT NULL,
  description TEXT DEFAULT ''
);

-- ==========================================
-- 角色状态快照（性能优化）
-- ==========================================
CREATE TABLE IF NOT EXISTS character_state_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  snapshot_year INTEGER NOT NULL,
  snapshot_month INTEGER DEFAULT 1,
  snapshot_day INTEGER DEFAULT 1,
  faction_name TEXT DEFAULT '',
  power_level TEXT DEFAULT '',
  motivation TEXT DEFAULT '',
  relationships_json TEXT DEFAULT '[]',
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_css_character_time
  ON character_state_snapshots(character_id, snapshot_year, snapshot_month, snapshot_day);

-- ==========================================
-- 写作笔记/便签（不参与导出）
-- ==========================================
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,       -- 'chapter' | 'event'
  entity_id INTEGER NOT NULL,
  content TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_type, entity_id);

-- ==========================================
-- 章节版本历史（用于版本对比）
-- ==========================================
CREATE TABLE IF NOT EXISTS chapter_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL,
  content TEXT DEFAULT '{}',
  label TEXT DEFAULT '',             -- 可选标签，如"第一稿"
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cv_chapter ON chapter_versions(chapter_id);

-- ==========================================
-- 标签/书签系统
-- ==========================================
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#7c3aed'
);

CREATE TABLE IF NOT EXISTS entity_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,          -- 'character' | 'event' | 'chapter'
  entity_id INTEGER NOT NULL,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(tag_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_et_entity ON entity_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_et_tag ON entity_tags(tag_id);
  `
}
