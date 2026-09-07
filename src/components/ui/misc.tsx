import * as React from "react";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/lib/types";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md border border-line bg-card p-5 shadow-card", className)}
      {...props}
    />
  );
}

const STATUS_STYLE: Record<BookingStatus, string> = {
  PENDING: "bg-warning-tint text-warning",
  CONFIRMED: "bg-success-tint text-success",
  COMPLETED: "bg-paper-3 text-ink-soft",
  CANCELLED: "bg-danger-tint text-danger",
  NO_SHOW: "bg-danger-tint text-danger",
};

export function StatusPill({
  status,
  label,
  className,
}: {
  status: BookingStatus;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLE[status],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-info/30 bg-info-tint text-info",
    success: "border-success/30 bg-success-tint text-success",
    warning: "border-warning/30 bg-warning-tint text-warning",
    danger: "border-danger/30 bg-danger-tint text-danger",
  } as const;
  return (
    <div className={cn("rounded-sm border px-3 py-2 text-sm", tones[tone], className)} role="status">
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-paper-2 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
