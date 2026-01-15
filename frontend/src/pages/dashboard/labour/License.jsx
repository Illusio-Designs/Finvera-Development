import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../../contexts/AuthContext";
import { labourLicenseAPI } from "../../../services/api";
import { companyAPI } from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import Dropdown from "../../../components/common/Dropdown/Dropdown";
import "../../../styles/pages/dashboard/labour/Labour.css";
import "../../../styles/components/StatCards.css";
import { BiPlus, BiEdit, BiErrorCircle, BiFile, BiTrash, BiShield, BiTrendingUp, BiCalendar, BiCheckCircle, BiDownload, BiRefresh } from "react-icons/bi";
import DocumentDownload from "../../../components/common/DocumentDownload/DocumentDownload";

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

  const stats = statistics || {};
  
  console.log('📊 Stats object:', stats);
  console.log('📊 Total:', stats.total);
  console.log('📊 byStatus:', stats.byStatus);
  console.log('📊 Active:', stats.byStatus?.active);
  console.log('📊 Expired:', stats.byStatus?.expired);
  console.log('📊 Expiring Soon:', stats.expiringSoon);

  return (
    <div className="statistics-section">
      <div className="statistics-grid">
        <div className="stat-card total">
          <div className="stat-icon">
            <BiShield />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.total || 0}</div>
            <div className="stat-label">Total Licenses</div>
          </div>
        </div>
        
        <div className="stat-card active">
          <div className="stat-icon">
            <BiCalendar />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.byStatus?.active || 0}</div>
            <div className="stat-label">Active</div>
          </div>
        </div>
        
        <div className="stat-card recent">
          <div className="stat-icon">
            <BiTrendingUp />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.expiringSoon || 0}</div>
            <div className="stat-label">Expiring Soon</div>
          </div>
        </div>
        
        <div className="stat-card rejected">
          <div className="stat-icon">
            <BiCheckCircle />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.byStatus?.expired || 0}</div>
            <div className="stat-label">Expired</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Labour License Component
