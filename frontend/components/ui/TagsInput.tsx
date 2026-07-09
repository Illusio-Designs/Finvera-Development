"use client";
import { useRef, useState } from "react";

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
  const tags = Array.isArray(value) ? value : (typeof value === "string" && value ? value.split(",").map((s) => s.trim()).filter(Boolean) : []);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
