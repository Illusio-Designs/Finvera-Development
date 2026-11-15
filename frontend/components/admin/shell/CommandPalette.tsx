"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { workspaceApi } from "@/lib/adminApi";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import type { Icon } from "./nav";

export type PaletteItem = { group: string; label: string; sub?: string | null; href: string; icon: Icon };

/* Ctrl/⌘ K command palette: every page this user can open plus a few
   quick actions (each goes to the page that does it). Type to filter,
   ↑/↓ to move, Enter to open, Esc or a click outside to close. */
export default function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: PaletteItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [records,setRecords]=useState<PaletteItem[]>([]),[recordLoading,setRecordLoading]=useState(false),[recordError,setRecordError]=useState('');
  useEffect(()=>{
    let active=true;setRecords([]);setRecordError('');setRecordLoading(false);
    if(!open||q.trim().length<2)return;
    setRecordLoading(true);
    const timer=setTimeout(()=>{workspaceApi.search(q).then(r=>{if(active)setRecords(r.items.map((item:any)=>({group:item.kind,label:item.label,sub:item.sub,href:item.href,icon:Search01Icon})));}).catch(()=>{if(active)setRecordError('Record search is unavailable. Page search still works.');}).finally(()=>{if(active)setRecordLoading(false);});},250);
    return()=>{active=false;clearTimeout(timer);};
  },[q,open]);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    back.current = document.activeElement as HTMLElement | null;
    setQ(""); setSel(0);
    const t = setTimeout(() => input.current?.focus(), 10);
    return () => { clearTimeout(t); back.current?.focus?.(); };
  }, [open]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...items.filter((it) => !s || `${it.label} ${it.sub || ""} ${it.group}`.toLowerCase().includes(s)),...records];
  }, [q, items, records]);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { list.current?.querySelector(".on")?.scrollIntoView({ block: "nearest" }); }, [sel]);

  if (!open) return null;

  const go = (it?: PaletteItem) => {
    if (!it) return;
    onClose();
    const target=new URL(it.href,window.location.origin);
    if(target.searchParams.has('q'))window.dispatchEvent(new CustomEvent('fv-record-search',{detail:{pathname:target.pathname,query:target.searchParams.get('q')}}));
    router.push(it.href);
  };

  let lastGroup = "";
  return (
    <>
      <div className="sh-scrim2" onMouseDown={onClose} />
      <div className="sh-cmd" role="dialog" aria-modal="true" aria-label="Search workspace">
        <label className="sh-cmd-search">
          <span className="sh-sr">Search pages, clients and records</span>
          <HugeiconsIcon icon={Search01Icon} size={18} strokeWidth={1.8} className="hgi" />
          <input ref={input} value={q} maxLength={80} placeholder="Search pages, clients, leads, content…" autoComplete="off"
            role="combobox" aria-expanded="true" aria-controls="sh-cmd-list" aria-autocomplete="list"
            aria-activedescendant={results[sel] ? `sh-cmd-${sel}` : undefined}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((n) => Math.max(0,Math.min(n + 1, results.length - 1))); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((n) => Math.max(n - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); go(results[sel]); }
              else if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }} />
        </label>
        {recordLoading&&<p role="status" className="sh-cmd-g">Searching records…</p>}{recordError&&<p role="alert" className="sh-cmd-g">{recordError}</p>}
        <div className="sh-cmd-l" id="sh-cmd-list" role="listbox" ref={list}>
          {results.length === 0 && !recordLoading ? (
            <div className="sh-empty" style={{ margin: 8 }}>
              <HugeiconsIcon icon={Search01Icon} size={20} strokeWidth={1.8} className="hgi" />
              <b>Nothing matches “{q}”</b><span>Try “leads”, “renewals” or “SEO”.</span>
            </div>
          ) : results.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.group + it.href + it.label}>
                {head && <div className="sh-cmd-g">{head}</div>}
                <button type="button" id={`sh-cmd-${i}`} role="option" aria-selected={i === sel} className={"sh-cmd-i" + (i === sel ? " on" : "")}
                  onMouseMove={() => setSel(i)} onClick={() => go(it)}>
                  <span className="sh-cmd-ic"><HugeiconsIcon icon={it.icon} size={18} strokeWidth={1.8} className="hgi" /></span>
                  <span className="sh-cmd-t">{it.label}</span>
                  {it.sub && <small>{it.sub}</small>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="sh-cmd-f">
          <span><kbd><HugeiconsIcon icon={ArrowUp01Icon} size={12} /></kbd> <kbd><HugeiconsIcon icon={ArrowDown01Icon} size={12} /></kbd> to move</span>
          <span><kbd>Enter</kbd> to open</span>
          <span><kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </>
  );
}
