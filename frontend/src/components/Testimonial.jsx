import { memo, useState, useEffect } from 'react';
import '../styles/components/Testimonial.css';
import { FaQuoteLeft, FaStar } from 'react-icons/fa';
import { HiXMark } from 'react-icons/hi2';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');

// ── Review Form Modal ──────────────────────────────────────────
const ReviewModal = ({ onClose }) => {
  const [form, setForm] = useState({ author: '', role: '', text: '', rating: 5 });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        // Refresh reviews so new one shows immediately
        fetch(`${API}/reviews`)
          .then(r => r.json())
          .then(d => { if (d.success && d.reviews.length > 0) window.dispatchEvent(new Event('reviews-updated')); })
          .catch(() => {});
      } else alert(data.message || 'Failed to submit.');
    } catch { alert('Failed to submit. Please try again.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="review-modal-backdrop" onClick={onClose}>
      <div className="review-modal" onClick={e => e.stopPropagation()}>
        <button className="review-modal-close" onClick={onClose}><HiXMark /></button>

        {submitted ? (
          <div className="review-success">
            <div className="review-success-icon">✓</div>
            <h3>Thank You!</h3>
            <p>Your review has been submitted and is now live!</p>
            <button className="review-submit-btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className="review-modal-header">
              <span className="review-modal-tag">Share Your Experience</span>
              <h2>Write a Review</h2>
            </div>
            <form onSubmit={handleSubmit} className="review-form">
              <div className="review-form-row">
                <div className="review-form-group">
                  <label>Your Name *</label>
                  <input name="author" value={form.author} onChange={handleChange} placeholder="Full name" required />
                </div>
                <div className="review-form-group">
                  <label>Role / Company</label>
                  <input name="role" value={form.role} onChange={handleChange} placeholder="e.g. Business Owner" />
                </div>
              </div>

              <div className="review-form-group">
                <label>Rating *</label>
                <div className="review-star-picker">
                  {[1,2,3,4,5].map(n => (
                    <button
                      type="button" key={n}
                      className={`review-star ${n <= form.rating ? 'active' : ''}`}
                      onClick={() => setForm(p => ({ ...p, rating: n }))}
                    >★</button>
                  ))}
                </div>
              </div>

              <div className="review-form-group">
                <label>Your Review *</label>
                <textarea name="text" value={form.text} onChange={handleChange} rows={4} placeholder="Share your experience with Radhe Consultancy..." required />
              </div>

              <button type="submit" className="review-submit-btn" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Review →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

// ── Card ──────────────────────────────────────────────────────
const TestimonialCard = ({ t }) => (
  <div className="tcard">
    <FaQuoteLeft className="tcard-quote" />
    <p className="tcard-text">{t.text}</p>
    <div className="tcard-footer">
      <div className="tcard-avatar">{t.author.charAt(0)}</div>
      <div>
        <div className="tcard-author">{t.author}</div>
        <div className="tcard-role">{t.role}</div>
      </div>
      <div className="tcard-stars">
        {Array.from({ length: t.rating }).map((_, i) => <FaStar key={i} />)}
      </div>
    </div>
  </div>
);

// ── Main ──────────────────────────────────────────────────────
const Testimonial = () => {
  const [reviews, setReviews] = useState([]);
  const [showModal, setShowModal] = useState(false);useEffect(() => {
    const load = () => {
      fetch(`${API}/reviews`)
        .then(r => r.json())
        .then(data => { if (data.success && data.reviews.length > 0) setReviews(data.reviews); })
        .catch(() => {});
    };
    load();
    window.addEventListener('reviews-updated', load);
    return () => window.removeEventListener('reviews-updated', load);
  }, []);

  const allCards = [...reviews, ...reviews];

  return (
    <section className="testimonial-section">
      <div className="testimonial-header">
        <p className="testimonial-tag">Client Testimonials</p>
        <h2>What Our Clients Say</h2>
        <p className="testimonial-sub">Trusted by businesses across Gujarat for compliance, insurance & legal services.</p>
        <button className="add-review-btn" onClick={() => setShowModal(true)}>+ Add Your Review</button>
      </div>

      <div className="testimonial-track-wrapper">
        {reviews.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#9aa3b5', padding: '40px 0' }}>No reviews yet. Be the first to share your experience!</p>
        ) : (
          <div className="testimonial-track">
            {[...reviews, ...reviews].map((t, i) => <TestimonialCard key={i} t={t} />)}
          </div>
        )}
      </div>

      {showModal && <ReviewModal onClose={() => setShowModal(false)} />}
    </section>
  );
};

export default memo(Testimonial);
