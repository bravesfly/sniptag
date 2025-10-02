import { integer, sqliteTable, text, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core"

// Tags 表（支持树形结构，最多3级）
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  parentId: integer("parent_id"), // 父标签ID，支持树形结构
  level: integer("level").notNull().default(1), // 标签层级：1、2、3
  path: text("path").notNull(), // 完整路径，如：Frontend/Framework/Vue
  color: text("color"), // 标签颜色，可选
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  pathUnique: uniqueIndex("path_unique").on(table.path),
  parentIndex: index("parent_idx").on(table.parentId),
  levelIndex: index("level_idx").on(table.level),
}));

// Bookmarks 表  
export const bookmarks = sqliteTable("bookmarks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title"), // 标题可以为空，从网站自动获取
  url: text("url").notNull(),
  description: text("description"),
  favicon: text("favicon"), // 网站图标 URL
  screenshot: text("screenshot"), // 网页截图 URL
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  urlIndex: index("url_idx").on(table.url),
  titleIndex: index("title_idx").on(table.title),
}));

// 书签标签路径关联表（支持多个标签路径）
export const bookmarkTagPaths = sqliteTable("bookmark_tag_paths", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookmarkId: integer("bookmark_id").notNull().references(() => bookmarks.id, { onDelete: "cascade" }),
  tagPath: text("tag_path").notNull(), // 完整的标签路径，如：Frontend/Framework/Vue
  leafTagId: integer("leaf_tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }), // 叶子节点标签ID
  order: integer("order").notNull().default(0), // 排序
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  bookmarkPathIndex: index("bookmark_path_idx").on(table.bookmarkId, table.tagPath),
  leafTagIndex: index("leaf_tag_idx").on(table.leafTagId),
}));

// 保留原有的扁平标签关联表（用于生成扁平化tags字段）
export const bookmarkTags = sqliteTable("bookmark_tags", {
  bookmarkId: integer("bookmark_id").notNull().references(() => bookmarks.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.bookmarkId, table.tagId] }),
}));


// 类型定义
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type BookmarkTag = typeof bookmarkTags.$inferSelect;
export type NewBookmarkTag = typeof bookmarkTags.$inferInsert;
export type BookmarkTagPath = typeof bookmarkTagPaths.$inferSelect;
export type NewBookmarkTagPath = typeof bookmarkTagPaths.$inferInsert;

