"use client";

import { X } from "./icons";
import { useRef, useState } from "react";

/**
 * Words as chips: type and press Enter or comma to add, click a suggestion to add it, click the x to remove. The value goes to the
 * form as one comma-separated field named `name`, as a plain text box would have sent.
 */
export function TagInput({
  name,
  defaultValue = [],
  suggestions = [],
  placeholder = "Type and press Enter",
  onChange,
  max = 12,
}: {
  name: string;
  defaultValue?: string[];
  suggestions?: string[];
  placeholder?: string;
  /** Called with the new list, for forms that keep their own state */
  onChange?: (tags: string[]) => void;
  max?: number;
}) {
  const [tags, setTagsState] = useState<string[]>(defaultValue);
  const setTags = (next: string[] | ((cur: string[]) => string[])) =>
    setTagsState((cur) => {
      const value = typeof next === "function" ? next(cur) : next;
      onChange?.(value);
      return value;
    });
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
  const add = (raw: string) => {
    const t = raw.split(",").map(clean).filter(Boolean);
    if (t.length) setTags((cur) => [...new Set([...cur, ...t])].slice(0, max));
    setText("");
  };
  const left = suggestions.filter((s) => !tags.includes(s));
  return (
    <div>
      <input type="hidden" name={name} value={tags.join(",")} />
      <div
        className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2 py-1.5 shadow-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20"
        onClick={() => input.current?.focus()}
      >
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-accent-line bg-accent-soft py-0.5 pr-1 pl-2.5 text-xs font-medium text-accent"
          >
            {t}
            <button
              type="button"
              onClick={() => setTags((cur) => cur.filter((x) => x !== t))}
              aria-label={`Remove ${t}`}
              className="rounded-full p-0.5 hover:bg-accent/15"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={input}
          value={text}
          onChange={(e) =>
            e.target.value.includes(",") ? add(e.target.value) : setText(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && tags.length)
              setTags((cur) => cur.slice(0, -1));
          }}
          onBlur={() => text && add(text)}
          placeholder={tags.length ? "" : placeholder}
          aria-label="Add"
          className="min-w-24 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
        />
      </div>
      {left.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">Suggestions:</span>
          {left.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-line-strong bg-surface px-2.5 py-0.5 text-xs text-ink-2 hover:border-accent hover:text-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
