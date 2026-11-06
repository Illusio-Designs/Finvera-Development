import type { Faq } from "@/lib/types";
export default function HomeFaqs({ items }: { items: Faq[] }) {
  const published = items.filter(item => !item.status || item.status === "published");
  if (!published.length) return null;
  return <section className="section" id="faq"><div className="container"><div className="section-head center reveal"><span className="eyebrow">FAQ</span><h2>Questions, <span className="grad-word">answered</span></h2></div><div className="faq">{published.map((item, index) => <div className={"qa reveal" + (index ? " d" + index : "")} key={item.id}><button className="q">{item.question}<span className="pm" /></button><div className="a"><p style={{ whiteSpace: "pre-wrap" }}>{item.answer}</p></div></div>)}</div></div></section>;
}
