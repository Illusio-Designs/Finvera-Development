"use client";
/* Email preferences for whoever is signed in. (Meant to become a tab of
   My account; this route keeps it reachable on its own.) */
import Link from "next/link";
import EmailPrefs from "@/components/admin/EmailPrefs";

export default function AccountEmailsPage() {
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="adm-top">
        <div>
          <div className="sys-eyebrow"><Link href="/dashboard/account" prefetch={false} style={{ color: "inherit" }}>My account</Link></div>
          <h1>Email notifications</h1>
          <p>Choose which emails you get. You can change this any time.</p>
        </div>
      </div>
      <EmailPrefs />
    </div>
  );
}
