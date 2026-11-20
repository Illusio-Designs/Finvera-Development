type PopoverSize = {
  width: number;
  maxHeight?: number;
};

export function positionPopover(panel: HTMLElement, trigger: HTMLElement, size: PopoverSize) {
  // Keep the popup in its field for keyboard and modal handling while lifting it above scrollers.
  if (typeof panel.showPopover === "function" && !panel.matches(":popover-open")) panel.showPopover();
  const viewport = window.visualViewport;
  const gap = 8;

  function update() {
    const anchor = trigger.getBoundingClientRect();
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? document.documentElement.clientWidth;
    const height = viewport?.height ?? window.innerHeight;
    const popupWidth = Math.min(size.width, width - 2 * gap);
    const below = top + height - anchor.bottom - 2 * gap;
    const above = anchor.top - top - 2 * gap;
    const preferredHeight = Math.min(panel.scrollHeight, size.maxHeight ?? Infinity);
    const opensUp = below < preferredHeight && above > below;

    Object.assign(panel.style, {
      width: `${popupWidth}px`,
      left: `${Math.max(left + gap, Math.min(anchor.left, left + width - popupWidth - gap))}px`,
      top: opensUp ? "auto" : `${Math.max(top + gap, anchor.bottom + gap)}px`,
      bottom: opensUp ? `${Math.max(gap, window.innerHeight - anchor.top + gap)}px` : "auto",
      maxHeight: `${Math.max(0, Math.min(opensUp ? above : below, size.maxHeight ?? Infinity))}px`,
    });
  }

  update();
  window.addEventListener("resize", update);
  window.addEventListener("scroll", update, true);
  viewport?.addEventListener("resize", update);
  viewport?.addEventListener("scroll", update);
  return () => {
    window.removeEventListener("resize", update);
    window.removeEventListener("scroll", update, true);
    viewport?.removeEventListener("resize", update);
    viewport?.removeEventListener("scroll", update);
  };
}
