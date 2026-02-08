"use client";

import { Bell, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/app/store";
import { WalletConnect } from "@/app/components/WalletConnect";
import { Badge } from "@/app/components/ui/Badge";
import { Role } from "@/src/contract/types";

const roleLabels: Record<Role, { label: string; variant: "accent" | "success" | "warning" | "muted" }> = {
  [Role.ADMIN]: { label: "Admin", variant: "accent" },
  [Role.HR]: { label: "HR Operator", variant: "success" },
  [Role.EMPLOYEE]: { label: "Employee", variant: "muted" },
  [Role.AUDITOR]: { label: "Auditor", variant: "warning" },
};

export function Header() {
  const { role, user, logout, notifications, sidebarOpen } = useAppStore();
  const router = useRouter();
  const unread = notifications.length;
  const roleInfo = roleLabels[role];

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header
      className={`
        fixed top-0 right-0 z-30 h-16
        bg-echo-bg/80 backdrop-blur-xl border-b border-echo-border
        flex items-center justify-between px-6
        transition-all duration-300
        ${sidebarOpen ? "left-64" : "left-[72px]"}
      `}
    >
      {/* Left side — user info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-echo-accent/20 flex items-center justify-center">
            <User className="w-4 h-4 text-echo-accent" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white leading-tight">
              {user?.displayName ?? "Unknown"}
            </span>
            <span className="text-xs text-echo-muted leading-tight">
              @{user?.username ?? "—"}
            </span>
          </div>
          <Badge variant={roleInfo.variant} dot>
            {roleInfo.label}
          </Badge>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-echo-muted hover:text-white hover:bg-echo-surface transition-all">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-echo-danger rounded-full text-[10px] font-bold flex items-center justify-center text-white">
              {unread}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-echo-border" />

        {/* Wallet */}
        <WalletConnect />

        {/* Divider */}
        <div className="w-px h-8 bg-echo-border" />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                     text-echo-muted hover:text-echo-danger hover:bg-echo-danger/10
                     transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
