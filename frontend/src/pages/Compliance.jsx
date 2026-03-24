import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Testimonial from '../components/Testimonial';
import Contact from '../components/Contact';
import Loader from '../components/common/Loader/Loader';
import { HiOutlineArrowRight } from 'react-icons/hi2';
import {
  HiBuildingOffice2, HiDocumentCheck, HiHeart, HiUserGroup,
  HiCurrencyDollar, HiBuildingStorefront, HiDocumentText,
  HiGift, HiStar, HiUsers,
} from 'react-icons/hi2';
import complianceBg from '../assets/compliance bg.webp';
import '../styles/pages/Compliance.css';

const complianceServices = [
  { Icon: HiBuildingOffice2,    slug: 'factory-act',          title: 'Factory Act',                      desc: 'Complete factory compliance and licensing services for your manufacturing setup.' },
  { Icon: HiDocumentCheck,      slug: 'digital-signature',    title: 'Digital Signature',                desc: 'Secure digital signature certification for all your business transactions.' },
  { Icon: HiHeart,              slug: 'esic',                 title: 'ESIC Registration',                desc: 'Employee state insurance registration for workplace and employee benefits.' },
  { Icon: HiUserGroup,          slug: 'contract-labour',      title: 'Contract Labour Act',              desc: 'Stay legal with proper contract labour act compliance and documentation.' },
  { Icon: HiCurrencyDollar,     slug: 'provident-fund',       title: 'Provident Fund Act',               desc: 'EPF/Provident Fund (PF) registration and ongoing compliance.' },
  { Icon: HiBuildingStorefront, slug: 'shops-establishment',  title: 'Shops & Establishment Act',        desc: 'Registration and compliance with shops and establishment regulations.' },
  { Icon: HiDocumentText,       slug: 'professional-tax',     title: 'Professional Tax Registration',    desc: 'Professional tax registration and compliance for your business.' },
  { Icon: HiGift,               slug: 'gratuity',             title: 'Gratuity Act Compliance',          desc: 'Management and compliance of gratuity benefits for employees.' },
  { Icon: HiStar,               slug: 'bonus-act',            title: 'Bonus Act Compliance',             desc: 'Legal compliance with bonus act regulations and employee benefits.' },
  { Icon: HiUsers,              slug: 'employee-compensation',title: "Employee's Compensation Act",      desc: 'Proper management of employee compensation and related compliance.' },
];

const Compliance = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <Loader />;

  return (
    <>
      <Header />
      <div className="compliance">
        <div className="hero-section">
          <img src={complianceBg} alt="" className="page-hero-bg" />
          <div className="page-hero-overlay" />
          <div className="page-hero-content">
            <h1>Compliance &amp; Licensing</h1>
          </div>
        </div>

        <div className="page-container">
          <div className="services-grid">
            {complianceServices.map((s) => (
              <div
                key={s.slug}
                className="service-card"
                onClick={() => navigate(`/compliance/${s.slug}`)}
              >
                <div className="icon-container">
                  <s.Icon />
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <div className="card-arrow">
                  <HiOutlineArrowRight />
                  <span>Learn More</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Testimonial />
        <Contact />
      </div>
      <Footer />
    </>
  );
};

export default Compliance;
