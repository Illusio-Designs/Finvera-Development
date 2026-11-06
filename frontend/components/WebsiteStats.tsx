import type { Stat } from "@/lib/types";

export default function WebsiteStats({ items }: { items: Stat[] }) {
  const rows = items.filter(item => !item.status || item.status === "published");
  if (!rows.length) return null;
  return <section className="section" style={{ paddingTop: 0 }} id="website-stats">
    <div className="container"><div className="stats reveal">
      {rows.map(item => {
        // Animate simple whole numbers. Keep decimals, separators and text exact.
        const match = /^(0|[1-9]\d*)([^\d.,]*)$/.exec(item.value);
        const count = match && Number.isSafeInteger(Number(match[1])) ? match : null;
        return <div className="stat" key={item.id}>
          <b {...(count ? { "data-count": count[1], "data-suffix": count[2] } : {})} style={{ overflowWrap: "anywhere" }}>{item.value}</b>
          <span style={{ overflowWrap: "anywhere" }}>{item.label}</span>
        </div>;
      })}
    </div></div>
  </section>;
}
