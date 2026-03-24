import React, { memo } from 'react';
import lawImg from '../../assets/289b0237f84d4c71ddb954980d4f9e9fefe36880.webp';

const reasons = [
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="16" r="8" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <path d="M10 40c0-7.7 6.3-14 14-14s14 6.3 14 14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M34 20l2 2 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Experienced Professionals',
    desc: 'In-depth knowledge of labour laws with years of hands-on expertise.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="10" width="32" height="28" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <path d="M16 10V6M32 10V6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M8 20h32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M16 30h6M16 36h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="34" cy="33" r="6" fill="currentColor" opacity="0.15"/>
        <path d="M31 33l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Government Liaison',
    desc: 'Strong departmental coordination for smooth approvals and compliance.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 8l4 8h9l-7 6 3 9-9-5-9 5 3-9-7-6h9z" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
        <path d="M14 36l-6 6M34 36l6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M10 42h28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'End-to-End Support',
    desc: 'From registration to compliance — we handle every step for you.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <path d="M24 14v10l6 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 24H4M44 24h-4M24 8V4M24 44v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Timely & Accurate',
    desc: '100% deadline-oriented service so you never miss a compliance date.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="14" width="36" height="26" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <path d="M16 14v-4a8 8 0 0116 0v4" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <circle cx="24" cy="27" r="4" fill="currentColor" opacity="0.2"/>
        <circle cx="24" cy="27" r="4" stroke="currentColor" strokeWidth="2"/>
        <path d="M24 31v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Customized Solutions',
    desc: 'Tailored compliance strategies designed around your business needs.',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 6C14 6 6 14 6 24s8 18 18 18 18-8 18-18S34 6 24 6z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
        <path d="M18 24l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Client-Centric Approach',
    desc: 'Trusted by businesses across Rajkot for reliable, transparent service.',
  },
];

const WhyChooseUs = memo(() => {
  return (
    <div className="why-choose-us">
      <div className="why-choose-inner">

        {/* Left: image */}
        <div className="why-choose-left">
          <div className="why-choose-img-wrap">
            <img src={lawImg} alt="Labour Law Compliance" />
          </div>
        </div>

        {/* Right: content */}
        <div className="why-choose-right">
          <span className="why-choose-tag">Why Choose Us</span>
          <h2 className="why-choose-title">Your Trusted Partner in Labour Law Compliance</h2>
          <p className="why-choose-sub">We simplify complex labour laws so you can focus on growing your business.</p>

          <div className="why-choose-grid">
            {reasons.map((r, i) => (
              <div className="why-card" key={i}>
                <div className="why-card-icon">{r.icon}</div>
                <div>
                  <h4>{r.title}</h4>
                  <p>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
});

WhyChooseUs.displayName = 'WhyChooseUs';

export default WhyChooseUs;
