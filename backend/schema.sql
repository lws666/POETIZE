-- POETIZE 博客 D1 数据库结构
-- 由线上库导出，可直接执行：npx wrangler d1 execute blog-db --file=./schema.sql

-- api_tokens
CREATE TABLE api_tokens (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash    TEXT UNIQUE NOT NULL,   -- SHA-256 hex of "blg_…"
  name          TEXT NOT NULL DEFAULT '',
  scope         TEXT NOT NULL DEFAULT 'read',
  created_at    TEXT NOT NULL,
  last_used_at  TEXT NOT NULL DEFAULT '',
  revoked       INTEGER NOT NULL DEFAULT 0
);

-- cap_kv
CREATE TABLE "cap_kv" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL,
  "expires" INTEGER
);

-- comment
CREATE TABLE "comment" (
  "_id" TEXT PRIMARY KEY,
  "uid" TEXT NOT NULL DEFAULT '',
  "nick" TEXT NOT NULL DEFAULT '',
  "mail" TEXT NOT NULL DEFAULT '',
  "mailMd5" TEXT NOT NULL DEFAULT '',
  "link" TEXT NOT NULL DEFAULT '',
  "avatar" TEXT NOT NULL DEFAULT '',
  "ua" TEXT NOT NULL DEFAULT '',
  "ip" TEXT NOT NULL DEFAULT '',
  "ipRegion" TEXT NOT NULL DEFAULT '',
  "master" INTEGER NOT NULL DEFAULT 0,
  "url" TEXT NOT NULL DEFAULT '',
  "href" TEXT NOT NULL DEFAULT '',
  "comment" TEXT NOT NULL DEFAULT '',
  "pid" TEXT NOT NULL DEFAULT '',
  "rid" TEXT NOT NULL DEFAULT '',
  "like" TEXT NOT NULL DEFAULT '[]',
  "top" INTEGER NOT NULL DEFAULT 0,
  "isSpam" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "extra" TEXT NOT NULL DEFAULT '{}'
);

-- config
CREATE TABLE "config" (
  "value" TEXT NOT NULL DEFAULT ''
);

-- counter
CREATE TABLE "counter" (
  "url" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL DEFAULT '',
  "time" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0
);

-- poem_comment
CREATE TABLE poem_comment (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  source             INTEGER NOT NULL,              -- 文章 id
  parent_comment_id  INTEGER NOT NULL DEFAULT 0,    -- 父评论（0 = 一级）
  floor_comment_id   INTEGER NOT NULL DEFAULT 0,    -- 所属楼层
  type               TEXT NOT NULL DEFAULT 'article', -- article | message | love | treeHole
  user_id            INTEGER NOT NULL DEFAULT 0,
  parent_user_id     INTEGER NOT NULL DEFAULT 0,
  like_count         INTEGER NOT NULL DEFAULT 0,
  comment_content    TEXT NOT NULL DEFAULT '',
  comment_info       TEXT NOT NULL DEFAULT '',      -- 存昵称/头像快照（未登录时）
  create_time        TEXT NOT NULL DEFAULT '',
  deleted            INTEGER NOT NULL DEFAULT 0
);

-- poem_family
CREATE TABLE poem_family (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL DEFAULT 0,
  bg_cover       TEXT NOT NULL DEFAULT '',
  man_cover      TEXT NOT NULL DEFAULT '',
  woman_cover    TEXT NOT NULL DEFAULT '',
  man_name       TEXT NOT NULL DEFAULT '',
  woman_name     TEXT NOT NULL DEFAULT '',
  timing         TEXT NOT NULL DEFAULT '',
  countdown_title TEXT NOT NULL DEFAULT '',
  status         INTEGER NOT NULL DEFAULT 1,
  create_time    TEXT NOT NULL DEFAULT '',
  deleted        INTEGER NOT NULL DEFAULT 0
, time_title TEXT NOT NULL DEFAULT '', countdown_time TEXT NOT NULL DEFAULT '');

-- poem_history
CREATE TABLE poem_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ip          TEXT NOT NULL DEFAULT '',
  nation      TEXT NOT NULL DEFAULT '',
  province    TEXT NOT NULL DEFAULT '',
  city        TEXT NOT NULL DEFAULT '',
  user_agent  TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',
  create_time TEXT NOT NULL DEFAULT ''
);

-- poem_resource
CREATE TABLE poem_resource (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL DEFAULT 0,
  type          TEXT NOT NULL DEFAULT 'picture',
  status        INTEGER NOT NULL DEFAULT 1,
  store_type    TEXT NOT NULL DEFAULT 'b2',
  path          TEXT NOT NULL DEFAULT '',
  size          INTEGER NOT NULL DEFAULT 0,
  mime_type     TEXT NOT NULL DEFAULT '',
  original_name TEXT NOT NULL DEFAULT '',
  create_time   TEXT NOT NULL DEFAULT '',
  deleted       INTEGER NOT NULL DEFAULT 0
);

-- poem_resource_path
CREATE TABLE poem_resource_path (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL DEFAULT '',
  classify     TEXT NOT NULL DEFAULT '',
  cover        TEXT NOT NULL DEFAULT '',
  url          TEXT NOT NULL DEFAULT '',
  introduction TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL DEFAULT 'picture',
  remark       TEXT NOT NULL DEFAULT '',
  status       INTEGER NOT NULL DEFAULT 1,
  create_time  TEXT NOT NULL DEFAULT '',
  deleted      INTEGER NOT NULL DEFAULT 0
);

