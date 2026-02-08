"use client";

import { useEffect } from "react";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useAppStore, type Notification } from "@/app/store";

const iconMap: Record<Notification["type"], typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap: Record<Notification["type"], { icon: string; border: string; bg: string }> = {
  success: {
    icon: "text-echo-success",
    border: "border-echo-success/20",
    bg: "bg-echo-success/5",
  },
  error: {
    icon: "text-echo-danger",
    border: "border-echo-danger/20",
    bg: "bg-echo-danger/5",
  },
  warning: {
    icon: "text-echo-warning",
    border: "border-echo-warning/20",
    bg: "bg-echo-warning/5",
  },
  info: {
    icon: "text-echo-accent",
    border: "border-echo-accent/20",
    bg: "bg-echo-accent/5",
  },
};

function Toast({ notification }: { notification: Notification }) {
  const { dismissNotification } = useAppStore();
  const Icon = iconMap[notification.type];
  const colors = colorMap[notification.type];

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      dismissNotification(notification.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification.id, dismissNotification]);

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl
        shadow-lg shadow-black/20 animate-toast-in
        bg-echo-surface/95 ${colors.border}
        max-w-sm w-full
      `}
    >
      <div className={`shrink-0 mt-0.5 ${colors.icon}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{notification.title}</p>
        {notification.message && (
          <p className="text-xs text-echo-muted mt-0.5 line-clamp-2">{notification.message}</p>
        )}
      </div>
      <button
        onClick={() => dismissNotification(notification.id)}
        className="shrink-0 p-1 rounded-lg text-echo-muted hover:text-white hover:bg-echo-bg/50 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function NotificationToast() {
  const { notifications } = useAppStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3">
      {notifications.slice(-5).map((notification) => (
        <Toast key={notification.id} notification={notification} />
      ))}
    </div>
  );
}
