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

/* Decode entity-escaped markup that got stored as plain text
   (e.g. "&lt;p&gt;Hi&lt;/p&gt;" -> "<p>Hi</p>"). */
function decodeEntities(s: string) {
  const ta = document.createElement("textarea");
  ta.innerHTML = s;
  return ta.value;
}
const hasRealTags = (s: string) => /<\/?(p|h[1-6]|ul|ol|li|blockquote|strong|em|b|i|a|br)\b/i.test(s);
const looksEscaped = (s: string) => /&lt;\/?(p|h[1-6]|ul|ol|li|blockquote|strong|em|b|i|a|br)\b/i.test(s);

export default function RichText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Self-heal content that was pasted as raw HTML source and got escaped.
    let v = value || "";
    if (looksEscaped(v) && !hasRealTags(v)) {
      v = decodeEntities(v);
      onChange(v);
    }
    if (ref.current && ref.current.innerHTML !== v) ref.current.innerHTML = v;
    // run once on mount (keyed by item in parent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => onChange(ref.current?.innerHTML || "");

  /* When someone pastes HTML source (plain text that is actually markup),
     insert it as real HTML instead of showing the tags. */
  const onPaste = (e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (!html && text && hasRealTags(text)) {
      e.preventDefault();
      document.execCommand("insertHTML", false, text);
      sync();
    }
  };
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
        onInput={sync} onBlur={sync} onPaste={onPaste} data-placeholder="Write here…" />
    </div>
  );
}
