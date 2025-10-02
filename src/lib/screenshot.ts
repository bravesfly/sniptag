import { getCloudflareContext } from "@opennextjs/cloudflare";

interface StoreFileOptions {
  fileBuffer: ArrayBuffer;
  fileName: string; // 在 R2 中的完整路径和文件名，例如 'screenshots/abc-123.png'
  contentType: string; // 文件的 MIME 类型，例如 'image/png'
}
// 获取网站截图并存储到R2
// export async function captureAndStoreScreenshot(url: string): Promise<string | null> {
//   try {
//     const env = getCloudflareContext().env;
//     // 检查API密钥是否配置
//     if (!env.SCREENSHOT_API_KEY) {
//       console.warn('SCREENSHOT_API_KEY 未配置，跳过截图功能');
//       return null;
//     }

//     // 验证URL
//     new URL(url);

//     // 获取截图
//     const screenshotUrl = `${env.SCREENSHOT_API_URL}?url=${encodeURIComponent(url)}&key=${env.SCREENSHOT_API_KEY}`;

//     console.log('请求截图 URL:', screenshotUrl);

//     const response = await fetch(screenshotUrl, {
//       method: 'GET',
//       headers: {
//         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
//         'Accept': 'image/png,image/jpeg,image/*,*/*'
//       },
//       signal: AbortSignal.timeout(30000), // 30秒超时
//     });

//     console.log('截图API响应状态:', response.status);
//     console.log('截图API响应头:', Object.fromEntries(response.headers.entries()));

//     if (!response.ok) {
//       const errorText = await response.text().catch(() => 'Unknown error');
//       console.error('截图API错误详情:', errorText);
//       console.warn('截图获取失败，但继续处理书签创建');
//       return null; // 截图失败时返回null，不抛出错误
//     }

//     // 获取图片数据
//     const imageBuffer = await response.arrayBuffer();

//     if (imageBuffer.byteLength === 0) {
//       throw new Error('截图为空');
//     }

//     // 生成唯一文件名
//     const timestamp = Date.now();
//     const urlHash = await generateUrlHash(url);
//     const fileName = `screenshots/${urlHash}-${timestamp}.png`;

//     // 存储到R2

//     if (!env.R2_BUCKET) {
//       console.warn('R2_BUCKET 未配置，跳过截图存储（开发环境正常）');
//       return null;
//     }

//     await env.R2_BUCKET.put(fileName, imageBuffer, {
//       httpMetadata: {
//         contentType: 'image/png',
//       },
//     });

//     // 在开发环境中，简单返回文件路径，不生成完整URL
//     // 生产环境中需要配置正确的R2公共访问域名
//     console.log('截图已保存到R2:', fileName);

//     // 使用环境变量或默认URL返回截图地址
//     const baseUrl = process.env.R2_PUBLIC_URL || 'https://pub-26197e8276c64400a5f88fe08c069f87.r2.dev';
//     return `${baseUrl}/${fileName}`;

//   } catch (error) {
//     console.error('获取截图失败:', error);
//     // 在开发环境下，我们暂时跳过截图功能
//     // 生产环境中可以根据需要调整策略
//     return null;
//   }
// }

// 生成URL的哈希值作为文件名的一部分
export async function generateUrlHash(url: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(url);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 16); // 取前16位
  } catch (error) {
    // 如果crypto不可用，使用简单的哈希
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(16);
  }
}

// 删除R2中的截图
export async function deleteScreenshot(screenshotUrl: string): Promise<boolean> {
  try {
    if (!screenshotUrl || !screenshotUrl.includes('screenshots/')) {
      return false;
    }

    // 从URL中提取文件路径
    const urlParts = screenshotUrl.split('/');
    const fileIndex = urlParts.findIndex(part => part === 'screenshots');

    if (fileIndex === -1 || fileIndex >= urlParts.length - 1) {
      return false;
    }

    const fileName = urlParts.slice(fileIndex).join('/');

    const { env } = getCloudflareContext();
    if (!env.FILES) {
      console.warn('R2_BUCKET 未配置，无法删除截图');
      return false;
    }

    await env.FILES.delete(fileName);
    return true;

  } catch (error) {
    console.error('删除截图失败:', error);
    return false;
  }
}
export async function storeFileInR2({ fileBuffer, fileName, contentType }: StoreFileOptions): Promise<string | null> {
  try {
    const env = getCloudflareContext().env;

    if (!env.FILES) {
      console.warn('R2_BUCKET 未配置，跳过文件存储');
      return null;
    }

    if (!fileBuffer || fileBuffer.byteLength === 0) {
      console.error('文件缓冲区为空，无法上传');
      return null;
    }

    // 将文件上传到 R2
    await env.FILES.put(fileName, fileBuffer, {
      httpMetadata: {
        contentType: contentType,
        // 你还可以在这里添加其他元数据，比如 cacheControl
        // cacheControl: 'public, max-age=31536000', 
      },
    });

    console.log(`文件已成功保存到 R2: ${fileName}`);

    return `${env.CLOUDFLARE_R2_URL}/${fileName}`;

  } catch (error) {
    console.error(`存储文件到 R2 失败: ${fileName}`, error);
    return null;
  }
}

