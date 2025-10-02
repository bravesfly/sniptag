import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BookmarksProvider } from "@/hooks/use-bookmarks";
import { getSession } from "@/modules/auth/utils/auth-utils";
import DashboardLayout from "@/modules/dashboard/dashboard.layout";

export default async function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();
    const user = session?.user;
    return <DashboardLayout><BookmarksProvider>
        <SidebarProvider>
            <AppSidebar user={user} />
            <SidebarInset>
                {children}
            </SidebarInset>
        </SidebarProvider>
    </BookmarksProvider></DashboardLayout>;
}
