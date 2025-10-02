// 网页内容提取器
export interface ExtractedContent {
  title: string;
  description: string;
  content: string; // 主体文本内容
  metadata: {
    wordCount: number;
    language?: string;
    readingTime: number; // 预估阅读时间（分钟）
  };
}

// 从HTML中提取主体内容
export function extractMainContent(html: string, url: string): ExtractedContent {
  // 移除脚本和样式标签
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // 提取标题
  const titleMatch = cleanHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || new URL(url).hostname;

  // 提取描述
  const descriptionMatch = cleanHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const description = descriptionMatch?.[1]?.trim() || '';

  // 尝试提取主体内容（优先级排序）
  let content = '';
  
  // 1. 尝试提取常见的内容区域
  const contentSelectors = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*entry[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const selector of contentSelectors) {
    const match = cleanHtml.match(selector);
    if (match && match[1]) {
      content = match[1];
      break;
    }
  }

  // 2. 如果没找到主体内容，尝试提取body内容
  if (!content) {
    const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      content = bodyMatch[1];
    } else {
      content = cleanHtml;
    }
  }

  // 3. 清理HTML标签，保留文本
  const textContent = extractTextFromHtml(content);
  
  // 计算元数据
  const wordCount = countWords(textContent);
  const readingTime = Math.ceil(wordCount / 200); // 假设每分钟阅读200字
  const language = detectLanguage(textContent);

  return {
    title,
    description,
    content: textContent,
    metadata: {
      wordCount,
      language,
      readingTime
    }
  };
}

// 从HTML中提取纯文本
function extractTextFromHtml(html: string): string {
  return html
    // 移除所有HTML标签
    .replace(/<[^>]*>/g, ' ')
    // 解码HTML实体
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // 清理多余空白
    .replace(/\s+/g, ' ')
    .trim();
}

// 计算单词数量
function countWords(text: string): number {
  if (!text) return 0;
  
  // 检测是否包含中文字符
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  
  if (hasChinese) {
    // 中文：按字符计算
    return text.replace(/\s/g, '').length;
  } else {
    // 英文：按单词计算
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
}

// 简单的语言检测
function detectLanguage(text: string): string {
  if (!text) return 'unknown';
  
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  
  if (chineseChars / totalChars > 0.3) {
    return 'zh';
  }
  
  // 简单的英文检测
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  if (englishWords > 10) {
    return 'en';
  }
  
  return 'unknown';
}

// 智能内容摘要（基于段落和关键词）
export function generateContentSummary(content: string, maxLength: number = 300): string {
  if (!content || content.length <= maxLength) {
    return content;
  }

  // 按段落分割
  const paragraphs = content.split(/\n\s*\n|\. /).filter(p => p.trim().length > 20);
  
  if (paragraphs.length === 0) {
    return content.substring(0, maxLength) + '...';
  }

  // 选择最有意义的段落（通常是开头几段）
  let summary = '';
  for (const paragraph of paragraphs.slice(0, 3)) {
    if (summary.length + paragraph.length <= maxLength) {
      summary += paragraph + '. ';
    } else {
      break;
    }
  }

  return summary.trim() || content.substring(0, maxLength) + '...';
}

// 增强的网站元数据获取（包含内容分析）
export async function fetchEnhancedMetadata(url: string): Promise<ExtractedContent> {
  try {
    // 验证URL
    new URL(url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: AbortSignal.timeout(15000), // 15秒超时
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return extractMainContent(html, url);
  } catch (error) {
    console.error('获取增强元数据失败:', error);
    
    // 返回默认值
    try {
      const urlObj = new URL(url);
      return {
        title: urlObj.hostname,
        description: '',
        content: '',
        metadata: {
          wordCount: 0,
          language: 'unknown',
          readingTime: 0
        }
      };
    } catch {
      return {
        title: url,
        description: '',
        content: '',
        metadata: {
          wordCount: 0,
          language: 'unknown',
          readingTime: 0
        }
      };
    }
  }
} 