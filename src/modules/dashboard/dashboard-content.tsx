"use client"

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { BookmarkCard } from "@/components/bookmark-card"
import { Separator } from "@/components/ui/separator"
import {
    SidebarTrigger,
} from "@/components/ui/sidebar"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
// import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Search, X } from "lucide-react"
import { useState, useEffect } from "react"
import { useBookmarks } from "@/hooks/use-bookmarks"


export default function DashboardContent() {
    const {
        bookmarks,
        loading,
        error,
        fetchBookmarks,
        addBookmark,
        deleteBookmark,
        selectedTagIds,
        selectedMenuPath,
        searchTerm,
        setSearchTerm,
        clearFilters,
    } = useBookmarks();
    // const { isAuthenticated } = useAuth();

    const [showAddDialog, setShowAddDialog] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [addError, setAddError] = useState("");

    const [newBookmark, setNewBookmark] = useState({
        url: "",
        title: "",
        description: "",
    });

    // 当筛选条件改变时，自动搜索
    useEffect(() => {
        handleSearch();
    }, [selectedTagIds, selectedMenuPath]);

    // 初始加载数据
    useEffect(() => {
        handleSearch();
    }, []);

    const handleSearch = () => {
        const searchParams: any = {};

        if (searchTerm.trim()) {
            searchParams.search = searchTerm;
        }

        // 如果有选中的标签，按标签搜索（多个标签时取交集）
        if (selectedTagIds.length > 0) {
            // 后端需要支持多标签筛选，这里先使用第一个标签
            searchParams.tagId = selectedTagIds[0];
        }

        // 如果有选中的菜单路径，按路径搜索
        if (selectedMenuPath) {
            searchParams.menuPath = selectedMenuPath;
        }

        fetchBookmarks(searchParams);
    };

    const handleAddBookmark = async () => {
        if (!newBookmark.url.trim() || isAdding) return;

        setIsAdding(true);
        setAddError("");

        try {
            const result = await addBookmark({
                url: newBookmark.url.trim(),
                title: newBookmark.title.trim() || undefined,
                description: newBookmark.description.trim() || undefined,
            });

            if (result.success) {
                setShowAddDialog(false);
                resetAddForm();
                // 刷新书签列表
                handleSearch();
            } else {
                setAddError(result.error || "添加书签失败");
            }
        } catch (error: any) {
            setAddError(error.message || "添加书签时发生错误");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteBookmark = async (id: string) => {
        try {
            await deleteBookmark(Number(id));
            // 刷新书签列表
            handleSearch();
        } catch (error: any) {
            // 处理删除错误
            if (error.message?.includes('认证失败')) {
                alert('认证已过期，请重新登录');
                // 可以触发重新登录逻辑
            } else {
                alert(`删除失败: ${error.message}`);
            }
        }
    };

    const resetAddForm = () => {
        setNewBookmark({ url: "", title: "", description: "" });
        setAddError("");
        setIsAdding(false);
    };

    const closeDialog = () => {
        setShowAddDialog(false);
        resetAddForm();
    };
    return (
        <>
            <header className="flex h-16 shrink-0 items-center gap-2">
                <div className="flex items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                    />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="#">
                                    书签收藏
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>所有书签</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                {/* 搜索和添加区域 */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 flex items-center gap-2">
                        <Input
                            placeholder="搜索书签..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch}>
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>
                    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                添加书签
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>添加新书签</DialogTitle>
                                <DialogDescription>
                                    输入URL是必需的。标题和描述是可选的，如果留空将自动获取网站信息。
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                {/* 错误提示 */}
                                {addError && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                                        {addError}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="url">URL *</Label>
                                    <Input
                                        id="url"
                                        placeholder="https://example.com"
                                        value={newBookmark.url}
                                        onChange={(e) => setNewBookmark(prev => ({ ...prev, url: e.target.value }))}
                                        disabled={isAdding}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="title">标题 (可选)</Label>
                                    <Input
                                        id="title"
                                        placeholder="自定义标题，留空则自动获取"
                                        value={newBookmark.title}
                                        onChange={(e) => setNewBookmark(prev => ({ ...prev, title: e.target.value }))}
                                        disabled={isAdding}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">描述 (可选)</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="自定义描述，留空则自动获取"
                                        value={newBookmark.description}
                                        onChange={(e) => setNewBookmark(prev => ({ ...prev, description: e.target.value }))}
                                        disabled={isAdding}
                                        rows={3}
                                    />
                                </div>

                                {/* 添加说明 */}
                                {isAdding && (
                                    <div className="text-sm text-muted-foreground bg-blue-50 border border-blue-200 px-3 py-2 rounded">
                                        正在处理中，这可能需要几秒钟时间来获取网站信息和AI分析标签...
                                    </div>
                                )}
                            </div>

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={closeDialog}
                                    disabled={isAdding}
                                >
                                    取消
                                </Button>
                                <Button
                                    onClick={handleAddBookmark}
                                    disabled={isAdding || !newBookmark.url.trim()}
                                >
                                    {isAdding ? "添加中..." : "添加书签"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* 当前筛选条件显示 */}
                {(selectedTagIds.length > 0 || selectedMenuPath || searchTerm) && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-sm font-medium text-blue-700">当前筛选:</span>
                        {searchTerm && (
                            <Badge variant="secondary">
                                搜索: {searchTerm}
                            </Badge>
                        )}
                        {selectedTagIds.length > 0 && (
                            <Badge variant="secondary">
                                标签数量: {selectedTagIds.length}
                            </Badge>
                        )}
                        {selectedMenuPath && (
                            <Badge variant="secondary">
                                目录: {selectedMenuPath}
                            </Badge>
                        )}
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            <X className="h-3 w-3 mr-1" />
                            清除筛选
                        </Button>
                    </div>
                )}

                {/* 错误提示 */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
                        {error}
                    </div>
                )}

                {/* 书签列表 */}
                {loading ? (
                    <div className="text-center py-8">加载中...</div>
                ) : (
                    <div className="grid auto-rows-min gap-4 md:grid-cols-4">
                        {bookmarks.map((bookmark: any) => (
                            <BookmarkCard
                                key={bookmark.id}
                                bookmark={bookmark}
                                className="bg-muted/50  rounded-xl"
                                onDelete={(id) => {
                                    handleDeleteBookmark(id)
                                }}
                            />
                        ))}
                    </div>
                )}

                {!loading && bookmarks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        {selectedTagIds.length > 0 || selectedMenuPath || searchTerm ? "没有找到匹配的书签" : "暂无书签"}
                    </div>
                )}
            </div>
        </>
    );
}
