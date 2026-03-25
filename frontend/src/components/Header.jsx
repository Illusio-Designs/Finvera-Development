import React, { useState, useEffect, memo } from 'react';
import { HiOutlineArrowSmallDown, HiOutlineArrowRight } from 'react-icons/hi2';
import { useLocation } from 'react-router-dom';
import OptimizedImage from './OptimizedImage';
import img from '../assets/@RADHE CONSULTANCY LOGO blue.webp';
import '../styles/components/Header.css';

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
          <button className="consult-btn">
            Free Consultation <HiOutlineArrowRight className="right-arrow" />
          </button>
          <MenuButton open={isMobileMenuOpen} onClick={toggleMobileMenu} />
        </div>
      </div>
    </header>
  );
};

export default memo(Header);
