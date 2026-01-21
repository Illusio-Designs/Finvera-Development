import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
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
  BiAnchor,
  BiRefresh,
} from "react-icons/bi";
import { stabilityManagementAPI } from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import "../../../styles/pages/dashboard/compliance/Compliance.css";
import "../../../styles/components/StatCards.css";
import "../../../styles/pages/dashboard/insurance/Insurance.css";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../../contexts/AuthContext";
import DocumentDownload from "../../../components/common/DocumentDownload/DocumentDownload";

// File Upload Modal - Memoized
const FileUploadModal = memo(({ onClose, onUpload }) => {
  const [files, setFiles] = useState([]);
  const [stabilityDate, setStabilityDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    if (!stabilityDate) {
      toast.error('Please select a stability date');
      return;
    }

    setLoading(true);
    try {
      await onUpload(files, stabilityDate);
      toast.success('Files uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload files');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Upload Files & Approve Stability">
      <div className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
            <input
              type="date"
              value={stabilityDate}
              onChange={(e) => setStabilityDate(e.target.value)}
              className="insurance-form-input"
              required
            />
            <small className="text-gray-500">
              Renewal date will be automatically calculated (5 years after stability date)
            </small>
          </div>

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
            {loading ? 'Uploading...' : 'Upload & Approve'}
          </Button>
        </div>
      </div>
    </Modal>
  );
});

FileUploadModal.displayName = 'FileUploadModal';

// Renewal Form Component
const RenewalForm = memo(({ onClose, onRenewal, stabilityData, stabilityManagers }) => {
  const [formData, setFormData] = useState({
    stability_manager_id: '',
    load_type: 'with_load',
    stability_date: '',
    remarks: ''
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // Pre-fill form with existing stability data
  useEffect(() => {
    if (stabilityData) {
      console.log('Pre-filling renewal form with data:', stabilityData);
      setFormData({
        stability_manager_id: stabilityData.stability_manager_id || '',
        load_type: stabilityData.load_type || 'with_load',
        stability_date: '',
        remarks: stabilityData.remarks || ''
      });
    }
  }, [stabilityData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error('Please select a PDF or Word document');
        return;
      }
      
      // Validate file size (10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.stability_manager_id || !formData.load_type || !formData.stability_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!file) {
      toast.error('Please select a stability document');
      return;
    }

    setLoading(true);
    try {
      const renewalFormData = new FormData();
      renewalFormData.append('stability_manager_id', formData.stability_manager_id);
      renewalFormData.append('load_type', formData.load_type);
      renewalFormData.append('stability_date', formData.stability_date);
      if (formData.remarks) {
        renewalFormData.append('remarks', formData.remarks);
      }
      renewalFormData.append('files', file);

      console.log('Submitting renewal form with data:', {
        stability_manager_id: formData.stability_manager_id,
        load_type: formData.load_type,
        stability_date: formData.stability_date,
        remarks: formData.remarks,
        file: file?.name
      });

      await onRenewal(renewalFormData);
      toast.success('Stability renewed successfully');
      onClose();
    } catch (error) {
      console.error('Error renewing stability:', error);
      toast.error(error.message || 'Failed to renew stability');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Renew Stability Certificate">
      <form onSubmit={handleSubmit} className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
            <label className="insurance-form-label">Stability Manager *</label>
            <select
              name="stability_manager_id"
              value={formData.stability_manager_id}
              onChange={handleInputChange}
              className="insurance-form-input"
              required
            >
              <option value="">Select Stability Manager</option>
              {stabilityManagers.map(manager => (
                <option key={manager.user_id} value={manager.user_id}>
                  {manager.username} ({manager.email})
                </option>
              ))}
            </select>
          </div>

          <div className="insurance-form-group">
            <label className="insurance-form-label">Load Type *</label>
            <select
              name="load_type"
              value={formData.load_type}
              onChange={handleInputChange}
              className="insurance-form-input"
              required
            >
              <option value="with_load">With Load</option>
              <option value="without_load">Without Load</option>
            </select>
          </div>

          <div className="insurance-form-group">
            <label className="insurance-form-label">New Stability Date *</label>
            <input
              type="date"
              name="stability_date"
              value={formData.stability_date}
              onChange={handleInputChange}
              className="insurance-form-input"
              required
            />
            <small className="text-gray-500">
              Renewal date will be automatically calculated (5 years after stability date)
            </small>
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

          <div className="insurance-form-group">
            <label className="insurance-form-label">Stability Document *</label>
            <input
              type="file"
              onChange={handleFileChange}
              className="insurance-form-input"
              accept=".pdf,.doc,.docx"
              required
            />
            <small className="text-gray-500">
              Upload new stability certificate (PDF or Word document, max 10MB)
            </small>
            {file && (
              <div className="selected-file">
                <BiFile className="mr-2" />
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>
        </div>

        <div className="insurance-form-actions">
          <Button type="button" onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Renewing...' : 'Renew Stability'}
          </Button>
        </div>
      </form>
    </Modal>
  );
});

RenewalForm.displayName = 'RenewalForm';

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
      toast.success('Stability rejected successfully');
    } catch (error) {
      toast.error('Failed to reject stability');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Reject Stability">
      <div className="reject-modal">
        <div className="form-group">
          <label>Remarks (Required):</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="form-control"
            rows="4"
            placeholder="Enter rejection remarks..."
            required
          />
        </div>

        <div className="modal-actions">
          <Button onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleReject} variant="contained" disabled={loading}>
            {loading ? 'Rejecting...' : 'Reject'}
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
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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

  if (!statistics) {
    return (
      <div className="statistics-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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

  const { total, stability, submit, approved, rejected, withLoad, withoutLoad, recent } = statistics;

  return (
    <div className="statistics-grid">
      <div className="stat-card total">
        <div className="stat-icon">
          <BiShield />
        </div>
        <div className="stat-content">
          <div className="stat-number">{total}</div>
          <div className="stat-label">Total Records</div>
        </div>
      </div>
      <div className="stat-card stability">
        <div className="stat-icon">
          <BiFile />
        </div>
        <div className="stat-content">
          <div className="stat-number">{stability}</div>
          <div className="stat-label">In Progress</div>
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
      <div className="stat-card withLoad">
        <div className="stat-icon">
          <BiAnchor />
        </div>
        <div className="stat-content">
          <div className="stat-number">{withLoad}</div>
          <div className="stat-label">With Load</div>
        </div>
      </div>
      <div className="stat-card withoutLoad">
        <div className="stat-icon">
          <BiShield />
        </div>
        <div className="stat-content">
          <div className="stat-number">{withoutLoad}</div>
          <div className="stat-label">Without Load</div>
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

// Stability Date Modal
const StabilityDateModal = ({ onClose, onUpdate, currentDate }) => {
  const [stabilityDate, setStabilityDate] = useState(currentDate || '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!stabilityDate) {
      toast.error('Please select a stability date');
      return;
    }

    setLoading(true);
    try {
      await onUpdate(stabilityDate);
      toast.success('Stability date updated successfully');
    } catch (error) {
      toast.error('Failed to update stability date');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Update Stability Date">
      <div className="stability-date-modal">
        <div className="form-group">
          <label>Stability Date:</label>
          <input
            type="date"
            value={stabilityDate}
            onChange={(e) => setStabilityDate(e.target.value)}
            className="form-control"
            required
          />
          <small className="text-gray-500">
            Renewal date will be automatically calculated (5 years after stability date)
          </small>
        </div>

        <div className="modal-actions">
          <Button onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleUpdate} variant="contained" disabled={loading}>
            {loading ? 'Updating...' : 'Update'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Main Stability Management Component
const StabilityManagement = ({ searchQuery = "" }) => {
  const [stabilityRecords, setStabilityRecords] = useState([]);
  const [groupedStabilities, setGroupedStabilities] = useState([]);
  const [filteredStabilityRecords, setFilteredStabilityRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedStability, setSelectedStability] = useState(null);
  const [selectedStabilityForRenewal, setSelectedStabilityForRenewal] = useState(null);
  const [stabilityManagers, setStabilityManagers] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('running');
  const { user } = useAuth();
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });

  // Handle search when searchQuery changes
  useEffect(() => {
    if (searchQuery && searchQuery.trim() !== "") {
      handleSearchStabilityRecords(searchQuery);
    } else {
      // Reset to appropriate data based on active tab
      if (activeTab === 'running') {
        setFilteredStabilityRecords(stabilityRecords);
      } else {
        setFilteredStabilityRecords(groupedStabilities);
      }
    }
  }, [searchQuery, stabilityRecords, groupedStabilities, activeTab]);

  const handleSearchStabilityRecords = async (query) => {
    try {
      const response = await stabilityManagementAPI.searchStabilityRecords(query);
      if (response.success) {
        setFilteredStabilityRecords(response.data);
      }
    } catch (error) {
      console.error('Error searching stability records:', error);
      // Fallback to local search
      const dataToSearch = activeTab === 'running' ? stabilityRecords : groupedStabilities;
      const filtered = dataToSearch.filter(record => 
        record.factoryQuotation?.companyName?.toLowerCase().includes(query.toLowerCase()) ||
        record.status?.toLowerCase().includes(query.toLowerCase()) ||
        record.stabilityManager?.username?.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredStabilityRecords(filtered);
    }
  };

  useEffect(() => {
    fetchStabilityManagementRecords(1, 10);
    fetchGroupedStabilities(1, 10);
    fetchStabilityManagers();
    fetchStabilityStatistics();
  }, []);

  // Set initial filtered records when data loads
  useEffect(() => {
    console.log('🔄 Setting initial filtered records:', {
      activeTab,
      stabilityRecordsLength: stabilityRecords.length,
      groupedStabilitiesLength: groupedStabilities.length
    });
    
    if (activeTab === 'running' && stabilityRecords.length > 0) {
      console.log('✅ Setting filtered records to stabilityRecords');
      setFilteredStabilityRecords(stabilityRecords);
    } else if (activeTab === 'all') {
      if (groupedStabilities.length > 0) {
        console.log('✅ Setting filtered records to groupedStabilities');
        setFilteredStabilityRecords(groupedStabilities);
      } else if (stabilityRecords.length > 0) {
        console.log('📋 Using running records as fallback for all tab (no grouped data)');
        setFilteredStabilityRecords(stabilityRecords.map(record => ({
          ...record,
          record_type: 'running'
        })));
      } else {
        console.log('⚠️ No data available for all tab');
      }
    } else {
      console.log('⚠️ No data to set for current tab');
    }
  }, [stabilityRecords, groupedStabilities, activeTab]);

  const fetchStabilityManagers = async () => {
    try {
      const response = await stabilityManagementAPI.getStabilityManagers();
      if (response.success) {
        setStabilityManagers(response.data);
      }
    } catch (error) {
      console.error('Error fetching stability managers:', error);
    }
  };

  const fetchGroupedStabilities = async (page = 1, pageSize = 10) => {
    try {
      console.log('🔄 Fetching grouped stabilities...');
      const response = await stabilityManagementAPI.getAllStabilitiesGrouped({ page, pageSize });
      console.log('📡 Grouped stabilities API response:', response);
      
      if (response.success) {
        console.log('✅ Grouped stabilities loaded:', response.data.length, 'records');
        console.log('📊 Grouped stabilities data:', response.data.map(record => ({
          id: record.id,
          record_type: record.record_type,
          company: record.factoryQuotation?.companyName || 'N/A',
          status: record.status
        })));
        setGroupedStabilities(response.data);
      } else {
        console.error('❌ Grouped stabilities API returned success: false');
      }
    } catch (error) {
      console.error('❌ Error fetching grouped stabilities:', error);
    }
  };

  const fetchStabilityManagementRecords = async (page = 1, pageSize = 10) => {
    console.log('🔄 Stability Management - Fetching records for page:', page, 'pageSize:', pageSize);
    setLoading(true);
    try {
      const response = await stabilityManagementAPI.getAllStabilityManagement({ page, pageSize });
      console.log('📡 Stability Management API Response:', {
        success: response.success,
        dataLength: response.data?.length || 0,
        totalItems: response.totalItems || 0,
        currentPage: response.currentPage || page,
        totalPages: response.totalPages || 1
      });
      
      if (response.success) {
        console.log('📊 Raw Stability Management Records from API:', response.data);
        console.log('📊 Stability Management Records:', response.data.map(record => ({
          id: record.id,
          company: record.factoryQuotation?.companyName || 'N/A',
          manager: record.stabilityManager?.username || 'N/A',
          status: record.status,
          loadType: record.load_type,
          filesType: typeof record.files,
          filesContent: record.files,
          filesLength: record.files ? (typeof record.files === 'string' ? 'string' : Array.isArray(record.files) ? record.files.length : 'object') : 'null'
        })));
        
        setStabilityRecords(response.data);
        
        // Update filtered records if we're on running tab
        if (activeTab === 'running') {
          setFilteredStabilityRecords(response.data);
        }
        
        if (response.currentPage) {
          setPagination({
            currentPage: response.currentPage || page,
            pageSize: response.pageSize || pageSize,
            totalPages: response.totalPages || 1,
            totalItems: response.totalItems || 0,
          });
        } else {
          setPagination((prev) => ({ ...prev, currentPage: page }));
        }
        setError(null);
        console.log('✅ Stability Management records loaded successfully');
      } else {
        console.error('❌ API returned success: false');
        setError("Failed to fetch stability management records");
      }
    } catch (err) {
      console.error("❌ Error fetching stability management records:", {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
      setError("Failed to fetch stability management records");
    } finally {
      setLoading(false);
      console.log('🏁 Stability Management fetch completed');
    }
  };

  const handlePageChange = async (page) => {
    await fetchStabilityManagementRecords(page, pagination.pageSize);
  };

  const handlePageSizeChange = async (newPageSize) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));
    await fetchStabilityManagementRecords(1, newPageSize);
  };

  const fetchStabilityStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await stabilityManagementAPI.getStatistics();
      if (response && response.data) {
        setStatistics(response.data);
      } else {
        console.error("Failed to fetch stability management statistics:", response);
        setStatistics({
          total: 0,
          stability: 0,
          submit: 0,
          approved: 0,
          rejected: 0,
          withLoad: 0,
          withoutLoad: 0,
          recent: 0
        });
      }
    } catch (error) {
      console.error("Error fetching stability management statistics:", error);
      setStatistics({
        total: 0,
        stability: 0,
        submit: 0,
        approved: 0,
        rejected: 0,
        withLoad: 0,
        withoutLoad: 0,
        recent: 0
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const handleStatusChange = async (stabilityId, newStatus) => {
    try {
      const currentStability = stabilityRecords.find(s => s.id === stabilityId);
      
      if (newStatus === 'Approved') {
        // Show upload modal for approval
        setSelectedStability(currentStability);
        setShowFileUploadModal(true);
      } else if (newStatus === 'Reject') {
        // Show reject modal
        setSelectedStability(currentStability);
        setShowRejectModal(true);
      } else if (newStatus === 'submit') {
        // Submit stability using the new API
        const response = await stabilityManagementAPI.updateStabilityStatus(stabilityId, { status: 'submit' });
        if (response.success) {
          toast.success('Stability submitted successfully');
          await fetchStabilityManagementRecords(pagination.currentPage, pagination.pageSize);
        }
      } else if (newStatus === 'stability') {
        // Update status to stability
        const response = await stabilityManagementAPI.updateStabilityStatus(stabilityId, { status: 'stability' });
        if (response.success) {
          toast.success('Stability status updated successfully');
          await fetchStabilityManagementRecords(pagination.currentPage, pagination.pageSize);
        }
      }
    } catch (error) {
      toast.error('Failed to update stability status');
    }
  };

  const handleUploadFiles = async (files, stabilityDate) => {
    if (!selectedStability) return;
    
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      // First update the status with stability date
      await stabilityManagementAPI.updateStabilityStatus(selectedStability.id, {
        status: 'Approved',
        stability_date: stabilityDate
      });

      // Then upload the files
      const response = await stabilityManagementAPI.uploadStabilityFiles(selectedStability.id, formData);
      if (response.success) {
        toast.success('Files uploaded and stability approved successfully');
        await fetchStabilityManagementRecords(pagination.currentPage, pagination.pageSize);
        setShowFileUploadModal(false);
        setSelectedStability(null);
      }
    } catch (error) {
      toast.error('Failed to upload files');
    }
  };

  const handleRejectStability = async (remarks) => {
    if (!selectedStability) return;
    
    try {
      const response = await stabilityManagementAPI.updateStabilityStatus(selectedStability.id, {
        status: 'Reject',
        remarks: remarks
      });
      if (response.success) {
        toast.success('Stability rejected successfully');
        await fetchStabilityManagementRecords(pagination.currentPage, pagination.pageSize);
        setShowRejectModal(false);
        setSelectedStability(null);
      }
    } catch (error) {
      toast.error('Failed to reject stability');
    }
  };

  const handleUpdateStabilityDates = async (stabilityDate) => {
    try {
      await stabilityManagementAPI.updateStabilityDates(selectedStability.id, {
        stability_date: stabilityDate
      });
      
      setShowDateModal(false);
      setSelectedStability(null);
      fetchStabilityManagementRecords(pagination.currentPage, pagination.pageSize);
    } catch (error) {
      console.error('Error updating stability dates:', error);
      throw error;
    }
  };

  // ===== RENEWAL SYSTEM FUNCTIONS =====

  const handleRenewal = (stability) => {
    console.log('🔄 Starting renewal for stability:', stability);
    
    // Transform stability data for renewal form
    const transformedData = {
      id: stability.id,
      stability_manager_id: stability.stability_manager_id,
      load_type: stability.load_type,
      stability_date: stability.stability_date,
      remarks: stability.remarks,
      factoryQuotation: stability.factoryQuotation,
      stabilityManager: stability.stabilityManager
    };
    
    setSelectedStabilityForRenewal(transformedData);
    setShowRenewalModal(true);
  };

  const handleRenewalModalClose = () => {
    setShowRenewalModal(false);
    setSelectedStabilityForRenewal(null);
  };

  const handleRenewalCompleted = async (formData) => {
    if (!selectedStabilityForRenewal) return;
    
    try {
      console.log('🔄 Processing stability renewal...');
      await stabilityManagementAPI.renewStability(selectedStabilityForRenewal.id, formData);
      
      // Refresh both running and grouped data
      await Promise.all([
        fetchStabilityManagementRecords(pagination.currentPage, pagination.pageSize),
        fetchGroupedStabilities(pagination.currentPage, pagination.pageSize),
        fetchStabilityStatistics()
      ]);
      
      console.log('✅ Stability renewal completed and data refreshed');
    } catch (error) {
      console.error('❌ Error in renewal completion:', error);
      throw error;
    }
  };

  // Handle tab switching
  const handleTabSwitch = (tab) => {
    console.log('🔄 Switching to tab:', tab);
    console.log('📊 Current data state:', {
      stabilityRecordsLength: stabilityRecords.length,
      groupedStabilitiesLength: groupedStabilities.length,
      filteredStabilityRecordsLength: filteredStabilityRecords.length
    });
    
    setActiveTab(tab);
    
    if (tab === 'running') {
      console.log('✅ Setting filtered records to stabilityRecords for running tab');
      setFilteredStabilityRecords(stabilityRecords);
    } else {
      console.log('✅ Setting filtered records to groupedStabilities for all tab');
      
      // If we have grouped stabilities, use them
      if (groupedStabilities.length > 0) {
        setFilteredStabilityRecords(groupedStabilities);
      } else {
        // Fetch grouped data if not already loaded
        console.log('🔄 Fetching grouped stabilities as none are loaded');
        fetchGroupedStabilities(1, pagination.pageSize);
        
        // As a fallback, show running records until grouped data loads
        if (stabilityRecords.length > 0) {
          console.log('📋 Using running records as fallback for all tab');
          setFilteredStabilityRecords(stabilityRecords.map(record => ({
            ...record,
            record_type: 'running'
          })));
        }
      }
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'stability':
        return 'status-badge-stability';
      case 'submit':
        return 'status-badge-submit';
      case 'Approved':
        return 'status-badge-approved';
      case 'Reject':
        return 'status-badge-reject';
      case 'Expired':
        return 'status-badge-expired';
      default:
        return 'status-badge-maked';
    }
  };

  const getLoadTypeBadgeClass = (loadType) => {
    switch (loadType) {
      case 'with_load':
        return 'load-badge-with';
      case 'without_load':
        return 'load-badge-without';
      default:
        return 'load-badge-default';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
  };

  const getFirstFileName = (record) => {
    try {
      console.log('🔍 Getting first filename for record:', record.id, 'files:', record.files);
      
      if (!record.files) {
        console.log('❌ No files field found');
        return null;
      }

      let files;
      if (typeof record.files === 'string') {
        try {
          files = JSON.parse(record.files);
          console.log('📋 Parsed files from string:', files);
        } catch (parseError) {
          console.error('❌ Error parsing JSON string:', parseError);
          return null;
        }
      } else {
        files = record.files;
        console.log('📋 Files already parsed:', files);
      }
      
      // Ensure files is an array
      if (!Array.isArray(files)) {
        console.log('❌ Files is not an array:', typeof files, files);
        return null;
      }

      // Check if array has elements
      if (files.length === 0) {
        console.log('❌ Files array is empty');
        return null;
      }

      // Get first file and validate it has filename
      const firstFile = files[0];
      if (!firstFile || typeof firstFile !== 'object') {
        console.log('❌ First file is invalid:', firstFile);
        return null;
      }

      if (!firstFile.filename) {
        console.log('❌ First file has no filename property:', firstFile);
        return null;
      }

      const filename = firstFile.filename;
      console.log('✅ First filename found:', filename);
      return filename;
      
    } catch (error) {
      console.error('❌ Error in getFirstFileName:', error);
      return null;
    }
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
          <div className="text-sm text-gray-500"><strong>Name: </strong>{record.factoryQuotation?.companyName || "-"}</div>
          <div className="text-sm"><strong>Address: </strong> {record.factoryQuotation?.companyAddress || "-"}</div>
          <div className="text-sm"><strong>Email: </strong> {record.factoryQuotation?.email || "-"}</div>
          <div className="text-sm"><strong>Phone: </strong> {record.factoryQuotation?.phone || "-"}</div>
        </div>
      ),
    },
    {
      key: "loadType",
      label: "Load Type",
      sortable: true,
      render: (_, record) => (
        <span className={`load-badge ${getLoadTypeBadgeClass(record.load_type)}`}>
          {record.load_type === 'with_load' ? 'With Load' : 'Without Load'}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (_, record) => (
        <div className="flex flex-col gap-1">
          {/* For Running tab or running records - show dropdown */}
          {activeTab === 'running' || record.record_type === 'running' ? (
            <select
              value={record.status}
              onChange={(e) => handleStatusChange(record.id, e.target.value)}
              className={`status-badge-dropdown ${getStatusBadgeClass(record.status)}`}
            >
              <option value="stability">Stability</option>
              <option value="submit">Submit</option>
              <option value="Approved">Approved</option>
              <option value="Reject">Reject</option>
              <option value="Expired">Expired</option>
            </select>
          ) : (
            /* For All tab with previous records OR records manually set to Expired */
            <span className="status-badge status-badge-expired">
              Expired
            </span>
          )}
        </div>
      ),
    },
    {
      key: "assignedDate",
      label: "Assigned Date",
      sortable: true,
      render: (_, record) => {
        const date = record.created_at || record.createdAt;
        return (
          <div className="flex items-center gap-1">
            <BiCalendar />
            {date ? formatDate(date) : 'No date'}
          </div>
        );
      },
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
      key: "stabilityDate",
      label: "Stability Date",
      sortable: true,
      render: (_, record) => (
        <div className="insurance-actions">
          {record.stability_date ? (
            <div className="flex items-center gap-1">
              <BiCalendar />
              {formatDate(record.stability_date)}
            </div>
          ) : (
            // Only show "Set Date" button for running records
            (activeTab === 'running' || record.record_type === 'running') && (
              <ActionButton
                onClick={() => {
                  setSelectedStability(record);
                  setShowDateModal(true);
                }}
                variant="secondary"
                size="small"
                title="Set Stability Date"
              >
                <BiEdit />
              </ActionButton>
            )
          )}
        </div>
      ),
    },
    {
      key: "renewalDate",
      label: "Renewal Date",
      sortable: true,
      render: (_, record) => (
        record.renewal_date ? (
          <div className="flex items-center gap-1">
            <BiCalendar />
            {formatDate(record.renewal_date)}
          </div>
        ) : "-"
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, record) => {
        const filename = getFirstFileName(record);
        console.log(`🔍 DocumentDownload for record ${record.id}: filename="${filename}", files="${record.files}"`);
        
        return (
          <div className="insurance-actions">
            {/* Renewal Button - only for running records with Approved status */}
            {(activeTab === 'running' || record.record_type === 'running') && record.status === 'Approved' && (
              <ActionButton
                onClick={() => handleRenewal(record)}
                variant="secondary"
                size="small"
                title="Renew Stability"
              >
                <BiRefresh />
              </ActionButton>
            )}
            
            <DocumentDownload 
              system="stability-management" 
              recordId={record.id}
              buttonText=""
              buttonClass="action-button action-button-secondary action-button-small"
              showIcon={true}
              filePath={filename ? `/uploads/stability/${filename}` : null}
              fileName={filename || `stability-record-${record.id}.pdf`}
              disabled={!filename}
            />
          </div>
        );
      },
    },
  ];

  const filteredRecords = React.useMemo(() => {
    console.log('🔍 Computing filtered records:', {
      activeTab,
      stabilityRecordsLength: stabilityRecords.length,
      groupedStabilitiesLength: groupedStabilities.length,
      filteredStabilityRecordsLength: filteredStabilityRecords.length
    });
    return filteredStabilityRecords;
  }, [filteredStabilityRecords, activeTab, stabilityRecords.length, groupedStabilities.length]);

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Stability Management</h1>
          </div>

          {error && (
            <div className="insurance-error">
              <BiErrorCircle className="inline mr-2" /> {error}
            </div>
          )}

          {/* Statistics Cards */}
          <div className="statistics-section">
            <h2 className="statistics-title">Stability Management Statistics</h2>
            <StatisticsCards statistics={statistics} loading={statsLoading} />
          </div>

          {/* Tab Navigation */}
          <div className="tab-navigation" style={{ marginBottom: "24px" }}>
            <button
              className={`tab-button ${
                activeTab === "running" ? "active" : ""
              }`}
              onClick={() => handleTabSwitch("running")}
            >
              <BiTrendingUp className="tab-icon" />
              Running
            </button>
            <button
              className={`tab-button ${activeTab === "all" ? "active" : ""}`}
              onClick={() => handleTabSwitch("all")}
            >
              <BiShield className="tab-icon" />
              All Stabilities
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "running" ? (
            loading ? (
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
            )
          ) : loading ? (
            <Loader size="large" color="primary" />
          ) : (
            <TableWithControl
              data={filteredRecords}
              columns={columns}
              defaultPageSize={10}
              serverSidePagination={false}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          )}
        </div>

        {showFileUploadModal && (
          <FileUploadModal
            onClose={() => {
              setShowFileUploadModal(false);
              setSelectedStability(null);
            }}
            onUpload={handleUploadFiles}
          />
        )}

        {showRejectModal && (
          <RejectModal
            onClose={() => {
              setShowRejectModal(false);
              setSelectedStability(null);
            }}
            onReject={handleRejectStability}
          />
        )}

        {showDateModal && (
          <StabilityDateModal
            onClose={() => {
              setShowDateModal(false);
              setSelectedStability(null);
            }}
            onUpdate={handleUpdateStabilityDates}
            currentDate={selectedStability?.stability_date}
          />
        )}

        {showRenewalModal && (
          <RenewalForm
            onClose={handleRenewalModalClose}
            onRenewal={handleRenewalCompleted}
            stabilityData={selectedStabilityForRenewal}
            stabilityManagers={stabilityManagers}
          />
        )}
      </div>
    </div>
  );
}

export default StabilityManagement; 
