import React, { memo, useState } from 'react';
import '../styles/components/Footer.css';
import OptimizedImage from './OptimizedImage';
import { FaLinkedinIn, FaMapMarkerAlt, FaPhoneAlt, FaEnvelope } from 'react-icons/fa';
import img from '../assets/@RADHE CONSULTANCY LOGO.webp';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');

const Footer = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(''); // 'success' | 'error' | ''
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/contact/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) { setStatus('success'); setEmail(''); }
      else setStatus('error');
    } catch { setStatus('error'); }
    finally { setLoading(false); }
  };
  return (
    <footer className="page-footer">

      {/* Newsletter Strip */}
      <div className="footer-newsletter">
        <div className="footer-newsletter-left">
          <p className="footer-newsletter-tag">Stay Updated</p>
          <h2>Sign Up To Get Latest Updates</h2>
        </div>
        <form className="footer-newsletter-form" onSubmit={handleSubscribe}>
          <input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Subscribing...' : status === 'success' ? '✓ Subscribed!' : 'Subscribe →'}
          </button>
        </form>
      </div>

      {/* Main Footer */}
      <div className="footer-main">
        {/* Brand col */}
        <div className="footer-col footer-brand">
          <OptimizedImage src={img} alt="Radhe Consultancy" className="footer-logo" />
          <p>Your trusted partner in HR & Labor Law Compliance since 2016. Comprehensive compliance solutions, insurance services, and legal consultation across 7 branches in Gujarat.</p>
          <div className="footer-social">
            <a href="https://www.linkedin.com/in/radhe-consultancy-067826281/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><FaLinkedinIn /></a>
          </div>
        </div>

        {/* Pages col */}
        <div className="footer-col">
          <h4>Pages</h4>
          <div className="footer-links">
            <a href="/">Home</a>
            <a href="/about">About Us</a>
            <a href="/blog">Our Blog</a>
            <a href="/contact">Contact Us</a>
          </div>
        </div>

        {/* Services col */}
        <div className="footer-col">
          <h4>Our Services</h4>
          <div className="footer-links">
            <a href="/insurance">Insurance</a>
            <a href="/compliance">Compliance & Licensing</a>
          </div>
        </div>

        {/* Contact col */}
        <div className="footer-col footer-contact">
          <h4>Contact Us</h4>
          <div className="footer-contact-item">
            <FaMapMarkerAlt />
            <div>
              <span className="footer-address-label">Head Office</span>
              <p>1215 - 1216, RK Empire, Nr. Mavdi Circle, 150 feet Ring Road, Rajkot.</p>
            </div>
          </div>
          <div className="footer-contact-item">
            <FaMapMarkerAlt />
            <div>
              <span className="footer-address-label">Branch Office</span>
              <p>Office no -16, 1st floor, Madhav Market, near Super market, Sanala Road, Morbi, Gujarat.</p>
            </div>
          </div>
          <div className="footer-contact-item">
            <FaPhoneAlt />
            <a href="tel:+919913014575">+91 99130 14575</a>
          </div>
          <div className="footer-contact-item">
            <FaEnvelope />
            <a href="mailto:radheconsultancy17@yahoo.com">radheconsultancy17@yahoo.com</a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <p>Copyright © <span>Radhe Consultancy</span>. All Rights Reserved.</p>
        <p>Design & Developed with ❤️ by <a href="https://illusiodesigns.agency/" target="_blank" rel="noopener noreferrer">Illusio Designs</a></p>
      </div>

    </footer>
  );
};

export default memo(Footer);
