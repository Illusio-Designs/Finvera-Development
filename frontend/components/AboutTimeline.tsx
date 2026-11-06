import type { Milestone } from "@/lib/types";
export default function AboutTimeline({ items }: { items: (Milestone & { status?: string })[] }) {
  const published = items.filter(item => !item.status || item.status === "published");
  if (!published.length) return null;
  return <section className="section" style={{ paddingTop: 0 }}><div className="container"><div className="section-head center reveal"><span className="eyebrow">Our journey</span><h2>Our story, <span className="grad-word">one milestone at a time</span></h2></div><div className="timeline">{published.map((item,index) => <div className={"tl-item reveal-x" + (index % 2 ? " r" : "")} key={item.id}><div className="tl-marker"><span className="tl-dot" /></div><div className="tl-body"><span className="tl-year">{item.year}</span><h4>{item.title}</h4><p style={{ whiteSpace: "pre-wrap" }}>{item.description}</p></div></div>)}</div></div></section>;
}
