import { NextRequest, NextResponse } from "next/server";
import { categories, getDb } from "@/db";
import { bookmarks, bookmarkTags, bookmarkTagPaths, tags, settings, type NewBookmark, type NewBookmarkTag } from "@/db/schema";
import { eq, like, and, desc, or, inArray } from "drizzle-orm";
import { ApiResponse, Bookmark } from "@/types";
import { fetchWebsiteMetadata } from "@/lib/metadata";
import { captureAndStoreScreenshot, processAndStoreBase64Image } from "@/lib/screenshot";
import { extractMainContent } from "@/lib/content-extractor";
import { analyzeWebContent, type AIAnalysisResult } from "@/lib/ai-analyzer";
import { AIConfig } from "@/lib/ai-providers";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// ==================== 通用工具函数 ====================

// 鉴权函数
function authenticateRequest(request: NextRequest): boolean {
  const { env } = getCloudflareContext();
  const authSecret = env.API_TOKEN as string | undefined;
  const requestSecret = request.headers.get('Authorization');

  // 1. Check for API secret for third-party requests
  if (authSecret && requestSecret) {
    if (requestSecret === authSecret) {
      return true;
    }
    return false; // Provided secret is wrong
  }

  // If no secret is provided, assume it's a same-origin request from the Next.js app,
  // which should be handled by middleware or other session management.
  // The original Basic Auth was insecure. A same-origin check is a basic guard.
  const origin = request.headers.get('Origin');
  const host = request.headers.get('Host');
  const requestUrl = new URL(request.url);

  if (origin && new URL(origin).hostname === requestUrl.hostname) {
    return true;
  }
  if (!origin && host && requestUrl.hostname === host) {
    return true;
  }

  return false;
}

// 返回鉴权失败响应
function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "未授权访问。"
    },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Sniptag API"'
      }
    }
  );
}

// URL验证函数
function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// 检查URL是否已存在
async function checkUrlExists(url: string): Promise<any | null> {
  const db = await getDb();
  const existingBookmark = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.url, url))
    .limit(1);

  return existingBookmark.length > 0 ? existingBookmark[0] : null;
}

// ==================== 标签处理函数 ====================

