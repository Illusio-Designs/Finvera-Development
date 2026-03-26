import React, { useState, useEffect, memo } from 'react';
import { HiOutlineArrowRight, HiOutlineArrowSmallDown, HiXMark } from 'react-icons/hi2';
import { useLocation } from 'react-router-dom';
import OptimizedImage from './OptimizedImage';
import img from '../assets/@RADHE CONSULTANCY LOGO blue.webp';
import '../styles/components/Header.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');

const ConsultModal = ({ onClose }) => {
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) setSubmitted(true);
      else alert(data.message || 'Failed to send.');
    } catch { alert('Failed to send. Please check your connection.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="consult-modal-backdrop" onClick={onClose}>
      <div className="consult-modal" onClick={e => e.stopPropagation()}>
        <button className="consult-modal-close" onClick={onClose}><HiXMark /></button>
        <div className="consult-modal-header">
          <span className="consult-modal-tag">Free Consultation</span>
          <h2>Get Expert Advice Today</h2>
          <p>Fill in your details and our team will get back to you within 24 hours.</p>
        </div>
        {submitted ? (
          <div className="consult-modal-success">
            <div className="consult-success-icon">✓</div>
            <h3>Request Submitted!</h3>
            <p>We'll get back to you within 24 hours.</p>
            <button className="consult-submit-btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="consult-modal-form">
            <div className="consult-form-row">
              <div className="consult-form-group">
                <label>First Name *</label>
                <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="First name" required />
              </div>
              <div className="consult-form-group">
                <label>Last Name</label>
                <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Last name" />
              </div>
            </div>
            <div className="consult-form-row">
              <div className="consult-form-group">
                <label>Phone *</label>
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="+91 XXXXX XXXXX" required />
              </div>
              <div className="consult-form-group">
                <label>Email *</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="your@email.com" required />
              </div>
            </div>
            <div className="consult-form-group">
              <label>Message <span style={{ color: '#aaa', fontWeight: 400 }}>(optional)</span></label>
              <textarea name="message" value={form.message} onChange={handleChange} rows={3} placeholder="Tell us about your requirement..." />
            </div>
            <button type="submit" className="consult-submit-btn" disabled={submitting}>
              {submitting ? 'Sending...' : 'Request Consultation →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const MenuButton = ({ open, onClick }) => {
  const styles = {
    container: {
      height: '32px',
      width: '32px',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      cursor: 'pointer',
      padding: '4px',
      background: 'none',
      border: 'none',
    },
    line: {
      height: '2px',
      width: '20px',
      background: '#333',
      transition: 'all 0.2s ease',
    },
    lineTop: {
      transform: open ? 'rotate(45deg)' : 'none',
      transformOrigin: 'top left',
      marginBottom: '5px',
    },
    lineMiddle: {
      opacity: open ? 0 : 1,
      transform: open ? 'translateX(-16px)' : 'none',
    },
    lineBottom: {
      transform: open ? 'translateX(-1px) rotate(-45deg)' : 'none',
      transformOrigin: 'top left',
      marginTop: '5px',
    },
  };

  return (
    <button className="menu-btn" style={styles.container} onClick={onClick}>
      <div style={{ ...styles.line, ...styles.lineTop }} />
      <div style={{ ...styles.line, ...styles.lineMiddle }} />
      <div style={{ ...styles.line, ...styles.lineBottom }} />
    </button>
  );
};

const Header = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showConsultModal, setShowConsultModal] = useState(false);
  const location = useLocation();
  const [activePage, setActivePage] = useState('');

  useEffect(() => {
    setActivePage(location.pathname);
  }, [location]);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
    <header>
      {/* Main Navbar */}
      <div className="navbar">
        <div className="logo" onClick={() => window.location.href = '/'}>
          <OptimizedImage src={img} alt="Radhe Consultancy" />
        </div>

        <nav className={`nav-links ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
          <div className={`nav-item ${activePage === '/' ? 'active' : ''}`} onClick={handleLinkClick}>
            <a href="/">Home</a>
          </div>
          <div className={`nav-item ${activePage === '/about' ? 'active' : ''}`} onClick={handleLinkClick}>
            <a href="/about">About Us</a>
          </div>
          <div className={`nav-item ${activePage === '/insurance' || activePage === '/compliance' ? 'active' : ''}`} onClick={toggleDropdown}>
            <a href="#">Service <HiOutlineArrowSmallDown className="down-icon" /></a>
            <div className={`dropdown-content ${isDropdownOpen ? 'show' : ''}`}>
              <a href="/insurance">Insurance</a>
              <a href="/compliance">Compliance & Licensing</a>
            </div>
          </div>
          <div className={`nav-item ${activePage === '/blog' || activePage === '/bloginner' ? 'active' : ''}`} onClick={handleLinkClick}>
            <a href="/blog">Blog</a>
          </div>
          <div className={`nav-item ${activePage === '/contact' ? 'active' : ''}`} onClick={handleLinkClick}>
            <a href="/contact">Contact</a>
          </div>
        </nav>

        <div className="nav-actions">
          <button className="consult-btn" onClick={() => setShowConsultModal(true)}>
            Free Consultation <HiOutlineArrowRight className="right-arrow" />
          </button>
          <MenuButton open={isMobileMenuOpen} onClick={toggleMobileMenu} />
        </div>
      </div>
    </header>
    {showConsultModal && <ConsultModal onClose={() => setShowConsultModal(false)} />}
    </>
  );
};

export default memo(Header);
