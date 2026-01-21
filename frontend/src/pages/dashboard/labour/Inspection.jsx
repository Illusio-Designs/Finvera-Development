import React, { useState, useEffect } from "react";
import { BiPlus, BiEdit, BiErrorCircle, BiFile, BiUpload, BiShield, BiTrendingUp, BiCalendar, BiTrash, BiFilter, BiCheckCircle } from "react-icons/bi";
import { labourInspectionAPI, companyAPI } from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import Dropdown from "../../../components/common/Dropdown/Dropdown";
import "../../../styles/pages/dashboard/labour/Labour.css";
import "../../../styles/components/StatCards.css";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../../contexts/AuthContext";

// Statistics Cards Component
const StatisticsCards = ({ statistics, loading }) => {
  if (loading) {
    return (
      <div className="statistics-section">
        <div className="statistics-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card">
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
      </div>
    );
  }

  const stats = statistics?.data || {};

  return (
    <div className="statistics-section">
      <div className="statistics-grid">
        <div className="stat-card total">
          <div className="stat-icon">
            <BiShield />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.total || 0}</div>
            <div className="stat-label">Total Inspections</div>
          </div>
        </div>
        
        <div className="stat-card active">
          <div className="stat-icon">
            <BiCalendar />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.pending || 0}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        
        <div className="stat-card recent">
          <div className="stat-icon">
            <BiTrendingUp />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.running || 0}</div>
            <div className="stat-label">Running</div>
          </div>
        </div>
        
        <div className="stat-card rejected">
          <div className="stat-icon">
            <BiCheckCircle />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.complete || 0}</div>
            <div className="stat-label">Complete</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Labour Inspection Form Component
