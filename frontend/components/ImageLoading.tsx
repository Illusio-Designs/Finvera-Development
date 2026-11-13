"use client";
import { imageTransition } from "@/lib/presentationMachine";
import { useEffect } from "react";
import { displayImageUrl } from "@/lib/displayImageUrl";
import "./image-loading.css";

type Item = { img: HTMLImageElement; reserved: boolean; width: string; minHeight: string; generation: number; source: string; overlay: HTMLSpanElement | null; host: HTMLElement | null; load: () => void; error: () => void; resize: ResizeObserver | null };

/* Keep the real img in place so cropping, tagging coordinates, hover states,
   React handlers and existing card dimensions remain unchanged. */
export default function ImageLoading() {
  useEffect(() => {
    const items = new Map<HTMLImageElement, Item>();
    const hosts = new Map<HTMLElement, { count: number; position: string; changed: boolean }>();
    let disposed = false;
    const sourceOf = (img: HTMLImageElement) => [img.getAttribute('src'), img.getAttribute('srcset'), img.getAttribute('sizes')].join('|');
    function release(item: Item) {
      if (item.reserved) { item.img.style.width = item.width; item.img.style.minHeight = item.minHeight; item.reserved = false; }
      item.overlay?.remove(); item.overlay = null; item.resize?.disconnect(); item.resize = null;
      if (item.host) { const host = item.host, entry = hosts.get(host); if (entry && --entry.count === 0) { if (entry.changed && host.style.position === 'relative') host.style.position = entry.position; hosts.delete(host); } item.host = null; }
    }
    function position(img: HTMLImageElement, item: Item) {
      if (!item.overlay || !item.host) return;
      const imageBox = img.getBoundingClientRect(), box = item.host.getBoundingClientRect();
      const width = imageBox.width || Math.min(item.host.clientWidth, Number(img.width) || item.host.clientWidth);
      const height = imageBox.height || Number(img.getAttribute('height')) || Math.min(item.host.clientHeight || width * .625, width * .625);
      Object.assign(item.overlay.style, { left: `${imageBox.left - box.left + item.host.scrollLeft - item.host.clientLeft}px`, top: `${imageBox.top - box.top + item.host.scrollTop - item.host.clientTop}px`, width: `${Math.max(0, width)}px`, height: `${Math.max(0, height)}px`, borderRadius: getComputedStyle(img).borderRadius });
    }
    function reserve(img: HTMLImageElement, item: Item) {
      const box = img.getBoundingClientRect(), host = img.parentElement, style = getComputedStyle(img);
      if (!host || box.height > 0 || style.display === 'none') return;
      const maxWidth = style.maxWidth.endsWith('px') ? parseFloat(style.maxWidth) : NaN, maxHeight = style.maxHeight.endsWith('px') ? parseFloat(style.maxHeight) : NaN;
      const width = box.width || Math.min(host.clientWidth, Number.isFinite(maxWidth) ? maxWidth : host.clientWidth);
      if (width < 1) return;
      item.width = img.style.width; item.minHeight = img.style.minHeight; item.reserved = true;
      if (!box.width) img.style.width = `${width}px`;
      img.style.minHeight = `${Math.min(width * .625, Number.isFinite(maxHeight) ? maxHeight : 400)}px`;
    }
    function cover(img: HTMLImageElement, item: Item) {
      if (item.overlay || !img.parentElement) return;
      const host = img.parentElement;
      let entry = hosts.get(host);
      if (!entry) { const changed = getComputedStyle(host).position === 'static'; entry = { count: 0, position: host.style.position, changed }; hosts.set(host, entry); if (changed) host.style.position = 'relative'; }
      entry.count++; item.host = host;
      const overlay = document.createElement('span'); overlay.className = 'image-load-shimmer'; overlay.setAttribute('aria-hidden', 'true');
      item.overlay = overlay; host.appendChild(overlay); position(img, item);
      if (typeof ResizeObserver !== 'undefined') { item.resize = new ResizeObserver(() => position(img, item)); item.resize.observe(img); item.resize.observe(host); }
    }
    function failed(img: HTMLImageElement, item: Item) {
      if (disposed || !img.isConnected) return;
      img.dataset.imageState = imageTransition(img.dataset.imageState, "FAIL"); cover(img, item);
      if (item.overlay) { item.overlay.className = 'image-load-fallback'; const box = img.getBoundingClientRect(); item.overlay.textContent = box.width > 70 && box.height > 50 ? img.alt || 'Image unavailable' : ''; }
    }
    async function loaded(img: HTMLImageElement, item: Item) {
      if (!img.complete || !img.naturalWidth) return;
      const generation = item.generation, source = sourceOf(img); position(img, item);
      try { if (typeof img.decode === 'function') await img.decode(); }
      catch { if (generation === item.generation && source === sourceOf(img)) failed(img, item); return; }
      if (disposed || !img.isConnected || generation !== item.generation || source !== sourceOf(img)) return;
      img.dataset.imageState = imageTransition(img.dataset.imageState, "READY"); release(item);
    }
    function begin(img: HTMLImageElement, item: Item) {
      const attr = img.getAttribute('src');
      if (attr && !img.getAttribute('srcset')) { const display = displayImageUrl(attr); if (display !== attr) img.setAttribute('src', display); }
      item.source = sourceOf(img); item.generation++; img.dataset.imageState = imageTransition(img.dataset.imageState, "LOAD"); release(item); reserve(img, item); cover(img, item);
      if (img.complete) { if (img.naturalWidth) void loaded(img, item); else failed(img, item); }
    }
    function track(img: HTMLImageElement) {
      if (img.dataset.imageLoading === 'off') return;
      const old = items.get(img);
      if (old) { if (old.source !== sourceOf(img)) begin(img, old); return; }
      const item: Item = { img, reserved: false, width: '', minHeight: '', generation: 0, source: '', overlay: null, host: null, load: () => {}, error: () => {}, resize: null };
      item.load = () => void loaded(img, item); item.error = () => failed(img, item); items.set(img, item);
      img.addEventListener('load', item.load); img.addEventListener('error', item.error); begin(img, item);
    }
    function scan(node: Node) { if (node instanceof HTMLImageElement) track(node); if (node instanceof Element) node.querySelectorAll('img').forEach(track); }
    scan(document.documentElement);
    const observer = new MutationObserver(records => {
      records.forEach(record => { if (record.type === 'attributes' && record.target instanceof HTMLImageElement) track(record.target); else record.addedNodes.forEach(scan); });
      items.forEach((item, img) => { if (!img.isConnected) { item.generation++; release(item); img.removeEventListener('load', item.load); img.removeEventListener('error', item.error); items.delete(img); } });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset', 'sizes'] });
    let frame = 0;
    const reposition = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; items.forEach((item, img) => position(img, item)); }); };
    window.addEventListener('resize', reposition); document.addEventListener('scroll', reposition, true);
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', reposition); document.removeEventListener('scroll', reposition, true); items.forEach((item, img) => { item.generation++; release(item); img.removeEventListener('load', item.load); img.removeEventListener('error', item.error); }); };
  }, []);
  return null;
}