// 第一部分：只负责获取截图
async function fetchScreenshot(url: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const env = getCloudflareContext().env;
  if (!env.SCREENSHOT_API_KEY) {
    console.warn('SCREENSHOT_API_KEY 未配置，跳过截图功能');
    return null;
  }

  const screenshotUrl = `${env.SCREENSHOT_API_URL}?url=${encodeURIComponent(url)}&key=${env.SCREENSHOT_API_KEY}`;
  const response = await fetch(screenshotUrl, {
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`截图API错误: ${response.status}`, errorText);
    return null;
  }

  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'image/png'; // 动态获取类型

  return { buffer, contentType };
}


// 第二部分：重构后的主函数，负责编排
/**
 * 捕获给定URL的截图并将其存储到R2。
 * @param url 要截图的网站URL。
 * @returns 存储成功后截图的公开访问URL，失败则返回 null。
 */
export async function captureAndStoreScreenshot(url: string): Promise<string | null> {
  try {
    // 步骤1: 验证URL
    new URL(url);

    // 步骤2: 获取截图数据
    const screenshotData = await fetchScreenshot(url);
    if (!screenshotData) {
      console.warn('获取截图失败，继续执行后续操作');
      return null;
    }

    // 步骤3: 生成唯一文件名
    const urlHash = await generateUrlHash(url);
    const fileName = `screenshots/${urlHash}-${Date.now()}.png`;

    // 步骤4: 调用通用存储函数来保存截图
    const publicUrl = await storeFileInR2({
      fileBuffer: screenshotData.buffer,
      fileName: fileName,
      contentType: screenshotData.contentType,
    });

    return publicUrl;

  } catch (error) {
    // 这个 catch 现在主要捕获 URL 验证错误或哈希生成错误
    console.error(`在 captureAndStoreScreenshot 流程中发生错误 for url: ${url}`, error);
    return null;
  }
}

/**
 * 处理base64编码的图片数据并保存到R2
 * @param base64Data base64编码的图片数据（包含或不包含数据URL前缀）
 * @param url 原始URL，用于生成文件名
 * @returns 保存成功后的公开访问URL，失败则返回null
 */
export async function processAndStoreBase64Image(base64Data: string, url: string): Promise<string | null> {
  try {
    // 清理base64数据，移除可能的数据URL前缀
    let cleanBase64 = base64Data;
    if (base64Data.includes(',')) {
      cleanBase64 = base64Data.split(',')[1];
    }

    // 验证base64格式
    if (!cleanBase64 || cleanBase64.length === 0) {
      console.error('base64数据为空');
      return null;
    }

    // 将base64转换为ArrayBuffer
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const fileBuffer = bytes.buffer;

    // 检测图片类型（简单检测）
    let contentType = 'image/png'; // 默认为PNG
    if (base64Data.includes('data:image/')) {
      const typeMatch = base64Data.match(/data:image\/([^;]+)/);
      if (typeMatch) {
        contentType = `image/${typeMatch[1]}`;
      }
    }

    // 生成唯一文件名
    const urlHash = await generateUrlHash(url);
    const timestamp = Date.now();
    const extension = contentType.split('/')[1] || 'png';
    const fileName = `screenshots/${urlHash}-${timestamp}.${extension}`;

    // 调用通用存储函数保存图片
    const publicUrl = await storeFileInR2({
      fileBuffer: fileBuffer,
      fileName: fileName,
      contentType: contentType,
    });

    console.log(`base64图片已保存到R2: ${fileName}`);
    return publicUrl;

  } catch (error) {
    console.error('处理base64图片失败:', error);
    return null;
  }
}