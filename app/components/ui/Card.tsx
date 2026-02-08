import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  padding?: "sm" | "md" | "lg";
}

const paddingMap = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({
  children,
  className = "",
  hover = false,
  glow = false,
  padding = "md",
}: CardProps) {
  return (
    <div
      className={`
        ${hover ? "glass-panel-hover" : "glass-panel"}
        ${glow ? "accent-glow" : ""}
        ${paddingMap[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  change?: { value: string; positive: boolean };
  className?: string;
}

export function StatCard({ label, value, icon, change, className = "" }: StatCardProps) {
  return (
    <Card className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-echo-muted">{label}</span>
        {icon && <span className="text-echo-accent">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {change && (
          <span
            className={`text-sm font-medium ${
              change.positive ? "text-echo-success" : "text-echo-danger"
            }`}
          >
            {change.positive ? "+" : ""}{change.value}
          </span>
        )}
      </div>
    </Card>
  );
}
