import React, { useState, useEffect } from 'react';
import Header from './Header';
import Footer from './Footer';
import Loader from './common/Loader/Loader';
import '../styles/pages/ServiceDetail.css';

const ServiceDetailPage = ({
  heroImage,
  heroTitle,
  heroSubtitle,
  introTitle,
  introParagraphs,
  introImage,
  offersTitle = 'What We Offer',
  offers,
}) => {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(t);
  }, []);

  if (loading) return <Loader />;

  return (
    <>
      <Header />
      <div className="service-detail-page">
        {/* Hero */}
        <div className="hero-section">
          <img src={heroImage} alt="" className="page-hero-bg" />
          <div className="page-hero-overlay" />
          <div className="page-hero-content">
            <h1>{heroTitle}</h1>
            {heroSubtitle && <p>{heroSubtitle}</p>}
          </div>
        </div>

        <div className="sd-body">
          {/* Intro — text left, image right */}
          <div className="sd-intro">
            <div className="sd-intro-text">
              <h2>{introTitle}</h2>
              {introParagraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <div className="sd-intro-image">
              <img src={introImage} alt={heroTitle} />
            </div>
          </div>

          {/* Offers */}
          {offers && offers.length > 0 && (
            <div className="sd-offers">
              <h2>{offersTitle}</h2>
              <div className="sd-offers-grid">
                {offers.map((o, i) => (
                  <div className="sd-offer-card" key={i}>
                    <h4>{o.title}</h4>
                    <p>{o.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ServiceDetailPage;