// 创建层级标签树
async function createHierarchicalTag(tagPath: string, db: any): Promise<number | null> {
  const pathParts = tagPath.split('/').filter(part => part.trim());
  let currentPath = '';
  let parentId = null;

  for (let i = 0; i < pathParts.length; i++) {
    const tagName = pathParts[i].trim();
    currentPath = i === 0 ? tagName : `${currentPath}/${tagName}`;

    const existingTag = await db
      .select()
      .from(tags)
      .where(eq(tags.path, currentPath))
      .limit(1);

    if (existingTag.length === 0) {
      const newTag: any[] = await db
        .insert(tags)
        .values({
          name: tagName,
          parentId: parentId,
          level: i + 1,
          path: currentPath,
          color: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      parentId = newTag[0].id;
    } else {
      parentId = existingTag[0].id;
    }
  }

  return parentId;
}

// 处理标签和标签路径
async function processTagsAndPaths(
  bookmarkId: number,
  tagNames: string[] = [],
  tagPaths: string[] = [],
  db: any
): Promise<void> {
  const newTagIds = [];
  const hierarchicalPaths = [...tagPaths];

  // 处理扁平标签
  for (const tagName of tagNames) {
    try {
      const cleanTagName = tagName.replace(/^#/, '').trim();

      if (cleanTagName.includes('/')) {
        // 层级标签
        const leafTagId = await createHierarchicalTag(cleanTagName, db);
        if (leafTagId) {
          hierarchicalPaths.push(cleanTagName);
        }
      } else {
        // 简单标签
        const existingTags = await db
          .select()
          .from(tags)
          .where(eq(tags.name, cleanTagName));

        let tagId;
        if (existingTags.length > 0) {
          tagId = existingTags[0].id;
        } else {
          const newTag: any[] = await db
            .insert(tags)
            .values({
              name: cleanTagName,
              parentId: null,
              level: 1,
              path: cleanTagName,
              color: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          tagId = newTag[0].id;
        }

        newTagIds.push(tagId);
      }
    } catch (error) {
      console.error(`创建标签失败: ${tagName}`, error);
    }
  }

  // 添加标签关联
  if (newTagIds.length > 0) {
    const tagAssociations = newTagIds.map(tagId => ({
      bookmarkId: bookmarkId,
      tagId: tagId,
    }));

    await db.insert(bookmarkTags).values(tagAssociations);
  }

  // 保存标签路径
  if (hierarchicalPaths.length > 0) {
    const tagPathInserts = [];

    for (let index = 0; index < hierarchicalPaths.length; index++) {
      const pathString = hierarchicalPaths[index];

      const leafTag = await db
        .select()
        .from(tags)
        .where(eq(tags.path, pathString))
        .limit(1);

      if (leafTag.length > 0) {
        tagPathInserts.push({
          bookmarkId: bookmarkId,
          tagPath: pathString,
          leafTagId: leafTag[0].id,
          order: index,
          createdAt: new Date(),
        });
      }
    }

    if (tagPathInserts.length > 0) {
      try {
        await db.insert(bookmarkTagPaths).values(tagPathInserts);
        console.log(`成功保存 ${tagPathInserts.length} 个标签路径`);
      } catch (error: any) {
        if (!error.message?.includes('no such table: bookmark_tag_paths')) {
          console.error('保存标签路径失败:', error);
        }
      }
    }
  }
}

// ==================== AI处理函数 ====================

// 获取AI配置
async function getAIConfig(db: any): Promise<AIConfig | null> {
  const aiSettings = await db
    .select()
    .from(settings)
    .where(eq(settings.category, "ai"));

  if (aiSettings.length === 0) {
    console.warn("AI settings not found in database, AI analysis will be skipped.");
    return null;
  }

  const aiConfigData: any = {};
  aiSettings.forEach((setting: any) => {
    aiConfigData[setting.key] = setting.value;
  });

  // For Cloudflare AI, only the model is required from settings.
  if (!aiConfigData.model) {
    console.error("AI model is not configured in settings, AI analysis will be skipped.");
    return null;
  }

  return {
    model: aiConfigData.model,
    temperature: parseFloat(aiConfigData.temperature) || 0.5,
    maxTokens: parseInt(aiConfigData.maxTokens) || 2048,
  };
}

// AI分析网页内容
async function analyzeWebpage(url: string, db: any, ai: any): Promise<AIAnalysisResult | null> {
  try {
    const aiConfig = await getAIConfig(db);
    if (!aiConfig) {
      console.log("AI config not found, skipping AI analysis.");
      return null;
    }

    // 获取网页内容
    const htmlResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
      }
    });

    if (!htmlResponse.ok) {
      console.error(`Failed to fetch website content for AI analysis. Status: ${htmlResponse.status}`);
      return null;
    }

    const html = await htmlResponse.text();
    const extractedContent = extractMainContent(html, url);

    // Pass the AI binding to the analysis function
    const aiAnalysis = await analyzeWebContent(extractedContent, aiConfig, ai);

    return aiAnalysis;
  } catch (error) {
    console.error('AI分析失败:', error);
    return null;
  }
}

// ==================== 截图处理函数 ====================

// 处理截图（base64或URL）
async function processScreenshot(screenshot: string, url: string): Promise<string | null> {
  if (!screenshot) {
    return null;
  }

  if (screenshot.startsWith('data:image/') || screenshot.match(/^[A-Za-z0-9+/=]+$/)) {
    // base64图片，上传到R2
    console.log('处理base64截图...');
    return await processAndStoreBase64Image(screenshot, url);
  } else {
    // URL形式的截图
    return screenshot;
  }
}

// ==================== 数据获取函数 ====================

// 获取网页元数据
async function fetchWebpageData(url: string): Promise<{
  title?: string;
  description?: string;
  favicon?: string;
  screenshot?: string;
}> {
  try {
    const [metadataResult, screenshotResult] = await Promise.allSettled([
      fetchWebsiteMetadata(url),
      captureAndStoreScreenshot(url)
    ]);

    const result: any = {};

    if (metadataResult.status === 'fulfilled' && metadataResult.value) {
      result.title = metadataResult.value.title;
      result.description = metadataResult.value.description;
      result.favicon = metadataResult.value.favicon;
    }

    if (screenshotResult.status === 'fulfilled' && screenshotResult.value) {
      result.screenshot = screenshotResult.value;
    }

    return result;
  } catch (error) {
    console.error('获取网页数据失败:', error);
    return {};
  }
}

// ==================== 书签数据增强函数 ====================

// 为书签添加标签和标签路径数据
async function enrichBookmarkWithTags(bookmark: any, db: any) {
  // 获取扁平化的标签
  const bookmarkTagsData = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(tags)
    .innerJoin(bookmarkTags, eq(tags.id, bookmarkTags.tagId))
    .where(eq(bookmarkTags.bookmarkId, bookmark.id));

  // 获取标签路径
  let bookmarkTagPathsData = [];
  try {
    bookmarkTagPathsData = await db
      .select({
        path: bookmarkTagPaths.tagPath,
        order: bookmarkTagPaths.order,
        leafTagId: bookmarkTagPaths.leafTagId,
      })
      .from(bookmarkTagPaths)
      .where(eq(bookmarkTagPaths.bookmarkId, bookmark.id))
      .orderBy(bookmarkTagPaths.order);
  } catch (error: any) {
    if (error.message?.includes('no such table: bookmark_tag_paths')) {
      console.warn('bookmark_tag_paths 表不存在，跳过标签路径查询');
      bookmarkTagPathsData = [];
    } else {
      throw error;
    }
  }

  // 构建TagPath数组
  const tagPaths = bookmarkTagPathsData.map((pathData: any) => {
    const pathParts = pathData.path.split('/').filter((part: string) => part.trim());
    const tags = pathParts.map((name: string, level: number) => ({
      id: pathData.leafTagId + level,
      name: name.trim(),
      parentId: level > 0 ? pathData.leafTagId + level - 1 : null,
      level: level + 1,
      path: pathParts.slice(0, level + 1).join('/'),
      color: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const leafTag = tags[tags.length - 1];

    return {
      path: pathData.path,
      tags,
      leafTag
    };
  });

  return {
    ...bookmark,
    tags: bookmarkTagsData,
    tagPaths: tagPaths,
  };
}

// ==================== API路由处理函数 ====================

// 处理 CORS 预检请求
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');

  // 允许来自你的 Web 应用和特定 Chrome 扩展的请求
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL, // 从环境变量中获取你的应用URL
    'chrome-extension://eiadckjccgkneelgkafmaeabookiooff'
  ].filter(Boolean); // 过滤掉未定义的值

  if (origin && allowedOrigins.includes(origin)) {
    return new NextResponse(null, {
      status: 204, // No Content
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400', // 24 hours
      },
    });
  }

  // 如果来源不允许，则返回 Forbidden
  return new NextResponse('Forbidden', { status: 403 });
}

// GET - 获取所有书签或搜索书签
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const tagId = searchParams.get("tagId");
    const menuPath = searchParams.get("menuPath");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let result: any[] = [];

    if (menuPath) {
      // 按菜单路径筛选
      const pathPattern = `${menuPath}/%`;
      const exactPath = menuPath;

      const matchingBookmarkIds = await db
        .selectDistinct({
          bookmarkId: bookmarkTagPaths.bookmarkId,
        })
        .from(bookmarkTagPaths)
        .where(
          or(
            eq(bookmarkTagPaths.tagPath, exactPath),
            like(bookmarkTagPaths.tagPath, pathPattern)
          )
        );

      if (matchingBookmarkIds.length === 0) {
        result = [];
      } else {
        const bookmarkIds = matchingBookmarkIds.map(item => item.bookmarkId);

        result = await db
          .select({
            id: bookmarks.id,
            title: bookmarks.title,
            url: bookmarks.url,
            description: bookmarks.description,
            favicon: bookmarks.favicon,
            screenshot: bookmarks.screenshot,
            createdAt: bookmarks.createdAt,
            updatedAt: bookmarks.updatedAt,
          })
          .from(bookmarks)
          .where(
            search
              ? and(
                inArray(bookmarks.id, bookmarkIds),
                like(bookmarks.title, `%${search}%`)
              )
              : inArray(bookmarks.id, bookmarkIds)
          )
          .orderBy(desc(bookmarks.createdAt))
          .limit(limit)
          .offset(offset);
      }
    } else if (tagId && search) {
      // 按标签筛选 + 搜索
      result = await db
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          url: bookmarks.url,
          description: bookmarks.description,
          favicon: bookmarks.favicon,
          createdAt: bookmarks.createdAt,
          updatedAt: bookmarks.updatedAt,
        })
        .from(bookmarks)
        .innerJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .where(and(
          eq(bookmarkTags.tagId, parseInt(tagId)),
          like(bookmarks.title, `%${search}%`)
        ))
        .orderBy(desc(bookmarks.createdAt))
        .limit(limit)
        .offset(offset);
    } else if (tagId) {
      // 仅按标签筛选
      result = await db
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          url: bookmarks.url,
          description: bookmarks.description,
          favicon: bookmarks.favicon,
          screenshot: bookmarks.screenshot,
          createdAt: bookmarks.createdAt,
          updatedAt: bookmarks.updatedAt,
        })
        .from(bookmarks)
        .innerJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .where(eq(bookmarkTags.tagId, parseInt(tagId)))
        .orderBy(desc(bookmarks.createdAt))
        .limit(limit)
        .offset(offset);
    } else if (search) {
      // 仅搜索
      result = await db
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          url: bookmarks.url,
          description: bookmarks.description,
          favicon: bookmarks.favicon,
          screenshot: bookmarks.screenshot,
          createdAt: bookmarks.createdAt,
          updatedAt: bookmarks.updatedAt,
        })
        .from(bookmarks)
        .where(like(bookmarks.title, `%${search}%`))
        .orderBy(desc(bookmarks.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      // 获取所有书签
      result = await db
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          url: bookmarks.url,
          description: bookmarks.description,
          favicon: bookmarks.favicon,
          screenshot: bookmarks.screenshot,
          createdAt: bookmarks.createdAt,
          updatedAt: bookmarks.updatedAt,
        })
        .from(bookmarks)
        .orderBy(desc(bookmarks.createdAt))
        .limit(limit)
        .offset(offset);
    }

    // 获取每个书签的标签和标签路径
    const bookmarksWithTags = await Promise.all(
      result.map(async (bookmark) => {
        return await enrichBookmarkWithTags(bookmark, db);
      })
    );

    return NextResponse.json({
      success: true,
      data: bookmarksWithTags
    });
  } catch (error) {
    console.error("获取书签失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: "获取书签失败"
      },
      { status: 500 }
    );
  }
}

