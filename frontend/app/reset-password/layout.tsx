import type { Metadata } from "next";

/* Link pages stay out of search results, and the token in the URL isn't sent
   on to other sites as a referrer. */
export const metadata: Metadata = {
  title: "Set your password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
