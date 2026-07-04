import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, PaintBoardIcon, SourceCodeIcon, Rocket01Icon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

const STEPS = [
  { n: "01", h: "Discover", p: "We map your goals, users and constraints into a sharp product blueprint.", ic: Search01Icon },
  { n: "02", h: "Design", p: "Wireframes to polished UI with motion, validated against real users.", ic: PaintBoardIcon },
  { n: "03", h: "Build", p: "Agile sprints, weekly demos and production-grade, tested code.", ic: SourceCodeIcon },
  { n: "04", h: "Scale", p: "Launch, monitor and iterate — we grow with you long after go-live.", ic: Rocket01Icon },
];

/* Shared process section — identical on Home and Services. */
export default function ProcessSteps({
  eyebrow = "How we work",
  title = <>A proven path from <span className="grad-word">idea to impact</span></>,
  paddingTop = 0,
}: { eyebrow?: string; title?: ReactNode; paddingTop?: number }) {
  return (
    <section className="section" style={{ paddingTop }} id="process">
      <div className="container">
        <div className="section-head center reveal">
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div className={"step reveal" + (i ? " d" + i : "")} key={s.n}>
              <span className="step-num">{s.n}.</span>
              <span className="step-ic"><HugeiconsIcon icon={s.ic} strokeWidth={1.8} className="hgi" /></span>
              <h4>{s.h}</h4>
              <p>{s.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
