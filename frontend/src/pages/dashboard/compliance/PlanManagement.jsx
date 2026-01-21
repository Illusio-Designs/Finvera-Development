import React, { useState, useEffect } from "react";
import {
  BiCheck,
  BiX,
  BiUpload,
  BiFile,
  BiUser,
  BiCalendar,
  BiEdit,
  BiShield,
  BiTrendingUp,
  BiErrorCircle,
  BiDownload,
} from "react-icons/bi";
import { planManagementAPI } from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import "../../../styles/pages/dashboard/compliance/Compliance.css";
import "../../../styles/components/StatCards.css";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../../contexts/AuthContext";
import DocumentDownload from "../../../components/common/DocumentDownload";

// File Upload Modal
const FileUploadModal = ({ onClose, onUpload }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    setLoading(true);
    try {
      await onUpload(files);
      toast.success('Files uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload files');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Upload Files">
      <div className="insurance-form">
        <div className="insurance-form-grid">
          <div className="file-upload-group">
            <label className="file-upload-label">Select Files</label>
            <div className="file-upload-container">
          <input
            type="file"
            multiple
            onChange={handleFileChange}
                className="file-upload-input"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
          />
              <Button
                type="button"
                variant="outlined"
                className="file-upload-button"
                onClick={() => document.querySelector('input[type="file"]').click()}
              >
                <BiUpload className="mr-2" />
                Choose Files
              </Button>
            </div>
          <small className="text-gray-500">
            Allowed file types: PDF, Word, Excel, Images, Text (Max 10MB each, up to 10 files)
          </small>
          </div>
        </div>

        {files.length > 0 && (
          <div className="selected-files">
            <h4>Selected Files:</h4>
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <BiFile /> {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            ))}
          </div>
        )}

        <div className="insurance-form-actions">
          <Button onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleUpload} variant="contained" disabled={loading}>
            {loading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Statistics Cards Component
const StatisticsCards = ({ statistics, loading }) => {
  if (loading) {
    return (
      <div className="statistics-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="stat-card loading">
            <div className="stat-icon">
              <div className="loading-placeholder" style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#e5e7eb' }}></div>
            </div>
            <div className="stat-content">
              <div className="stat-number">
                <div className="loading-placeholder" style={{ width: 60, height: 24, backgroundColor: '#e5e7eb', borderRadius: 4 }}></div>
              </div>
              <div className="stat-label">
                <div className="loading-placeholder" style={{ width: 100, height: 16, backgroundColor: '#e5e7eb', borderRadius: 4 }}></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const { total, plan, submit, approved, rejected, recent } = statistics;

  return (
    <div className="statistics-grid">
      <div className="stat-card total">
        <div className="stat-icon">
          <BiShield />
        </div>
        <div className="stat-content">
          <div className="stat-number">{total}</div>
          <div className="stat-label">Total Plans</div>
        </div>
      </div>
      <div className="stat-card plan">
        <div className="stat-icon">
          <BiFile />
        </div>
        <div className="stat-content">
          <div className="stat-number">{plan}</div>
          <div className="stat-label">In Planning</div>
        </div>
      </div>
      <div className="stat-card submit">
        <div className="stat-icon">
          <BiTrendingUp />
        </div>
        <div className="stat-content">
          <div className="stat-number">{submit}</div>
          <div className="stat-label">Submitted</div>
        </div>
      </div>
      <div className="stat-card approved">
        <div className="stat-icon">
          <BiCheck />
        </div>
        <div className="stat-content">
          <div className="stat-number">{approved}</div>
          <div className="stat-label">Approved</div>
        </div>
      </div>
      <div className="stat-card rejected">
        <div className="stat-icon">
          <BiErrorCircle />
        </div>
        <div className="stat-content">
          <div className="stat-number">{rejected}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>
      <div className="stat-card recent">
        <div className="stat-icon">
          <BiCalendar />
        </div>
        <div className="stat-content">
          <div className="stat-number">{recent}</div>
          <div className="stat-label">Recent (30 days)</div>
        </div>
      </div>
    </div>
  );
};

// Reject Modal
const RejectModal = ({ onClose, onReject }) => {
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReject = async () => {
    if (!remarks.trim()) {
      toast.error('Please enter remarks for rejection');
      return;
    }

    setLoading(true);
    try {
      await onReject(remarks);
      toast.success('Plan rejected successfully');
    } catch (error) {
      toast.error('Failed to reject plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Reject Plan">
      <div className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
              className="insurance-form-input"
            rows="4"
            placeholder="Enter rejection remarks..."
            required
          />
          </div>
        </div>

        <div className="insurance-form-actions">
          <Button onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleReject} variant="contained" disabled={loading}>
            Reject
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Main Plan Management Component
const PlanManagement = ({ searchQuery = "" }) => {
  const [plans, setPlans] = useState([]);
  const [filteredPlans, setFilteredPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planManagers, setPlanManagers] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });
  const { user } = useAuth();
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  // Handle search when searchQuery changes
  useEffect(() => {
    if (searchQuery && searchQuery.trim() !== "") {
      handleSearchPlans(searchQuery);
    } else {
      setFilteredPlans(plans);
    }
  }, [searchQuery, plans]);

  const handleSearchPlans = async (query) => {
    try {
      const response = await planManagementAPI.searchPlans(query);
      if (response.success) {
        setFilteredPlans(response.data);
      }
    } catch (error) {
      console.error('Error searching plans:', error);
      // Fallback to local search
      const filtered = plans.filter(plan => 
        plan.companyName?.toLowerCase().includes(query.toLowerCase()) ||
        plan.status?.toLowerCase().includes(query.toLowerCase()) ||
        plan.planManager?.username?.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredPlans(filtered);
    }
  };

  useEffect(() => {
    fetchPlanManagementRecords(1, 10);
    fetchPlanStatistics();
  }, []);

  const fetchPlanManagementRecords = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      console.log('PlanManagement: Fetching plans for page:', page, 'pageSize:', pageSize);
      const response = await planManagementAPI.getAllPlanManagement({
        page,
        pageSize,
        status: statusFilter === 'all' ? undefined : statusFilter
      });
      
      if (response.success) {
        setPlans(response.data || []);
        setFilteredPlans(response.data || []);
        if (response.pagination) {
          setPagination({
            currentPage: response.pagination.currentPage || page,
            pageSize: response.pagination.itemsPerPage || pageSize,
            totalPages: response.pagination.totalPages || 1,
            totalItems: response.pagination.totalItems || 0,
          });
        }
        setError(null);
      } else {
        setError("Failed to fetch plan management records");
      }
    } catch (err) {
      console.error("Error fetching plan management records:", err);
      setError("Failed to fetch plan management records");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await planManagementAPI.getStatistics();
      if (response && response.data) {
        setStatistics(response.data);
      } else {
        console.error("Failed to fetch plan management statistics:", response);
        setStatistics({
          total: 0,
          plan: 0,
          submit: 0,
          approved: 0,
          rejected: 0,
          recent: 0
        });
      }
    } catch (error) {
      console.error("Error fetching plan management statistics:", error);
      setStatistics({
        total: 0,
        plan: 0,
        submit: 0,
        approved: 0,
        rejected: 0,
        recent: 0
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const handlePageChange = async (page) => {
    console.log("PlanManagement: Page changed to:", page);
    await fetchPlanManagementRecords(page, pagination.pageSize);
  };

  const handlePageSizeChange = async (newPageSize) => {
    console.log("PlanManagement: Page size changed to:", newPageSize);
    
    // Update pagination state first
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));
    
    // Then fetch plans with the new page size
    await fetchPlanManagementRecords(1, newPageSize);
  };

  const handleStatusChange = async (planId, newStatus) => {
    try {
      const currentPlan = plans.find(p => p.id === planId);
      
      if (newStatus === 'Approved') {
        // Show upload modal for approval
        setEditingPlan(currentPlan);
        setShowModal(true);
      } else if (newStatus === 'Reject') {
        // Show reject modal
        setEditingPlan(currentPlan);
        setShowRejectModal(true);
      } else if (newStatus === 'submit') {
        // Submit plan using the new API
        const response = await planManagementAPI.updatePlanStatus(planId, { status: 'submit' });
        if (response.success) {
          toast.success('Plan submitted successfully');
          await fetchPlanManagementRecords();
        }
      } else if (newStatus === 'plan') {
        // Update status to plan
        const response = await planManagementAPI.updatePlanStatus(planId, { status: 'plan' });
        if (response.success) {
          toast.success('Plan status updated successfully');
          await fetchPlanManagementRecords();
        }
      }
    } catch (error) {
      toast.error('Failed to update plan status');
    }
  };

  const handleUploadFiles = async (files) => {
    if (!editingPlan) return;
    
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await planManagementAPI.uploadPlanFiles(editingPlan.id, formData);
      if (response.success) {
        toast.success('Files uploaded and plan approved successfully');
        await fetchPlanManagementRecords();
        setShowModal(false);
        setEditingPlan(null);
      }
    } catch (error) {
      toast.error('Failed to upload files');
    }
  };

  const handleRejectPlan = async (remarks) => {
    if (!editingPlan) return;
    
    try {
      const response = await planManagementAPI.updatePlanStatus(editingPlan.id, {
        status: 'Reject',
        remarks: remarks
      });
      if (response.success) {
        toast.success('Plan rejected successfully');
        await fetchPlanManagementRecords();
        setShowRejectModal(false);
        setEditingPlan(null);
      }
    } catch (error) {
      toast.error('Failed to reject plan');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'plan':
        return 'status-badge-plan';
      case 'submit':
        return 'status-badge-submit';
      case 'Approved':
        return 'status-badge-approved';
      case 'Reject':
        return 'status-badge-reject';
      default:
        return 'status-badge-maked';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
  };

  const columns = [
    {
      key: "sr_no",
      label: "Sr No.",
      sortable: true,
      render: (_, __, index) => index + 1,
    },
    {
      key: "quotation",
      label: "Company Details",
      sortable: true,
      render: (_, record) => (
        <div>
          <div className="text-sm text-gray-500"><strong>Name:</strong>{record.factoryQuotation?.companyName || "-"}</div>
          <div className="text-sm"><strong>Address:</strong> {record.factoryQuotation?.companyAddress || "-"}</div>
          <div className="text-sm"><strong>Email:</strong> {record.factoryQuotation?.email || "-"}</div>
          <div className="text-sm"><strong>Phone:</strong> {record.factoryQuotation?.phone || "-"}</div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Plan Status",
      sortable: true,
      render: (_, record) => (
        <select
          value={record.status}
          onChange={(e) => handleStatusChange(record.id, e.target.value)}
          className={`status-badge-dropdown ${getStatusBadgeClass(record.status)}`}
        >
          <option value="plan">Plan</option>
          <option value="submit">Submit</option>
          <option value="Approved">Approved</option>
          <option value="Reject">Reject</option>
        </select>
      ),
    },
    {
      key: "assignedDate",
      label: "Assigned Date",
      sortable: true,
      render: (_, record) => (
        <div className="flex items-center gap-1">
          <BiCalendar />
          {formatDate(record.created_at)}
        </div>
      ),
    },
    {
      key: "submittedDate",
      label: "Submitted Date",
      sortable: true,
      render: (_, record) => (
        record.submitted_at ? (
          <div className="flex items-center gap-1">
            <BiCalendar />
            {formatDate(record.submitted_at)}
          </div>
        ) : "-"
      ),
    },
    {
      key: "reviewedDate",
      label: "Reviewed Date",
      sortable: true,
      render: (_, record) => (
        record.reviewed_at ? (
          <div className="flex items-center gap-1">
            <BiCalendar />
            {formatDate(record.reviewed_at)}
          </div>
        ) : "-"
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <DocumentDownload
            system="plan-management"
            recordId={record.id}
            buttonText=""
            buttonClass="action-button action-button-secondary action-button-small"
            showIcon={true}
            filePath={record.upload_option ? `/uploads/plan_management/${record.upload_option}` : null}
            fileName={record.upload_option || 'plan-document.pdf'}
          />
        </div>
      ),
    },
  ];

  const filteredRecords = React.useMemo(() => {
    return filteredPlans;
  }, [filteredPlans]);

  // Add error boundary for unexpected errors
  if (!plans || !filteredPlans || !statistics) {
    return (
      <div className="insurance">
        <div className="insurance-container">
          <div className="insurance-content">
            <div className="insurance-header">
              <h1 className="insurance-title">Plan Management</h1>
              <div className="plan-manager-info">
                <BiUser /> Welcome, {user?.username || 'Plan Manager'}
              </div>
            </div>
            <div className="insurance-error">
              <BiErrorCircle className="inline mr-2" /> Loading plan management data...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Plan Management</h1>
            <div className="plan-manager-info">
              <BiUser /> Welcome, {user?.username || 'Plan Manager'}
            </div>
          </div>

          {error && (
            <div className="insurance-error">
              <BiX className="inline mr-2" /> {error}
            </div>
          )}

          {/* Statistics Cards */}
          <div className="statistics-section">
            <h2 className="statistics-title">Plan Management Statistics</h2>
            <StatisticsCards statistics={statistics} loading={statsLoading} />
          </div>

        {loading ? (
          <Loader size="large" color="primary" />
        ) : (
          <TableWithControl
            data={filteredRecords}
            columns={columns}
            defaultPageSize={pagination.pageSize}
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            serverSidePagination={true}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        )}
      </div>

        {showModal && (
          <FileUploadModal
            onClose={() => {
              setShowModal(false);
              setEditingPlan(null);
            }}
            onUpload={handleUploadFiles}
          />
        )}

        {showRejectModal && (
          <RejectModal
            onClose={() => {
              setShowRejectModal(false);
              setEditingPlan(null);
            }}
            onReject={handleRejectPlan}
          />
        )}

        {/* Document Download Modal */}
        {showDocumentModal && editingPlan && (
          <Modal
            isOpen={showDocumentModal}
            onClose={() => setShowDocumentModal(false)}
            title="Download Documents"
          >
            <DocumentDownload 
              system="plan-management" 
              recordId={editingPlan.id} 
            />
          </Modal>
        )}
      </div>
    </div>
  );
}

export default PlanManagement; 
