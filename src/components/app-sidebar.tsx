"use client"

import * as React from "react"
import { useState } from "react"
import {
  BookOpen,
  X,
  Menu,
  ChevronRight,
  Tags
} from "lucide-react"
import { NavUser } from "@/components/nav-user"
import { useTags } from "@/hooks/use-tags"
// import { useAuth } from "@/hooks/use-auth"
import { useBookmarks } from "@/hooks/use-bookmarks"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Tag } from "@/types"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { getSession } from "@/modules/auth/utils/auth-utils"
import { authClient } from "@/modules/auth/utils/auth-client"

/**
 * 通用版本：把扁平数组转成森林（多棵树）
 * 适用于 parentId 为 null/undefined 的节点可能有多条
 */
function flatToForest<T extends { id: number; parentId?: number | null }>(
  list: T[],
): (T & { children: T[] })[] {
  // 建立 id -> node 的映射
  const map = new Map<number, T & { children: T[] }>();

  // 先把每个节点包装成带 children 的对象
  for (const item of list) {
    map.set(item.id, { ...item, children: [] });
  }

  const roots: (T & { children: T[] })[] = [];

  // 再遍历一遍，挂到父节点下面
  for (const item of list) {
    const node = map.get(item.id)!;
    if (item.parentId == null) {
      // parentId 为 null/undefined 的作为根节点
      roots.push(node);
    } else {
      const parent = map.get(item.parentId);
      if (parent) {
        parent.children.push(node);
      }
    }
  }

  return roots;
}


// 分离单一标签和菜单标签
function separateTagsAndMenus(tagsWithChildren: (Tag & { children: Tag[] })[]) {
  const singleTags: Tag[] = [];
  const menuTags: (Tag & { children: Tag[] })[] = [];

  tagsWithChildren.forEach(tag => {
    // 判断是否为单一节点：没有父节点、没有子节点、且名称不包含路径分隔符
    const isHierarchical = tag.name.includes('/') || tag.path.includes('/');

    if (!tag.parentId && tag.children.length === 0 && !isHierarchical) {
      singleTags.push(tag);
    } else {
      // 有子节点、有父节点或者是层级结构的作为菜单
      menuTags.push(tag);
    }
  });

  return { singleTags, menuTags };
}

