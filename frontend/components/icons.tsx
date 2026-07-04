import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon, Tick02Icon, NewTwitterIcon, Linkedin01Icon, Github01Icon, InstagramIcon,
} from "@hugeicons/core-free-icons";

export const Mark = ({ className = "mark" }: { className?: string }) => (
  <svg className={className} aria-hidden="true">
    <use href="#finmark" />
  </svg>
);

type IconProps = { width?: number; className?: string };

/* Wrap a Hugeicons glyph as a drop-in for the old inline-SVG icon components.
   Rounded stroke caps come from the global `.hgi` rule. */
const hugeicon = (icon: typeof ArrowRight01Icon, dw = 18) =>
  function Icon({ width, className }: IconProps) {
    return (
      <HugeiconsIcon
        icon={icon}
        size={width ?? dw}
        strokeWidth={1.8}
        className={"hgi" + (className ? " " + className : "")}
      />
    );
  };

export const Arrow = hugeicon(ArrowRight01Icon);
export const Check = hugeicon(Tick02Icon);
export const XIcon = hugeicon(NewTwitterIcon, 16);
export const LinkedIn = hugeicon(Linkedin01Icon, 16);
export const GitHub = hugeicon(Github01Icon, 16);
export const Instagram = hugeicon(InstagramIcon, 16);