const LabourLicense = ({ searchQuery = "" }) => {
  console.log('[LabourLicense] Component rendered with searchQuery:', searchQuery);
  const [licenses, setLicenses] = useState([]);
  const [filteredLicenses, setFilteredLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [companies, setCompanies] = useState([]);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [selectedLicenseForRenewal, setSelectedLicenseForRenewal] = useState(null);
  const [activeTab, setActiveTab] = useState('running');
  const [groupedLicenses, setGroupedLicenses] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });
  const { user, userRoles } = useAuth();

  // Check if user has permission to manage labour licenses
  const canManageLicenses = userRoles?.includes('admin') || 
                           userRoles?.includes('compliance_manager') || 
                           userRoles?.includes('labour_law_manager');

  // Fetch all licenses
  const fetchLicenses = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      
      // Build filters - Running tab ALWAYS shows only active licenses
      const filters = {
        page,
        pageSize,
        status: 'active'  // Always filter for active status in running tab
      };
      
      const response = await labourLicenseAPI.getAllLicenses(filters);
      
      if (response.success) {
        // Check and update expired licenses on the frontend
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const updatedLicenses = response.data.map(license => {
          const expiryDate = new Date(license.expiry_date);
          expiryDate.setHours(0, 0, 0, 0);
          
          // If expiry date has passed but status is not expired, mark it as expired
          if (expiryDate < today && license.status !== 'expired') {
            return { ...license, status: 'expired' };
          }
          return license;
        });
        
        setLicenses(updatedLicenses || []);
        
        // Only set filteredLicenses if we're on the running tab
        if (activeTab === 'running') {
          setFilteredLicenses(updatedLicenses || []);
        }
        
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
      console.error('Error fetching licenses:', error);
      setError(error.message || 'Failed to fetch licenses');
      toast.error(error.message || 'Failed to fetch licenses');
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await labourLicenseAPI.getStatistics();
      console.log('📊 Statistics API response:', response);
      if (response.success) {
        console.log('📊 Statistics data:', response.data);
        setStatistics(response.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch companies for dropdown
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

  // Handle search when searchQuery changes
  useEffect(() => {
    if (searchQuery && searchQuery.trim() !== "") {
      handleSearchLicenses(searchQuery);
    } else {
      // Only update filteredLicenses for running tab
      // For all tab, the client-side filtering useEffect handles it
      if (activeTab === 'running' && licenses.length > 0) {
        setFilteredLicenses(licenses);
      }
    }
  }, [searchQuery, licenses, activeTab]);

  // Initial data fetch
  useEffect(() => {
    // First check and update expired licenses, then fetch data
    const initializeData = async () => {
      try {
        // Check for expired licenses first
        await labourLicenseAPI.checkExpiredLicenses();
      } catch (error) {
        console.error('Error checking expired licenses:', error);
      }
      
      // Then fetch all data
      fetchLicenses(1, 10);
      fetchStatistics();
      fetchCompanies();
    };
    
    initializeData();
    // Don't fetch grouped licenses on initial load - only when user switches to "All" tab
  }, []);

  // Fetch grouped licenses
  const fetchGroupedLicenses = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      console.log('🔍 DEBUG: Fetching grouped licenses...');
      const response = await labourLicenseAPI.getAllLicensesGrouped({ page, pageSize });
      console.log('🔍 DEBUG: API Response:', response);
      console.log('🔍 DEBUG: Response data length:', response.data?.length);
      console.log('🔍 DEBUG: First 3 records:', response.data?.slice(0, 3));
      
      if (response.success) {
        // Store the original data
        setGroupedLicenses(response.data);
        console.log('🔍 DEBUG: Set groupedLicenses with', response.data.length, 'records');
        
        // Apply status filter
        let filteredData = response.data;
        if (statusFilter !== 'all') {
          filteredData = response.data.filter(license => {
            // For previous records, they're always expired
            if (license.record_type === 'previous') {
              return statusFilter === 'expired';
            }
            // For running records, check their status
            return license.status === statusFilter;
          });
        }
        
        // Update filtered licenses for display
        setFilteredLicenses(filteredData);
        console.log('🔍 DEBUG: Set filteredLicenses with', filteredData.length, 'records');
        
        // Update pagination
        setPagination({
          currentPage: response.currentPage || page,
          pageSize: response.pageSize || pageSize,
          totalPages: response.totalPages || 1,
          totalItems: response.totalItems || response.data.length,
        });
      }
    } catch (error) {
      console.error('Error fetching grouped licenses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle renewal
  const handleRenewal = (license) => {
    console.log('🔄 Starting renewal for license:', license);
    setSelectedLicenseForRenewal(license);
    setShowRenewalModal(true);
  };

  const handleRenewalModalClose = () => {
    setShowRenewalModal(false);
    setSelectedLicenseForRenewal(null);
  };

  const handleRenewalCompleted = async (formData) => {
    if (!selectedLicenseForRenewal) return;
    
    try {
      console.log('🔄 Processing labour license renewal...');
      await labourLicenseAPI.renewLicense(selectedLicenseForRenewal.license_id, formData);
      
      // Refresh both running and grouped data
      await Promise.all([
        fetchLicenses(pagination.currentPage, pagination.pageSize),
        fetchGroupedLicenses(pagination.currentPage, pagination.pageSize),
        fetchStatistics()
      ]);
      
      console.log('✅ Labour license renewal completed and data refreshed');
      toast.success('Labour license renewed successfully');
      handleRenewalModalClose();
    } catch (error) {
      console.error('❌ Error in renewal completion:', error);
      toast.error(error.message || 'Failed to renew labour license');
      throw error;
    }
  };

  // Handle tab switching
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    // Reset status filter to 'all' when switching tabs
    setStatusFilter('all');
    
    if (tab === 'running') {
      fetchLicenses(1, pagination.pageSize);
    } else {
      fetchGroupedLicenses(1, pagination.pageSize);
    }
  };

  // Apply client-side filtering when grouped licenses or status filter changes
  useEffect(() => {
    console.log('🔍 DEBUG: useEffect triggered - activeTab:', activeTab, 'groupedLicenses.length:', groupedLicenses.length, 'statusFilter:', statusFilter);
    
    if (activeTab === 'all' && groupedLicenses.length > 0) {
      let filteredData = groupedLicenses;
      
      if (statusFilter !== 'all') {
        filteredData = groupedLicenses.filter(license => {
          // For previous records, they're always expired
          if (license.record_type === 'previous') {
            return statusFilter === 'expired';
          }
          // For running records, check their status
          return license.status === statusFilter;
        });
      }
      
      console.log('🔍 DEBUG: Setting filteredLicenses from useEffect with', filteredData.length, 'records');
      setFilteredLicenses(filteredData);
    }
  }, [groupedLicenses, statusFilter, activeTab]);

  // Handle search
  const handleSearchLicenses = async (query) => {
    try {
      const response = await labourLicenseAPI.searchLicenses(query);
      if (response.success) {
        setFilteredLicenses(response.data || []);
      }
    } catch (error) {
      console.error('Error searching licenses:', error);
      toast.error('Search failed');
    }
  };

  // Handle status filter
  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    
    // Reset to page 1 when filter changes
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    
    // Refetch data based on active tab
    if (activeTab === 'running') {
      // For running tab, refetch with the new status filter
      fetchLicenses(1, pagination.pageSize);
    } else {
      // For all tab, client-side filtering will be applied via useEffect
      // No need to refetch, just let the useEffect handle it
    }
  };

  // Handle status update
  const handleStatusUpdate = async (licenseId, newStatus) => {
    try {
      setUpdatingStatus(prev => ({ ...prev, [licenseId]: true }));
      const response = await labourLicenseAPI.updateLicense(licenseId, { status: newStatus });
      if (response.success) {
        toast.success('Status updated successfully');
        await fetchLicenses(pagination.currentPage, pagination.pageSize);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(error.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [licenseId]: false }));
    }
  };

  const handlePageChange = async (page) => {
    console.log("License: Page changed to:", page);
    await fetchLicenses(page, pagination.pageSize);
  };

  const handlePageSizeChange = async (newPageSize) => {
    console.log("License: Page size changed to:", newPageSize);
    
    // Update pagination state first
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));
    
    // Then fetch licenses with the new page size
    await fetchLicenses(1, newPageSize);
  };

  // Handle create/edit license
  const handleSubmit = async (formData) => {
    try {
      if (selectedLicense) {
        // Update existing license
        const response = await labourLicenseAPI.updateLicense(selectedLicense.license_id, formData);
        if (response.success) {
          toast.success('License updated successfully');
          setShowModal(false);
          setSelectedLicense(null);
          fetchLicenses();
        }
      } else {
        // Create new license
        const response = await labourLicenseAPI.createLicense(formData);
        if (response.success) {
          toast.success('License created successfully');
          setShowModal(false);
          fetchLicenses();
        }
      }
    } catch (error) {
      console.error('Error saving license:', error);
      toast.error(error.message || 'Failed to save license');
    }
  };

  // Handle delete license
  const handleDelete = async (licenseId) => {
    if (window.confirm('Are you sure you want to delete this license?')) {
      try {
        const response = await labourLicenseAPI.deleteLicense(licenseId);
        if (response.success) {
          toast.success('License deleted successfully');
          fetchLicenses();
        }
      } catch (error) {
        console.error('Error deleting license:', error);
        toast.error(error.message || 'Failed to delete license');
      }
    }
  };

  const canEdit = userRoles?.includes('admin') || userRoles?.includes('compliance_manager') || userRoles?.includes('labour_law_manager');
  const canDelete = userRoles?.includes('admin');

  // Table columns configuration
  const columns = [
    {
      key: "sr_no",
      label: "Sr No.",
      sortable: true,
      render: (_, __, index) => {
        // Calculate serial number based on current page and page size
        return (pagination.currentPage - 1) * pagination.pageSize + index + 1;
      },
    },
    {
      key: "company",
      label: "Company",
      sortable: true,
      render: (_, license) => (
        <div>
          <div className="font-medium">{license.company?.company_name || 'N/A'}</div>
          <div className="text-sm text-gray-500">{license.company?.company_code || ''}</div>
        </div>
      ),
    },
    {
      key: "license_number",
      label: "License Number",
      sortable: true,
      render: (value) => <span className="font-medium">{value}</span>,
    },
    {
      key: "type",
      label: "License Type",
      sortable: true,
      render: (value) => (
        <span className={`license-type-badge ${value?.toLowerCase() === 'central' ? 'type-central' : 'type-state'}`}>
          {value || 'N/A'}
        </span>
      ),
    },
    {
      key: "expiry_date",
      label: "Expiry Date",
      sortable: true,
      render: (value, license) => {
        const expiryDate = new Date(value);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        const isExpired = expiryDate < today;
        const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
        const isExpiredStatus = license.status === 'expired';
        
        let statusClass = '';
        let statusText = '';
        let emailServiceStatus = '';
        
        if (isExpiredStatus) {
          statusClass = 'expired-highlight';
          statusText = 'EXPIRED';
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
      render: (value, license) => {
        // Use license_id for running records, id for previous records
        const licenseId = license.license_id || license.id;
        
        // Check if license is expired based on expiry date
        const expiryDate = new Date(license.expiry_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiryDate.setHours(0, 0, 0, 0);
        const isExpiredByDate = expiryDate < today;
        
        // For "All Licenses" tab with previous records, show "Expired" badge
        if (activeTab === 'all' && license.record_type === 'previous') {
          return (
            <span className="status-badge status-badge-expired">
              Expired
            </span>
          );
        }
        
        // If expired by date, show expired status regardless of database status
        if (isExpiredByDate) {
          // Auto-update status in background if it's not already expired
          if (value !== 'expired') {
            handleStatusUpdate(licenseId, 'expired');
          }
          
          return (
            <span className="status-badge status-badge-expired">
              Expired
            </span>
          );
        }
        
        // For running records, show interactive dropdown if user can edit
        const statusClass = 
          value === 'active' ? 'status-badge-active' :
          value === 'expired' ? 'status-badge-expired' :
          value === 'suspended' ? 'status-badge-suspended' :
          value === 'renewed' ? 'status-badge-renewed' : 'status-badge-default';
        
        // If user can edit and it's a running record, show interactive dropdown
        if (canEdit && (activeTab === 'running' || license.record_type === 'running')) {
          const isUpdating = updatingStatus[licenseId];
          return (
            <div className="status-dropdown-container">
              <select
                value={value || 'active'}
                onChange={(e) => handleStatusUpdate(licenseId, e.target.value)}
                className={`status-badge-dropdown ${statusClass}`}
                disabled={isUpdating}
              >
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
                <option value="renewed">Renewed</option>
              </select>
              {isUpdating && (
                <div className="status-updating-indicator">
                  <Loader size="small" />
                </div>
              )}
            </div>
          );
        }
        
        // For read-only users or previous records, show status badge
        return (
          <span className={`status-badge ${statusClass}`}>
            {value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Active'}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, license) => {
        // Use license_id for running records, id for previous records
        const licenseId = license.license_id || license.id;
        
        return (
          <div className="insurance-actions">
            {/* Edit Button - show for all licenses */}
            {canEdit && (
              <ActionButton
                onClick={() => {
                  setSelectedLicense(license);
                  setShowModal(true);
                }}
                variant="secondary"
                size="small"
                title="Edit"
              >
                <BiEdit />
              </ActionButton>
            )}
            
            {/* Renewal Button - show for all active licenses */}
            {license.status === 'active' && canEdit && (
              <ActionButton
                onClick={() => handleRenewal(license)}
                variant="secondary"
                size="small"
                title="Renew License"
              >
                <BiRefresh />
              </ActionButton>
            )}
            
            {/* Delete Button - show for all licenses */}
            {canDelete && (
              <ActionButton
                onClick={() => handleDelete(licenseId)}
                variant="danger"
                size="small"
                title="Delete"
              >
                <BiTrash />
              </ActionButton>
            )}
          </div>
        );
      },
    }
  ];

  // Status options for All Licenses tab only
  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "active", label: "Active" },
    { value: "expired", label: "Expired" },
    { value: "suspended", label: "Suspended" },
    { value: "renewed", label: "Renewed" }
  ];



  if (loading) {
    return <Loader />;
  }

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Labour License Management</h1>
            <div className="list-container">
              {canManageLicenses && (
                <Button
                  variant="contained"
                  onClick={() => {
                    setSelectedLicense(null);
                    setShowModal(true);
                  }}
                  icon={<BiPlus />}
                >
                  Add License
                </Button>
              )}
              
              {/* Status filter only for All Licenses tab */}
              {activeTab === 'all' && (
                <div className="dashboard-header-dropdown-container">
                  <Dropdown
                    options={statusOptions}
                    value={statusOptions.find((opt) => opt.value === statusFilter)}
                    onChange={(option) => {
                      handleStatusFilter(option ? option.value : "all");
                    }}
                    placeholder="Filter by Status"
                  />
                </div>
              )}
            </div>
          </div>

          <StatisticsCards statistics={statistics} loading={statsLoading} />
          
          {/* Tab Navigation */}
          <div className="tab-navigation" style={{ marginBottom: "24px" }}>
            <button
              className={`tab-button ${
                activeTab === "running" ? "active" : ""
              }`}
              onClick={() => handleTabSwitch("running")}
            >
              <BiTrendingUp className="tab-icon" />
              Running Licenses
            </button>
            <button
              className={`tab-button ${activeTab === "all" ? "active" : ""}`}
              onClick={() => handleTabSwitch("all")}
            >
              <BiShield className="tab-icon" />
              All Licenses
            </button>
          </div>
          
          {error && (
            <div className="insurance-error">
              <BiErrorCircle className="inline mr-2" /> {error}
            </div>
          )}

          {/* Tab Content */}
          {loading ? (
            <Loader size="large" color="primary" />
          ) : activeTab === "running" ? (
            <TableWithControl
              data={filteredLicenses}
              columns={columns}
              defaultPageSize={pagination.pageSize}
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              serverSidePagination={true}
            />
          ) : (
            <TableWithControl
              data={filteredLicenses}
              columns={columns}
              defaultPageSize={pagination.pageSize}
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              onPageChange={(page) => fetchGroupedLicenses(page, pagination.pageSize)}
              onPageSizeChange={(newPageSize) => {
                setPagination(prev => ({ ...prev, pageSize: newPageSize, currentPage: 1 }));
                fetchGroupedLicenses(1, newPageSize);
              }}
              serverSidePagination={true}
            />
          )}
        </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedLicense(null);
        }}
        title={selectedLicense ? 'Edit Labour License' : 'Add New Labour License'}
      >
        <LicenseForm
          license={selectedLicense}
          companies={companies}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowModal(false);
            setSelectedLicense(null);
          }}
        />
      </Modal>

      {/* Document Download Modal */}
      {showDocumentModal && selectedLicense && (
        <DocumentDownload
          isOpen={showDocumentModal}
          onClose={() => setShowDocumentModal(false)}
          system="labour-license"
          recordId={selectedLicense.license_id}
          recordName={selectedLicense.company?.company_name || selectedLicense.company_name}
        />
      )}

      {/* Renewal Modal */}
      {showRenewalModal && selectedLicenseForRenewal && (
        <RenewalForm
          onClose={handleRenewalModalClose}
          onRenewal={handleRenewalCompleted}
          licenseData={selectedLicenseForRenewal}
          companies={companies}
        />
      )}
      </div>
    </div>
  );
};

