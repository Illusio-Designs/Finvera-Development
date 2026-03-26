import React, { useState, useEffect } from 'react';
import { FaEnvelope, FaPhoneAlt, FaMapMarkerAlt, FaWhatsapp } from 'react-icons/fa';
import '../styles/components/FloatingContact.css';

const FloatingContact = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 3100);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return (
    <>
      {/* Right side — mail, phone, location */}
      <div className="floating-right">
        <a
          href="mailto:radheconsultancy17@yahoo.com"
          className="float-btn"
          aria-label="Email"
        >
          <FaEnvelope />
          <span className="float-pulse" />
        </a>
        <a
          href="tel:+919913014575"
          className="float-btn"
          aria-label="Phone"
        >
          <FaPhoneAlt />
          <span className="float-pulse" />
        </a>
        <a
          href="https://www.google.com/maps?q=22.2627490,70.7864744&label=1215-1216+RK+Empire,+Nr.+Mavdi+Circle,+150+feet+Ring+Road,+Rajkot"
          target="_blank"
          rel="noopener noreferrer"
          className="float-btn"
          aria-label="Location"
        >
          <FaMapMarkerAlt />
          <span className="float-pulse" />
        </a>
      </div>

      {/* Bottom left — WhatsApp */}
      <a
        href="https://wa.me/919913014575"
        target="_blank"
        rel="noopener noreferrer"
        className="float-whatsapp"
        aria-label="WhatsApp"
      >
        <FaWhatsapp />
        <span className="float-pulse whatsapp-pulse" />
      </a>
    </>
  );
};

export default FloatingContact;
