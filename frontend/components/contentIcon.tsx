import { HugeiconsIcon } from "@hugeicons/react";
import {
  Rocket01Icon, Target02Icon, Award01Icon, Agreement01Icon, PaintBoardIcon,
  Calculator01Icon, Store01Icon, Megaphone01Icon, SourceCodeIcon, Search01Icon,
  CloudServerIcon, UserGroupIcon, AiBrain01Icon, DashboardSquare02Icon,
} from "@hugeicons/core-free-icons";

/* Icon-key → Hugeicons glyph (keys are stored on CMS content items). */
const MAP: Record<string, typeof Rocket01Icon> = {
  rocket: Rocket01Icon, target: Target02Icon, award: Award01Icon, agreement: Agreement01Icon,
  paint: PaintBoardIcon, calculator: Calculator01Icon, store: Store01Icon, megaphone: Megaphone01Icon,
  code: SourceCodeIcon, search: Search01Icon, cloud: CloudServerIcon, team: UserGroupIcon, ai: AiBrain01Icon,
};

export const ICON_KEYS = Object.keys(MAP);

export default function ContentIcon({ name, size }: { name?: string; size?: number }) {
  return <HugeiconsIcon icon={MAP[name || ""] || DashboardSquare02Icon} size={size} strokeWidth={1.8} className="hgi" />;
}
