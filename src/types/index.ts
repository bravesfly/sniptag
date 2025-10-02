// 标签类型（支持树形结构）
export interface Tag {
  id: number;
  name: string;
  parentId?: number | null;
  level: number; // 1, 2, 3
  path: string; // 完整路径，如：Frontend/Framework/Vue
  color?: string | null;
  createdAt: Date;
  updatedAt: Date;
  children?: Tag[]; // 子标签（用于构建树形结构）
}

// 标签路径类型
export interface TagPath {
  path: string; // 如：Frontend/Framework/Vue
  tags: Tag[]; // 路径中的所有标签，从根到叶
  leafTag: Tag; // 叶子节点标签
}

// 书签类型
export interface Bookmark {
  id: number;
  title?: string | null;
  url: string;
  description?: string | null;
  favicon?: string | null;
  screenshot?: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: Tag[]; // 扁平化的所有标签（去重）
  tagPaths: TagPath[]; // 多个标签路径，如：[Frontend/Framework/Vue, Frontend/UI/Components]
}

// 新建标签类型
export interface NewTag {
  name: string;
  color?: string | null;
}

// 新建书签类型
export interface NewBookmark {
  title?: string | null;
  url: string;
  description?: string | null;
  favicon?: string | null;
  screenshot?: string | null;
  tagIds?: number[];
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 书签查询参数
export interface BookmarkQuery {
  search?: string;
  tagId?: number;
  limit?: number;
  offset?: number;
} 