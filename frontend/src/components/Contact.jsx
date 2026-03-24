import React, { memo } from 'react';
import '../styles/components/Contact.css';
import { FaUser, FaEnvelope, FaPhone, FaPen, FaMapMarkerAlt } from 'react-icons/fa';
import { HiOutlineArrowRight, HiPhone, HiEnvelope, HiMapPin } from 'react-icons/hi2';

const Contact = () => {
  return (
    <section className="contact-section">

      {/* Header */}
      <div className="contact-section-header">
        <p className="contact-tag">Have Any Questions?</p>
        <h2>Get In Touch With Us</h2>
        <p className="contact-sub">We're here to help with compliance, insurance & legal services across Gujarat.</p>
      </div>

      <div className="contact-wrapper">

        {/* Left — Info */}
        <div className="contact-info-side">
          <div className="info-card">
            <div className="info-card-icon"><HiMapPin /></div>
            <div className="info-card-body">
              <h4>Location</h4>
              <p><strong>Head Office</strong><br />1215 - 1216, RK Empire, Nr. Mavdi Circle, 150 feet Ring Road, Rajkot.</p>
              <p style={{marginTop: '10px'}}><strong>Branch Office</strong><br />Office no -16, 1st floor, Madhav Market, near Super market, Sanala Road, Morbi, Gujarat.</p>
            </div>
          </div>

          <div className="info-card">
            <div className="info-card-icon"><HiPhone /></div>
            <div className="info-card-body">
              <h4>Phone</h4>
              <a href="tel:+919913014575">+91 99130 14575</a>
            </div>
          </div>

          <div className="info-card">
            <div className="info-card-icon"><HiEnvelope /></div>
            <div className="info-card-body">
              <h4>Email</h4>
              <a href="mailto:radheconsultancy17@yahoo.com">radheconsultancy17@yahoo.com</a>
            </div>
          </div>
        </div>

        {/* Right — Form */}
        <div className="contact-form-side">
          <div className="contact-input-group">
            <FaUser className="cinput-icon" />
            <input type="text" placeholder="Your Name" />
          </div>

          <div className="contact-input-row">
            <div className="contact-input-group">
              <FaEnvelope className="cinput-icon" />
              <input type="email" placeholder="Email Address" />
            </div>
            <div className="contact-input-group">
              <FaPhone className="cinput-icon rotate" />
              <input type="tel" placeholder="Phone Number" />
            </div>
          </div>

          <div className="contact-input-group">
            <FaPen className="cinput-icon top" />
            <textarea placeholder="Your Message" rows="5" style={{resize:'none', scrollbarWidth:'none'}}></textarea>
          </div>

          <button className="contact-send-btn">
            Send Message <HiOutlineArrowRight />
          </button>
        </div>

      </div>
    </section>
  );
};

export default memo(Contact);
