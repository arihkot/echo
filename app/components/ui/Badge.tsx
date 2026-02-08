import { ReactNode } from "react";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger" | "muted";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-echo-surface text-white border-echo-border",
  accent: "bg-echo-accent/10 text-echo-accent border-echo-accent/20",
  success: "bg-echo-success/10 text-echo-success border-echo-success/20",
  warning: "bg-echo-warning/10 text-echo-warning border-echo-warning/20",
  danger: "bg-echo-danger/10 text-echo-danger border-echo-danger/20",
  muted: "bg-echo-bg text-echo-muted border-echo-border",
};

const dotStyles: Record<BadgeVariant, string> = {
  default: "bg-white",
  accent: "bg-echo-accent",
  success: "bg-echo-success",
  warning: "bg-echo-warning",
  danger: "bg-echo-danger",
  muted: "bg-echo-muted",
};

export function Badge({ children, variant = "default", dot = false, className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full
        text-xs font-medium border
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} />}
      {children}
    </span>
  );
}
