"use client";
import { useEffect, useRef, useState } from "react";

/* Strip stray brackets/quotes and JSON-string artefacts from a single tag. */
const clean = (t: unknown) => String(t ?? "").trim().replace(/^[[\]]+|[[\]]+$/g, "").replace(/^["']+|["']+$/g, "").trim();

/* Turn any stored shape (array, comma string, or a JSON-encoded string) into a clean string[]. */
export function normalizeTags(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    const s = value.trim();
    if (s.startsWith("[")) {
      try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map(clean).filter(Boolean); } catch { /* fall through */ }
    }
    return s.split(",").map(clean).filter(Boolean);
  }
  return [];
}

/* Capsule tag input — type and press comma/Enter to add a pill; each pill has an
   ×. Stores a plain string[] (comma-separated when serialised), not JSON text. */
export default function TagsInput({
  value, onChange, placeholder, id,
}: {
  value: string[] | string | null | undefined;
  onChange: (v: string[]) => void;
  placeholder?: string;
  id?: string;
}) {
  const tags = normalizeTags(value);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Self-heal legacy JSON-string / dirty values into a clean array once, so
  // saving (even without editing) stores a proper list.
  useEffect(() => {
    const isCleanArray = Array.isArray(value) && value.every((v) => clean(v) === v);
    if (!isCleanArray) onChange(tags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...tags];
    parts.forEach((p) => { if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p); });
    onChange(next);
    setDraft("");
  };
  const remove = (i: number) => onChange(tags.filter((_, idx) => idx !== i));

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
    else if (e.key === "Backspace" && !draft && tags.length) remove(tags.length - 1);
  };

  return (
    <div className="adm-tags" onClick={() => inputRef.current?.focus()}>
      {tags.map((t, i) => (
        <span className="adm-tag-pill" key={t + i}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={(e) => { e.stopPropagation(); remove(i); }}>×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        className="adm-tag-field"
        value={draft}
        onChange={(e) => { const v = e.target.value; if (v.includes(",")) add(v); else setDraft(v); }}
        onKeyDown={onKey}
        onBlur={() => add(draft)}
        placeholder={tags.length ? "" : (placeholder || "Type and press comma…")}
      />
    </div>
  );
}