const LabourInspectionForm = ({ inspection, onClose, onInspectionUpdated }) => {
  const [formData, setFormData] = useState({
    company_id: '',
    document_upload: '',
    document_name: '',
    date_of_notice: '',
    officer_name: '',
    remarks: '',
    status: 'pending'
  });

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCompanies();
    if (inspection) {
      setFormData({
        company_id: inspection.company_id || '',
        document_upload: inspection.document_upload || '',
        document_name: inspection.document_name || '',
        date_of_notice: inspection.date_of_notice ? inspection.date_of_notice.split('T')[0] : '',
        officer_name: inspection.officer_name || '',
        remarks: inspection.remarks || '',
        status: inspection.status || 'pending'
      });
    }
  }, [inspection]);

  const fetchCompanies = async () => {
    try {
      // Fetch all companies with a large page size to ensure we get all companies
      const response = await companyAPI.getAllCompanies({ pageSize: 9999 });
      if (response.success) {
        setCompanies(response.companies || response.data || []);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate required fields
    if (!formData.company_id || !formData.date_of_notice || !formData.officer_name) {
      setError('Company, Date of Notice, and Officer Name are required');
      setLoading(false);
      return;
    }

    try {
      if (inspection) {
        await labourInspectionAPI.updateInspection(inspection.inspection_id, formData);
        toast.success('Labour inspection updated successfully!');
      } else {
        await labourInspectionAPI.createInspection(formData);
        toast.success('Labour inspection created successfully!');
      }
      onInspectionUpdated();
      onClose();
    } catch (error) {
      setError(error.message || 'Failed to save inspection');
      toast.error(error.message || 'Failed to save inspection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
            <select
              name="company_id"
              value={formData.company_id}
              onChange={handleChange}
              className="insurance-form-input"
              required
            >
              <option value="">Select Company</option>
              {companies.map(company => (
                <option key={company.company_id} value={company.company_id}>
                  {company.company_name} ({company.company_code})
                </option>
              ))}
            </select>
          </div>

          <div className="insurance-form-group">
            <input
              type="date"
              name="date_of_notice"
              value={formData.date_of_notice}
              onChange={handleChange}
              className="insurance-form-input"
              required
            />
          </div>

          <div className="insurance-form-group">
            <input
              type="text"
              name="officer_name"
              value={formData.officer_name}
              onChange={handleChange}
              placeholder="Officer Name"
              className="insurance-form-input"
              required
            />
          </div>

          <div className="insurance-form-group">
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="insurance-form-input"
            >
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="complete">Complete</option>
            </select>
          </div>

          <div className="file-upload-group">
            <label className="file-upload-label">Document Upload</label>
            <div className="file-upload-container">
              <input
                type="file"
                name="document_upload"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setFormData(prev => ({
                      ...prev,
                      document_upload: file.name,
                      document_name: file.name
                    }));
                  }
                }}
                className="file-upload-input"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <Button
                type="button"
                variant="outlined"
                className="file-upload-button"
                onClick={() => document.querySelector('input[name="document_upload"]').click()}
              >
                <BiUpload className="mr-2" />
                Choose File
              </Button>
            </div>
            <small className="text-gray-600 text-xs mt-1">
              Upload inspection documents (PDF, Word, Images)
            </small>
          </div>

          <div className="insurance-form-group">
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              placeholder="Additional remarks or notes..."
              className="insurance-form-input"
              rows="3"
            />
          </div>
        </div>

        {error && (
          <div className="insurance-form-error">
            <BiErrorCircle className="inline mr-2" /> {error}
          </div>
        )}

        <div className="insurance-form-actions">
          <Button type="button" variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {inspection ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </>
  );
};

// Main Labour Inspection Component
const LabourInspection = ({ searchQuery = "" }) => {
  console.log('[LabourInspection] Component rendered with searchQuery:', searchQuery);
  
  const [inspections, setInspections] = useState([]);
  const [filteredInspections, setFilteredInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });
  const { user, userRoles } = useAuth();

  // Handle search when searchQuery changes
  useEffect(() => {
    console.log('[LabourInspection] searchQuery changed:', searchQuery);
    if (searchQuery && searchQuery.trim() !== "") {
      console.log('[LabourInspection] Calling handleSearchInspections with:', searchQuery);
      handleSearchInspections(searchQuery);
    } else {
      console.log('[LabourInspection] Setting filteredInspections to all inspections');
      setFilteredInspections(inspections);
    }
  }, [searchQuery, inspections]);

  const handleSearchInspections = async (query) => {
    console.log('[LabourInspection] handleSearchInspections called with query:', query);
    try {
      const response = await labourInspectionAPI.searchInspections(query);
      console.log('[LabourInspection] Search API response:', response);
      if (response.success) {
        setFilteredInspections(response.data);
        console.log('[LabourInspection] Search results set:', response.data);
      }
    } catch (error) {
      console.error('Error searching inspections:', error);
      // Fallback to local search
      const filtered = inspections.filter(inspection => 
        inspection.company?.company_name?.toLowerCase().includes(query.toLowerCase()) ||
        inspection.officer_name?.toLowerCase().includes(query.toLowerCase()) ||
        inspection.status?.toLowerCase().includes(query.toLowerCase())
      );
      console.log('[LabourInspection] Local search fallback results:', filtered);
      setFilteredInspections(filtered);
    }
  };

  useEffect(() => {
    fetchInspections(1, 10);
    fetchStatistics();
  }, []);

  const fetchInspections = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      console.log('Inspection: Fetching inspections for page:', page, 'pageSize:', pageSize);
      const params = {
        page,
        pageSize,
      };
      
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await labourInspectionAPI.getAllInspections(params);
      if (response.success) {
        setInspections(response.data || []);
        setFilteredInspections(response.data || []);
        if (response.pagination) {
          setPagination({
            currentPage: response.pagination.currentPage || page,
            pageSize: response.pagination.itemsPerPage || pageSize,
            totalPages: response.pagination.totalPages || 1,
            totalItems: response.pagination.totalItems || 0,
          });
        }
      }
    } catch (error) {
      setError(error.message || 'Failed to fetch inspections');
      toast.error(error.message || 'Failed to fetch inspections');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await labourInspectionAPI.getStatistics();
      if (response.success) {
        setStatistics(response);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedInspection(null);
  };

  const handleEdit = (inspection) => {
    setSelectedInspection(inspection);
    setShowModal(true);
  };

  const handleDelete = async (inspection) => {
    if (window.confirm('Are you sure you want to delete this inspection?')) {
      try {
        await labourInspectionAPI.deleteInspection(inspection.inspection_id);
        toast.success('Inspection deleted successfully!');
        await fetchInspections(pagination.currentPage, pagination.pageSize);
        fetchStatistics();
      } catch (error) {
        toast.error(error.message || 'Failed to delete inspection');
      }
    }
  };

  const handlePageChange = async (page) => {
    console.log("Inspection: Page changed to:", page);
    await fetchInspections(page, pagination.pageSize);
  };

  const handlePageSizeChange = async (newPageSize) => {
    console.log("Inspection: Page size changed to:", newPageSize);
    
    // Update pagination state first
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));
    
    // Then fetch inspections with the new page size
    await fetchInspections(1, newPageSize);
  };

  const handleInspectionUpdated = () => {
    fetchInspections(pagination.currentPage, pagination.pageSize);
    fetchStatistics();
  };

  // Handle inline status change
  const handleStatusChange = async (inspectionId, newStatus) => {
    try {
      setUpdatingStatus(prev => ({ ...prev, [inspectionId]: true }));
      
      // Get the current inspection data to check expiry
      const currentInspection = filteredInspections.find(insp => insp.inspection_id === inspectionId);
      
      // Check if email service should be stopped
      let shouldStopEmails = false;
      let stopReason = '';
      
      if (newStatus === 'complete') {
        shouldStopEmails = true;
        stopReason = 'Status marked as complete';
      } else if (currentInspection && currentInspection.expiry_date) {
        const expiryDate = new Date(currentInspection.expiry_date);
        const today = new Date();
        const daysSinceExpiry = Math.ceil((today - expiryDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceExpiry > 15) {
          shouldStopEmails = true;
          stopReason = `Expired more than 15 days ago (${daysSinceExpiry} days)`;
        }
      }
      
      // Update the inspection status
      const response = await labourInspectionAPI.updateInspection(inspectionId, { 
        status: newStatus,
        email_service_active: !shouldStopEmails // Add this field to track email service status
      });
      
      if (response.success) {
        toast.success(`Status updated to ${newStatus} successfully`);
        
        // Show notification about email service if stopped
        if (shouldStopEmails) {
          toast.info(`Email service stopped: ${stopReason}`);
        }
        
        await fetchInspections();
        await fetchStatistics();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [inspectionId]: false }));
    }
  };

  const canEdit = userRoles.includes('admin') || userRoles.includes('compliance_manager') || userRoles.includes('labour_law_manager');
  const canDelete = userRoles.includes('admin');

  const columns = [
    {
      key: "sr_no",
      label: "Sr No.",
      sortable: true,
      render: (_, __, index) => index + 1,
    },
    {
      key: "company",
      label: "Company",
      sortable: true,
      render: (_, inspection) => (
        <div>
          <div className="font-medium">{inspection.company?.company_name || 'N/A'}</div>
          <div className="text-sm text-gray-500">{inspection.company?.company_code || ''}</div>
        </div>
      ),
    },
    {
      key: "officer_name",
      label: "Officer",
      sortable: true,
      render: (value) => <span className="font-medium">{value}</span>,
    },
    {
      key: "date_of_notice",
      label: "Notice Date",
      sortable: true,
      render: (value) => (
        <div>
          <div>{new Date(value).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })}</div>
        </div>
      ),
    },
    {
      key: "expiry_date",
      label: "Expiry Date",
      sortable: true,
      render: (value, inspection) => {
        const expiryDate = new Date(value);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        const isExpired = expiryDate < today;
        const isExpiringSoon = daysUntilExpiry <= 15 && daysUntilExpiry > 0;
        const isComplete = inspection.status === 'complete';
        
        let statusClass = '';
        let statusText = '';
        let emailServiceStatus = '';
        
        if (isComplete) {
          statusClass = 'complete-highlight';
          statusText = 'COMPLETE';
          emailServiceStatus = 'Email Service: INACTIVE';
        } else if (isExpired) {
          statusClass = 'expired-highlight';
          statusText = 'EXPIRED';
          emailServiceStatus = 'Email Service: INACTIVE';
        } else if (isExpiringSoon) {
          statusClass = 'expiring-soon-highlight';
          statusText = `${daysUntilExpiry} days left`;
          emailServiceStatus = 'Email Service: ACTIVE';
        } else {
          statusClass = 'active-highlight';
          statusText = 'Active';
          emailServiceStatus = 'Email Service: ACTIVE';
        }
        
        return (
          <div className={`expiry-date-cell ${statusClass}`}>
            <div className="expiry-date">
              {expiryDate.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}
            </div>
            <div className={`expiry-status ${statusClass}`}>
              {statusText}
            </div>
            <div className="email-service-status">
              {emailServiceStatus}
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value, inspection) => {
        const statusClass = 
          value === 'pending' ? 'status-badge-pending' :
          value === 'running' ? 'status-badge-running' :
          value === 'complete' ? 'status-badge-complete' : 'status-badge-default';
        
        // If user can edit, show interactive dropdown
        if (canEdit) {
          const isUpdating = updatingStatus[inspection.inspection_id];
          return (
            <div className="status-dropdown-container">
              <select
                value={value || 'pending'}
                onChange={(e) => handleStatusChange(inspection.inspection_id, e.target.value)}
                className={`status-badge-dropdown ${statusClass}`}
                disabled={isUpdating}
              >
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="complete">Complete</option>
              </select>
              {isUpdating && (
                <div className="status-updating-indicator">
                  <Loader size="small" />
                </div>
              )}
            </div>
          );
        }
        
        // For read-only users, show status badge
        return (
          <span className={`status-badge ${statusClass}`}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, inspection) => (
        <div className="insurance-actions">
          {canEdit && (
            <ActionButton
              onClick={() => handleEdit(inspection)}
              variant="secondary"
              size="small"
              title="Edit"
            >
              <BiEdit />
            </ActionButton>
          )}
          
          
          {canDelete && (
            <ActionButton
              onClick={() => handleDelete(inspection)}
              variant="danger"
              size="small"
              title="Delete"
            >
              <BiTrash />
            </ActionButton>
          )}
        </div>
      ),
    },
  ];

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "pending", label: "Pending" },
    { value: "running", label: "Running" },
    { value: "complete", label: "Complete" },
  ];

  const handleFilterChange = () => {
    fetchInspections();
  };

  const handleSearch = () => {
    fetchInspections();
  };

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Labour Law Inspection</h1>
            <div className="list-container">
              {canEdit && (
                <Button
                  variant="contained"
                  onClick={() => setShowModal(true)}
                  icon={<BiPlus />}
                >
                  Add Inspection
                </Button>
              )}
              
              <div className="dashboard-header-dropdown-container">
                <Dropdown
                  options={statusOptions}
                  value={statusOptions.find((opt) => opt.value === statusFilter)}
                  onChange={(option) => {
                    setStatusFilter(option ? option.value : "all");
                    handleFilterChange();
                  }}
                  placeholder="Filter by Status"
                />
              </div>
            </div>
          </div>

          
          <StatisticsCards statistics={statistics} loading={statsLoading} />
          
          {error && (
            <div className="insurance-error">
              <BiErrorCircle className="inline mr-2" /> {error}
            </div>
          )}

        {loading ? (
          <Loader size="large" color="primary" />
        ) : (
          <TableWithControl
            data={filteredInspections}
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

        <Modal
          isOpen={showModal}
          onClose={handleModalClose}
          title={selectedInspection ? "Edit Labour Inspection" : "Add New Labour Inspection"}
        >
          <LabourInspectionForm
            inspection={selectedInspection}
            onClose={handleModalClose}
            onInspectionUpdated={handleInspectionUpdated}
          />
        </Modal>
      </div>
    </div>
  );
};

export default LabourInspection;
