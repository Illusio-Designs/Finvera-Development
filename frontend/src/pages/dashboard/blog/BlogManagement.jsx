import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { BiPlus, BiEdit, BiTrash, BiNews, BiTrendingUp, BiCalendar } from 'react-icons/bi';
import TableWithControl from '../../../components/common/Table/TableWithControl';
import Button from '../../../components/common/Button/Button';
import ActionButton from '../../../components/common/ActionButton/ActionButton';
import Modal from '../../../components/common/Modal/Modal';
import Loader from '../../../components/common/Loader/Loader';
import '../../../styles/pages/dashboard/insurance/Insurance.css';
import '../../../styles/components/StatCards.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
// Base URL without /api suffix for constructing image URLs
const BASE_URL = API.replace(/\/api$/, '');

// Helper: build full image URL
const imgUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path}`;
};
const CATEGORIES = ['General', 'Compliance', 'Insurance', 'Labour Law', 'DSC', 'News'];

// ── Blog Form ──────────────────────────────────────────────────
const BlogForm = ({ blog, onClose, onSaved }) => {
  const [form, setForm] = useState({
    title: blog?.title || '',
    excerpt: blog?.excerpt || '',
    content: blog?.content || '',
    category: blog?.category || 'General',
    tags: Array.isArray(blog?.tags) ? blog.tags.join(', ') : '',
    author: blog?.author || 'Radhe Consultancy',
    status: blog?.status || 'published',
    cover_image: null,
  });
  const [preview, setPreview] = useState(blog?.cover_image ? imgUrl(blog.cover_image) : null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setForm(p => ({ ...p, cover_image: file }));
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'cover_image') { if (v) fd.append('cover_image', v); }
        else fd.append(k, v);
      });
      const url = blog ? `${API}/blogs/${blog.blog_id}` : `${API}/blogs`;
      const method = blog ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success(blog ? 'Blog updated!' : 'Blog published!');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to save blog');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="insurance-form-grid">
        <div className="insurance-form-group" style={{ gridColumn: 'span 2' }}>
          <label className="insurance-form-label">Title *</label>
          <input name="title" value={form.title} onChange={handleChange} placeholder="Blog title" className="insurance-form-input" required />
        </div>

        <div className="insurance-form-group">
          <label className="insurance-form-label">Category</label>
          <select name="category" value={form.category} onChange={handleChange} className="insurance-form-input">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="insurance-form-group">
          <label className="insurance-form-label">Status</label>
          <select name="status" value={form.status} onChange={handleChange} className="insurance-form-input">
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div className="insurance-form-group">
          <label className="insurance-form-label">Author</label>
          <input name="author" value={form.author} onChange={handleChange} className="insurance-form-input" />
        </div>

        <div className="insurance-form-group">
          <label className="insurance-form-label">Tags (comma separated)</label>
          <input name="tags" value={form.tags} onChange={handleChange} placeholder="compliance, esic, pf" className="insurance-form-input" />
        </div>

        <div className="insurance-form-group" style={{ gridColumn: 'span 2' }}>
          <label className="insurance-form-label">Excerpt</label>
          <textarea name="excerpt" value={form.excerpt} onChange={handleChange} rows={2} placeholder="Short description shown on blog listing..." className="insurance-form-input" style={{ resize: 'vertical' }} />
        </div>

        <div className="insurance-form-group" style={{ gridColumn: 'span 2' }}>
          <label className="insurance-form-label">Content *</label>
          <textarea name="content" value={form.content} onChange={handleChange} rows={14} placeholder="Write full blog content here..." className="insurance-form-input" style={{ resize: 'vertical', minHeight: 280 }} required />
        </div>

        <div className="insurance-form-group" style={{ gridColumn: 'span 2' }}>
          <label className="insurance-form-label">Cover Image</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eef2fb', color: '#1F4F9C', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
              📷 {preview ? 'Change Image' : 'Upload Cover Image'}
              <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            </label>
            {preview && <img src={preview} alt="preview" style={{ height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid #e4eaf5' }} />}
          </div>
        </div>
      </div>

      <div className="insurance-form-actions">
        <Button type="button" variant="outlined" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? 'Saving...' : blog ? 'Update Blog' : 'Publish Blog'}
        </Button>
      </div>
    </form>
  );
};

// ── Stat Cards ─────────────────────────────────────────────────
const StatCards = ({ total, published, draft }) => (
  <div className="statistics-section">
    <div className="statistics-grid">
      <div className="stat-card total">
        <div className="stat-icon"><BiNews /></div>
        <div className="stat-content">
          <div className="stat-number">{total}</div>
          <div className="stat-label">Total Posts</div>
        </div>
      </div>
      <div className="stat-card active">
        <div className="stat-icon"><BiTrendingUp /></div>
        <div className="stat-content">
          <div className="stat-number">{published}</div>
          <div className="stat-label">Published</div>
        </div>
      </div>
      <div className="stat-card recent">
        <div className="stat-icon"><BiCalendar /></div>
        <div className="stat-content">
          <div className="stat-number">{draft}</div>
          <div className="stat-label">Drafts</div>
        </div>
      </div>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────
const BlogManagement = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filter, setFilter] = useState('all');

  const fetchBlogs = async (p = 1, ps = pageSize) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/blogs/admin/all?page=${p}&limit=${ps}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBlogs(data.blogs);
        setTotalPages(data.totalPages);
        setTotalItems(data.totalItems);
      }
    } catch {
      toast.error('Failed to load blogs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBlogs(page, pageSize); }, [page, pageSize]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this blog post?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/blogs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success('Blog deleted');
      fetchBlogs(page, pageSize);
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleSaved = () => {
    setShowModal(false);
    setSelected(null);
    fetchBlogs(page, pageSize);
  };

  const published = blogs.filter(b => b.status === 'published').length;
  const draft = blogs.filter(b => b.status === 'draft').length;
  const filteredBlogs = filter === 'all' ? blogs : blogs.filter(b => b.status === filter);

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const columns = [
    {
      key: 'sr_no', label: 'Sr No.',
      render: (_, __, i) => (page - 1) * pageSize + i + 1,
    },
    {
      key: 'cover_image', label: 'Cover',
      render: (_, b) => b.cover_image
        ? <img src={imgUrl(b.cover_image)} alt="" style={{ width: 200, height: 'auto', objectFit: 'cover', borderRadius: 6 }} />
        : <div style={{ width: 56, height: 42, background: '#eef2fb', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa3b5' }}>📷</div>
    },
    {
      key: 'title', label: 'Title', sortable: true,
      render: (_, b) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0a1a3c' }}>{b.title}</div>
          <div style={{ fontSize: '0.75rem', color: '#9aa3b5' }}>{b.slug}</div>
        </div>
      )
    },
    {
      key: 'category', label: 'Category', sortable: true,
      render: (_, b) => (
        <span style={{ background: '#eef2fb', color: '#1F4F9C', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 50 }}>
          {b.category}
        </span>
      )
    },
    {
      key: 'status', label: 'Status', sortable: true,
      render: (_, b) => (
        <span style={{
          fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 50,
          background: b.status === 'published' ? '#dcfce7' : '#fef9c3',
          color: b.status === 'published' ? '#16a34a' : '#ca8a04'
        }}>
          {b.status}
        </span>
      )
    },
    { key: 'views', label: 'Views', sortable: true, render: (_, b) => b.views || 0 },
    { key: 'created_at', label: 'Date', sortable: true, render: (_, b) => formatDate(b.created_at) },
    {
      key: 'actions', label: 'Actions',
      render: (_, b) => (
        <div className="insurance-actions">
          <ActionButton variant="secondary" size="small" onClick={() => { setSelected(b); setShowModal(true); }}>
            <BiEdit />
          </ActionButton>
          <ActionButton variant="danger" size="small" onClick={() => handleDelete(b.blog_id)}>
            <BiTrash />
          </ActionButton>
        </div>
      )
    }
  ];

  if (loading && blogs.length === 0) return <Loader />;

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Blog Management</h1>
            <Button variant="contained" onClick={() => { setSelected(null); setShowModal(true); }}>
              <BiPlus /> New Blog Post
            </Button>
          </div>

          <StatCards total={totalItems} published={published} draft={draft} />

          {/* Filter Tabs */}
          <div className="tab-navigation" style={{ marginBottom: '24px' }}>
            <button className={`tab-button ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              <BiNews className="tab-icon" /> All Posts
            </button>
            <button className={`tab-button ${filter === 'published' ? 'active' : ''}`} onClick={() => setFilter('published')}>
              <BiTrendingUp className="tab-icon" /> Published
            </button>
            <button className={`tab-button ${filter === 'draft' ? 'active' : ''}`} onClick={() => setFilter('draft')}>
              <BiCalendar className="tab-icon" /> Drafts
            </button>
          </div>

          <TableWithControl
            data={filteredBlogs}
            columns={columns}
            loading={loading}
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            defaultPageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
            serverSidePagination={true}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>

        <Modal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setSelected(null); }}
          title={selected ? 'Edit Blog Post' : 'New Blog Post'}
          size="large"
        >
          <BlogForm
            blog={selected}
            onClose={() => { setShowModal(false); setSelected(null); }}
            onSaved={handleSaved}
          />
        </Modal>
      </div>
    </div>
  );
};

export default BlogManagement;
