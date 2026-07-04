import { HugeiconsIcon } from "@hugeicons/react";
import {
  CloudServerIcon, UserGroupIcon, CloudIcon, ApiIcon, PaintBoardIcon, AiBrain01Icon, DashboardSquare02Icon,
} from "@hugeicons/core-free-icons";

/* Maps a service `icon` key (stored in the DB) to a Hugeicons glyph. */
const ICONS: Record<string, typeof CloudServerIcon> = {
  saas: CloudServerIcon,
  crm: UserGroupIcon,
  cloud: CloudIcon,
  api: ApiIcon,
  design: PaintBoardIcon,
  ai: AiBrain01Icon,
};

export default function ServiceIcon({ name }: { name: string }) {
  return <HugeiconsIcon icon={ICONS[name] || DashboardSquare02Icon} strokeWidth={1.8} className="hgi" />;
}
