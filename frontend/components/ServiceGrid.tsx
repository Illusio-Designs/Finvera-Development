import Link from "next/link";
import { Arrow } from "@/components/icons";
import ServiceIcon from "@/components/serviceIcons";
import type { Service } from "@/lib/types";

/* Shared services grid — identical cards on Home and Services. */
export default function ServiceGrid({ services, cta = "Learn more", href = "/services" }: { services: Service[]; cta?: string; href?: string }) {
  return (
    <div className="grid-3">
      {services.map((s, i) => (
        <article className={"card reveal-x" + (i % 2 ? " r" : "") + " d" + ((i % 3) + 1)} data-tilt data-cursor key={s.id}>
          <div className="ic"><ServiceIcon name={s.icon} /></div>
          <h3>{s.title}</h3>
          <p>{s.description}</p>
          <Link href={href} className="more" data-cursor>{cta} <Arrow /></Link>
        </article>
      ))}
    </div>
  );
}
