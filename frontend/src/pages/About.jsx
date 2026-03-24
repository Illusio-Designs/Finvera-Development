import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Workingwith from '../components/Workingwith';
import Casestudy from '../components/Casestudy';
import Testimonial from '../components/Testimonial';
import Contact from '../components/Contact';
import Footer from '../components/Footer';
import Loader from '../components/common/Loader/Loader';
import OptimizedImage from '../components/OptimizedImage';
import { HiOutlineEye, HiOutlineRocketLaunch } from 'react-icons/hi2';
import '../styles/pages/About.css';
import aboutLawImg from '../assets/law(8).webp';
import heroAbout from '../assets/law(11).webp';
import helpBg from '../assets/about law section bg.webp';

const About = () => {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleContactClick = () => {
    window.location.href = '/contact';
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <>
      <Header />
      <div className="about-hero-wrap">
        <img src={heroAbout} alt="" className="about-hero-bg" />
        <div className="about-hero-content">
          <h1>About Us</h1>
        </div>
      </div>
      <div className="about-container">

      <div className="about-intro-section">
        <div className="about-intro-image">
          <OptimizedImage src={aboutLawImg} alt="Labour Law Consultancy" className="about-intro-img" />
        </div>
        <div className="about-intro-content">
          <span className="about-intro-tag">Who We Are</span>
          <h2 className="about-intro-heading">Your Trusted Partner in <span>Labour Law Compliance</span></h2>
          <p className="about-intro-lead">
            Radhe Consultancy is a leading Labour Law Consultancy firm based in Rajkot. With over 9 years of dedicated experience, we specialize in helping businesses navigate the complexities of statutory regulations with confidence and ease.
          </p>
          <p className="about-intro-body">
            Our expertise spans a wide range of labour laws, ensuring organizations remain fully compliant while focusing on their core operations. From registrations and documentation to ongoing compliance management and audits — our approach is proactive, detail-oriented, and aligned with the latest legal updates.
          </p>
          <p className="about-intro-body">
            Our mission is to simplify compliance, minimize risks, and provide peace of mind to businesses of all sizes. Whether you are a startup, SME, or established enterprise, we bring the experience and knowledge needed to ensure your business stays compliant and protected.
          </p>
          <button className="about-intro-btn" onClick={handleContactClick}>Get In Touch →</button>
        </div>
      </div>

<div className="vision-mission-section">
  <div className="vision-section">
    <div className="section-title-with-line">
      <span className="vm-icon"><HiOutlineEye /></span>
      <h2>Our Vision</h2>
    </div>
    <p>
      To be the most trusted Labour Law Consultancy in Gujarat — empowering businesses of all sizes to operate with full statutory compliance, confidence, and peace of mind. We envision a future where every organization, from startups to established enterprises, has access to reliable, accurate, and proactive compliance support.
    </p>
  </div>
  <div className="mission-section">
    <div className="section-title-with-line">
      <span className="vm-icon"><HiOutlineRocketLaunch /></span>
      <h2>Our Mission</h2>
    </div>
    <p>
      To simplify labour law compliance for businesses by delivering timely, accurate, and tailored solutions. We are committed to navigating the complexities of statutory regulations on behalf of our clients — handling everything from registrations and documentation to audits and ongoing compliance management — so they can focus on what matters most: growing their business.
    </p>
  </div>
</div>

<div className="help" style={{ backgroundImage: `url(${helpBg})` }}>
  <div className="help-overlay" />
  <div className="help-inner">
    <h1>We Help You With Quality Labour Law Compliance</h1>
    <p>Since 2016, Radhe Consultancy has been Gujarat's trusted partner for HR & Labour Law Compliance. With over 9 years of experience, we serve businesses across industries — handling registrations, documentation, audits, and ongoing statutory compliance so you can focus on growing your business.</p>
    <div className="help-btn" onClick={handleContactClick}>Contact Now →</div>
  </div>
</div>



      <div className="casestudy">
      <div className="casestudy-content">
            <p>Our Work</p>
            <h1>Real Cases. Real Results.</h1>
        </div>
      <Casestudy />
        </div>
        <Workingwith />
        <Testimonial />
        <Contact />
        </div>
      <Footer />
    </>
  );
};

export default About; 

