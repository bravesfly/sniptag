import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bookmark, Tag, TagPath } from "@/types";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
// --- 新增导入 ---
import { Button } from "./ui/button";
import { X } from "lucide-react";
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
// --- 结束 ---


export function BookmarkCard({
  bookmark,
  className,
  onDelete,
}: {
  bookmark: Bookmark;
  className?: string;
  onDelete?: (id: string) => void;
}) {




  const fallbackImage =
    bookmark.screenshot || "/placeholder.jpg";

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止卡片点击事件冒泡
    e.preventDefault();
    if (onDelete) {
      onDelete(bookmark.id.toString());
    }
  };

  return (
    <Card
      className={cn(
        "w-full cursor-pointer max-w-full transition-all duration-300 hover:shadow-lg p-0 gap-0",
        className
      )}

    >
      <CardHeader className=" p-0 max-w-full ">
        {/* --- 开始修改: 为图片和按钮添加一个相对定位的容器 --- */}
        <div className="relative group">
          <PhotoProvider>
            <PhotoView src={fallbackImage}>
              <img
                src={fallbackImage}
                alt={bookmark.title || "Bookmark"}
                className="rounded-t-lg w-full h-48 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "/placeholder.jpg";
                }}
              />
            </PhotoView>
          </PhotoProvider>


          {/* --- 新增的删除按钮 --- */}
          {onDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/30 text-white/80 backdrop-blur-sm hover:bg-black/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleDelete}
                >
                  <X size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>删除书签</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex items-start justify-between gap-3 px-4 py-2">
          <div className="flex-1 min-w-0 flex items-center">
            <img
              src={bookmark.favicon || "/favicon.ico"}
              alt="favicon"
              className="w-6 h-6 rounded-full shrink-0 mr-2"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/favicon.ico";
              }}
            />

            {/* 链接 */}
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-block" // 保持原来的下划线动效
              onClick={(e) => e.stopPropagation()}
            >
              <span
                className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors duration-200 line-clamp-1 leading-tight"
                title={bookmark.title || bookmark.url}
              >
                {bookmark.title ?? bookmark.url}
              </span>
              <span
                className="absolute -bottom-1 left-0 h-0.5 bg-primary w-0 group-hover:w-full transition-all duration-300"
                style={{ height: "3px" }}
              />
            </a>
          </div>

          {/* {isAuthenticated && onDelete && (
    <Button
      variant="ghost"
      size="sm"
      className="flex-shrink-0 h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
      onClick={handleDelete}
      aria-label="删除书签"
    >
      <X size={16} />
    </Button>
  )} */}
        </div>
      </CardHeader>

      <CardContent className="px-4 py-0">

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  <p className="line-clamp-3 leading-relaxed">
                    {bookmark.description}
                  </p>
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="w-128">
            <p className="text-sm">
              {bookmark.description}
            </p>
          </TooltipContent>
        </Tooltip>

      </CardContent>
      <CardFooter className="flex items-center px-4 py-3">
        <div className="min-w-0 flex-1">
          {
            bookmark.tagPaths && bookmark.tagPaths.length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                <Badge className="text-xs font-mono">
                  #{bookmark.tagPaths[0].path}
                </Badge>
              </div>
            ) : (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="flex gap-2 overflow-hidden">
                    {bookmark.tags?.map((tag, idx) => (
                      <Badge key={idx} className="text-xs font-mono shrink-0">
                        #{tag.name}
                      </Badge>
                    ))}
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="flex gap-2 flex-wrap">
                    {bookmark.tags?.map((tag, idx) => (
                      <Badge key={idx} className="text-xs font-mono">
                        #{tag.name}
                      </Badge>
                    ))}
                  </div>
                </HoverCardContent>
              </HoverCard>

            )
          }
        </div>

        <span className="ml-2 flex-shrink-0 text-sm text-muted-foreground">
          {new Date(bookmark.createdAt).toLocaleDateString("zh-CN")}
        </span>
      </CardFooter>
    </Card>
  );
}