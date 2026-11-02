import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Deletion",
  description: "How to remove the Facebook and Instagram data Finvera stores, and how to ask us to delete your data.",
};

const EMAIL = "info@illusiodesigns.agency";

/* Static page for Meta's "User data deletion" requirement. */
export default function DataDeletion() {
  const h2 = { fontSize: 20, fontWeight: 700, color: "var(--ink, inherit)", margin: "30px 0 8px" } as const;
  return (
    <article className="section" style={{ paddingTop: 150 }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="crumbs" style={{ marginBottom: 18 }}>
          <Link href="/">Home</Link><span className="sep">/</span><span>Data Deletion</span>
        </div>
        <h1 style={{ fontFamily: "var(--display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".01em", fontSize: "clamp(28px,4.4vw,48px)", lineHeight: 1.05, margin: "10px 0 12px" }}>
          Data Deletion
        </h1>
        <div style={{ marginTop: 24, color: "var(--muted)", fontSize: 16, lineHeight: 1.8 }}>
          <p>
            Finvera Solutions uses Facebook Login only to let our team publish scheduled posts to the Facebook Pages and
            Instagram business accounts we manage for our clients. For each connected brand we store the Page name and ID,
            the linked Instagram username and ID, and an access token for the Page (encrypted). We also keep the links of
            posts we publish. We do not store personal profile data, friends lists or messages.
          </p>

          <h2 style={h2}>Remove the connection yourself</h2>
          <ol style={{ paddingLeft: 22 }}>
            <li>On Facebook, go to <b>Settings &amp; privacy → Settings → Business integrations</b> (or <b>Apps and websites</b>).</li>
            <li>Find <b>Finvera Solutions</b> and click <b>Remove</b>.</li>
            <li>This immediately stops Finvera from accessing or posting to your Page and Instagram account.</li>
          </ol>
          <p>Team members with access to the Finvera dashboard can also disconnect a brand under <b>Content calendar → Team &amp; uploads → Social accounts → Disconnect</b>, which deletes the stored Page token straight away.</p>

          <h2 style={h2}>Ask us to delete your data</h2>
          <p>
            Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a> with the subject <b>“Data deletion request”</b> and the name of your
            Facebook Page or Instagram account. We delete the stored account details and tokens within 30 days and confirm
            by email once it is done.
          </p>
          <p style={{ color: "var(--muted-2)", fontSize: 14 }}>Email: {EMAIL}</p>
        </div>
        <div style={{ marginTop: 44 }}>
          <Link href="/" className="btn btn-ghost">← Back home</Link>
        </div>
      </div>
    </article>
  );
}
