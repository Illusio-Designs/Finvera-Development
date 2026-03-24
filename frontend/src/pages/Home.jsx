import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import Header from '../components/Header';
import Workingwith from '../components/Workingwith';
import Casestudy from '../components/Casestudy';
import Testimonial from '../components/Testimonial';
import Contact from '../components/Contact';
import Footer from '../components/Footer';
import Loader from '../components/common/Loader/Loader';
import OptimizedImage from '../components/OptimizedImage';
import TrustedConsultancy from '../components/home/TrustedConsultancy';
import WhyChooseUs from '../components/home/WhyChooseUs';
import CaseStudySection from '../components/home/CaseStudySection';
import useThrottle from '../hooks/useThrottle';
// Import slider images
import sliderImg1 from "../assets/law.webp";
import sliderImg2 from "../assets/law(4).webp";
import sliderImg3 from "../assets/law(10).webp";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import heroBg from "../assets/Hero bg.webp";
import "../styles/pages/Home.css"

const COMPLIANCE_TABS = [
  {
    label: "Code on Wages 2019",
    acts: [
      "Equal Remuneration Act 1976",
      "Minimum Wages Act 1948",
      "Payment of Bonus Act 1965",
      "Payment of Wages Act 1936",
    ],
  },
  {
    label: "Industrial Relation Code 2020",
    acts: [
      "Trade Unions Act 1926",
      "Industrial Employment (Standing Orders) Act 1946",
      "Industrial Disputes Act 1947",
    ],
  },
  {
    label: "Occupational Safety, Health & Working Conditions Code 2020",
    acts: [
      "Factories Act 1948",
      "Mines Act 1952",
      "Dock Workers Act 1986",
      "Building & Construction Workers Act 1996",
      "Plantations Labour Act 1951",
      "Contract Labour Act 1970",
      "Inter-State Migrant Workmen Act 1979",
      "Motor Transport Workers Act 1961",
      "Sales Promotion Employees Act 1976",
      "Beedi and Cigar Workers Act 1966",
      "Cine Workers Act 1981",
    ],
  },
  {
    label: "Social Security Code 2020",
    acts: [
      "Employees Compensation Act 1923",
      "Employees State Insurance Act 1948",
      "Employees Provident Fund Act 1952",
      "Employment Exchanges Act 1959",
      "Maternity Benefit Act 1961",
      "Payment of Gratuity Act 1972",
      "Cine Workers Welfare Fund Act 1981",
      "Building & Construction Workers Welfare Cess Act 1996",
      "Unorganised Workers Social Security Act 2008",
    ],
  },
];

