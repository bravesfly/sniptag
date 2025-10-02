"use client";

import { useState, useEffect } from "react";
import { Tag, NewTag, ApiResponse } from "@/types";

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取标签列表
  const fetchTags = async (search?: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);

      const url = `/api/tags${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = (await response.json()) as ApiResponse<Tag[]>;
        if (data.success && data.data) {
          setTags(data.data);
        }
      } else {
        const errorData = (await response.json()) as ApiResponse;
        setError(errorData.error || "获取标签失败");
      }
    } catch (error) {
      console.error("Fetch tags error:", error);
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  // 添加标签
  const addTag = async (tag: NewTag) => {
    setError(null);
    
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tag),
      });

      if (response.ok) {
        const data = (await response.json()) as ApiResponse<Tag>;
        if (data.success && data.data) {
          setTags(prev => [...prev, data.data!]);
          return { success: true, tag: data.data };
        }
      } else {
        const errorData = (await response.json()) as ApiResponse;
        setError(errorData.error || "添加标签失败");
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error("Add tag error:", error);
      setError("网络错误");
      return { success: false, error: "网络错误" };
    }

    return { success: false, error: "未知错误" };
  };

  // 更新标签
  const updateTag = async (id: number, tag: Partial<NewTag>) => {
    setError(null);
    
    try {
      const response = await fetch(`/api/tags?id=${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tag),
      });

      if (response.ok) {
        const data = (await response.json()) as ApiResponse<Tag>;
        if (data.success && data.data) {
          setTags(prev => 
            prev.map(t => t.id === id ? data.data! : t)
          );
          return { success: true, tag: data.data };
        }
      } else {
        const errorData = (await response.json()) as ApiResponse;
        setError(errorData.error || "更新标签失败");
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error("Update tag error:", error);
      setError("网络错误");
      return { success: false, error: "网络错误" };
    }

    return { success: false, error: "未知错误" };
  };

  // 删除标签
  const deleteTag = async (id: number) => {
    setError(null);
    
    try {
      const response = await fetch(`/api/tags?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const data = (await response.json()) as ApiResponse;
        if (data.success) {
          setTags(prev => prev.filter(t => t.id !== id));
          return { success: true };
        }
      } else {
        const errorData = (await response.json()) as ApiResponse;
        setError(errorData.error || "删除标签失败");
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error("Delete tag error:", error);
      setError("网络错误");
      return { success: false, error: "网络错误" };
    }

    return { success: false, error: "未知错误" };
  };

  // 初始加载
  useEffect(() => {
    fetchTags();
  }, []);

  return {
    tags,
    loading,
    error,
    fetchTags,
    addTag,
    updateTag,
    deleteTag,
  };
} 