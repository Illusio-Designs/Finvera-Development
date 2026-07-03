"use client";
import { useEffect, useRef } from "react";
import { dialog } from "@/lib/dialog";

/* Lightweight WYSIWYG editor (contentEditable) that outputs HTML.
   No external dependencies — good enough for admin content editing. */
const BTNS: [string, string, string?][] = [
  ["bold", "B"],
  ["italic", "I"],
  ["underline", "U"],
];
const BLOCKS: [string, string][] = [
  ["h2", "H2"],
  ["h3", "H3"],
  ["p", "¶"],
  ["blockquote", "❝"],
];

export default function RichText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) ref.current.innerHTML = value || "";
    // run once on mount (keyed by item in parent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => onChange(ref.current?.innerHTML || "");
  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    sync();
  };
  const block = (tag: string) => exec("formatBlock", tag);
  const link = async () => {
    const url = await dialog.prompt({ title: "Insert link", placeholder: "https://…", confirmText: "Insert" });
    if (url) exec("createLink", url);
  };

  return (
    <div className="rte">
      <div className="rte-bar">
        {BTNS.map(([cmd, label]) => (
          <button key={cmd} type="button" title={cmd} onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
            style={{ fontWeight: cmd === "bold" ? 700 : 400, fontStyle: cmd === "italic" ? "italic" : "normal", textDecoration: cmd === "underline" ? "underline" : "none" }}>
            {label}
          </button>
        ))}
        <span className="rte-sep" />
        {BLOCKS.map(([tag, label]) => (
          <button key={tag} type="button" title={tag} onMouseDown={(e) => { e.preventDefault(); block(tag); }}>{label}</button>
        ))}
        <span className="rte-sep" />
        <button type="button" title="Bullet list" onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}>• List</button>
        <button type="button" title="Numbered list" onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}>1. List</button>
        <button type="button" title="Link" onMouseDown={(e) => { e.preventDefault(); link(); }}>🔗</button>
        <button type="button" title="Clear formatting" onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); block("p"); }}>✕</button>
      </div>
      <div ref={ref} className="rte-area prose" contentEditable suppressContentEditableWarning
        onInput={sync} onBlur={sync} data-placeholder="Write here…" />
    </div>
  );
}
