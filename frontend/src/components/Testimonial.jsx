import React, { memo } from 'react';
import '../styles/components/Testimonial.css';
import { FaQuoteLeft, FaStar } from 'react-icons/fa';

const testimonials = [
  {
    text: "Radhe Consultancy helped us renew our factory license within just 15 days without any production downtime. Their team handled all documentation and regulatory coordination seamlessly.",
    author: "Rajesh Patel",
    role: "Manufacturing Business Owner",
    rating: 5,
  },
  {
    text: "Our ESIC registration was completed smoothly thanks to Radhe Consultancy's expert guidance. They explained every step clearly and ensured all our employees were properly covered.",
    author: "Priya Sharma",
    role: "HR Manager",
    rating: 5,
  },
  {
    text: "When our commercial vehicle met with an accident, Radhe Consultancy processed our motor insurance claim of ₹2.5 lakhs within 30 days. Their documentation support was outstanding.",
    author: "Amit Desai",
    role: "Transport Business Owner",
    rating: 5,
  },
  {
    text: "DSC implementation for our 50+ employees was handled professionally. They provided complete training and setup, making our digital operations seamless.",
    author: "Neha Mehta",
    role: "Operations Director",
    rating: 5,
  },
  {
    text: "Fire insurance claim of ₹15 lakhs for our textile factory was settled successfully. They prepared all documentation meticulously and coordinated with insurance surveyors effectively.",
    author: "Kiran Shah",
    role: "Textile Factory Owner",
    rating: 5,
  },
  {
    text: "Labour license compliance audit for our 100+ employee unit was conducted thoroughly. They identified all gaps and helped us achieve full compliance within the deadline.",
    author: "Vikram Joshi",
    role: "Plant Manager",
    rating: 5,
  },
];

// Duplicate for seamless infinite loop
const allCards = [...testimonials, ...testimonials];

const TestimonialCard = ({ t }) => (
  <div className="tcard">
    <FaQuoteLeft className="tcard-quote" />
    <p className="tcard-text">{t.text}</p>
    <div className="tcard-footer">
      <div className="tcard-avatar">{t.author.charAt(0)}</div>
      <div>
        <div className="tcard-author">{t.author}</div>
        <div className="tcard-role">{t.role}</div>
      </div>
      <div className="tcard-stars">
        {Array.from({ length: t.rating }).map((_, i) => <FaStar key={i} />)}
      </div>
    </div>
  </div>
);

const Testimonial = () => (
  <section className="testimonial-section">
    <div className="testimonial-header">
      <p className="testimonial-tag">Client Testimonials</p>
      <h2>What Our Clients Say</h2>
      <p className="testimonial-sub">Trusted by businesses across Gujarat for compliance, insurance & legal services.</p>
    </div>

    <div className="testimonial-track-wrapper">
      <div className="testimonial-track">
        {allCards.map((t, i) => (
          <TestimonialCard key={i} t={t} />
        ))}
      </div>
    </div>
  </section>
);

export default memo(Testimonial);