-- poem_treehole
CREATE TABLE poem_treehole (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  avatar      TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL DEFAULT '',
  create_time TEXT NOT NULL DEFAULT '',
  deleted     INTEGER NOT NULL DEFAULT 0
);

-- poem_weiyan
CREATE TABLE poem_weiyan (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL DEFAULT 0,
  like_count   INTEGER NOT NULL DEFAULT 0,
  content      TEXT NOT NULL DEFAULT '',
  is_public    INTEGER NOT NULL DEFAULT 1,
  type         TEXT NOT NULL DEFAULT 'friend',
  source       INTEGER NOT NULL DEFAULT 0,
  create_time  TEXT NOT NULL DEFAULT '',
  deleted      INTEGER NOT NULL DEFAULT 0
);

-- posts
CREATE TABLE posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT UNIQUE NOT NULL,
  title      TEXT NOT NULL DEFAULT '',       -- JSON: 支持 i18n (e.g. {"zh-CN":"标题","en":"Title"})
  date       TEXT NOT NULL,                  -- ISO 8601
  updated    TEXT DEFAULT '',                -- ISO 8601
  tags       TEXT DEFAULT '[]',              -- JSON array  ["tag1","tag2"]
  categories TEXT DEFAULT '[]',              -- JSON array  ["cat1","cat2"]
  excerpt    TEXT DEFAULT '',
  cover      TEXT DEFAULT '',
  type       TEXT DEFAULT 'post',            -- 卡片类型 (post/bilibili/yuque/...)
  top        INTEGER DEFAULT 0,              -- 置顶优先级, 越大越靠前
  draft      INTEGER DEFAULT 0,              -- 0=发布 1=草稿
  hide       TEXT DEFAULT '',                -- 隐藏: ''/index/all
  password   TEXT DEFAULT '',                -- 加密密码
  encrypt    INTEGER DEFAULT 0,              -- 0=不加密 1=加密
  comment    INTEGER DEFAULT 1,              -- 0=关闭评论 1=开启
  toc        INTEGER DEFAULT 1,              -- 0=隐藏目录 1=显示
  nav        INTEGER DEFAULT 1,              -- 0=隐藏前后导航 1=显示
  pinned     INTEGER DEFAULT 0,              -- 0=不固定 1=固定（旧版 top 替代）

  -- 存储
  b2_key     TEXT NOT NULL DEFAULT '',       -- B2 对象键: posts/{slug}/index.md
  content    TEXT DEFAULT NULL,              -- Markdown 原文（迁移兼容，后续可移除）

  -- 额外前体字段兜底
  frontmatter TEXT DEFAULT '{}',             -- JSON: 未被独立列覆盖的任意前体字段

  -- 时间戳
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
, summary TEXT DEFAULT '', view_type TEXT NOT NULL DEFAULT 'public', view_value TEXT NOT NULL DEFAULT '', tips TEXT NOT NULL DEFAULT '');

-- sessions
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,         -- SHA-256 hex of "sess_…"
  user_id     INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- site_config
CREATE TABLE site_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);

-- uploads
CREATE TABLE uploads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  b2_key     TEXT NOT NULL,                  -- B2 对象键
  filename   TEXT NOT NULL,                  -- 原始文件名
  mime_type  TEXT NOT NULL,                  -- MIME
  size       INTEGER NOT NULL,               -- bytes
  url        TEXT NOT NULL,                   -- 公开访问 URL
  created_at TEXT DEFAULT (datetime('now'))
);

-- users
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,          -- pbkdf2$<iter>$<b64salt>$<b64hash>
  role          TEXT NOT NULL DEFAULT 'read',  -- 'admin' | 'write' | 'read'
  totp_enabled  INTEGER NOT NULL DEFAULT 0,   -- 管理员 2FA 开关（自选）
  disabled      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  last_login_at TEXT NOT NULL DEFAULT ''
, user_type INTEGER NOT NULL DEFAULT 2, user_lv INTEGER NOT NULL DEFAULT 1, email TEXT NOT NULL DEFAULT '', phone_number TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', gender INTEGER NOT NULL DEFAULT 0, introduction TEXT NOT NULL DEFAULT '', subscribe TEXT NOT NULL DEFAULT '', admire TEXT NOT NULL DEFAULT '', user_status INTEGER NOT NULL DEFAULT 1);

-- 索引
CREATE INDEX "idx_cap_kv_expires" ON "cap_kv" ("expires");
CREATE INDEX "idx_comment_created" ON "comment" ("created" DESC);
CREATE INDEX "idx_comment_ip_created" ON "comment" ("ip", "created" DESC);
CREATE INDEX "idx_comment_rid" ON "comment" ("rid");
CREATE INDEX "idx_comment_url_created" ON "comment" ("url", "created" DESC);
CREATE INDEX idx_poem_comment_source ON poem_comment(source, type, deleted);
CREATE INDEX idx_poem_history_time ON poem_history(create_time);
CREATE INDEX idx_posts_date ON posts(date DESC);
CREATE INDEX idx_posts_draft_date ON posts(draft, date DESC);
CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_top  ON posts(top DESC);
CREATE INDEX idx_uploads_b2_key ON uploads(b2_key);
