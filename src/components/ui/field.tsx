import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-10 w-full rounded-sm border border-line-strong bg-card px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClass, className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(inputClass, "h-auto min-h-20 py-2 leading-relaxed", className)}
      {...props}
    />
  );
});

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | string[];
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const err = Array.isArray(error) ? error[0] : error;
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-clay">*</span>}
      </label>
      {children}
      {hint && !err && <p className="text-xs text-ink-faint">{hint}</p>}
      {err && (
        <p className="text-xs text-danger" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
