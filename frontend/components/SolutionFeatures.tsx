import { Check } from "@/components/icons";
import type { Feature } from "@/lib/types";

export default function SolutionFeatures({ items }: { items: Feature[] }) {
  const rows = items.filter(item => !item.status || item.status === "published");
  if (!rows.length) return null;
  return <ul className="feature-list">{rows.map(item => <li key={item.id}>
    <span className="fi"><Check width={15} /></span><div style={{ minWidth: 0 }}>
      <h4 style={{ overflowWrap: "anywhere" }}>{item.title}</h4>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.description}</p>
    </div>
  </li>)}</ul>;
}
