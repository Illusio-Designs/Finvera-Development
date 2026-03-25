import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Loader from '../components/common/Loader/Loader';
import { HiOutlineArrowRight, HiOutlineCalendar, HiOutlineTag } from 'react-icons/hi2';
import blogBg from '../assets/blog bg.webp';
import img from '../assets/Mask group (1).webp';
import img1 from '../assets/Mask group (2).webp';
import '../styles/pages/Blog.css';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const POSTS_PER_PAGE = 6;

const fallbackImages = [img, img1, img, img1, img, img1];

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const Blog = () => {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/blogs?page=${currentPage}&limit=${POSTS_PER_PAGE}`);
        const data = await res.json();
        if (data.success) {
          setPosts(data.blogs);
          setTotalPages(data.totalPages);
        }
      } catch {
        // silently fail — empty state shown
      } finally {
        setLoading(false);
      }
    };
    fetchBlogs();
  }, [currentPage]);

  const getImage = (post, idx) => {
    if (post.cover_image) return `${BACKEND_URL}${post.cover_image}`;
    return fallbackImages[idx % fallbackImages.length];
  };

  if (loading) return <Loader />;

  return (
    <>
      <Header />
      <div className="blog-page">
        <div className="hero-section">
          <img src={blogBg} alt="" className="page-hero-bg" />
          <div className="page-hero-overlay" />
          <div className="page-hero-content">
            <h1>Our Blog</h1>
            <p>Insights, updates and expert advice on labour law & insurance</p>
          </div>
        </div>

        <div className="blog-container">
          <div className="blog-section-header">
            <span className="blog-tag">Latest Articles</span>
            <h2>News &amp; Insights from Radhe Consultancy</h2>
          </div>

          <div className="blog-grid">
            {posts.length === 0 ? (
              <div className="blog-empty-state">
                <p>No blog posts published yet. Check back soon.</p>
              </div>
            ) : posts.map((post, idx) => (
              <Link to={`/blog/${post.slug}`} key={post.blog_id} className="blog-card-link">
                <article className="blog-card">
                  <div className="blog-card-image">
                    <img src={getImage(post, idx)} alt={post.title} />
                    {post.category && <span className="blog-category-badge">{post.category}</span>}
                  </div>
                  <div className="blog-card-body">
                    <div className="blog-meta">
                      <span><HiOutlineCalendar /> {formatDate(post.created_at)}</span>
                    </div>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <div className="blog-read-more">Read More <HiOutlineArrowRight /></div>
                  </div>
                </article>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="blog-pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={`page-btn ${p === currentPage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(p)}
                >{p}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Blog;
