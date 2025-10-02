import { redirect } from "next/navigation";
import { Navigation } from "@/components/navigation";

import { getSession } from "@/modules/auth/utils/auth-utils";
import { BookmarksProvider } from "@/hooks/use-bookmarks";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import authRoutes from "../auth/auth.route";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    if (!session) {
        redirect(authRoutes.login);
    }

    return (
        <>{children}</>

    );
}
