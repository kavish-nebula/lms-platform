import type { ReactNode } from "react";

export function EnrollmentChoice({ name, value, checked, onChange, children }: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2 text-sm leading-snug hover:border-brand-line has-checked:border-brand has-checked:bg-brand-soft has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:cursor-default">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="size-4 shrink-0 accent-brand" />
      <span className="min-w-0 wrap-break-word">{children}</span>
    </label>
  );
}
