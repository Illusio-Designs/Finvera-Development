import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { BiPlus, BiEdit, BiTrash, BiImage } from 'react-icons/bi';
import Button from '../../../components/common/Button/Button';
import Modal from '../../../components/common/Modal/Modal';
import Loader from '../../../components/common/Loader/Loader';
import '../../../styles/pages/dashboard/blog/BlogManagement.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CATEGORIES = ['General', 'Compliance', 'Insurance', 'Labour Law', 'DSC', 'News'];

const emptyForm = { title: '', excerpt: '', content: '', category: 'General', tags: '', author: 'Radhe Consultancy', status: 'published', cover_image: null };

// ── Blog Form ──────────────────────────────────────────────────
const BlogForm = ({ blog, onClose, onSaved }) => {
  const [form, setForm] = useState(blog ? {
    title: blog.title,
    excerpt: blog.excerpt || '',
    content: blog.content,
    category: blog.category || 'General',
    tags: Array.isArray(blog.tags) ? blog.tags.join(', ') : '',
    author: blog.author || 'Radhe Consultancy',
    status: blog.status || 'published',
    cover_image: null,
  } : { ...emptyForm });
  const [preview, setPreview] = useState(blog?.cover_image ? `${API}${blog.cover_image}` : null);
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

      const url = blog ? `${API}/api/blogs/${blog.blog_id}` : `${API}/api/blogs`;
      const method = blog ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success(blog ? 'Blog updated!' : 'Blog created!');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to save blog');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="blog-form">
      <div className="blog-form-grid">
        <div className="bf-group bf-full">
          <label>Title *</label>
          <input name="title" value={form.title} onChange={handleChange} placeholder="Blog title" className="bf-input" required />
        </div>

        <div className="bf-group">
          <label>Category</label>
          <select name="category" value={form.category} onChange={handleChange} className="bf-input">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="bf-group">
          <label>Status</label>
          <select name="status" value={form.status} onChange={handleChange} className="bf-input">
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div className="bf-group">
          <label>Author</label>
          <input name="author" value={form.author} onChange={handleChange} className="bf-input" />
        </div>

        <div className="bf-group">
          <label>Tags (comma separated)</label>
          <input name="tags" value={form.tags} onChange={handleChange} placeholder="e.g. compliance, esic, pf" className="bf-input" />
        </div>

        <div className="bf-group bf-full">
          <label>Excerpt (short description)</label>
          <textarea name="excerpt" value={form.excerpt} onChange={handleChange} rows={2} placeholder="Brief summary shown on blog listing..." className="bf-input" />
        </div>

        <div className="bf-group bf-full">
          <label>Content *</label>
          <textarea name="content" value={form.content} onChange={handleChange} rows={12} placeholder="Write your full blog content here..." className="bf-input bf-content" required />
        </div>

        <div className="bf-group bf-full">
          <label>Cover Image</label>
          <div className="bf-image-upload">
            <label className="bf-image-label" htmlFor="cover_image_input">
              <BiImage /> {preview ? 'Change Image' : 'Upload Cover Image'}
            </label>
            <input id="cover_image_input" type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            {preview && <img src={preview} alt="preview" className="bf-image-preview" />}
          </div>
        </div>
      </div>

      <div className="bf-actions">
        <Button type="button" variant="outlined" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving...' : blog ? 'Update Blog' : 'Publish Blog'}</Button>
      </div>
    </form>
  );
};

// ── Main Component ─────────────────────────────────────────────
const BlogManagement = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchBlogs = async (p = 1) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/blogs/admin/all?page=${p}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBlogs(data.blogs);
        setTotalPages(data.totalPages);
        setTotalItems(data.totalItems);
      }
    } catch (err) {
      toast.error('Failed to load blogs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBlogs(page); }, [page]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this blog post?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/blogs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success('Blog deleted');
      fetchBlogs(page);
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleSaved = () => {
    setShowModal(false);
    setSelected(null);
    fetchBlogs(page);
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading && blogs.length === 0) return <Loader />;

  return (
    <div className="blog-mgmt">
      <div className="blog-mgmt-header">
        <div>
          <h2>Blog Management</h2>
          <p>{totalItems} total posts</p>
        </div>
        <Button variant="contained" onClick={() => { setSelected(null); setShowModal(true); }}>
          <BiPlus /> New Blog Post
        </Button>
      </div>

      <div className="blog-mgmt-table-wrap">
        <table className="blog-mgmt-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Cover</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Views</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {blogs.length === 0 ? (
              <tr><td colSpan={8} className="blog-empty">No blog posts yet. Create your first one!</td></tr>
            ) : blogs.map((b, i) => (
              <tr key={b.blog_id}>
                <td>{(page - 1) * 10 + i + 1}</td>
                <td>
                  {b.cover_image
                    ? <img src={`${API}${b.cover_image}`} alt="" className="blog-thumb" />
                    : <div className="blog-thumb-placeholder"><BiImage /></div>
                  }
                </td>
                <td className="blog-title-cell">
                  <span>{b.title}</span>
                  <small>{b.slug}</small>
                </td>
                <td><span className="blog-cat-badge">{b.category}</span></td>
                <td>
                  <span className={`blog-status-badge ${b.status}`}>{b.status}</span>
                </td>
                <td>{b.views}</td>
                <td>{formatDate(b.created_at)}</td>
                <td>
                  <div className="blog-actions">
                    <button className="blog-action-btn edit" onClick={() => { setSelected(b); setShowModal(true); }} title="Edit"><BiEdit /></button>
                    <button className="blog-action-btn delete" onClick={() => handleDelete(b.blog_id)} title="Delete"><BiTrash /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="blog-mgmt-pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} className={`bm-page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setSelected(null); }} title={selected ? 'Edit Blog Post' : 'New Blog Post'} size="large">
        <BlogForm blog={selected} onClose={() => { setShowModal(false); setSelected(null); }} onSaved={handleSaved} />
      </Modal>
    </div>
  );
};

export default BlogManagement;
