import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Testimonials from '../components/Testimonial';
import Loader from '../components/common/Loader/Loader';
import OptimizedImage from '../components/OptimizedImage';
import '../styles/pages/Bloginner.css';
import blog from '../assets/bloginner1.webp';
import blog1 from '../assets/bloginner2.webp';
import blog2 from '../assets/bloginner3.webp';
import img from "../assets/Mask group (1).webp";
import img1 from "../assets/Mask group (2).webp";

const Bloginner = () => {
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const title = searchParams.get('title');

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
      <div className="bloginner">
        <div className="hero-section">
            <div className="hero-content">
                <h1>{title || 'Blog Post'}</h1>
            </div>
        </div>
      
        <div className="blogmain-wrapper">
      <div className="bloginner-image">
        <OptimizedImage src={blog} alt="blog" />
      </div>
      
      <div className="bloginner-content-wrapper">
        {/* Main Blog Content */}
        <div className="bloginner-main">
          <h2>23 Cases Have Been Successfully</h2>

          <p>Factory License Renewal is a critical compliance requirement for manufacturing businesses in Gujarat. At Radhe Consultancy, we have successfully processed over 500+ factory license renewals, ensuring zero production downtime for our clients. Our streamlined process includes document verification, application submission, and follow-up with regulatory authorities.</p><br />

          <p>The Factory Act of 1948 mandates that all manufacturing units employing 10 or more workers with power, or 20 or more workers without power, must obtain and regularly renew their factory license. Our expert team ensures complete compliance with all regulatory requirements, including safety protocols, worker welfare measures, and environmental clearances.</p><br />

        <p>Our comprehensive factory license renewal service includes pre-renewal audit, documentation preparation, regulatory liaison, and post-approval compliance monitoring. We work closely with the Factory Inspector's office to ensure smooth processing and timely approval. Our clients benefit from our deep understanding of Gujarat's industrial regulations and our established relationships with regulatory authorities.</p><br />

          <p>The renewal process typically involves submission of Form 2A along with required documents such as building plan approval, fire safety certificate, pollution clearance, and worker welfare compliance certificates. Our team meticulously prepares all documentation to avoid any delays or rejections. We also provide ongoing compliance support to ensure your factory operations remain legally compliant throughout the license period.</p><br />

          <p>With our proven track record of 100% success rate in factory license renewals, Radhe Consultancy has become the trusted partner for manufacturing companies across Gujarat. Our clients include textile mills, chemical plants, pharmaceutical companies, and engineering units. We pride ourselves on delivering timely, cost-effective solutions that keep your business operations running smoothly while maintaining full regulatory compliance.</p>

        </div>
        {/* Recommendation News Sidebar */}
        <div className="bloginner-sidebar">
          <h4>Recommendation News</h4>
          <div className="sidebar-news-item">
            <OptimizedImage src={img} alt="news" />
            <div>
              <h2>ESIC Compliance Made Simple</h2>
             <p>Complete guide to ESIC registration process. read more</p>
            </div>
          </div>
          <div className="sidebar-news-item">
            <OptimizedImage src={img1} alt="news" />
            <div>
              <h2>Motor Insurance Claim Success</h2>
              <p>₹2.5 lakhs claim settled within 30 days. read more</p>
            </div>
          </div>
          <div className="sidebar-news-item">
            <OptimizedImage src={img} alt="news" />
            <div>
              <h2>DSC Implementation Guide</h2>
              <p>Digital signatures for 50+ employees setup. read more</p>
            </div>
          </div>
        </div>
      </div>
      {/* Longest Handled Cases Section */}
      <div className="longest-cases-section">
        <h2>Longest Handled Cases</h2>
        <div className="longest-cases-cards">
          <div className="case-card">
            <OptimizedImage src={blog1} alt="case" />
            <h2>The Case of Giant Theft of Money at the Bank</h2>
          </div>
          <div className="case-card">
            <OptimizedImage src={blog2} alt="case" />
            <h2>Mysterious Murder Cases in Manila City</h2>
          </div>
        </div>
        <p>Our most complex cases demonstrate our expertise in handling challenging compliance and insurance scenarios. The Giant Theft case involved comprehensive insurance claim processing and legal documentation for a major financial institution, while the Manila City case required extensive investigation and regulatory compliance coordination. These cases showcase our ability to manage multi-faceted legal and compliance challenges.</p><br /> 
        <p>Each complex case requires detailed documentation, regulatory coordination, and strategic planning. Our team works closely with legal experts, insurance companies, and regulatory authorities to ensure comprehensive resolution. We maintain detailed case files and provide regular updates to clients throughout the process, ensuring transparency and accountability at every step.</p><br />
        <p>The success of these challenging cases has established Radhe Consultancy as a leader in complex compliance and insurance matters. Our systematic approach, combined with deep regulatory knowledge and strong industry relationships, enables us to deliver successful outcomes even in the most difficult situations. We continue to build our expertise through continuous learning and adaptation to evolving regulatory landscapes.</p>
      </div>
        </div>
      </div>
   
        <div className="help">
          <h1>We Help You With Quality Legal Lawyer</h1>
          <p>With over 8 years of experience in HR & Labor Law Compliance, Radhe Consultancy provides expert legal consultation and comprehensive compliance solutions. Our team of qualified professionals ensures your business stays compliant with all regulatory requirements while maximizing operational efficiency.</p>
          <div className="help-btn" onClick={handleContactClick}>Contact Now →</div>
        </div>
        <Testimonials />
      <Footer />
    </>
  );
};

export default Bloginner;

