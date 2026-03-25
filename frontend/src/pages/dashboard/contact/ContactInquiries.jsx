import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { BiTrash, BiEnvelope, BiPhone, BiUser, BiNews, BiTrendingUp, BiCheckCircle } from 'react-icons/bi';
import TableWithControl from '../../../components/common/Table/TableWithControl';
import ActionButton from '../../../components/common/ActionButton/ActionButton';
import Modal from '../../../components/common/Modal/Modal';
import Loader from '../../../components/common/Loader/Loader';
import '../../../styles/pages/dashboard/insurance/Insurance.css';
import '../../../styles/components/StatCards.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const STATUS_COLORS = {
  new:     { bg: '#fef9c3', color: '#ca8a04' },
  read:    { bg: '#dbeafe', color: '#1d4ed8' },
  replied: { bg: '#dcfce7', color: '#16a34a' },
};

const ContactInquiries = () => {
  const [tab, setTab]               = useState('inquiries');
  const [inquiries, setInquiries]   = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selected, setSelected]     = useState(null); // for message modal

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchInquiries = async (p = 1, ps = pageSize) => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/contact/inquiries?page=${p}&limit=${ps}`, { headers });
      const data = await res.json();
      if (data.success) { setInquiries(data.inquiries); setTotalPages(data.totalPages); setTotalItems(data.totalItems); }
    } catch { toast.error('Failed to load inquiries'); }
    finally { setLoading(false); }
  };

  const fetchSubscribers = async (p = 1, ps = pageSize) => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/contact/subscribers?page=${p}&limit=${ps}`, { headers });
      const data = await res.json();
      if (data.success) { setSubscribers(data.subscribers); setTotalPages(data.totalPages); setTotalItems(data.totalItems); }
    } catch { toast.error('Failed to load subscribers'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    setPage(1);
    if (tab === 'inquiries') fetchInquiries(1, pageSize);
    else fetchSubscribers(1, pageSize);
  }, [tab]);

  const handleStatusChange = async (id, status) => {
    try {
      const res  = await fetch(`${API}/contact/inquiries/${id}/status`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const data = await res.json();
      if (data.success) { toast.success('Status updated'); fetchInquiries(page, pageSize); }
    } catch { toast.error('Failed to update status'); }
  };

  const handleDeleteInquiry = async (id) => {
    if (!window.confirm('Delete this inquiry?')) return;
    try {
      const res  = await fetch(`${API}/contact/inquiries/${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.success) { toast.success('Deleted'); fetchInquiries(page, pageSize); }
    } catch { toast.error('Failed to delete'); }
  };

  const handleDeleteSubscriber = async (id) => {
    if (!window.confirm('Delete this subscriber?')) return;
    try {
      const res  = await fetch(`${API}/contact/subscribers/${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.success) { toast.success('Deleted'); fetchSubscribers(page, pageSize); }
    } catch { toast.error('Failed to delete'); }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // Stats
  const newCount     = inquiries.filter(i => i.status === 'new').length;
  const repliedCount = inquiries.filter(i => i.status === 'replied').length;

  // Inquiry columns
  const inquiryColumns = [
    { key: 'sr', label: 'Sr No.', render: (_, __, i) => (page - 1) * pageSize + i + 1 },
    {
      key: 'name', label: 'Name', sortable: true,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#eef2fb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1F4F9C', flexShrink: 0 }}><BiUser /></div>
          <div>
            <div style={{ fontWeight: 600, color: '#0a1a3c' }}>{r.first_name} {r.last_name}</div>
            <div style={{ fontSize: '0.75rem', color: '#9aa3b5' }}>{formatDate(r.created_at)}</div>
          </div>
        </div>
      )
    },
    { key: 'email', label: 'Email', sortable: true, render: (_, r) => <a href={`mailto:${r.email}`} style={{ color: '#1F4F9C' }}>{r.email}</a> },
    { key: 'phone', label: 'Phone', render: (_, r) => <a href={`tel:${r.phone}`} style={{ color: '#1F4F9C' }}>{r.phone}</a> },
    {
      key: 'message', label: 'Message',
      render: (_, r) => r.message
        ? <span style={{ cursor: 'pointer', color: '#1F4F9C', textDecoration: 'underline' }} onClick={() => setSelected(r)}>View</span>
        : <span style={{ color: '#ccc' }}>—</span>
    },
    {
      key: 'status', label: 'Status', sortable: true,
      render: (_, r) => (
        <select
          value={r.status}
          onChange={e => handleStatusChange(r.id, e.target.value)}
          style={{ border: 'none', borderRadius: 50, padding: '3px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: STATUS_COLORS[r.status]?.bg, color: STATUS_COLORS[r.status]?.color }}
        >
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
        </select>
      )
    },
    {
      key: 'actions', label: 'Actions',
      render: (_, r) => (
        <div className="insurance-actions">
          <ActionButton variant="danger" size="small" onClick={() => handleDeleteInquiry(r.id)}><BiTrash /></ActionButton>
        </div>
      )
    }
  ];

  // Subscriber columns
  const subscriberColumns = [
    { key: 'sr', label: 'Sr No.', render: (_, __, i) => (page - 1) * pageSize + i + 1 },
    { key: 'email', label: 'Email', sortable: true, render: (_, r) => <a href={`mailto:${r.email}`} style={{ color: '#1F4F9C' }}>{r.email}</a> },
    {
      key: 'status', label: 'Status',
      render: (_, r) => (
        <span style={{ background: r.status === 'active' ? '#dcfce7' : '#f3f4f6', color: r.status === 'active' ? '#16a34a' : '#6b7280', fontSize: '0.78rem', fontWeight: 600, padding: '3px 10px', borderRadius: 50 }}>
          {r.status}
        </span>
      )
    },
    { key: 'created_at', label: 'Subscribed On', sortable: true, render: (_, r) => formatDate(r.created_at) },
    {
      key: 'actions', label: 'Actions',
      render: (_, r) => (
        <div className="insurance-actions">
          <ActionButton variant="danger" size="small" onClick={() => handleDeleteSubscriber(r.id)}><BiTrash /></ActionButton>
        </div>
      )
    }
  ];

  if (loading && inquiries.length === 0 && subscribers.length === 0) return <Loader />;

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Contact & Newsletter</h1>
          </div>

          {/* Stat Cards */}
          <div className="statistics-section">
            <div className="statistics-grid">
              <div className="stat-card total">
                <div className="stat-icon"><BiEnvelope /></div>
                <div className="stat-content">
                  <div className="stat-number">{totalItems}</div>
                  <div className="stat-label">{tab === 'inquiries' ? 'Total Inquiries' : 'Total Subscribers'}</div>
                </div>
              </div>
              {tab === 'inquiries' && <>
                <div className="stat-card active">
                  <div className="stat-icon"><BiNews /></div>
                  <div className="stat-content">
                    <div className="stat-number">{newCount}</div>
                    <div className="stat-label">New</div>
                  </div>
                </div>
                <div className="stat-card recent">
                  <div className="stat-icon"><BiCheckCircle /></div>
                  <div className="stat-content">
                    <div className="stat-number">{repliedCount}</div>
                    <div className="stat-label">Replied</div>
                  </div>
                </div>
              </>}
            </div>
          </div>

          {/* Tabs */}
          <div className="tab-navigation" style={{ marginBottom: 24 }}>
            <button className={`tab-button ${tab === 'inquiries' ? 'active' : ''}`} onClick={() => setTab('inquiries')}>
              <BiEnvelope className="tab-icon" /> Contact Inquiries
            </button>
            <button className={`tab-button ${tab === 'subscribers' ? 'active' : ''}`} onClick={() => setTab('subscribers')}>
              <BiTrendingUp className="tab-icon" /> Newsletter Subscribers
            </button>
          </div>

          <TableWithControl
            data={tab === 'inquiries' ? inquiries : subscribers}
            columns={tab === 'inquiries' ? inquiryColumns : subscriberColumns}
            loading={loading}
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            defaultPageSize={pageSize}
            onPageChange={(p) => { setPage(p); tab === 'inquiries' ? fetchInquiries(p, pageSize) : fetchSubscribers(p, pageSize); }}
            onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); tab === 'inquiries' ? fetchInquiries(1, ps) : fetchSubscribers(1, ps); }}
            serverSidePagination={true}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>
      </div>

      {/* Message Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Message Details">
        {selected && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px 0', fontSize: '0.9rem' }}>
              <span style={{ color: '#9aa3b5', fontWeight: 600 }}>Name</span>
              <span style={{ color: '#0a1a3c', fontWeight: 600 }}>{selected.first_name} {selected.last_name}</span>
              <span style={{ color: '#9aa3b5', fontWeight: 600 }}>Email</span>
              <a href={`mailto:${selected.email}`} style={{ color: '#1F4F9C' }}>{selected.email}</a>
              <span style={{ color: '#9aa3b5', fontWeight: 600 }}>Phone</span>
              <a href={`tel:${selected.phone}`} style={{ color: '#1F4F9C' }}>{selected.phone}</a>
              <span style={{ color: '#9aa3b5', fontWeight: 600 }}>Date</span>
              <span>{formatDate(selected.created_at)}</span>
              <span style={{ color: '#9aa3b5', fontWeight: 600, paddingTop: 8 }}>Message</span>
              <p style={{ color: '#374151', lineHeight: 1.7, margin: 0, paddingTop: 8 }}>{selected.message || '—'}</p>
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <a href={`mailto:${selected.email}`} style={{ background: '#1F4F9C', color: '#fff', padding: '9px 20px', borderRadius: 8, textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>
                Reply via Email
              </a>
              <button onClick={() => setSelected(null)} style={{ background: '#f3f4f6', color: '#374151', padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ContactInquiries;
