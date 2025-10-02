// 网站元信息类型
export interface WebsiteMetadata {
  title?: string;
  description?: string;
  favicon?: string;
}

// 从HTML中提取元信息
export function extractMetadata(html: string, url: string): WebsiteMetadata {
  const metadata: WebsiteMetadata = {};

  // 提取title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    metadata.title = titleMatch[1].trim();
  }

  // 提取description (优先meta description)
  const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                           html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  if (descriptionMatch && descriptionMatch[1]) {
    metadata.description = descriptionMatch[1].trim();
  }

  // 提取favicon (多种可能的格式)
  const faviconMatches = [
    html.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']*)["'][^>]*>/i),
    html.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']icon["'][^>]*>/i),
    html.match(/<link[^>]*rel=["']shortcut icon["'][^>]*href=["']([^"']*)["'][^>]*>/i),
    html.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']shortcut icon["'][^>]*>/i),
  ];

  for (const match of faviconMatches) {
    if (match && match[1]) {
      let faviconUrl = match[1].trim();
      
      // 处理相对URL
      if (faviconUrl.startsWith('//')) {
        faviconUrl = new URL(url).protocol + faviconUrl;
      } else if (faviconUrl.startsWith('/')) {
        faviconUrl = new URL(url).origin + faviconUrl;
      } else if (!faviconUrl.startsWith('http')) {
        faviconUrl = new URL(faviconUrl, url).href;
      }
      
      metadata.favicon = faviconUrl;
      break;
    }
  }

  // 如果没有找到favicon，尝试默认位置
  if (!metadata.favicon) {
    try {
      const urlObj = new URL(url);
      metadata.favicon = `${urlObj.origin}/favicon.ico`;
    } catch (error) {
      // 忽略URL解析错误
    }
  }

  return metadata;
}

// 获取网站元信息
export async function fetchWebsiteMetadata(url: string): Promise<WebsiteMetadata> {
  try {
    // 验证URL
    new URL(url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000), // 10秒超时
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return extractMetadata(html, url);
  } catch (error) {
    console.error('获取网站元信息失败:', error);
    
    // 返回默认值
    try {
      const urlObj = new URL(url);
      return {
        title: urlObj.hostname,
        description: undefined,
        favicon: `${urlObj.origin}/favicon.ico`,
      };
    } catch {
      return {
        title: url,
        description: undefined,
        favicon: undefined,
      };
    }
  }
} 