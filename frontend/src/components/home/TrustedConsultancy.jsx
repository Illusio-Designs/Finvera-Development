import React, { memo } from 'react';
import OptimizedImage from '../OptimizedImage';
import lawMain from '../../assets/law(3).webp';
import lawTop from '../../assets/law(5).webp';
import lawBottom from '../../assets/law(6).webp';

const TrustedConsultancy = memo(({ handleAboutClick }) => {
  return (
    <div className="about-section">
      <div className="about-inner">

        {/* Left: image collage */}
        <div className="about-images">
          <div className="about-img-main">
            <OptimizedImage src={lawMain} alt="Labour Law Compliance" />
          </div>
          <OptimizedImage src={lawTop} alt="Compliance Services" className="about-img-top" />
          <OptimizedImage src={lawBottom} alt="Legal Consultancy" className="about-img-bottom" />
        </div>

        {/* Right: content */}
        <div className="about-content">
          <span className="about-tag">About Us</span>
          <h2 className="about-heading">Welcome to <span>Radhe Consultancy</span></h2>

          <p className="about-lead">
            A leading Labour Law Consultancy firm based in Rajkot with over 9 years of dedicated experience — helping businesses navigate statutory regulations with confidence and ease.
          </p>

          <p className="about-body">
            Our expertise spans a wide range of labour laws, ensuring organizations remain fully compliant while focusing on their core operations. From registrations and documentation to ongoing compliance management and audits, our approach is proactive, detail-oriented, and aligned with the latest legal updates.
          </p>

          <p className="about-body">
            Our mission is to simplify compliance, minimize risks, and provide peace of mind to businesses of all sizes — whether you are a startup, SME, or established enterprise.
          </p>

          <button className="about-cta" onClick={handleAboutClick}>
            Learn More About Us →
          </button>
        </div>

      </div>
    </div>
  );
});

TrustedConsultancy.displayName = 'TrustedConsultancy';

export default TrustedConsultancy;