// POST - 创建新书签
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'chrome-extension://eiadckjccgkneelgkafmaeabookiooff'
  ].filter(Boolean);

  const corsHeaders: { [key: string]: string } = {};
  if (origin && allowedOrigins.includes(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  }

  // 鉴权检查
  if (!authenticateRequest(request)) {
    return unauthorizedResponse();
  }

  if (request.headers.get('content-type') !== 'application/json') {
    return NextResponse.json({ success: false, error: "Invalid content type" }, { status: 400, headers: corsHeaders });
  }

  try {
    console.log('开始创建书签...');
    const db = await getDb();
    const { env } = getCloudflareContext();

    const body: Omit<NewBookmark, "id" | "createdAt" | "updatedAt"> & {
      tagIds?: number[];
      tags?: string[];
      tagPaths?: string[];
    } = await request.json();

    const url = body.url.trim();

    if (!validateUrl(url)) {
      return NextResponse.json({ success: false, error: "URL格式不正确" }, { status: 400, headers: corsHeaders });
    }

    const existingBookmark = await checkUrlExists(url);
    if (existingBookmark) {
      return NextResponse.json({ success: false, error: "该URL已经添加过了", data: existingBookmark }, { status: 409, headers: corsHeaders });
    }

    const hasClientData = body.title || body.description || body.screenshot || (body.tags && body.tags.length > 0) || (body.tagPaths && body.tagPaths.length > 0);

    let finalData: NewBookmark = {
      title: body.title || url,
      url: url,
      description: body.description || null,
      favicon: body.favicon || null,
      screenshot: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (body.screenshot) {
      finalData.screenshot = await processScreenshot(body.screenshot, url);
    }

    let aiAnalysisResult: AIAnalysisResult | null = null;

    if (!hasClientData) {
      console.log('只有URL，使用AI获取数据...');
      const [webpageData, aiAnalysisSettled] = await Promise.allSettled([
        fetchWebpageData(url),
        analyzeWebpage(url, db, env.AI) // Pass AI binding
      ]);

      if (webpageData.status === 'fulfilled' && webpageData.value) {
        finalData.title = webpageData.value.title || finalData.title;
        finalData.description = webpageData.value.description || finalData.description;
        finalData.favicon = webpageData.value.favicon || finalData.favicon;
        finalData.screenshot = webpageData.value.screenshot || finalData.screenshot;
      }

      if (aiAnalysisSettled.status === 'fulfilled' && aiAnalysisSettled.value) {
        aiAnalysisResult = aiAnalysisSettled.value;
        // Use AI summary only if metadata description is missing
        finalData.description = aiAnalysisResult.summary || finalData.description;
      }
    }

    // 插入书签以获取ID
    const bookmarkResult = await db.insert(bookmarks).values(finalData).returning();
    const createdBookmark = bookmarkResult[0];

    // 统一处理所有标签和路径
    const clientTags = body.tags || [];
    const clientTagPaths = body.tagPaths || [];
    const aiTags = aiAnalysisResult?.tags || [];
    const aiTagPaths = aiAnalysisResult?.tagPaths.map(p => p.path) || [];

    const allTags = [...clientTags, ...aiTags];
    const allTagPaths = [...clientTagPaths, ...aiTagPaths];

    if (allTags.length > 0 || allTagPaths.length > 0) {
      await processTagsAndPaths(
        createdBookmark.id, // Use the real bookmark ID
        allTags,
        allTagPaths,
        db
      );
    }

    // 如果有tagIds，也需要处理
    if (body.tagIds && body.tagIds.length > 0) {
      const tagAssociations: NewBookmarkTag[] = body.tagIds.map(tagId => ({
        bookmarkId: createdBookmark.id,
        tagId: tagId,
      }));
      await db.insert(bookmarkTags).values(tagAssociations);
    }

    // 重新获取完整的书签数据
    const finalBookmark = await enrichBookmarkWithTags(createdBookmark, db);

    return NextResponse.json({ success: true, data: finalBookmark, message: '书签创建成功' }, { status: 201, headers: corsHeaders });

  } catch (error: any) {
    console.error("创建书签失败:", error);
    return NextResponse.json({ success: false, error: `创建书签失败: ${error.message}` }, { status: 500, headers: corsHeaders });
  }
}

// PUT - 更新书签
export async function PUT(request: NextRequest) {
  // 鉴权检查
  if (!authenticateRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "缺少书签 ID"
        },
        { status: 400 }
      );
    }

    const body: Partial<NewBookmark> & { tagIds?: number[] } = await request.json();

    if (!body.title?.trim() || !body.url?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "标题和URL不能为空"
        },
        { status: 400 }
      );
    }

    // 验证URL格式
    if (!validateUrl(body.url)) {
      return NextResponse.json(
        {
          success: false,
          error: "URL格式不正确"
        },
        { status: 400 }
      );
    }

    const updateData = {
      title: body.title.trim(),
      url: body.url.trim(),
      description: body.description?.trim() || null,
      favicon: body.favicon?.trim() || null,
      screenshot: body.screenshot?.trim() || null,
      updatedAt: new Date(),
    };

    // 更新书签
    const result = await db
      .update(bookmarks)
      .set(updateData)
      .where(eq(bookmarks.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "书签不存在"
        },
        { status: 404 }
      );
    }

    // 如果提供了标签ID，更新标签关联
    if (body.tagIds !== undefined) {
      // 删除现有的标签关联
      await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, parseInt(id)));

      // 创建新的标签关联
      if (body.tagIds.length > 0) {
        const tagAssociations: NewBookmarkTag[] = body.tagIds.map(tagId => ({
          bookmarkId: parseInt(id),
          tagId: tagId,
        }));

        await db.insert(bookmarkTags).values(tagAssociations);
      }
    }

    // 获取更新后的完整书签数据（包含标签）
    const bookmarkTagsData = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
      })
      .from(tags)
      .innerJoin(bookmarkTags, eq(tags.id, bookmarkTags.tagId))
      .where(eq(bookmarkTags.bookmarkId, parseInt(id)));

    const updatedResult = {
      ...result[0],
      tags: bookmarkTagsData,
    };

    return NextResponse.json({
      success: true,
      data: updatedResult
    });
  } catch (error: any) {
    console.error("更新书签失败:", error);

    return NextResponse.json(
      {
        success: false,
        error: "更新书签失败"
      },
      { status: 500 }
    );
  }
}

// DELETE - 删除书签
export async function DELETE(request: NextRequest) {
  // 鉴权检查
  if (!authenticateRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "缺少书签 ID"
        },
        { status: 400 }
      );
    }

    const result = await db
      .delete(bookmarks)
      .where(eq(bookmarks.id, parseInt(id)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "书签不存在"
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "书签删除成功"
    });
  } catch (error) {
    console.error("删除书签失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: "删除书签失败"
      },
      { status: 500 }
    );
  }
}
