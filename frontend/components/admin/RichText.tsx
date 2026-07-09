"use client";
import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { dialog } from "@/lib/dialog";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";


/* Full WYSIWYG editor built on TipTap / ProseMirror.
   Outputs clean HTML through the same value/onChange interface. */

const hasBlockTags = (s: string) => /<\/?(p|h[1-6]|ul|ol|li|blockquote)\b/i.test(s);

/* Content pasted as raw HTML source and stored escaped ("&lt;p&gt;…", often
   wrapped in <div>/<br>) shows tags as text. Its *visible text* is the real
   HTML source — recover it so TipTap can parse it. */
function normalizeContent(value: string): string {
  const v = value || "";
  if (!v) return "";
  if (hasBlockTags(v)) return v; // already well-formed
  if (typeof document === "undefined") return v;
  const tmp = document.createElement("div");
  tmp.innerHTML = v;
  const text = (tmp.textContent || "").trim();
  return hasBlockTags(text) ? text : v;
}

function Btn({ editor, label, title, onClick, active }: {
  editor: Editor | null; label: React.ReactNode; title: string; onClick: () => void; active?: boolean;
}) {
  return (
    <button type="button" title={title} className={active ? "is-active" : ""} disabled={!editor}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}>
      {label}
    </button>
  );
}

export default function RichText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = useRef<Editor | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    try {
      const { url } = await api.upload(file);
      editorRef.current?.chain().focus().setImage({ src: url, alt: file.name }).run();
      toast("Image added");
    } catch {
      toast("Image upload failed", "err");
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } },
      }),
      Image.configure({ inline: false, HTMLAttributes: { class: "rte-img" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Write your content…" }),
    ],
    content: normalizeContent(value),
    editorProps: {
      attributes: { class: "rte-area prose" },
      handlePaste: (_view, event) => {
        const f = event.clipboardData?.files?.[0];
        if (f && f.type.startsWith("image/")) { uploadImage(f); return true; }
        return false;
      },
      handleDrop: (_view, event) => {
        const f = (event as DragEvent).dataTransfer?.files?.[0];
        if (f && f.type.startsWith("image/")) { event.preventDefault(); uploadImage(f); return true; }
        return false;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  editorRef.current = editor;

  // If we recovered escaped source on load, push the clean HTML up so a plain Save persists it.
  useEffect(() => {
    if (!editor) return;
    if (normalizeContent(value) !== (value || "")) onChange(editor.getHTML());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const link = async () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = await dialog.prompt({ title: "Insert link", placeholder: "https://…", defaultValue: prev || "", confirmText: "Insert" });
    if (url === null || url === undefined) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const c = () => editor?.chain().focus();

  return (
    <div className="rte">
      <div className="rte-bar">
        <Btn editor={editor} title="Undo" label="↶" onClick={() => c()?.undo().run()} />
        <Btn editor={editor} title="Redo" label="↷" onClick={() => c()?.redo().run()} />
        <span className="rte-sep" />
        <Btn editor={editor} title="Bold" label={<b>B</b>} active={editor?.isActive("bold")} onClick={() => c()?.toggleBold().run()} />
        <Btn editor={editor} title="Italic" label={<i>I</i>} active={editor?.isActive("italic")} onClick={() => c()?.toggleItalic().run()} />
        <Btn editor={editor} title="Underline" label={<u>U</u>} active={editor?.isActive("underline")} onClick={() => c()?.toggleUnderline().run()} />
        <Btn editor={editor} title="Strikethrough" label={<s>S</s>} active={editor?.isActive("strike")} onClick={() => c()?.toggleStrike().run()} />
        <Btn editor={editor} title="Inline code" label={<span style={{ fontFamily: "var(--mono)" }}>{"</>"}</span>} active={editor?.isActive("code")} onClick={() => c()?.toggleCode().run()} />
        <span className="rte-sep" />
        <Btn editor={editor} title="Heading 2" label="H2" active={editor?.isActive("heading", { level: 2 })} onClick={() => c()?.toggleHeading({ level: 2 }).run()} />
        <Btn editor={editor} title="Heading 3" label="H3" active={editor?.isActive("heading", { level: 3 })} onClick={() => c()?.toggleHeading({ level: 3 }).run()} />
        <Btn editor={editor} title="Paragraph" label="¶" active={editor?.isActive("paragraph")} onClick={() => c()?.setParagraph().run()} />
        <span className="rte-sep" />
        <Btn editor={editor} title="Bullet list" label="• List" active={editor?.isActive("bulletList")} onClick={() => c()?.toggleBulletList().run()} />
        <Btn editor={editor} title="Numbered list" label="1. List" active={editor?.isActive("orderedList")} onClick={() => c()?.toggleOrderedList().run()} />
        <Btn editor={editor} title="Quote" label="❝" active={editor?.isActive("blockquote")} onClick={() => c()?.toggleBlockquote().run()} />
        <Btn editor={editor} title="Code block" label="{ }" active={editor?.isActive("codeBlock")} onClick={() => c()?.toggleCodeBlock().run()} />
        <Btn editor={editor} title="Divider" label="―" onClick={() => c()?.setHorizontalRule().run()} />
        <span className="rte-sep" />
        <Btn editor={editor} title="Align left" label="⯇" active={editor?.isActive({ textAlign: "left" })} onClick={() => c()?.setTextAlign("left").run()} />
        <Btn editor={editor} title="Align center" label="≡" active={editor?.isActive({ textAlign: "center" })} onClick={() => c()?.setTextAlign("center").run()} />
        <Btn editor={editor} title="Align right" label="⯈" active={editor?.isActive({ textAlign: "right" })} onClick={() => c()?.setTextAlign("right").run()} />
        <span className="rte-sep" />
        <Btn editor={editor} title="Link" label="🔗" active={editor?.isActive("link")} onClick={link} />
        <Btn editor={editor} title="Insert image" label="🖼" onClick={() => fileRef.current?.click()} />
        <Btn editor={editor} title="Clear formatting" label="✕" onClick={() => c()?.clearNodes().unsetAllMarks().run()} />
      </div>
      <EditorContent editor={editor} />
      <input ref={fileRef} type="file" accept="image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
    </div>
  );
}
