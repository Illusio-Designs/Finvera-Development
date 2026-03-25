import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Loader from '../components/common/Loader/Loader';
import { HiOutlineCalendar, HiOutlineArrowRight, HiOutlineArrowLeft } from 'react-icons/hi2';
import blogBg from '../assets/blog bg.webp';
import img from '../assets/Mask group (1).webp';
import img1 from '../assets/Mask group (2).webp';
import '../styles/pages/Bloginner.css';

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
const imgUrl = (p) => (!p ? null : p.startsWith('http') ? p : `${BACKEND_URL}${p}`);

const fallbackImages = [img, img1, img, img1];

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const Bloginner = () => {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [blog, setBlog] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }
    const fetchBlog = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/blogs/${slug}`);
        const data = await res.json();
        if (data.success) {
          setBlog(data.blog);
          setRecentPosts(data.recentPosts || []);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchBlog();
  }, [slug]);

  const getImage = (post, idx) => {
    if (post?.cover_image) return imgUrl(post.cover_image);
    return fallbackImages[idx % fallbackImages.length];
  };

  if (loading) return <Loader />;

  if (notFound) return (
    <>
      <Header />
      <div className="bloginner-page">
        <div className="hero-section">
          <img src={blogBg} alt="" className="page-hero-bg" />
          <div className="page-hero-overlay" />
          <div className="page-hero-content"><h1>Blog Not Found</h1></div>
        </div>
        <div className="bi-body" style={{ textAlign: 'center', padding: '80px 5%' }}>
          <p style={{ color: '#7a8499', marginBottom: 24 }}>The blog post you're looking for doesn't exist.</p>
          <Link to="/blog" className="bi-back-btn"><HiOutlineArrowLeft /> Back to Blog</Link>
        </div>
      </div>
      <Footer />
    </>
  );

  return (
    <>
      <Header />
      <div className="bloginner-page">
        {/* Hero */}
        <div className="hero-section">
          <img src={blogBg} alt="" className="page-hero-bg" />
          <div className="page-hero-overlay" />
          <div className="page-hero-content">
            <span className="bi-hero-category">{blog.category}</span>
            <h1>{blog.title}</h1>
            <div className="bi-hero-meta">
              <span><HiOutlineCalendar /> {formatDate(blog.created_at)}</span>
              <span>By {blog.author}</span>
            </div>
          </div>
        </div>

        <div className="bi-body">
          <div className="bi-layout">
            {/* Main content */}
            <main className="bi-main">
              {blog.cover_image && (
                <div className="bi-cover">
                  <img src={imgUrl(blog.cover_image)} alt={blog.title} />
                </div>
              )}
              <div
                className="bi-content"
                dangerouslySetInnerHTML={{ __html: blog.content.replace(/\n/g, '<br/>') }}
              />
              {blog.tags && blog.tags.length > 0 && (
                <div className="bi-tags">
                  {blog.tags.map((t, i) => <span key={i} className="bi-tag">{t}</span>)}
                </div>
              )}
              <Link to="/blog" className="bi-back-btn">
                <HiOutlineArrowLeft /> Back to Blog
              </Link>
            </main>

            {/* Sidebar */}
            <aside className="bi-sidebar">
              <div className="bi-sidebar-card">
                <h4>Recent Posts</h4>
                <div className="bi-recent-list">
                  {recentPosts.length > 0 ? recentPosts.map((p, i) => (
                    <Link to={`/blog/${p.slug}`} key={p.blog_id} className="bi-recent-item">
                      <img src={getImage(p, i)} alt={p.title} />
                      <div>
                        <p>{p.title}</p>
                        <span>{formatDate(p.created_at)}</span>
                      </div>
                    </Link>
                  )) : fallbackImages.map((img, i) => (
                    <div key={i} className="bi-recent-item">
                      <img src={img} alt="post" />
                      <div>
                        <p>Labour Law Compliance Guide</p>
                        <span>Jan 2025</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bi-sidebar-cta">
                <h4>Need Expert Help?</h4>
                <p>Our team is ready to assist you with all compliance and insurance needs.</p>
                <Link to="/contact" className="bi-cta-btn">Contact Us <HiOutlineArrowRight /></Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Bloginner;
