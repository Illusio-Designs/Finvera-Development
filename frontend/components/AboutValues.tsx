import ContentIcon from "@/components/contentIcon";
import type { ValueItem } from "@/lib/types";
export default function AboutValues({ items }: { items: (ValueItem & { status?: string })[] }) {
  const published = items.filter(item => !item.status || item.status === "published");
  if (!published.length) return null;
  return <section className="section" style={{ paddingTop: 0 }}><div className="container"><div className="section-head center reveal"><span className="eyebrow">What drives us</span><h2>Values we <span className="grad-word">build by</span></h2></div><div className="grid-4">{published.map((item, index) => <div className={"card value reveal" + (index ? " d" + index : "")} data-cursor key={item.id}><div className="vic"><ContentIcon name={item.icon} size={22} /></div><h4>{item.title}</h4><p style={{ whiteSpace: "pre-wrap" }}>{item.description}</p></div>)}</div></div></section>;
}
