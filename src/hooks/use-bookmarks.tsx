"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Bookmark, ApiResponse } from "@/types";
// import { useAuth } from "@/hooks/use-auth";

interface BookmarkFilters {
  search?: string;
  tagId?: number;
  menuPath?: string;
  limit?: number;
  offset?: number;
}

interface BookmarksContextType {
  bookmarks: Bookmark[];
  loading: boolean;
  error: string | null;
  selectedTagIds: number[];
  selectedMenuPath: string | null;
  searchTerm: string;
  fetchBookmarks: (filters?: BookmarkFilters) => Promise<void>;
  addBookmark: (bookmark: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'tagPaths'>) => Promise<ApiResponse<Bookmark>>;
  deleteBookmark: (id: number) => Promise<ApiResponse<Bookmark>>;

  setSelectedTagIds: (tagIds: number[]) => void;
  setSelectedMenuPath: (path: string | null) => void;
  setSearchTerm: (term: string) => void;
  clearFilters: () => void;
  handleTagSelect: (tagId: number) => void;
  handleMenuSelect: (path: string) => void;
}

const BookmarksContext = createContext<BookmarksContextType | undefined>(undefined);

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedMenuPath, setSelectedMenuPath] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");


  const fetchBookmarks = useCallback(async (filters: BookmarkFilters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();

      if (filters.search) searchParams.append('search', filters.search);
      if (filters.tagId) searchParams.append('tagId', filters.tagId.toString());
      if (filters.menuPath) searchParams.append('menuPath', filters.menuPath);
      if (filters.limit) searchParams.append('limit', filters.limit.toString());
      if (filters.offset) searchParams.append('offset', filters.offset.toString());

      const response = await fetch(`/api/bookmarks?${searchParams}`);
      const data: ApiResponse<Bookmark[]> = await response.json();

      if (data.success && data.data) {
        setBookmarks(data.data);
      } else {
        setError(data.error || "获取书签失败");
        setBookmarks([]);
      }
    } catch (error: any) {
      setError(error.message || "网络错误");
      setBookmarks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // const addBookmark = useCallback(async (bookmark: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'tagPaths'>) => {
  // try {
  //   // const authHeaders = getAuthHeader();

  //   const response = await fetch('/api/bookmarks', {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       // ...authHeaders,
  //     },
  //     body: JSON.stringify(bookmark),
  //   });

  //   const data: ApiResponse<Bookmark> = await response.json();

  //   // 如果认证失败，返回具体错误
  //   if (response.status === 401) {
  //     console.error('添加书签认证失败，可能需要重新登录');
  //     return { success: false, error: "认证失败，请重新登录" };
  //   }

  //   return data;
  // } catch (error: any) {
  //   console.error('添加书签请求失败:', error);
  //   return { success: false, error: error.message || "添加书签失败" };
  // }
  // }, [getAuthHeader]);

  // const deleteBookmark = useCallback(async (id: number) => {
  //   try {
  //     const authHeaders = getAuthHeader();

  //     const response = await fetch(`/api/bookmarks?id=${id}`, {
  //       method: 'DELETE',
  //       headers: {
  //         ...authHeaders,
  //       },
  //     });

  //     if (response.status === 401) {
  //       console.error('删除书签认证失败');
  //       throw new Error('认证失败，请重新登录');
  //     }

  //     if (response.ok) {
  //       setBookmarks(prev => prev.filter(bookmark => bookmark.id !== id));
  //     } else {
  //       const errorData = await response.json() as { error?: string };
  //       throw new Error(errorData.error || '删除失败');
  //     }
  //   } catch (error: any) {
  //     console.error('删除书签失败:', error);
  //     throw error; // 重新抛出错误，让调用方处理
  //   }
  // }, [getAuthHeader]);

  const handleTagSelect = useCallback((tagId: number) => {
    setSelectedTagIds(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
    setSelectedMenuPath(null);
  }, []);

  const handleMenuSelect = useCallback((path: string) => {
    setSelectedMenuPath(prev => prev === path ? null : path);
    setSelectedTagIds([]);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedTagIds([]);
    setSelectedMenuPath(null);
    setSearchTerm("");
  }, []);
  const addBookmark = useCallback(async (bookmark: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'tagPaths'>): Promise<ApiResponse<Bookmark>> => {
    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookmark),
      });

      const data: ApiResponse<Bookmark> = await response.json();

      if (response.status === 401) {
        console.error('添加书签认证失败，可能需要重新登录');
        return { success: false, error: "认证失败，请重新登录" };
      }
      
      if (data.success && data.data) {
        setBookmarks(prev => [data.data!, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }

      return data;
    } catch (error: any) {
      console.error('添加书签请求失败:', error);
      return { success: false, error: error.message || "添加书签失败" };
    }
  }, []);

  const deleteBookmark = useCallback(async (id: number): Promise<ApiResponse<any>> => {
    try {
      const response = await fetch(`/api/bookmarks?id=${id}`, {
        method: 'DELETE',
      });

      const data: ApiResponse<any> = await response.json();

      if (response.status === 401) {
        console.error('删除书签认证失败');
        return { success: false, error: "认证失败，请重新登录" };
      }

      if (data.success) {
        setBookmarks(prev => prev.filter(bookmark => bookmark.id !== id));
      }
      
      return data;
    } catch (error: any) {
      console.error('删除书签失败:', error);
      return { success: false, error: error.message || "删除书签失败" };
    }
  }, []);
  const value: BookmarksContextType = {
    bookmarks,
    loading,
    error,
    selectedTagIds,
    selectedMenuPath,
    searchTerm,
    fetchBookmarks,
    addBookmark,
    deleteBookmark,
    setSelectedTagIds,
    setSelectedMenuPath,
    setSearchTerm,
    clearFilters,
    handleTagSelect,
    handleMenuSelect,
  };

  return (
    <BookmarksContext.Provider value={value}>
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks() {
  const context = useContext(BookmarksContext);
  if (context === undefined) {
    throw new Error('useBookmarks must be used within a BookmarksProvider');
  }
  return context;
} 