// Renewal Form Component
const RenewalForm = ({ onClose, onRenewal, licenseData, companies }) => {
  const [formData, setFormData] = useState({
    license_number: '',
    expiry_date: '',
    type: '',
    remarks: ''
  });
  const [loading, setLoading] = useState(false);

  // Pre-fill form with existing license data
  useEffect(() => {
    if (licenseData) {
      console.log('Pre-filling renewal form with data:', licenseData);
      setFormData({
        license_number: '',
        expiry_date: '',
        type: licenseData.type || '',
        remarks: licenseData.remarks || ''
      });
    }
  }, [licenseData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.license_number || !formData.expiry_date || !formData.type) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      console.log('Submitting renewal form with data:', formData);
      await onRenewal(formData);
    } catch (error) {
      console.error('Error renewing license:', error);
      toast.error(error.message || 'Failed to renew license');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Renew Labour License">
      <form onSubmit={handleSubmit} className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
            <label className="insurance-form-label">Company</label>
            <input
              type="text"
              value={licenseData?.company?.company_name || 'N/A'}
              className="insurance-form-input"
              disabled
            />
          </div>

          <div className="insurance-form-group">
            <label className="insurance-form-label">Previous License Number</label>
            <input
              type="text"
              value={licenseData?.license_number || 'N/A'}
              className="insurance-form-input"
              disabled
            />
          </div>

          <div className="insurance-form-group">
            <label className="insurance-form-label">New License Number *</label>
            <input
              type="text"
              name="license_number"
              value={formData.license_number}
              onChange={handleInputChange}
              className="insurance-form-input"
              placeholder="Enter new license number"
              required
            />
          </div>

          <div className="insurance-form-group">
            <label className="insurance-form-label">New Expiry Date *</label>
            <input
              type="date"
              name="expiry_date"
              value={formData.expiry_date}
              onChange={handleInputChange}
              className="insurance-form-input"
              required
            />
          </div>

          <div className="insurance-form-group">
            <label className="insurance-form-label">License Type *</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="insurance-form-input"
              required
            >
              <option value="">Select License Type</option>
              <option value="Central">Central</option>
              <option value="State">State</option>
            </select>
          </div>

          <div className="insurance-form-group">
            <label className="insurance-form-label">Remarks</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleInputChange}
              className="insurance-form-input"
              rows="3"
              placeholder="Enter any remarks for the renewal..."
            />
          </div>
        </div>

        <div className="insurance-form-actions">
          <Button type="button" onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Renewing...' : 'Renew License'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// License Form Component
const LicenseForm = ({ license, companies, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    company_id: '',
    license_number: '',
    expiry_date: '',
    status: 'Active',
    type: '',
    remarks: ''
  });

  const [files, setFiles] = useState([]);

  // Initialize form data when editing
  useEffect(() => {
    if (license) {
      setFormData({
        company_id: license.company_id || '',
        license_number: license.license_number || '',
        expiry_date: license.expiry_date ? new Date(license.expiry_date).toISOString().split('T')[0] : '',
        status: license.status || 'Active',
        type: license.type || '',
        remarks: license.remarks || ''
      });
    }
  }, [license]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.company_id || !formData.license_number || !formData.expiry_date || !formData.type) {
      toast.error('Company, license number, expiry date, and license type are required');
      return;
    }

    // Create FormData for file upload
    const submitData = new FormData();
    
    // Append form fields
    Object.keys(formData).forEach(key => {
      if (formData[key] !== undefined && formData[key] !== '') {
        submitData.append(key, formData[key]);
      }
    });

    // Append files
    if (files.length > 0) {
      files.forEach(file => {
        submitData.append('files', file);
      });
    }

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="insurance-form">
      <div className="insurance-form-grid">
        <div className="insurance-form-group">
          <select
            id="company_id"
            name="company_id"
            value={formData.company_id}
            onChange={handleChange}
            required
            className="insurance-form-input"
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
            type="text"
            id="license_number"
            name="license_number"
            value={formData.license_number}
            onChange={handleChange}
            required
            className="insurance-form-input"
            placeholder="Enter license number"
          />
      </div>

        <div className="insurance-form-group">
          <input
            type="date"
            id="expiry_date"
            name="expiry_date"
            value={formData.expiry_date}
            onChange={handleChange}
            required
            className="insurance-form-input"
          />
        </div>

        <div className="insurance-form-group">
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            required
            className="insurance-form-input"
          >
            <option value="">Select License Type</option>
            <option value="Central">Central</option>
            <option value="State">State</option>
          </select>
        </div>
      </div>

      <div className="insurance-form-actions">
        <Button type="button" onClick={onCancel} variant="outlined">
          Cancel
        </Button>
        <Button type="submit" variant="contained">
          {license ? 'Update License' : 'Create License'}
        </Button>
      </div>
    </form>
  );
};

export default LabourLicense;
