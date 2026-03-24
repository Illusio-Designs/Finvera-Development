import React, { memo, useMemo } from 'react';
import "../styles/components/Casestudy.css";
import OptimizedImage from './OptimizedImage';
import gallery1 from "../../src/assets/law(6).webp";
import gallery2 from "../../src/assets/law(7).webp";
import gallery3 from "../../src/assets/law(8).webp";
import gallery4 from "../../src/assets/law(9).webp";
import gallery5 from "../../src/assets/law(11).webp";

const Casestudy = memo(() => {
  const cases = useMemo(() => [
    { src: gallery1, tag: 'Insurance',   title: 'Motor & Vehicle Insurance Claim Settlement',   desc: 'Successfully processed ₹2.5L claim within 30 days.' },
    { src: gallery2, tag: 'Compliance',  title: 'Factory Act License Renewal',                  desc: 'Renewed license with zero production downtime.' },
    { src: gallery3, tag: 'Labour Law',  title: 'Contract Labour Act Registration',              desc: 'Full compliance achieved for 100+ employee unit.' },
    { src: gallery4, tag: 'Insurance',   title: 'Fire Insurance Claim — Textile Factory',        desc: '₹15L claim settled with complete documentation.' },
    { src: gallery5, tag: 'Compliance',  title: 'ESIC & PF Registration Drive',                  desc: 'Covered 50+ employees across 3 branches.' },
  ], []);

  return (
    <div className="cs-grid">
      {/* Large featured card */}
      <div className="cs-card cs-card--featured">
        <OptimizedImage src={cases[0].src} alt={cases[0].title} className="cs-img" />
        <div className="cs-overlay">
          <span className="cs-tag">{cases[0].tag}</span>
          <h3>{cases[0].title}</h3>
          <p>{cases[0].desc}</p>
        </div>
      </div>

      {/* Right column — 2 stacked */}
      <div className="cs-col">
        {cases.slice(1, 3).map((c, i) => (
          <div className="cs-card" key={i}>
            <OptimizedImage src={c.src} alt={c.title} className="cs-img" />
            <div className="cs-overlay">
              <span className="cs-tag">{c.tag}</span>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom row — 2 cards */}
      {cases.slice(3).map((c, i) => (
        <div className="cs-card cs-card--bottom" key={i}>
          <OptimizedImage src={c.src} alt={c.title} className="cs-img" />
          <div className="cs-overlay">
            <span className="cs-tag">{c.tag}</span>
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
});

Casestudy.displayName = 'Casestudy';
export default Casestudy;
