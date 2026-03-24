import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Testimonial from '../components/Testimonial';
import Pagination from '../components/common/Pagination';
import Loader from '../components/common/Loader/Loader';
import OptimizedImage from '../components/OptimizedImage';
import { HiOutlineArrowRight } from 'react-icons/hi2';
import img from "../assets/Mask group (1).webp";
import img1 from "../assets/Mask group (2).webp";
import blogBg from "../assets/blog bg.webp";
import '../styles/pages/Blog.css';

const blogPosts = [
  {
    id: 1,
    title: 'Factory License Renewal Success Story',
    image: img,
    excerpt: 'How we helped a manufacturing company renew their factory license within 15 days, ensuring zero production downtime.'
  },
  {
    id: 2,
    title: 'ESIC Compliance Made Simple',
    image: img1,
    excerpt: 'Complete guide to ESIC registration and compliance for small businesses with step-by-step documentation process.'
  },
  {
    id: 3,
    title: 'Motor Insurance Claim Settlement',
    image: img,
    excerpt: 'Successfully processed motor insurance claim worth ₹2.5 lakhs for commercial vehicle accident within 30 days.'
  },
  {
    id: 4,
    title: 'Health Policy Benefits Maximized',
    image: img1,
    excerpt: 'How proper health insurance planning saved a family ₹8 lakhs in medical expenses during critical illness.'
  },
  {
    id: 5,
    title: 'DSC Implementation for SMEs',
    image: img,
    excerpt: 'Digital Signature Certificate setup and training for 50+ employees in manufacturing sector for seamless operations.'
  },
  {
    id: 6,
    title: 'Fire Insurance Claim Success',
    image: img1,
    excerpt: 'Complete fire insurance claim settlement of ₹15 lakhs for textile factory with proper documentation support.'
  },
  {
    id: 7,
    title: 'Employee Compensation Case Win',
    image: img,
    excerpt: 'Successfully secured employee compensation for workplace injury with full legal support and documentation.'
  },
  {
    id: 8,
    title: 'Labour License Compliance Guide',
    image: img1,
    excerpt: 'Comprehensive labour license compliance checklist for construction companies operating in Gujarat.'
  },
  {
    id: 9,
    title: 'Life Insurance Planning Success',
    image: img,
    excerpt: 'Strategic life insurance planning that provided ₹50 lakhs coverage with optimal premium structure for young professionals.'
  },
  {
    id: 10,
    title: 'Factory Act Compliance Audit',
    image: img1,
    excerpt: 'Complete Factory Act compliance audit and rectification for 100+ employee manufacturing unit in Ahmedabad.'
  },
  {
    id: 11,
    title: 'Vehicle Policy Renewal Automation',
    image: img,
    excerpt: 'Automated vehicle policy renewal system implementation for fleet of 25 commercial vehicles saving 60% time.'
  },
  {
    id: 12,
    title: 'Legal Consultation Success Story',
    image: img1,
    excerpt: 'Resolved complex labour dispute through expert legal consultation, avoiding costly litigation for manufacturing company.'
  }
];

const POSTS_PER_PAGE = 6;

const Blog = () => {
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const totalPages = Math.ceil(blogPosts.length / POSTS_PER_PAGE);
  
  const getCurrentPosts = () => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    const endIndex = startIndex + POSTS_PER_PAGE;
    return blogPosts.slice(startIndex, endIndex);
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <>
      <Header />
      <div className="blog">
      <div className="hero-section">
        <img src={blogBg} alt="" className="page-hero-bg" />
        <div className="page-hero-overlay" />
        <div className="page-hero-content">
          <h1>Blogs</h1>
        </div>
      </div>
        <div className="page-container">
          <p>News</p>
          <h1>The Latest News <br /> And Blog From Northman</h1>
          <div className="blog-grid">
            {getCurrentPosts().map((post) => (
              <Link to={`/bloginner?title=${encodeURIComponent(post.title)}`} key={post.id} className="blog-card-link">
                <article className="blog-card">
                  <div className="blog-image">
                    <OptimizedImage 
                      src={post.image} 
                      alt={post.title}
                    />
                  </div>
                  <div className="blog-content">
                    <h2>{post.title}</h2>
                    <p className="blog-excerpt">{post.excerpt}</p>
                    <button className="read-more">Read More →</button>
                  </div>
                </article>
              </Link>
            ))}
          </div>
          <div className="pagination-wrapper">
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div> 
        <Testimonial />
      </div>
      <Footer />
    </>
  );
};

export default Blog; 
