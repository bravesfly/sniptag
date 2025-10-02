import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core"

// Settings 表（存储AI配置）
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(), // 配置键名
  value: text("value").notNull(), // 配置值（JSON字符串）
  category: text("category").notNull().default("general"), // 配置分类：ai、general等
  description: text("description"), // 配置描述
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  keyIndex: index("key_idx").on(table.key),
  categoryIndex: index("category_idx").on(table.category),
}));

// 类型定义
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
