import type { ReactNode } from "react";
import ContentIcon from "@/components/contentIcon";
import { getProcessSteps } from "@/lib/api";
import type { ProcessStep } from "@/lib/types";

const FALLBACK: ProcessStep[] = [
  { id: 1, step: "01", title: "Discover", description: "We map your goals, users and constraints into a sharp product blueprint.", icon: "search" },
  { id: 2, step: "02", title: "Design", description: "Wireframes to polished UI with motion, validated against real users.", icon: "paint" },
  { id: 3, step: "03", title: "Build", description: "Agile sprints, weekly demos and production-grade, tested code.", icon: "code" },
  { id: 4, step: "04", title: "Scale", description: "Launch, monitor and iterate — we grow with you long after go-live.", icon: "rocket" },
];

/* Shared process section — identical on Home and Services, content from the CMS. */
export default async function ProcessSteps({
  eyebrow = "How we work",
  title = <>A proven path from <span className="grad-word">idea to impact</span></>,
  paddingTop = 0,
}: { eyebrow?: string; title?: ReactNode; paddingTop?: number }) {
  const rows = await getProcessSteps();
  const steps = rows.length ? rows : FALLBACK;
  return (
    <section className="section" style={{ paddingTop }} id="process">
      <div className="container">
        <div className="section-head center reveal">
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <div className="steps">
          {steps.map((s, i) => (
            <div className={"step reveal" + (i ? " d" + i : "")} key={s.id}>
              <span className="step-num">{s.step || String(i + 1).padStart(2, "0")}.</span>
              <span className="step-ic"><ContentIcon name={s.icon} /></span>
              <h4>{s.title}</h4>
              <p>{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
