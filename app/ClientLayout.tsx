"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/app/components/Sidebar";
import { Header } from "@/app/components/Header";
import { NotificationToast } from "@/app/components/NotificationToast";
import { AuthGuard } from "@/app/components/AuthGuard";
import { useAppStore } from "@/app/store";

export function ClientLayout({ children }: { children: ReactNode }) {
  const { sidebarOpen } = useAppStore();
  const pathname = usePathname();

  // Login page renders without shell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <Sidebar />
      <Header />
      <main
        className={`
          pt-16 min-h-screen transition-all duration-300
          ${sidebarOpen ? "pl-64" : "pl-[72px]"}
        `}
      >
        <div className="p-6 max-w-7xl mx-auto animate-fade-in">{children}</div>
      </main>
      <NotificationToast />
    </AuthGuard>
  );
}
