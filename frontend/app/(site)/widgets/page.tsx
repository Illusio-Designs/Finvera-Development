import type { ReactNode } from "react";
import {
  Button, Pill, Tag, Eyebrow, SectionHeading, ServiceCard, Stat, FeatureItem,
  FaqItem, TestimonialCard, Step, InfoItem, CTABand, Marquee, BarsMock, RingMock, Field,
} from "@/components/ui";
import { Arrow } from "@/components/icons";
import PhoneInput from "@/components/PhoneInput";
import { PasswordDemo, ToastDemo, TooltipDemo, ConfirmDemo, SuccessCheckDemo, TableDemo, DatePickerDemo } from "@/components/WidgetDemos";

/* Hidden route — intentionally NOT linked from Nav or Footer. */
export const metadata = {
  title: "Widgets",
  robots: { index: false, follow: false },
};

const WIDGETS: { id: string; name: string; comp: string; node: ReactNode; note?: string }[] = [
  {
    id: "buttons", name: "Buttons", comp: "<Button variant />",
    node: (
      <>
        <Button variant="primary" magnetic>Primary <Arrow /></Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="grad">Gradient <Arrow /></Button>
      </>
    ),
  },
  {
    id: "pill", name: "Status pill", comp: "<Pill />",
    node: <Pill>Empowering Global SaaS &amp; CRM Growth</Pill>,
  },
  {
    id: "tag", name: "Tag / badge", comp: "<Tag />",
    node: <><Tag>Won</Tag><Tag>Enterprise</Tag><Tag>+34% conversion</Tag></>,
  },
  {
    id: "eyebrow", name: "Eyebrow label", comp: "<Eyebrow />",
    node: <Eyebrow>What we do</Eyebrow>,
  },
  {
    id: "heading", name: "Section heading", comp: "<SectionHeading />",
    node: <div style={{ width: "100%" }}><SectionHeading eyebrow="What we do" title={<>End-to-end <span className="grad-word">product engineering</span></>} text="From first line of code to global scale." /></div>,
  },
  {
    id: "service", name: "Service card (3D tilt)", comp: "<ServiceCard />",
    node: (
      <div style={{ maxWidth: 340 }}>
        <ServiceCard title="SaaS Development" text="Multi-tenant, subscription-ready platforms built for scale." href="/services"
          icon={<><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /><rect x="9" y="9" width="6" height="6" rx="1" /></>} />
      </div>
    ),
  },
  {
    id: "stats", name: "Animated stats", comp: "<Stat />",
    node: (
      <div className="stats" style={{ width: "100%" }}>
        <Stat value={250} suffix="+" label="Projects delivered" />
        <Stat value={99} suffix="%" label="Uptime guaranteed" />
        <Stat value={18} suffix="+" label="Countries served" />
        <Stat value={4} suffix="min" label="Avg. deploy time" />
      </div>
    ),
  },
  {
    id: "features", name: "Feature list", comp: "<FeatureItem />",
    node: (
      <ul className="feature-list" style={{ width: "100%", maxWidth: 420 }}>
        <FeatureItem title="Smart pipelines" text="Drag-and-drop deal stages with automated hand-offs." />
        <FeatureItem title="AI lead scoring" text="Know which leads to call first, ranked in real time." />
        <FeatureItem title="Live analytics" text="Boardroom-ready dashboards updated to the second." />
      </ul>
    ),
  },
  {
    id: "steps", name: "Process steps", comp: "<Step />",
    node: (
      <div className="steps" style={{ width: "100%" }}>
        <Step num="01" title="Discover" text="Map goals, users and constraints into a blueprint." />
        <Step num="02" title="Design" text="Wireframes to polished UI, validated with users." />
        <Step num="03" title="Build" text="Agile sprints, weekly demos, tested code." />
        <Step num="04" title="Scale" text="Launch, monitor and iterate together." />
      </div>
    ),
  },
  {
    id: "testimonial", name: "Testimonial card", comp: "<TestimonialCard />",
    node: <TestimonialCard quote="Finvera shipped our CRM in six weeks — absolute pros." name="Aisha Khan" role="CEO, Orbital" avatar="AK" />,
  },
  {
    id: "faq", name: "FAQ accordion", comp: "<FaqItem />",
    node: (
      <div className="faq" style={{ width: "100%" }}>
        <FaqItem q="How fast can you start on my project?" a="Most engagements kick off within one week after a short discovery call." />
        <FaqItem q="Who owns the code and IP?" a="You do, 100% — full source, designs and infrastructure with documentation." />
      </div>
    ),
  },
  {
    id: "bars", name: "Dashboard — bar chart", comp: "<BarsMock />",
    node: <div style={{ maxWidth: 380, width: "100%" }}><BarsMock /></div>,
  },
  {
    id: "ring", name: "Dashboard — progress ring", comp: "<RingMock />",
    node: <div style={{ maxWidth: 300, width: "100%" }}><RingMock /></div>,
  },
  {
    id: "info", name: "Contact info item", comp: "<InfoItem />",
    node: (
      <div className="contact-info" style={{ width: "100%", maxWidth: 420 }}>
        <InfoItem title="Email us" text="hello@finvera.dev" icon={<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></>} />
      </div>
    ),
  },
  {
    id: "fields", name: "Form fields", comp: "<Field />",
    node: (
      <form style={{ width: "100%", maxWidth: 460 }}>
        <Field label="Full name" id="wg_name" placeholder="Jane Doe" />
        <Field label="Message" id="wg_msg" placeholder="Tell us about your project..." textarea />
      </form>
    ),
  },
  {
    id: "marquee", name: "Logo marquee", comp: "<Marquee />",
    node: (
      <div style={{ width: "100%" }}>
        <Marquee items={["Nexora", "Orbital", "Vaultly", "Prismix", "Loopwork", "Quanta"].map((l) => (
          <span className="logo-item" key={l}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="4" /></svg>{l}</span>
        ))} />
      </div>
    ),
  },
  {
    id: "cta", name: "CTA band", comp: "<CTABand />",
    node: <div style={{ width: "100%" }}><CTABand title="Ready to build?" text="Book a free 30-minute strategy call." cta={{ label: "Book a consultation", href: "/contact" }} /></div>,
  },
  {
    id: "phone", name: "Phone input (flags)", comp: "<PhoneInput />",
    node: (
      <div style={{ width: "100%", maxWidth: 360 }}>
        <PhoneInput name="wg_phone" />
      </div>
    ),
  },
  {
    id: "password", name: "Password field (eye toggle)", comp: "<PasswordDemo />",
    node: <PasswordDemo />,
  },
  {
    id: "tooltip", name: "Tooltips", comp: "data-tip",
    node: <TooltipDemo />,
  },
  {
    id: "toast", name: "Toast notifications", comp: "toast()",
    node: <ToastDemo />,
  },
  {
    id: "confirm", name: "Confirm dialog", comp: "<ConfirmDemo />",
    node: <ConfirmDemo />,
  },
  {
    id: "success", name: "Success check (micro-animation)", comp: ".success-check",
    node: <SuccessCheckDemo />,
  },
  {
    id: "table", name: "Data table (search · sort · paginate)", comp: "<DataTable />",
    node: <TableDemo />,
  },
  {
    id: "datepicker", name: "Date picker", comp: 'type="date"',
    node: <DatePickerDemo />,
  },
  {
    id: "chrome", name: "Global chrome (ambient)", comp: "<Chrome />",
    node: <p className="wg-note">Preloader, blue <b>waterfall light beam</b> backdrop, animated grid + orbs, custom cursor + spotlight, scroll-progress bar, back-to-top button and the cookie banner are always present via the shared <code>Chrome</code> component — visible everywhere on this page too.</p>,
  },
];

export default function Widgets() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <Eyebrow>Internal</Eyebrow>
          <h1 style={{ marginTop: 16 }}>Component <span className="grad-word">library</span></h1>
          <p>A live catalog of Finvera&apos;s shared widgets. This route is intentionally unlisted — reachable only at <code style={{ fontFamily: "var(--mono)", color: "var(--blue-400)" }}>/widgets</code>, never linked from the header or footer.</p>
          <div className="wg-toc">
            {WIDGETS.map((w) => <a key={w.id} href={`#${w.id}`}>{w.name}</a>)}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="container" style={{ maxWidth: 960 }}>
          {WIDGETS.map((w, i) => (
            <div className="wg" id={w.id} key={w.id}>
              <div className="wg-head">
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <b>{w.name}</b>
                <code>{w.comp}</code>
              </div>
              <div className={"wg-body" + (["heading", "stats", "features", "steps", "faq", "marquee", "cta", "info", "fields", "phone", "password", "table", "datepicker", "chrome"].includes(w.id) ? " col" : "")}>
                {w.node}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
