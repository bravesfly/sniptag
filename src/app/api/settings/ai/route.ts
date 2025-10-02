import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AIConfig, DEFAULT_AI_CONFIG } from "@/lib/ai-providers";

// 获取AI设置
export async function GET() {
  try {
    const { env } = getCloudflareContext();
    const db = drizzle(env.DB);

    try {
      const aiSettings = await db
        .select()
        .from(settings)
        .where(eq(settings.category, "ai"));
        console.log(aiSettings);
        

      const config: Partial<AIConfig> = {};

      for (const setting of aiSettings) {
        try {
          config[setting.key as keyof AIConfig] = JSON.parse(setting.value);
        } catch {
          // 如果不是JSON，直接使用字符串值
          (config as any)[setting.key] = setting.value;
        }
      }

      return NextResponse.json(config);
    } catch (dbError: any) {
      // 如果settings表不存在，返回默认配置
      if (dbError.cause?.message?.includes('no such table: settings')) {
        console.warn("Settings表不存在，返回默认AI配置");
        return NextResponse.json({
          // provider: DEFAULT_AI_CONFIG.provider,
          model: DEFAULT_AI_CONFIG.model,
          // 不返回apiKey以保证安全
        });
      }
      throw dbError;
    }
  } catch (error) {
    console.error("获取AI设置失败:", error);
    return NextResponse.json(
      { error: "获取设置失败" },
      { status: 500 }
    );
  }
}

// 保存AI设置
export async function POST(request: NextRequest) {
  try {
    const config = await request.json() as AIConfig;

    // 验证配置
    // const validation = validateAIConfig(config);
    // if (!validation.valid) {
    //   return NextResponse.json(
    //     { error: validation.errors.join(", ") },
    //     { status: 400 }
    //   );
    // }

    const { env } = getCloudflareContext();
    const db = drizzle(env.DB);

    try {
      // 保存每个配置项
      const settingsToSave = [
        // { key: "provider", value: config.provider },
        { key: "model", value: config.model },
        // { key: "apiKey", value: config.apiKey },
        { key: "temperature", value: config.temperature?.toString() || "0.7" },
        { key: "maxTokens", value: config.maxTokens?.toString() || "4000" },
      ];

        // if (config.baseUrl) {
        //   settingsToSave.push({ key: "baseUrl", value: config.baseUrl });
        // }

      for (const setting of settingsToSave) {
        await db
          .insert(settings)
          .values({
            key: setting.key,
            value: setting.value,
            category: "ai",
            description: `AI配置项: ${setting.key}`,
          })
          .onConflictDoUpdate({
            target: settings.key,
            set: {
              value: setting.value,
              updatedAt: new Date(),
            },
          });
      }

      return NextResponse.json({ success: true });
    } catch (dbError: any) {
      // 如果settings表不存在，先创建表
      if (dbError.cause?.message?.includes('no such table: settings')) {
        console.warn("Settings表不存在，尝试创建表");

        try {
          // 创建settings表
          await db.run(`
            CREATE TABLE IF NOT EXISTS settings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              key TEXT UNIQUE NOT NULL,
              value TEXT NOT NULL,
              category TEXT DEFAULT 'general' NOT NULL,
              description TEXT,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
          `);

          // 创建索引
          await db.run(`CREATE INDEX IF NOT EXISTS key_idx ON settings (key)`);
          await db.run(`CREATE INDEX IF NOT EXISTS category_idx ON settings (category)`);

          console.log("Settings表创建成功，重新尝试保存");

          // 重新尝试保存
          const settingsToSave = [
            // { key: "provider", value: config.provider },
            { key: "model", value: config.model },
            // { key: "apiKey", value: config.apiKey },
            { key: "temperature", value: config.temperature?.toString() || "0.7" },
            { key: "maxTokens", value: config.maxTokens?.toString() || "4000" },
          ];

          // if (config.baseUrl) {
          //   settingsToSave.push({ key: "baseUrl", value: config.baseUrl });
          // }

          for (const setting of settingsToSave) {
            const now = Date.now();
            await (db as any).run(
              `INSERT INTO settings (key, value, category, description, created_at, updated_at)
               VALUES ('${setting.key}', '${setting.value}', 'ai', 'AI配置项: ${setting.key}', ${now}, ${now})
               ON CONFLICT(key) DO UPDATE SET value = '${setting.value}', updated_at = ${now}`
            );
          }

          return NextResponse.json({ success: true });
        } catch (createError) {
          console.error("创建settings表失败:", createError);
          throw createError;
        }
      }
      throw dbError;
    }
  } catch (error) {
    console.error("保存AI设置失败:", error);
    return NextResponse.json(
      { error: "保存设置失败" },
      { status: 500 }
    );
  }
} 