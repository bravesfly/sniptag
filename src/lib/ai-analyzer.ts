import { z } from "zod";
import { AIConfig } from "./ai-providers";
import { ExtractedContent } from "./content-extractor";
import { TagPath } from "@/types";
import type { Ai } from '@cloudflare/ai';
import { createWorkersAI } from 'workers-ai-provider';
import { generateObject, generateText, type ModelMessage } from 'ai';
import { getCloudflareContext } from "@opennextjs/cloudflare";

// type ModelName = Parameters<Ai['run']>[0];

// 分析结果类型定义
export interface AIAnalysisResult {
  summary: string;
  tags: string[];
  tagPaths: TagPath[];
  keywords: string[];
  language: string;
  sentiment: "positive" | "neutral" | "negative";
  categories: string[];
}

// AI分析结果schema
const AnalysisResultSchema = z.object({
  summary: z.string().describe("网页内容的简洁摘要，约100字左右"),
  tags: z.array(z.string()).describe("相关标签列表，5-8个标签，以#开头，如: #JavaScript, #React"),
  tagPaths: z.array(z.string()).describe("树形标签路径数组，如: ['Programming/Languages', 'Web/Development', 'Code/JavaScript']"),
  keywords: z.array(z.string()).describe("核心关键词，5-8个关键词，按重要性排序"),
  language: z.string().describe("内容主要语言: zh, en, ja, 等"),
  sentiment: z.enum(["positive", "neutral", "negative"]).describe("内容情感倾向"),
  categories: z.array(z.string()).describe("内容分类标签")
});

const analysisSystemPrompt = `You are an expert web content analyst. Your task is to analyze the provided web page content and return a detailed analysis in a structured JSON format. Follow the instructions precisely.`;