// 递归渲染菜单项组件
function MenuTagItem({
  tag,
  level = 0,
  selectedMenuPath,
  onMenuSelect,
}: {
  tag: Tag & { children?: Tag[] },
  level?: number,
  selectedMenuPath?: string | null,
  onMenuSelect?: (path: string) => void,
}) {
  const hasChildren = tag.children && tag.children.length > 0;
  const isSelected = selectedMenuPath === tag.path;

  // 如果是根级别，使用 SidebarMenuItem
  if (level === 0) {
    return (
      <Collapsible key={tag.id} asChild defaultOpen={false}>
        <SidebarMenuItem>
          <SidebarMenuButton
            className={`cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${isSelected ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
              }`}
            onClick={() => {
              onMenuSelect?.(tag.path);
            }}
          >
            <BookOpen className="h-4 w-4" />
            <span className="truncate">{tag.name}</span>
          </SidebarMenuButton>

          {hasChildren && (
            <>
              <CollapsibleTrigger asChild>
                <SidebarMenuAction className="data-[state=open]:rotate-90">
                  <ChevronRight />
                  <span className="sr-only">展开</span>
                </SidebarMenuAction>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {tag.children?.map((childTag) => (
                    <MenuTagItem
                      key={childTag.id}
                      tag={childTag}
                      level={level + 1}
                      selectedMenuPath={selectedMenuPath}
                      onMenuSelect={onMenuSelect}
                    />
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </>
          )}
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  // 子级别，使用 SidebarMenuSubItem
  return (
    <Collapsible key={tag.id} asChild defaultOpen={false}>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          className={`cursor-pointer ${isSelected ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
            }`}
          onClick={() => {
            onMenuSelect?.(tag.path);
          }}
        >
          <span>{tag.name}</span>
        </SidebarMenuSubButton>

        {hasChildren && (
          <>
            <CollapsibleTrigger asChild>
              <SidebarMenuAction className="data-[state=open]:rotate-90 h-3 w-3">
                <ChevronRight />
                <span className="sr-only">展开</span>
              </SidebarMenuAction>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {tag.children?.map((childTag) => (
                  <MenuTagItem
                    key={childTag.id}
                    tag={childTag}
                    level={level + 1}
                    selectedMenuPath={selectedMenuPath}
                    onMenuSelect={onMenuSelect}
                  />
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </>
        )}
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

export function AppSidebar({ user, ...props }: { user: any } & React.ComponentProps<typeof Sidebar>) {
  const { tags, loading: tagsLoading } = useTags();

  const {
    selectedTagIds,
    selectedMenuPath,
    handleTagSelect,
    handleMenuSelect
  } = useBookmarks();

  const [showSettings, setShowSettings] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // 登录表单状态
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState("");

  // 构建树形结构并分离标签和菜单
  const tagsWithChildren = flatToForest(tags);
  const { singleTags, menuTags } = separateTagsAndMenus(tagsWithChildren);

  const handleLogout = async () => {
    const result = await authClient.signOut();
    console.log(result);

    if (result && result.data && result.data.success) {
      toast("退出登录", {
        description: "您已成功退出登录",
      });
      window.location.href = '/login';
    }
  };

  const handleSettings = () => {
    window.location.href = '/dashboard/settings';
  };

  const handleLogin = async (e: React.FormEvent) => {
    // e.preventDefault();
    // setLoginLoading(true);
    // setError("");

    // const result = await login(email, password);
    // console.log('result', result);

    // if (result.success) {
    //   // 显示成功 toast
    //   toast("登录成功", {
    //     description: `欢迎回来，${email}！`,
    //   });

    //   // 关闭 modal 并清空表单
    //   setShowLogin(false);
    //   setEmail("");
    //   setPassword("");
    // } else {
    //   setError(result.error || "登录失败");

    //   // 显示错误 toast
    //   toast.error("登录失败", {
    //     description: result.error || "请检查邮箱和密码",
    //   });
    // }

    // setLoginLoading(false);
  };

  const closeLogin = () => {
    setShowLogin(false);
    setEmail("");
    setPassword("");
    setError("");
  };

  return (
    <>

      <Sidebar variant="inset" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/">
                  <Avatar>
                    <AvatarImage src="/icon.png" />
                    <AvatarFallback>ST</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-lg leading-tight">
                    <span className="truncate font-medium">Sniptag</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <ScrollArea className=" h-full">
            {tagsLoading ? (
              <div className="p-4 text-sm text-muted-foreground">加载标签中...</div>
            ) : (
              <Accordion type="multiple" defaultValue={["menus"]} className="w-full">
                {/* 菜单结构部分 */}
                {menuTags.length > 0 && (
                  <AccordionItem value="menus">
                    <AccordionTrigger className="px-4 py-2 font-medium text-base">
                      <div className="flex items-center gap-2">
                        <Menu className="h-4 w-4" />
                        <span>目录 ({menuTags.length})</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <SidebarGroup>
                        <SidebarMenu>
                          {menuTags.map((tag) => (
                            <MenuTagItem
                              key={tag.id}
                              tag={tag}
                              selectedMenuPath={selectedMenuPath}
                              onMenuSelect={handleMenuSelect}
                            />
                          ))}
                        </SidebarMenu>
                      </SidebarGroup>
                    </AccordionContent>
                  </AccordionItem>
                )}
                {/* 单一标签部分 */}
                {singleTags.length > 0 && (
                  <AccordionItem value="tags">
                    <AccordionTrigger className="px-4 py-2 font-medium text-base">

                      <div className="flex items-center gap-2">
                        <Tags className="h-4 w-4" />
                        标签 ({singleTags.length})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          {singleTags.map((tag) => {
                            const isSelected = selectedTagIds.includes(tag.id);
                            return (
                              <Badge
                                key={tag.id}
                                variant={isSelected ? "default" : "secondary"}
                                className="cursor-pointer "
                                onClick={() => handleTagSelect(tag.id)}
                              >
                                #{tag.name}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}



                {/* 空状态 */}
                {singleTags.length === 0 && menuTags.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    暂无标签数据
                  </div>
                )}
              </Accordion>
            )}
          </ScrollArea>

        </SidebarContent>
        <SidebarFooter>
          {/* <NavUser
                user={user}
                onSettings={handleSettings}
                onLogout={handleLogout}
              /> */}
          {/* <div>footer</div> */}
          {!user ? (
            <div >
              <Button className="w-full" onClick={() => setShowLogin(true)}>
                登录
              </Button>
            </div>
          ) : (
            user && (
              <NavUser
                user={user}
                onSettings={handleSettings}
                onLogout={handleLogout}
              />
            )
          )}
          {/* <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} /> */}
        </SidebarFooter>
      </Sidebar>



      {/* 登录 Modal - 直接在这里实现 */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-lg border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">登录</h2>
              <Button variant="ghost" size="sm" onClick={closeLogin}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin123"
                  required
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={loginLoading} className="flex-1">
                  {loginLoading ? "登录中..." : "登录"}
                </Button>
                <Button type="button" variant="outline" onClick={closeLogin}>
                  取消
                </Button>
              </div>
            </form>

            {/* <div className="mt-4 text-sm text-gray-600">
              <p>默认账号：admin@example.com</p>
              <p>默认密码：admin123</p>
              <p className="text-red-600 font-medium">⚠️ 请使用正确的密码：admin123</p>
            </div> */}
          </div>
        </div>
      )}
    </>
  );
}