const ComplianceCard = () => {
  const [hoveredTab, setHoveredTab] = useState(null);

  return (
    <div className="service-card light compliance-card" onMouseLeave={() => setHoveredTab(null)}>
      <h3>Compliance &amp; Licensing</h3>
      <div className="compliance-list">
        {COMPLIANCE_TABS.map((tab, i) => (
          <div
            key={i}
            className={`cl-row${hoveredTab === i ? " hovered" : ""}`}
            onMouseEnter={() => setHoveredTab(i)}
          >
            <span className="cl-num">{i + 1}</span>
            <span className="cl-label">{tab.label}</span>
          </div>
        ))}

        {/* Flyout overlay — covers the list area when hovered */}
        <div className={`cl-flyout${hoveredTab !== null ? " visible" : ""}`}>
          {hoveredTab !== null && (
            <>
              <p className="cl-flyout-title">{COMPLIANCE_TABS[hoveredTab].label}</p>
              <ul>
                {COMPLIANCE_TABS[hoveredTab].acts.map((act, j) => (
                  <li key={j}>
                    <span className="cl-act-num">{j + 1}</span>
                    {act}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      <button className="get-started-btn">Get Started →</button>
    </div>
  );
};

const Home = () => {
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleContactClick = useCallback(() => {
    window.location.href = '/contact';
  }, []);

  const handleAboutClick = useCallback(() => {
    window.location.href = '/about';
  }, []);

  // Dynamic slider data - memoized to prevent recreation
  const sliderData = useMemo(() => [
    {
      subtitle: "Labour Law Compliance",
      title: "Simplifying Compliance, Protecting Your Business",
      image: sliderImg1
    },
    {
      subtitle: "Expert Legal Solutions",
      title: "Professional Legal Services & Consultation",
      image: sliderImg2
    },
    {
      subtitle: "Statutory Compliance Experts",
      title: "Navigate Labour Laws With Confidence & Ease",
      image: sliderImg3
    }
  ], []);

  // Auto slide effect
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentSlide === sliderData.length - 1) {
        // When reaching last slide, disable transition and jump to first
        setIsTransitioning(false);
        setCurrentSlide(0);
        // Re-enable transition after a small delay
        setTimeout(() => {
          setIsTransitioning(true);
        }, 50);
      } else {
        setCurrentSlide(prev => prev + 1);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [currentSlide, sliderData.length]);

  // Navigation functions - defined BEFORE they're used
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const isAtStart = container.scrollLeft <= 0;
    const isAtEnd = container.scrollLeft >= container.scrollWidth - container.clientWidth - 10;
    
    // Only update if values actually changed to prevent re-renders
    setShowLeftArrow(prev => {
      const newValue = !isAtStart;
      return newValue === prev ? prev : newValue;
    });
    setShowRightArrow(prev => {
      const newValue = !isAtEnd;
      return newValue === prev ? prev : newValue;
    });
  }, []);
  
  // Throttle scroll position check to reduce re-renders
  const throttledCheckScrollPosition = useThrottle(checkScrollPosition, 200);

  const nextSlide = useCallback(() => {
    if (currentSlide === sliderData.length - 1) {
      setIsTransitioning(false);
      setCurrentSlide(0);
      setTimeout(() => {
        setIsTransitioning(true);
      }, 50);
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  }, [currentSlide, sliderData.length]);

  useEffect(() => {
    const checkWidth = () => {
      const mobile = window.innerWidth < 500;
      setIsMobile(prev => prev === mobile ? prev : mobile);
      checkScrollPosition();
    };
    
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, [checkScrollPosition]);

  const scrollLeft = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollBy({ left: -container.offsetWidth, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollBy({ left: container.offsetWidth, behavior: 'smooth' });
    }
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <>
      <Header />
      <div className="home-container">
        <div className="hero-section" style={{ backgroundImage: `url(${heroBg})` }}>
          {/* Overlay */}
          <div className="hero-overlay" />

          {/* Slides */}
          <div className="hero-slider">
            {sliderData.map((slide, index) => (
              <div
                key={index}
                className={`slide ${index === currentSlide ? 'active' : ''}`}
              >
                <div className="slide-content">
                  <div className="hero-text">
                    <span className="hero-tag">{slide.subtitle}</span>
                    <h1 className="title">{slide.title}</h1>
                    <div className="hero-btns">
                      <button className="contact-btn" onClick={handleContactClick}>Get In Touch</button>
                      <button className="about-btn" onClick={handleAboutClick}>Learn More →</button>
                    </div>
                  </div>
                  <div className="hero-image">
                    <OptimizedImage src={slide.image} alt="Legal services illustration" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div className="hero-dots">
            {sliderData.map((_, index) => (
              <button
                key={index}
                className={`hero-dot ${currentSlide === index ? 'active' : ''}`}
                onClick={() => setCurrentSlide(index)}
              />
            ))}
          </div>

          {/* Slide counter */}
          <div className="hero-counter">
            <span className="hero-counter-current">{String(currentSlide + 1).padStart(2, '0')}</span>
            <span className="hero-counter-sep" />
            <span className="hero-counter-total">{String(sliderData.length).padStart(2, '0')}</span>
          </div>
        </div>
       
        <TrustedConsultancy handleAboutClick={handleAboutClick} />

        <div className="services-section">
          <p className="services-subtitle">What We Do</p>
          <h2 className="services-title">Legal Services We Offer</h2>
           <div className="services-cards" ref={scrollContainerRef} onScroll={throttledCheckScrollPosition}>
            <ComplianceCard />

            <div className="service-card dark">
              <h3>Insurance</h3>
              <ol className="numbered-list">
                <li>Employee's Compensation Policy (WC Policy)</li>
                <li>Fire Insurance</li>
                <li>Group Personal Accident Policy (GPA)</li>
                <li>Group Mediclaim (GMC)</li>
                <li>Motor &amp; Vehicle Insurance</li>
                <li>Marine Insurance</li>
                <li>Health Insurance</li>
                <li>Public Liability Insurance</li>
              </ol>
              <button className="get-started-btn">Get Started →</button>
            </div>

            <div className="service-card light">
              <h3>Additional Services</h3>
              <ol className="numbered-list">
                <li>Digital Signature</li>
                <li>Labour Law Statutory Audit</li>
              </ol>
              <button className="get-started-btn">Get Started →</button>
            </div>
          </div>
          {isMobile && showLeftArrow && (
            <button 
              onClick={scrollLeft} 
              className="scroll-left-btn"
              aria-label="Scroll left"
            >
              <FaChevronLeft />
            </button>
          )}
          {isMobile && showRightArrow && (
            <button 
              onClick={scrollRight} 
              className="scroll-right-btn"
              aria-label="Scroll right"
            >
              <FaChevronRight />
            </button>
          )}
        </div>
        </div>

        <WhyChooseUs />

        <Workingwith />
        <CaseStudySection />
        <Testimonial />
        <Contact />
     
      <Footer />
    </>
  );
}

export default Home;
