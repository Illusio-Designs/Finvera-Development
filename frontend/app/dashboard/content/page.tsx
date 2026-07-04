import Link from "next/link";

const SECTIONS: [string, string, string][] = [
  ["/dashboard/faqs", "FAQ", "Questions on the home page"],
  ["/dashboard/values", "Values", "'Values we build by' — About"],
  ["/dashboard/brands", "Brands", "Brand ecosystem — About"],
  ["/dashboard/timeline", "Timeline", "Journey milestones — About"],
  ["/dashboard/process", "Process steps", "'How we work' — Home & Services"],
  ["/dashboard/stats", "Stats", "Stats band — Home"],
  ["/dashboard/logos", "Trusted-by logos", "Marquee — Home"],
  ["/dashboard/features", "Solution features", "'Run your revenue' — Home"],
];

export default function ContentHub() {
  return (
    <>
      <div className="adm-top">
        <div><h1>Site content</h1><p>Edit the copy blocks and lists shown across the marketing site.</p></div>
      </div>
      <div className="content-hub">
        {SECTIONS.map(([href, title, sub]) => (
          <Link key={href} href={href} className="content-hub-card">
            <b>{title}</b>
            <span>{sub}</span>
            <span className="chc-go">Manage →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
