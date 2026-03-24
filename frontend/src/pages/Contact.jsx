import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Loader from '../components/common/Loader/Loader';
import '../styles/pages/Contact.css';
import { FiPhone, FiMapPin, FiMail, FiClock } from 'react-icons/fi';
import contactBg from '../assets/contact bg.webp';

const Contact = () => {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <>
      <Header />
      <div className="contactpage-container">
        <div className="contactpage-hero-section">
          <img src={contactBg} alt="" className="contactpage-hero-bg" />
          <div className="contactpage-hero-overlay" />
          <div className="contactpage-hero-content">
            <h1>Contact Us</h1>
          </div>
        </div>
        
        <div className="cp-body">
          {/* Left — info cards */}
          <div className="cp-info">
            <span className="cp-tag">Get In Touch</span>
            <h2 className="cp-heading">We'd Love to <span>Hear From You</span></h2>
            <p className="cp-sub">Reach out to us for any queries related to labour law compliance, insurance, or any of our services. We're here to help.</p>

            <div className="cp-cards">
              <div className="cp-card">
                <div className="cp-card-icon"><FiPhone /></div>
                <div>
                  <p className="cp-card-label">Phone</p>
                  <a href="tel:+919913014575" className="cp-card-val">+91 99130 14575</a>
                </div>
              </div>
              <div className="cp-card">
                <div className="cp-card-icon"><FiMail /></div>
                <div>
                  <p className="cp-card-label">Email</p>
                  <a href="mailto:radheconsultancy17@yahoo.com" className="cp-card-val">radheconsultancy17@yahoo.com</a>
                </div>
              </div>
              <div className="cp-card">
                <div className="cp-card-icon"><FiMapPin /></div>
                <div>
                  <p className="cp-card-label">Head Office</p>
                  <p className="cp-card-val">1215-1216, RK Empire, Nr. Mavdi Circle, 150 feet Ring Road, Rajkot.</p>
                </div>
              </div>
              <div className="cp-card">
                <div className="cp-card-icon"><FiMapPin /></div>
                <div>
                  <p className="cp-card-label">Branch Office</p>
                  <p className="cp-card-val">Office no-16, 1st floor, Madhav Market, near Super market, Sanala Road, Morbi, Gujarat.</p>
                </div>
              </div>
              <div className="cp-card">
                <div className="cp-card-icon"><FiClock /></div>
                <div>
                  <p className="cp-card-label">Working Hours</p>
                  <p className="cp-card-val">07:00 AM – 09:00 PM</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <form className="cp-form" onSubmit={e => e.preventDefault()}>
            <h3 className="cp-form-title">Send Us a Message</h3>
            <div className="cp-form-row">
              <div className="cp-form-group">
                <label>First Name*</label>
                <input type="text" placeholder="Enter first name" required />
              </div>
              <div className="cp-form-group">
                <label>Last Name*</label>
                <input type="text" placeholder="Enter last name" required />
              </div>
            </div>
            <div className="cp-form-row">
              <div className="cp-form-group">
                <label>Phone*</label>
                <input type="tel" placeholder="Enter your phone" required />
              </div>
              <div className="cp-form-group">
                <label>Email*</label>
                <input type="email" placeholder="Enter your email" required />
              </div>
            </div>
            <div className="cp-form-group">
              <label>Message <span className="cp-optional">(optional)</span></label>
              <textarea rows="5" placeholder="Enter your message"></textarea>
            </div>
            <button type="submit" className="cp-submit">Send Message →</button>
          </form>
        </div>

        {/* Map full width */}
        <div className="cp-map">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3692.4022079934716!2d70.78399467506814!3d22.2627490797136!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3959ca5dbe7afda3%3A0x6d8e1af5be0f4126!2sRK%20Empire!5e0!3m2!1sen!2sin!4v1746769795410!5m2!1sen!2sin"
            title="Radhe Consultancy Location"
            allowFullScreen=""
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Contact; 
