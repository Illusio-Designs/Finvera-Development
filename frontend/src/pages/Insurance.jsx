import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Testimonial from '../components/Testimonial';
import Contact from '../components/Contact';
import Loader from '../components/common/Loader/Loader';
import { HiOutlineArrowRight } from 'react-icons/hi2';
import '../styles/pages/Insurance.css';
import insuranceBg from '../assets/insurance bg.webp';

const insuranceServices = [
  { icon: 'fas fa-car',                  slug: 'motor-vehicle',         title: 'Motor & Vehicle Insurance',    desc: 'Expert assistance for motor vehicle insurance claims and settlements.' },
  { icon: 'fas fa-hand-holding-medical', slug: 'health',                title: 'Health Insurance',             desc: 'We help resolve medical claim disputes and insurance settlement concerns.' },
  { icon: 'fas fa-ship',                 slug: 'marine',                title: 'Marine Insurance',             desc: 'Covering cargo damage, ship-to-shore, and marine liability issues.' },
  { icon: 'fas fa-fire-extinguisher',    slug: 'fire',                  title: 'Fire Insurance',               desc: 'Assistance in property damage claims and insurance service.' },
  { icon: 'fas fa-user-shield',          slug: 'employee-compensation', title: 'Employee Compensation Policy', desc: 'Helping employees deal with injury benefits compensation settlements.' },
];

const Insurance = () => {
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
      <div className="insurance-page">
        <div className="hero-section">
          <img src={insuranceBg} alt="" className="page-hero-bg" />
          <div className="page-hero-overlay" />
          <div className="page-hero-content">
            <h1>Insurance</h1>
          </div>
        </div>

        <div className="page-container">
          <div className="services-grid">
            {insuranceServices.map((s) => (
              <div
                key={s.slug}
                className="service-card"
                onClick={() => navigate(`/insurance/${s.slug}`)}
              >
                <div className="icon-container">
                  <i className={s.icon}></i>
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

export default Insurance;
