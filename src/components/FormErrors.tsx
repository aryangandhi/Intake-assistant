"use client";
import type { FieldError } from "@/lib/validation";

/** Summary at the top of a form. Each entry links to, and focuses, the field with the problem. */
export function ErrorSummary({ errors, className = "" }: { errors: FieldError[]; className?: string }) {
  if (!errors.length) return null;
  return (
    <div role="alert" className={`rounded-md border-2 border-red-700 bg-red-50 p-3 text-red-800 ${className}`}>
      <p className="font-semibold">Please fix the following before continuing:</p>
      <ul className="mt-1 list-disc pl-5">
        {errors.map((e) => (
          <li key={e.field}>
            <a
              href={`#${e.field}`}
              className="underline"
              onClick={(ev) => {
                ev.preventDefault();
                document.getElementById(e.field)?.focus();
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function fieldProps(errors: FieldError[], id: string) {
  const bad = errors.some((e) => e.field === id);
  return { "aria-invalid": bad ? (true as const) : undefined, "aria-describedby": bad ? `${id}-error` : undefined };
}

export function InlineError({ errors, id }: { errors: FieldError[]; id: string }) {
  const e = errors.find((x) => x.field === id);
  return e ? <p id={`${id}-error`} className="mt-1 text-sm font-medium text-red-700">{e.message}</p> : null;
}
