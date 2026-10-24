"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* Header "Jump to a page…" box. Ctrl/⌘ K focuses it; type to filter the
   pages this user can open, arrows to move, Enter to go. */
export type JumpItem = { href: string; label: string; group?: string | null };

export default function JumpTo({ items }: { items: JumpItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [mac, setMac] = useState(false);

  useEffect(() => { setMac(/Mac|iPhone|iPad/.test(navigator.platform)); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); setOpen(true); }
    };
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((it) => !s || it.label.toLowerCase().includes(s) || (it.group || "").toLowerCase().includes(s)).slice(0, 8);
  }, [q, items]);
  useEffect(() => { setSel(0); }, [q]);

  const go = (it?: JumpItem) => {
    if (!it) return;
    router.push(it.href);
    setQ(""); setOpen(false); input.current?.blur();
  };

  return (
    <div className="adm-jump" ref={box}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" /></svg>
      <input
        ref={input} value={q} placeholder="Jump to a page…" aria-label="Jump to a page"
        role="combobox" aria-expanded={open} aria-controls="adm-jump-list" aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((n) => Math.min(n + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((n) => Math.max(n - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); go(results[sel]); }
          else if (e.key === "Escape") { setOpen(false); input.current?.blur(); }
        }}
      />
      <kbd>{mac ? "⌘ K" : "Ctrl K"}</kbd>
      {open && (
        <ul id="adm-jump-list" className="adm-jump-list" role="listbox">
          {results.length === 0 ? <li className="none">No page matches “{q}”</li> : results.map((it, i) => (
            <li key={it.href} role="option" aria-selected={i === sel} className={i === sel ? "on" : ""}
              onMouseEnter={() => setSel(i)} onMouseDown={(e) => { e.preventDefault(); go(it); }}>
              <span>{it.label}</span>{it.group && <small>{it.group}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
