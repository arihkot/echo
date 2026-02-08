"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Banknote,
  MessageSquareText,
  BarChart3,
  LayoutDashboard,
  Shield,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import { useAppStore } from "@/app/store";
import { Badge } from "@/app/components/ui/Badge";
import { Role } from "@/src/contract/types";

const roleBadgeVariant: Record<Role, "accent" | "success" | "warning" | "muted"> = {
  [Role.ADMIN]: "accent",
  [Role.HR]: "success",
  [Role.EMPLOYEE]: "muted",
  [Role.AUDITOR]: "warning",
};

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Overview & status",
  },
  {
    href: "/organization",
    label: "Organization",
    icon: Building2,
    description: "Manage employees & roles",
  },
  {
    href: "/salary",
    label: "Salary",
    icon: Banknote,
    description: "Payments & receipts",
  },
  {
    href: "/reviews",
    label: "Reviews",
    icon: MessageSquareText,
    description: "Anonymous feedback",
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    description: "Transparency metrics",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, orgName, orgStatus, user } = useAppStore();

  return (
    <aside
      className={`
        fixed top-0 left-0 h-full z-40
        bg-echo-surface/95 backdrop-blur-xl border-r border-echo-border
        transition-all duration-300 ease-in-out
        flex flex-col
        ${sidebarOpen ? "w-64" : "w-[72px]"}
      `}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-echo-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-echo-accent flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {sidebarOpen && (
          <div className="animate-fade-in">
            <h1 className="text-lg font-bold text-gradient">Echo</h1>
          </div>
        )}
      </div>

      {/* Org info */}
      {sidebarOpen && (
        <div className="px-5 py-4 border-b border-echo-border animate-fade-in">
          <p className="text-xs text-echo-muted uppercase tracking-wider mb-1">Organization</p>
          <p className="text-sm font-medium text-white truncate">{orgName}</p>
          <Badge
            variant={orgStatus === "ACTIVE" ? "success" : "warning"}
            dot
            className="mt-2"
          >
            {orgStatus}
          </Badge>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-all duration-200 group relative
                ${
                  isActive
                    ? "bg-echo-accent/10 text-echo-accent border border-echo-accent/20"
                    : "text-echo-muted hover:text-white hover:bg-echo-bg border border-transparent"
                }
              `}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-echo-accent" : ""}`} />
              {sidebarOpen && (
                <div className="animate-fade-in min-w-0">
                  <span className="text-sm font-medium block">{item.label}</span>
                  {isActive && (
                    <span className="text-xs text-echo-muted block truncate">
                      {item.description}
                    </span>
                  )}
                </div>
              )}
              {!sidebarOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-echo-surface border border-echo-border rounded-md text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logged-in user */}
      {user && (
        <div className="px-3 py-3 border-t border-echo-border shrink-0">
          <div className={`flex items-center gap-3 px-2 py-2 rounded-lg ${sidebarOpen ? "" : "justify-center"}`}>
            <div className="w-8 h-8 rounded-full bg-echo-accent/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-echo-accent" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0 animate-fade-in">
                <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
                <Badge variant={roleBadgeVariant[user.role]} className="mt-0.5">
                  {user.role}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="px-3 py-3 border-t border-echo-border shrink-0">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                     text-echo-muted hover:text-white hover:bg-echo-bg transition-all duration-200 text-sm"
        >
          {sidebarOpen ? (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