// 综合分析网页内容（摘要+标签+关键词）
export async function analyzeWebContent(
  content: ExtractedContent,
  aiConfig: AIConfig,
  ai: Ai
): Promise<AIAnalysisResult> {
  try {
    const { env } = getCloudflareContext();
    const workersai = createWorkersAI({ binding: env.AI });
    const userPrompt = `
Please analyze the following web content:

Title: ${content.title}
Description: ${content.description || 'None'}
Content: ${content.content.substring(0, 3000)}
URL: ${content.title.includes('http') ? content.title : 'None'}


Web Content Structured Information Extraction Prompt
You are to act as a highly precise Structured Data Extraction engine. Your task is to analyze the provided web content and generate a single, structured JSON object as your sole output.
Core Directives
Strict JSON Output: Your entire response must be a single, valid JSON object. Do not include any explanatory text,or any characters before or after the JSON structure.
Chinese Language: All text values within the JSON (e.g., summary, tags, keywords) should be in Chinese, unless they are proper nouns or specific terms that do not have a common Chinese translation.
Content Fidelity: All analysis must be based strictly on the provided content. Do not infer information or use external knowledge.
Analysis Requirements
summary: Generate a concise summary of approximately 100 words, capturing the core content, main purpose, and value of the web page.
tags: Extract 5-8 highly relevant tags.Tags must start with a #.Hierarchical tags must use a / as a separator (e.g., #Business/Marketing).
tagPaths: Prioritize the use of Chinese!For any hierarchical tags, create a flat path string. For example, for the tag #Business/Marketing, the corresponding path would be "Business/Marketing". Non-hierarchical tags should be omitted from this list.
keywords: Extract 5-8 core keywords, ordered by their importance and relevance to the text in descending order.
language: Identify the primary language of the content. Return the result as an ISO 639-1 language code (e.g., en, zh-CN, es).
sentiment: Analyze the overall sentiment of the content. Choose one of the following: 'Positive', 'Negative', or 'Neutral'.
categories: Classify the content into 1-3 relevant categories. Each category should be a hierarchical path, represented as an array of strings from broad to specific.


Return ONLY a valid JSON object matching the specified schema.`;

    const messages: ModelMessage[] = [
      { role: 'system', content: analysisSystemPrompt },
      { role: 'user', content: userPrompt }
    ];
    console.log(messages);

    console.log(aiConfig);


    // 修复类型错误：确保 model 参数类型正确
    const { object: parsedObject } = await generateObject({
      model: workersai(aiConfig.model as any),
      schema: AnalysisResultSchema,
      messages,
      temperature: aiConfig.temperature || 0.3,
      // maxTokens: aiConfig.maxTokens || 1500,
    });

    console.log(parsedObject);

    const tagPaths: TagPath[] = parsedObject.tagPaths.map((pathString) => ({
      path: pathString,
      tags: [],
      leafTag: {
        id: 0,
        name: pathString.split('/').pop() || '',
        parentId: null,
        level: pathString.split('/').length,
        path: pathString,
        color: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }));

    return {
      ...parsedObject,
      tagPaths,
    };
  } catch (error) {
    console.error("AI内容分析失败:", error);

    // Fallback to simple analysis
    const simpleTags = extractSimpleTags(content);
    return {
      summary: content.description || content.title || "无法生成摘要",
      tags: simpleTags.map(tag => `#${tag}`),
      tagPaths: [],
      keywords: simpleTags,
      language: content.metadata?.language || "unknown",
      sentiment: "neutral",
      categories: []
    };
  }
}

// 生成内容摘要
export async function generateContentSummary(
  content: ExtractedContent,
  aiConfig: AIConfig,
  ai: Ai,
  maxLength: number = 200
): Promise<string> {
  try {
    const { env } = getCloudflareContext();
    const workersai = createWorkersAI({ binding: env.AI });
    const prompt = `请为以下内容生成一个简洁的摘要，不超过${maxLength}字：

标题: ${content.title}
内容: ${content.content.substring(0, 2000)}

摘要要求：
- 突出核心信息和价值
- 语言简洁明了
- 保持客观中性
- 字数控制在${maxLength}字以内`;

    const { text } = await generateText({
      model: workersai(aiConfig.model as any),
      prompt,
      temperature: 0.5,
    });

    return text.trim();
  } catch (error) {
    console.error("生成摘要失败:", error);
    return content.description || content.title || "";
  }
}

// 生成智能标签
export async function generateSmartTags(
  content: ExtractedContent,
  aiConfig: AIConfig,
  ai: Ai
): Promise<string[]> {
  try {
    const { env } = getCloudflareContext();
    const workersai = createWorkersAI({ binding: env.AI });
    const schema = z.object({
      tags: z.array(z.string()).describe("相关标签列表，每个标签应该准确反映内容特点")
    });

    const prompt = `请为以下内容生成相关标签：

标题: ${content.title}
描述: ${content.description}
内容: ${content.content.substring(0, 1500)}

要求：
- 标签要准确反映内容特点
- 包括技术、主题、类型等维度
- 5-10个标签
- 标签用中文或英文
- 优先使用通用的标签名称
- 只返回符合schema的有效JSON对象`;

    const { object: parsedObject } = await generateObject({
      model: workersai(aiConfig.model as any),
      schema: schema,
      prompt,
    });

    return parsedObject.tags;

  } catch (error) {
    console.error("生成标签失败:", error);
    return extractSimpleTags(content);
  }
}

// 简单标签提取（回退方案）
function extractSimpleTags(content: ExtractedContent): string[] {
  const tags: string[] = [];
  const text = `${content.title} ${content.description} ${content.content}`.toLowerCase();

  // 技术栈检测
  const techKeywords = [
    { keyword: 'react', tag: 'React' },
    { keyword: 'vue', tag: 'Vue.js' },
    { keyword: 'angular', tag: 'Angular' },
    { keyword: 'javascript', tag: 'JavaScript' },
    { keyword: 'typescript', tag: 'TypeScript' },
    { keyword: 'python', tag: 'Python' },
    { keyword: 'java', tag: 'Java' },
    { keyword: 'golang', tag: 'Go' },
    { keyword: 'rust', tag: 'Rust' },
    { keyword: 'docker', tag: 'Docker' },
    { keyword: 'kubernetes', tag: 'Kubernetes' },
    { keyword: 'api', tag: 'API' },
    { keyword: 'database', tag: 'Database' },
    { keyword: 'frontend', tag: 'Frontend' },
    { keyword: 'backend', tag: 'Backend' },
  ];

  for (const { keyword, tag } of techKeywords) {
    if (text.includes(keyword) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }

  // 根据URL域名添加标签
  try {
    const url = new URL(content.title.includes('http') ? content.title : 'https://example.com');
    const domain = url.hostname.toLowerCase();

    if (domain.includes('github')) tags.push('GitHub');
    if (domain.includes('stackoverflow')) tags.push('StackOverflow');
    if (domain.includes('medium')) tags.push('Blog');
    if (domain.includes('dev.to')) tags.push('Development');
    if (domain.includes('docs')) tags.push('Documentation');
  } catch {
    // 忽略URL解析错误
  }

  return tags.slice(0, 8); // 最多返回8个标签
}
