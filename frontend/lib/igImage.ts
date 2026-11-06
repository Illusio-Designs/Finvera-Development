/* Make an image Instagram-safe before it is uploaded for a social post.

   Instagram's publishing API only accepts JPEG images, with an aspect ratio
   between 4:5 (portrait) and 1.91:1 (landscape). The server converts to JPEG
   too, but only when its image tool is installed, so the browser does it
   here as well:
     • PNG / WebP / GIF / HEIC (where the browser can read it) → JPEG
     • transparency → white
     • too tall or too wide → white borders added to reach 4:5 or 1.91:1
     • longer than 2160 px → scaled down
   Videos and JPEGs that are already fine are sent unchanged. */

const MIN_RATIO = 4 / 5;   // portrait limit
const MAX_RATIO = 1.91;    // landscape limit
const MAX_EDGE = 2160;
const QUALITY = 0.9;

export type IgFix = { file: File; changed: boolean; note?: string };

async function decode(file: File): Promise<{ w: number; h: number; draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void } | null> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    return { w: bmp.width, h: bmp.height, draw: (ctx, x, y, w, h) => ctx.drawImage(bmp, x, y, w, h) };
  } catch {
    // Older Safari: fall back to an <img>.
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
      return { w: img.naturalWidth, h: img.naturalHeight, draw: (ctx, x, y, w, h) => ctx.drawImage(img, x, y, w, h) };
    } catch { return null; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
}

export async function instagramSafe(file: File, mode: "feed" | "preserve" = "feed"): Promise<IgFix> {
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) return { file, changed: false }; // video etc.
  const isJpeg = /^image\/jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name);
  const img = await decode(file);
  if (!img || !img.w || !img.h) {
    if (isJpeg) return { file, changed: false };
    throw new Error(`“${file.name}” couldn't be read. Save it as a JPG and upload again — Instagram only accepts JPG.`);
  }
  const ratio = img.w / img.h;
  const tooTall = mode === "feed" && ratio < MIN_RATIO, tooWide = mode === "feed" && ratio > MAX_RATIO;
  const tooBig = Math.max(img.w, img.h) > MAX_EDGE;
  if (isJpeg && !tooTall && !tooWide && !tooBig) return { file, changed: false };

  // Canvas size: the image's box padded to the allowed ratio, then scaled down if needed.
  let cw = img.w, ch = img.h;
  if (tooTall) cw = Math.round(img.h * MIN_RATIO);
  if (tooWide) ch = Math.round(img.w / MAX_RATIO);
  const scale = Math.min(1, MAX_EDGE / Math.max(cw, ch));
  cw = Math.round(cw * scale); ch = Math.round(ch * scale);
  const dw = Math.round(img.w * scale), dh = Math.round(img.h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't prepare images. Save it as a JPG and upload again.");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cw, ch);
  img.draw(ctx, Math.round((cw - dw) / 2), Math.round((ch - dh) / 2), dw, dh);
  const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", QUALITY));
  if (!blob) throw new Error(`“${file.name}” couldn't be converted. Save it as a JPG and upload again.`);
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  const notes = [!isJpeg && "converted to JPG", (tooTall || tooWide) && `white borders added (${tooTall ? "4:5" : "1.91:1"})`, tooBig && "resized"].filter(Boolean);
  return { file: new File([blob], name, { type: "image/jpeg", lastModified: Date.now() }), changed: true, note: notes.join(", ") };
}

/* All files at once; returns the files to upload and a short summary line. */
export async function instagramSafeAll(files: File[], mode: "feed" | "preserve" = "feed"): Promise<{ files: File[]; summary: string }> {
  const out = await Promise.all(files.map(file => instagramSafe(file, mode)));
  const changed = out.filter((x) => x.changed);
  const summary = changed.length ? `${changed.length} image${changed.length === 1 ? "" : "s"} made Instagram-ready (${[...new Set(changed.map((c) => c.note))].join("; ")}).` : "";
  return { files: out.map((x) => x.file), summary };
}
