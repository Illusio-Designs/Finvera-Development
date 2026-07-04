import Link from "next/link";
import SiteShot from "@/components/SiteShot";
import type { Project } from "@/lib/types";

function Thumb({ p }: { p: Project }) {
  if (p.desktopImage) {
    return (
      <div className="shot-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="shot ready" src={p.desktopImage} alt={`${p.title} screenshot`} loading="lazy" />
      </div>
    );
  }
  return <SiteShot url={p.url} kind="desktop" alt={`${p.title} screenshot`} />;
}

export default function ProjectCard({ p, i }: { p: Project; i: number }) {
  return (
    <Link className={"pcard reveal-x" + (i % 2 ? " r" : "") + " d" + ((i % 3) + 1)} href={`/work/${p.slug}`} data-cursor>
      <div className="pfolder">
        <svg className="pf-back" viewBox="0 0 50 40" preserveAspectRatio="none" fill="none" aria-hidden>
          <path d="M0 4C0 1.79086 1.79086 0 4 0H16.524C17.721 0 18.8415 0.54051 19.574 1.4673L22.426 5.0654C23.1585 5.99219 24.279 6.5327 25.476 6.5327H46C48.2091 6.5327 50 8.32356 50 10.5327V36C50 38.2091 48.2091 40 46 40H4C1.79086 40 0 38.2091 0 36V4Z" fill="#1c3f86" />
        </svg>
        <span className="pf-tab-label">{String(i + 1).padStart(2, "0")}</span>
        <div className="pf-photo"><Thumb p={p} /></div>
        <div className="pf-front">
          <svg viewBox="0 0 50 34" preserveAspectRatio="none" fill="none" aria-hidden>
            <path d="M0 4C0 1.79086 1.79086 0 4 0H46C48.2091 0 50 1.79086 50 4V30C50 32.2091 48.2091 34 46 34H4C1.79086 34 0 32.2091 0 30V4Z" fill="#3e60ab" />
          </svg>
          <div className="pf-info"><span className="cat">{p.category}</span><h3>{p.title}</h3></div>
        </div>
      </div>
    </Link>
  );
}
