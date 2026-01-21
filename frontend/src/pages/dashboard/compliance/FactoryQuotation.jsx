// This file is now FactoryQuotation.jsx
import React, { useState, useEffect } from "react";
import { BiPlus, BiEdit, BiErrorCircle, BiFile, BiUpload, BiShield, BiTrendingUp, BiCalendar, BiDownload, BiShow } from "react-icons/bi";
import { factoryQuotationAPI, planManagementAPI, userAPI, stabilityManagementAPI, applicationManagementAPI, companyAPI, renewalStatusAPI } from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import Dropdown from "../../../components/common/Dropdown/Dropdown";
import DocumentDownload from "../../../components/common/DocumentDownload/DocumentDownload";
import PhoneInput from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';
import "../../../styles/pages/dashboard/compliance/Compliance.css";
import "../../../styles/components/StatCards.css";
import "../../../styles/pages/dashboard/companies/Vendor.css";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../../contexts/AuthContext";

// View Quotation Modal Component
const ViewQuotationModal = ({ isOpen, onClose, quotation }) => {
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB");
  };

  if (!quotation) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Factory Quotation Details">
      <div className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Company Name
            </label>
            <div className="view-field">{quotation.companyName || "-"}</div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Company Code
            </label>
            <div className="view-field">
              {quotation.company?.company_code || "-"}
            </div>
          </div>

          <div
            className="insurance-form-group"
            style={{ gridColumn: "span 2" }}
          >
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Company Address
            </label>
            <div className="view-field" style={{ whiteSpace: "pre-line" }}>
              {quotation.companyAddress || "-"}
            </div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Phone Number
            </label>
            <div className="view-field">{quotation.phone || "-"}</div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Email
            </label>
            <div className="view-field">{quotation.email || "-"}</div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Number of Workers
            </label>
            <div className="view-field">{quotation.noOfWorkers || "-"}</div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Horse Power
            </label>
            <div className="view-field">{quotation.horsePower || "-"}</div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Calculated Amount
            </label>
            <div className="view-field">
              ₹{quotation.calculatedAmount?.toLocaleString() || "0"}
            </div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Year
            </label>
            <div className="view-field">
              {quotation.year || 1} year{quotation.year > 1 ? "s" : ""}
            </div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Stability Certificate Type
            </label>
            <div className="view-field">
              {quotation.stabilityCertificateType === "with load"
                ? "With Load"
                : quotation.stabilityCertificateType === "without load"
                ? "Without Load"
                : quotation.stabilityCertificateType || "-"}
            </div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Stability Certificate Amount
            </label>
            <div className="view-field">
              ₹{quotation.stabilityCertificateAmount?.toLocaleString() || "0"}
            </div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Administration Charge
            </label>
            <div className="view-field">
              ₹{quotation.administrationCharge?.toLocaleString() || "0"}
            </div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Consultancy Fees
            </label>
            <div className="view-field">
              ₹{quotation.consultancyFees?.toLocaleString() || "0"}
            </div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Plan Charge
            </label>
            <div className="view-field">
              ₹{quotation.planCharge?.toLocaleString() || "0"}
            </div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Total Amount
            </label>
            <div
              className="view-field"
              style={{ fontWeight: "bold", fontSize: "1.1em" }}
            >
              ₹{quotation.totalAmount?.toLocaleString() || "0"}
            </div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Status
            </label>
            <div className="view-field">
              <span
                className={`status-badge ${
                  quotation.status === "approved"
                    ? "status-badge-approved"
                    : quotation.status === "maked"
                    ? "status-badge-maked"
                    : quotation.status === "plan"
                    ? "status-badge-plan"
                    : quotation.status === "stability"
                    ? "status-badge-stability"
                    : quotation.status === "application"
                    ? "status-badge-application"
                    : quotation.status === "renewal"
                    ? "status-badge-renewal"
                    : "status-badge-maked"
                }`}
              >
                {quotation.status?.charAt(0).toUpperCase() +
                  quotation.status?.slice(1) || "-"}
              </span>
            </div>
          </div>

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Created At
            </label>
            <div className="view-field">{formatDate(quotation.created_at)}</div>
          </div>
        </div>

        <div className="insurance-form-actions">
          <button type="button" className="btn btn-outlined" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Plan Manager Selection Modal
const PlanManagerSelectionModal = ({ isOpen, onClose, onSelect, quotation }) => {
  const [selectedPlanManager, setSelectedPlanManager] = useState('');
  const [loading, setLoading] = useState(false);
  const [planManagers, setPlanManagers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchPlanManagers();
    }
  }, [isOpen]);

  const fetchPlanManagers = async () => {
    try {
      setLoading(true);
      console.log('Fetching plan managers...');
      
      // Fetch users with Plan_manager role
      const response = await planManagementAPI.getPlanManagers();
      console.log('Plan managers API response:', response);
      
      if (response && response.success && Array.isArray(response.data)) {
        setPlanManagers(response.data);
        console.log('Plan managers loaded successfully:', response.data);
      } else {
        console.error('Invalid response format:', response);
        toast.error('Failed to load plan managers - invalid response');
        setPlanManagers([]);
      }
    } catch (error) {
      console.error('Error fetching plan managers:', error);
      console.error('Error details:', error.response?.data || error.message);
      toast.error(`Failed to load plan managers: ${error.message}`);
      setPlanManagers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedPlanManager) {
      toast.error('Please select a plan manager');
      return;
    }

    // Prevent duplicate submissions
    if (loading) return;

    setLoading(true);
    try {
      const response = await planManagementAPI.createPlanManagement({
        factory_quotation_id: quotation.id,
        plan_manager_id: selectedPlanManager
      });
      
      if (response.success) {
        toast.success('Plan manager assigned successfully');
        onSelect(selectedPlanManager);
        onClose();
      }
    } catch (error) {
      console.error('Error assigning plan manager:', error);
      if (error.message?.includes('already exists')) {
        toast.error('Plan manager already assigned to this quotation');
      } else {
      toast.error('Failed to assign plan manager');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Plan Manager">
      <div className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
          <select
            value={selectedPlanManager}
            onChange={(e) => setSelectedPlanManager(e.target.value)}
              className="insurance-form-input"
            disabled={loading}
          >
            <option value="">
              {loading ? 'Loading plan managers...' : 'Select Plan Manager'}
            </option>
            {planManagers.map(manager => (
              <option key={manager.user_id} value={manager.user_id}>
                {manager.username} ({manager.email})
              </option>
            ))}
          </select>
          </div>
        </div>

        <div className="insurance-form-actions">
          <Button onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleAssign} variant="contained" disabled={loading}>
            Assign
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const StabilityManagerSelectionModal = ({ isOpen, onClose, onSelect, quotation }) => {
  const [selectedStabilityManager, setSelectedStabilityManager] = useState('');
  const [loading, setLoading] = useState(false);
  const [stabilityManagers, setStabilityManagers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchStabilityManagers();
    }
  }, [isOpen]);

  const fetchStabilityManagers = async () => {
    try {
      const response = await stabilityManagementAPI.getStabilityManagers();
      if (response.success) {
        setStabilityManagers(response.data);
      }
    } catch (error) {
      console.error('Error fetching stability managers:', error);
      toast.error('Failed to fetch stability managers');
    }
  };

  const handleAssign = async () => {
    if (!selectedStabilityManager) {
      toast.error('Please select a stability manager');
      return;
    }
    setLoading(true);
    try {
      // Use the existing stabilityCertificateType from the quotation and map to API format
      let loadType = 'with_load'; // default
      if (quotation?.stabilityCertificateType === 'with load') {
        loadType = 'with_load';
      } else if (quotation?.stabilityCertificateType === 'without load') {
        loadType = 'without_load';
      }
      
      console.log('Modal - Original stabilityCertificateType:', quotation?.stabilityCertificateType);
      console.log('Modal - Mapped loadType:', loadType);
      
      onSelect(selectedStabilityManager, loadType);
      onClose();
    } catch (error) {
      toast.error('Failed to assign stability manager');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Stability Manager">
      <div className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
          <select
            value={selectedStabilityManager}
            onChange={(e) => setSelectedStabilityManager(e.target.value)}
              className="insurance-form-input"
            disabled={loading}
          >
            <option value="">
              {loading ? 'Loading stability managers...' : 'Select Stability Manager'}
            </option>
            {stabilityManagers.map(manager => (
              <option key={manager.user_id} value={manager.user_id}>
                {manager.username} ({manager.email})
              </option>
            ))}
          </select>
        </div>
        </div>
        <div className="insurance-form-actions">
          <Button onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleAssign} variant="contained" disabled={loading}>
            Assign
          </Button>
        </div>
      </div>
    </Modal>
  );
};



// Application Approval Modal
const ApplicationApprovalModal = ({ isOpen, onClose, onApprove, currentApplication }) => {
  const [applicationDate, setApplicationDate] = useState(currentApplication?.application_date || '');
  const [expiryDate, setExpiryDate] = useState(currentApplication?.expiry_date || '');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
  };

  const handleApprove = async () => {
    if (!applicationDate) {
      toast.error('Please select an application date');
      return;
    }

    setLoading(true);
    try {
      await onApprove(files, applicationDate, expiryDate);
      toast.success('Application approved successfully');
      onClose(); // Close modal after successful approval
    } catch (error) {
      toast.error('Failed to approve application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Approve Application">
      <div className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
          <input
            type="date"
            value={applicationDate}
            onChange={(e) => setApplicationDate(e.target.value)}
              className="insurance-form-input"
            required
          />
        </div>

          <div className="insurance-form-group">
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
              className="insurance-form-input"
          />
          <small className="text-gray-500">
            Leave empty if no specific expiry date
          </small>
        </div>

          <div className="file-upload-group">
            <label className="file-upload-label">Upload Files (Optional)</label>
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
          <Button onClick={handleApprove} variant="contained" disabled={loading}>
            {loading ? 'Approving...' : 'Approve'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Application Reject Modal
const ApplicationRejectModal = ({ isOpen, onClose, onReject }) => {
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
      toast.success('Application rejected successfully');
    } catch (error) {
      toast.error('Failed to reject application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reject Application">
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
            {loading ? 'Rejecting...' : 'Reject'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Renewal Modal for Vendor Creation - Same as Company Registration
const RenewalModal = ({ isOpen, onClose, quotation, onRenewalCreated }) => {
  const [formData, setFormData] = useState({
    company_name: '',
    company_code: '',
    owner_name: '',
    owner_address: '',
    designation: '',
    company_address: '',
    contact_number: '+91',
    company_email: '',
    gst_number: '',
    pan_number: '',
    firm_type: '',
    nature_of_work: '',
    factory_license_number: '',
    labour_license_number: '',
    type_of_company: '',
    company_website: ''
  });

  // Backend renewal modal fields
  const [renewalData, setRenewalData] = useState({
    upload_option: null,
    expiry_date: ''
  });

  // Ensure phone number starts with +91 for India
  useEffect(() => {
    if (!formData.contact_number || !formData.contact_number.startsWith('+91')) {
      setFormData(prev => ({
        ...prev,
        contact_number: '+91'
      }));
    }
  }, []);

  // Populate form data when renewal modal opens
  useEffect(() => {
    if (isOpen && quotation) {
      setFormData({
        company_name: quotation.companyName || '',
        company_code: quotation.companyCode || quotation.company_code || '',
        owner_name: quotation.ownerName || '',
        owner_address: quotation.ownerAddress || '',
        designation: quotation.designation || '',
        company_address: quotation.companyAddress || '',
        contact_number: quotation.phone || '+91',
        company_email: quotation.email || '',
        gst_number: quotation.gstNumber || '',
        pan_number: quotation.panNumber || '',
        firm_type: quotation.firmType || '',
        nature_of_work: quotation.natureOfWork || '',
        type_of_company: quotation.typeOfCompany || '',
        company_website: quotation.companyWebsite || ''
      });
    }
  }, [isOpen, quotation]);

  const [files, setFiles] = useState({
    gst_document: null,
    pan_document: null
  });

  const [fileNames, setFileNames] = useState({
    gst_document: '',
    pan_document: ''
  });

  const [loading, setLoading] = useState(false);



  const validateGST = (gst) => {
    // Remove any spaces and convert to uppercase
    gst = gst.replace(/\s/g, "").toUpperCase();
    console.log('Validating GST:', gst);

    // Check length
    if (gst.length !== 15) {
      console.log('GST length invalid:', gst.length);
      return false;
    }

    // Check state code (first 2 digits)
    const stateCode = gst.substring(0, 2);
    if (!/^\d{2}$/.test(stateCode)) {
      console.log('Invalid state code:', stateCode);
      return false;
    }

    // Check PAN number (next 10 characters)
    const panNumber = gst.substring(2, 12);
    if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(panNumber)) {
      console.log('Invalid PAN number:', panNumber);
      return false;
    }

    // Check entity number (13th character)
    const entityNumber = gst.charAt(12);
    if (!/^[0-9A-Z]$/.test(entityNumber)) {
      console.log('Invalid entity number:', entityNumber);
      return false;
    }

    // Check check digit (14th character)
    const checkDigit = gst.charAt(13);
    if (!/^[0-9A-Z]$/.test(checkDigit)) {
      console.log('Invalid check digit:', checkDigit);
      return false;
    }

    // Check last character (must be alphanumeric)
    const lastChar = gst.charAt(14);
    if (!/^[0-9A-Z]$/.test(lastChar)) {
      console.log('Invalid last character:', lastChar);
      return false;
    }

    console.log('GST validation successful');
    return true;
  };

  const handleGSTChange = (e) => {
    let value = e.target.value;
    
    // Remove any non-alphanumeric characters
    value = value.replace(/[^0-9A-Za-z]/g, '');
    
    // Convert to uppercase
    value = value.toUpperCase();
    
    // Limit to 15 characters
    if (value.length > 15) {
      value = value.substring(0, 15);
    }
    
    // Auto-extract PAN from GST (positions 3-12)
    if (value.length >= 12) {
      const panNumber = value.substring(2, 12);
      setFormData(prev => ({
        ...prev,
        gst_number: value,
        pan_number: panNumber
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        gst_number: value
      }));
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
        console.log(`[Renewal] File selected for ${type}:`, {
            name: file.name,
            type: file.type,
            size: file.size
        });
        setFiles(prev => ({
            ...prev,
            [type]: file
        }));
        setFileNames(prev => ({
            ...prev,
            [type]: file.name
        }));
    }
  };

  const handlePhoneChange = (value) => {
    console.log('Phone number changed:', value);
    setFormData((prev) => ({
      ...prev,
      contact_number: value || '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[RenewalForm] Starting form submission');
    console.log('[RenewalForm] Form data:', formData);

    // Validate required fields
    const requiredFields = [
      'company_name',
      'owner_name',
      'company_address',
      'contact_number',
      'company_email',
      'gst_number',
      'pan_number',
      'firm_type',
      'nature_of_work',
      'type_of_company'
    ];

    const missingFields = requiredFields.filter(field => !formData[field]);
    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Validate GST number format
    if (!validateGST(formData.gst_number)) {
      toast.error('Invalid GST number format. Please enter a valid 15-character GST number.');
      return;
    }

    try {
      setLoading(true);

      // First, check if company already exists with this GST number
      let existingCompany = null;
      try {
        // Fetch all companies with a large page size to ensure we get all companies
        const companiesResponse = await companyAPI.getAllCompanies({ pageSize: 9999 });
        if (companiesResponse.success && companiesResponse.data) {
          existingCompany = companiesResponse.data.find(
            company => company.gst_number === formData.gst_number
          );
          if (existingCompany) {
            console.log('Found existing company with GST:', existingCompany.gst_number);
          }
        }
      } catch (error) {
        console.log('Error checking existing companies:', error);
        // Continue with creating new company if we can't check existing ones
      }

      let companyResponse;

      if (existingCompany) {
        // Company exists, update it instead of creating new one
        console.log('Company with GST number already exists, updating...');
        
        // Create FormData for update
        const updateData = new FormData();
        
        // Append all form fields
        Object.keys(formData).forEach(key => {
          if (key !== 'gst_document' && key !== 'pan_document') {
            const value = formData[key] || '';
            updateData.append(key, value);
            console.log(`Appending ${key}:`, value);
          }
        });

        // Handle file uploads for update
        if (files.gst_document instanceof File) {
          console.log('Appending GST document for update:', {
            name: files.gst_document.name,
            type: files.gst_document.type,
            size: files.gst_document.size
          });
          updateData.append('gst_document', files.gst_document);
        }

        if (files.pan_document instanceof File) {
          console.log('Appending PAN document for update:', {
            name: files.pan_document.name,
            type: files.pan_document.type,
            size: files.pan_document.size
          });
          updateData.append('pan_document', files.pan_document);
        }

        companyResponse = await companyAPI.updateCompany(existingCompany.id, updateData);
        console.log('Company updated:', companyResponse);
      } else {
        // Company doesn't exist, create new one
        console.log('Creating new company...');
        
        // Create FormData for new company
        const submitData = new FormData();

        // Append all form fields
        Object.keys(formData).forEach(key => {
          if (key !== 'gst_document' && key !== 'pan_document') {
            const value = formData[key] || '';
            submitData.append(key, value);
            console.log(`Appending ${key}:`, value);
          }
        });

        // Handle file uploads
        if (files.gst_document instanceof File) {
          console.log('Appending GST document:', {
            name: files.gst_document.name,
            type: files.gst_document.type,
            size: files.gst_document.size
          });
          submitData.append('gst_document', files.gst_document);
        }

        if (files.pan_document instanceof File) {
          console.log('Appending PAN document:', {
            name: files.pan_document.name,
            type: files.pan_document.type,
            size: files.pan_document.size
          });
          submitData.append('pan_document', files.pan_document);
        }

        companyResponse = await companyAPI.createCompany(submitData);
        console.log('Company/Vendor created:', companyResponse);
      }

      if (companyResponse.success) {
        console.log('Form submission successful');
        
        // Update factory quotation status to renewal and link company
        const companyId = existingCompany ? existingCompany.id : companyResponse.data.company_id;
        await factoryQuotationAPI.updateStatus(quotation.id, { 
          status: 'renewal',
          company_id: companyId,
          renewal_date: new Date().toISOString()
        });
        
        // Create renewal status record
        try {
          // Create FormData for renewal status with files
          const renewalFormData = new FormData();
          renewalFormData.append('factory_quotation_id', quotation.id);
          renewalFormData.append('expiry_date', renewalData.expiry_date);
          
          // Append files if they exist
          if (renewalData.upload_option && renewalData.upload_option.length > 0) {
            renewalData.upload_option.forEach(file => {
              renewalFormData.append('files', file);
            });
          }
          
          await renewalStatusAPI.createRenewalStatus(renewalFormData);
          console.log('Renewal status record created successfully');
          
          // Update application status to 'renewal' if it exists
          if (quotation.applicationManagement) {
            try {
              await applicationManagementAPI.updateApplicationStatus(
                quotation.applicationManagement.id, 
                { status: 'renewal' }
              );
              console.log('Application status updated to renewal');
            } catch (appError) {
              console.error('Error updating application status:', appError);
            }
          }
        } catch (renewalError) {
          console.error('Error creating renewal status record:', renewalError);
          // Don't fail the entire process if renewal status creation fails
        }
        
        const message = existingCompany 
          ? 'Renewal created successfully! Existing company has been updated.'
          : 'Renewal created successfully! New company/Vendor account has been created.';
        
        toast.success(message);
        
        onRenewalCreated();
        onClose();
      } else {
        throw new Error(companyResponse.message || 'Failed to save company');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      
      // Handle specific error cases
      if (error.message && error.message.includes('GST number already exists')) {
        toast.error('A company with this GST number already exists. Please use a different GST number or contact support.');
      } else if (error.message && error.message !== 'An error occurred') {
        toast.error(error.message);
      } else {
        toast.error('An error occurred while creating the renewal. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "gst_number") {
      handleGSTChange(e);
    } else if (name === "contact_number") {
      // Ensure contact number is properly formatted
      const formattedNumber = value.replace(/\D/g, ''); // Remove non-digit characters
      setFormData((prev) => ({
        ...prev,
        [name]: formattedNumber,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Renewal - Company Registration">
      <div className="renewal-modal">


        <form onSubmit={handleSubmit} className="insurance-form">
          <div className="insurance-form-grid">
            <div className="insurance-form-group">
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                placeholder="Company Name"
                required
                className="insurance-form-input"
              />
            </div>

            <div className="insurance-form-group">
              <input
                type="text"
                name="company_code"
                value={formData.company_code}
                onChange={handleChange}
                placeholder="Company Code (e.g., COMP0001)"
                className="insurance-form-input"
              />
            </div>

            <div className="insurance-form-group">
              <input
                type="text"
                name="owner_name"
                value={formData.owner_name}
                onChange={handleChange}
                placeholder="Owner Name"
                required
                className="insurance-form-input"
              />
            </div>

            <div className="insurance-form-group">
              <textarea
                name="owner_address"
                value={formData.owner_address}
                onChange={handleChange}
                placeholder="Owner Address"
                required
                className="insurance-form-input"
                rows="3"
              />
            </div>

            <div className="insurance-form-group">
              <input
                type="text"
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                placeholder="Designation"
                required
                className="insurance-form-input"
              />
            </div>

            <div className="insurance-form-group">
              <textarea
                name="company_address"
                value={formData.company_address}
                onChange={handleChange}
                placeholder="Company Address"
                required
                className="insurance-form-input"
                rows="3"
              />
            </div>

            <div className="insurance-form-group">
              <PhoneInput
                international
                defaultCountry="IN"
                value={formData.contact_number}
                onChange={handlePhoneChange}
                placeholder="Enter phone number"
                required
                className="insurance-form-input phone-input-custom"
                flags={flags}
                countrySelectProps={{
                  className: "phone-input-country-select"
                }}
                addInternationalOption={false}
                limitMaxLength={true}
                maxLength={15}
                preferredCountries={['IN']}
                countries={['IN', 'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'CN', 'BR']}
              />
            </div>

            <div className="insurance-form-group">
              <input
                type="email"
                name="company_email"
                value={formData.company_email}
                onChange={handleChange}
                placeholder="Email"
                required
                className="insurance-form-input"
              />
            </div>

            <div className="insurance-form-group">
              <input
                type="text"
                name="gst_number"
                value={formData.gst_number}
                onChange={handleChange}
                placeholder="GST Number (15 digits)"
                required
                className="insurance-form-input"
                maxLength={15}
              />
            </div>

            <div className="file-upload-group">
              <label className="file-upload-label">GST Certificate</label>
                <div className="file-upload-container">
                  <input
                    type="file"
                    onChange={(e) => handleFileChange(e, 'gst_document')}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="file-upload-input"
                  />
                <Button
                  type="button"
                  variant="outlined"
                  className="file-upload-button"
                  onClick={() => document.querySelector('input[type="file"]').click()}
                >
                  <BiUpload className="mr-2" />
                  {fileNames.gst_document || 'Upload GST Certificate'}
                </Button>
                  </div>
            </div>

            <div className="insurance-form-group">
              <input
                type="text"
                name="pan_number"
                value={formData.pan_number}
                onChange={handleChange}
                placeholder="PAN Number"
                required
                className="insurance-form-input"
                readOnly
              />
            </div>

            <div className="file-upload-group">
              <label className="file-upload-label">PAN Card</label>
                <div className="file-upload-container">
                  <input
                    type="file"
                    onChange={(e) => handleFileChange(e, 'pan_document')}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="file-upload-input"
                  />
                <Button
                  type="button"
                  variant="outlined"
                  className="file-upload-button"
                  onClick={() => document.querySelector('input[type="file"]').click()}
                >
                  <BiUpload className="mr-2" />
                  {fileNames.pan_document || 'Upload PAN Card'}
                </Button>
                  </div>
            </div>

            <div className="insurance-form-group">
              <select
                name="firm_type"
                value={formData.firm_type}
                onChange={handleChange}
                required
                className="insurance-form-input"
              >
                <option value="">Select Firm Type</option>
                <option value="Proprietorship">Proprietorship</option>
                <option value="Partnership">Partnership</option>
                <option value="LLP">LLP</option>
                <option value="Private Limited">Private Limited</option>
                <option value="Limited">Limited</option>
                <option value="Trust">Trust</option>
              </select>
            </div>

            <div className="insurance-form-group">
              <input
                type="text"
                name="nature_of_work"
                value={formData.nature_of_work}
                onChange={handleChange}
                placeholder="Nature of Work"
                required
                className="insurance-form-input"
              />
            </div>

            <div className="insurance-form-group">
              <input
                type="text"
                name="factory_license_number"
                value={formData.factory_license_number}
                onChange={handleChange}
                placeholder="Factory License Number"
                className="insurance-form-input"
              />
            </div>

            <div className="insurance-form-group">
              <input
                type="text"
                name="labour_license_number"
                value={formData.labour_license_number}
                onChange={handleChange}
                placeholder="Labour License Number"
                className="insurance-form-input"
              />
            </div>

            <div className="insurance-form-group">
              <select
                name="type_of_company"
                value={formData.type_of_company}
                onChange={handleChange}
                required
                className="insurance-form-input"
              >
                <option value="">Select Type of Company</option>
                <option value="Industries">Industries</option>
                <option value="Contractor">Contractor</option>
                <option value="School">School</option>
                <option value="Hospital">Hospital</option>
                <option value="Service">Service</option>
              </select>
            </div>

            <div className="insurance-form-group">
              <input
                type="url"
                name="company_website"
                value={formData.company_website}
                onChange={handleChange}
                placeholder="Company Website (Optional)"
                className="insurance-form-input"
              />
            </div>

            {/* Backend Renewal Modal Fields */}
            <div className="insurance-form-group">
              <label>Upload Option:</label>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const selectedFiles = Array.from(e.target.files);
                  setRenewalData(prev => ({
                    ...prev,
                    upload_option: selectedFiles
                  }));
                }}
                className="insurance-form-input"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
              />
              <small className="text-gray-500">
                Allowed file types: PDF, Word, Excel, Images, Text (Max 10MB each)
              </small>
            </div>

            <div className="insurance-form-group">
              <label>Expiry Date:</label>
              <input
                type="date"
                value={renewalData.expiry_date}
                onChange={(e) => setRenewalData(prev => ({
                  ...prev,
                  expiry_date: e.target.value
                }))}
                className="insurance-form-input"
              />
            </div>
          </div>

          <div className="insurance-form-actions">
            <Button type="button" variant="outlined" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

const FactoryQuotationForm = ({ quotation, onClose, onQuotationUpdated }) => {
  const [formData, setFormData] = useState({
    companyName: "",
    companyAddress: "",
    phone: "",
    email: "",
    noOfWorkers: "",
    horsePower: "",
    calculatedAmount: "",
    year: 1,
    stabilityCertificateType: "with load",
    stabilityCertificateAmount: "",
    administrationCharge: "",
    consultancyFees: "",
    planCharge: "",
    totalAmount: "",
    status: "maked",
  });

  const [calculationOptions, setCalculationOptions] = useState({
    horsePowerOptions: [],
    noOfWorkersOptions: []
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load calculation options when component mounts
    const loadCalculationOptions = async () => {
      try {
        const response = await factoryQuotationAPI.getCalculationOptions();
        if (response && response.data) {
          setCalculationOptions(response.data);
        }
      } catch (err) {
        console.error('Error loading calculation options:', err);
      }
    };
    
    loadCalculationOptions();
  }, []);

  useEffect(() => {
    if (quotation) {
      setFormData({
        companyName: quotation.companyName || "",
        companyAddress: quotation.companyAddress || "",
        phone: quotation.phone || "",
        email: quotation.email || "",
        noOfWorkers: quotation.noOfWorkers || "",
        horsePower: quotation.horsePower || "",
        calculatedAmount: quotation.calculatedAmount || "",
        year: quotation.year || 1,
        stabilityCertificateType: quotation.stabilityCertificateType || "with load",
        stabilityCertificateAmount: quotation.stabilityCertificateAmount || "",
        administrationCharge: quotation.administrationCharge || "",
        consultancyFees: quotation.consultancyFees || "",
        planCharge: quotation.planCharge || "",
        totalAmount: quotation.totalAmount || "",
        status: quotation.status || "maked",
      });
    }
  }, [quotation]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Auto-calculate when horse power or number of workers changes
    if (name === 'horsePower' || name === 'noOfWorkers') {
      const newHorsePower = name === 'horsePower' ? value : formData.horsePower;
      const newNoOfWorkers = name === 'noOfWorkers' ? value : formData.noOfWorkers;
      
      if (newHorsePower && newNoOfWorkers) {
        calculateAmount(newHorsePower, newNoOfWorkers);
      }
    }
  };

  const calculateAmount = async (horsePower, noOfWorkers) => {
    try {
      const response = await factoryQuotationAPI.calculateAmount(horsePower, noOfWorkers);
      if (response && response.data && response.data.calculatedAmount) {
        setFormData(prev => ({
          ...prev,
          calculatedAmount: response.data.calculatedAmount
        }));
      }
    } catch (err) {
      console.error('Error calculating amount:', err);
    }
  };

  const calculateTotal = () => {
    const calculated = parseFloat(formData.calculatedAmount) || 0;
    const yearMultiplier = parseFloat(formData.year) || 1;
    const stability = parseFloat(formData.stabilityCertificateAmount) || 0;
    const admin = parseFloat(formData.administrationCharge) || 0;
    const consultancy = parseFloat(formData.consultancyFees) || 0;
    const plan = parseFloat(formData.planCharge) || 0;
    
    // Calculate: (calculated amount × year multiplier) + other charges
    return (calculated * yearMultiplier) + stability + admin + consultancy + plan;
  };

  useEffect(() => {
    const total = calculateTotal();
    setFormData(prev => ({ ...prev, totalAmount: total }));
  }, [formData.calculatedAmount, formData.year, formData.stabilityCertificateAmount, formData.administrationCharge, formData.consultancyFees, formData.planCharge]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("\n=== [Factory Quotation] Form Submit Started ===");
    console.log("Form Values:", formData);

    setLoading(true);
    setError("");

    // Validate required fields
    const requiredFields = {
      companyName: "Company Name",
      companyAddress: "Company Address",
      phone: "Phone",
      email: "Email",
      noOfWorkers: "Number of Workers",
      horsePower: "Horse Power",
      calculatedAmount: "Calculated Amount",
      year: "Year",
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key]) => !formData[key])
      .map(([_, label]) => label);

    if (missingFields.length > 0) {
      console.error("[Factory Quotation] Missing required fields:", missingFields);
      setError(`Missing required fields: ${missingFields.join(", ")}`);
      setLoading(false);
      return;
    }

    try {
      let response;
      if (quotation) {
        console.log("\n[Factory Quotation] Updating quotation:", quotation.id);
        response = await factoryQuotationAPI.updateQuotation(quotation.id, formData);
        toast.success("Factory quotation updated successfully!");
      } else {
        console.log("\n[Factory Quotation] Creating new quotation");
        response = await factoryQuotationAPI.createQuotation(formData);
        toast.success("Factory quotation created successfully!");
      }

      // Generate PDF automatically after creation/update
      if (response && response.data && response.data.id) {
        try {
          await factoryQuotationAPI.generatePDF(response.data.id);
          toast.info("PDF generated successfully!");
        } catch (pdfError) {
          console.error("Error generating PDF:", pdfError);
          toast.warning("Quotation saved but PDF generation failed. You can generate it manually.");
        }
      }

      onQuotationUpdated();
    } catch (err) {
      console.error("\n[Factory Quotation] Error submitting form:", err);
      const errorMessage = err.response?.data?.message || "Failed to save factory quotation";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      console.log("=== [Factory Quotation] Form Submit Ended ===\n");
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              placeholder="Company Name"
              className="insurance-form-input"
              required
            />
          </div>

          <div className="insurance-form-group">
            <input
              type="text"
              name="companyAddress"
              value={formData.companyAddress}
              onChange={handleChange}
              placeholder="Company Address"
              className="insurance-form-input"
              required
            />
          </div>

          <div className="insurance-form-group">
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Phone Number"
              className="insurance-form-input"
              required
            />
          </div>

          <div className="insurance-form-group">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email"
              className="insurance-form-input"
              required
            />
          </div>

                    <div className="insurance-form-group">
            <select
              name="noOfWorkers"
              value={formData.noOfWorkers}
              onChange={handleChange}
              className="insurance-form-input"
              required
            >
        <option value="">Select No. of Workers</option>
              {calculationOptions.noOfWorkersOptions.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
          </div>

          <div className="insurance-form-group">
            <select
              name="horsePower"
              value={formData.horsePower}
              onChange={handleChange}
              className="insurance-form-input"
              required
            >
        <option value="">Select Horse Power</option>
              {calculationOptions.horsePowerOptions.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
          </div>

          <div className="insurance-form-group">
            <input
              type="number"
              name="calculatedAmount"
              value={formData.calculatedAmount}
              onChange={handleChange}
              placeholder="Calculated Amount (Auto-calculated)"
              className="insurance-form-input"
              required
              min="0"
              step="0.01"
              readOnly
            />
            <small className="text-gray-600 text-xs mt-1">
              Auto-calculated based on Horse Power and Number of Workers
            </small>
          </div>

          <div className="insurance-form-group">
            <input
              type="number"
              name="year"
              value={formData.year}
              onChange={handleChange}
              placeholder="Number of Years (1, 2, 3...)"
              className="insurance-form-input"
              required
              min="1"
              max="10"
            />
            <small className="text-gray-600 text-xs mt-1">
              Number of years to multiply with calculated amount
            </small>
          </div>

          <div className="insurance-form-group">
            <select
              name="stabilityCertificateType"
              value={formData.stabilityCertificateType}
              onChange={handleChange}
              className="insurance-form-input"
              required
            >
        <option value="with load">With Load</option>
        <option value="without load">Without Load</option>
      </select>
          </div>

          <div className="insurance-form-group">
            <input
              type="number"
              name="stabilityCertificateAmount"
              value={formData.stabilityCertificateAmount}
              onChange={handleChange}
              placeholder="Stability Certificate Amount"
              className="insurance-form-input"
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="insurance-form-group">
            <input
              type="number"
              name="administrationCharge"
              value={formData.administrationCharge}
              onChange={handleChange}
              placeholder="Administration Charge"
              className="insurance-form-input"
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="insurance-form-group">
            <input
              type="number"
              name="consultancyFees"
              value={formData.consultancyFees}
              onChange={handleChange}
              placeholder="Consultancy Fees"
              className="insurance-form-input"
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="insurance-form-group">
            <input
              type="number"
              name="planCharge"
              value={formData.planCharge}
              onChange={handleChange}
              placeholder="Plan Charge"
              className="insurance-form-input"
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="insurance-form-group">
            <input
              type="number"
              name="totalAmount"
              value={formData.totalAmount}
              className="insurance-form-input"
              placeholder="Total Amount"
              readOnly
            />
          </div>

          <div className="insurance-form-group">
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="insurance-form-input"
              required
            >
        {["maked", "approved", "plan", "stability", "application", "renewal"].map((opt) => (
          <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
        ))}
      </select>
          </div>
        </div>

        {error && (
          <div className="insurance-error">
            <BiErrorCircle className="inline mr-2" /> {error}
          </div>
        )}

        <div className="insurance-form-actions">
          <Button type="button" variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {quotation ? "Update" : "Create"}
          </Button>
      </div>
    </form>
    </>
  );
};

// --- StatisticsCards Component ---
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

  const { total, pending, approved, rejected, plan, stability, application, renewal } = statistics;

  return (
    <div className="statistics-section">
      <div className="statistics-grid">
        <div className="stat-card total">
          <div className="stat-icon">
            <BiShield />
          </div>
          <div className="stat-content">
            <div className="stat-number">{total}</div>
            <div className="stat-label">Total Quotations</div>
          </div>
        </div>
        <div className="stat-card active">
          <div className="stat-icon">
            <BiTrendingUp />
          </div>
          <div className="stat-content">
            <div className="stat-number">{pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        <div className="stat-card recent">
          <div className="stat-icon">
            <BiCalendar />
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
      </div>
      
      {/* Additional Status Cards */}
      <div className="statistics-grid" style={{ marginTop: '1rem' }}>
        <div className="stat-card plan">
          <div className="stat-icon">
            <BiFile />
          </div>
          <div className="stat-content">
            <div className="stat-number">{plan}</div>
            <div className="stat-label">Plan</div>
          </div>
        </div>
        <div className="stat-card stability">
          <div className="stat-icon">
            <BiShield />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stability}</div>
            <div className="stat-label">Stability</div>
          </div>
        </div>
        <div className="stat-card application">
          <div className="stat-icon">
            <BiEdit />
          </div>
          <div className="stat-content">
            <div className="stat-number">{application}</div>
            <div className="stat-label">Application</div>
          </div>
        </div>
        <div className="stat-card renewal">
          <div className="stat-icon">
            <BiCalendar />
          </div>
          <div className="stat-content">
            <div className="stat-number">{renewal}</div>
            <div className="stat-label">Renewal</div>
          </div>
        </div>
      </div>
    </div>
  );
};

function FactoryQuotation({ searchQuery = "" }) {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [showPlanManagerModal, setShowPlanManagerModal] = useState(false);
  const [showStabilityManagerModal, setShowStabilityManagerModal] = useState(false);
  const [showStabilityModal, setShowStabilityModal] = useState(false);
  const [showStabilityRejectModal, setShowStabilityRejectModal] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showApplicationRejectModal, setShowApplicationRejectModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingQuotation, setViewingQuotation] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });
  const [statistics, setStatistics] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    plan: 0,
    stability: 0,
    application: 0,
    renewal: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'completed'
  const [groupedQuotations, setGroupedQuotations] = useState([]);
  const { user, userRoles } = useAuth();
  const isAdmin = userRoles.includes("admin");
  const isComplianceManager = userRoles.includes("compliance_manager");
  const canEdit = isAdmin || isComplianceManager;

  useEffect(() => {
    console.log("Factory Quotation component mounted");
    if (searchQuery && searchQuery.trim() !== "") {
      handleSearchQuotations(searchQuery);
    } else {
      fetchQuotations(1, 10);
    }
    fetchFactoryQuotationStatistics();
  }, [searchQuery]);

  const handleSearchQuotations = async (query) => {
    try {
      console.log("Searching factory quotations with query:", query);
      setLoading(true);
      const response = await factoryQuotationAPI.searchQuotations({ 
        q: query,
        page: 1,
        pageSize: pagination.pageSize 
      });
      
      if (response && response.quotations && Array.isArray(response.quotations)) {
        setQuotations(response.quotations);
        setPagination({
          currentPage: response.currentPage || 1,
          pageSize: response.pageSize || pagination.pageSize,
          totalPages: response.totalPages || 1,
          totalItems: response.totalItems || 0,
        });
        setError(null);
      } else if (response && response.data && Array.isArray(response.data)) {
        const filtered = response.data.filter(quotation => 
          quotation.companyName?.toLowerCase().includes(query.toLowerCase()) ||
          quotation.email?.toLowerCase().includes(query.toLowerCase()) ||
          quotation.phone?.includes(query)
        );
        setQuotations(filtered);
        setError(null);
      } else if (Array.isArray(response)) {
        setQuotations(response);
        setError(null);
      } else {
        setError("Invalid data format received from server");
        setQuotations([]);
      }
    } catch (err) {
      console.error("Error searching factory quotations:", err);
      // Fallback to fetching all if search fails
      await fetchQuotations(1, pagination.pageSize);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotations = async (page = 1, pageSize = 10, filterStatus = null) => {
    try {
      console.log("Fetching factory quotations...", { page, pageSize, filterStatus });
      setLoading(true);
      
      // Filter based on active tab
      let params = { page, pageSize };
      if (activeTab === 'all') {
        // For 'all' tab, apply status filter if provided
        const currentFilter = filterStatus !== null ? filterStatus : statusFilter;
        if (currentFilter !== 'all') {
          params.status = currentFilter;
        }
      }
      
      const response = await factoryQuotationAPI.getAllQuotations(params);
      console.log("Factory Quotation API response:", response);

      if (response && response.quotations && Array.isArray(response.quotations)) {
        setQuotations(response.quotations);
        setPagination({
          currentPage: response.currentPage || page,
          pageSize: response.pageSize || pageSize,
          totalPages: response.totalPages || 1,
          totalItems: response.totalItems || 0,
        });
        setError(null);
      } else if (response && response.data && Array.isArray(response.data)) {
        setQuotations(response.data);
        setPagination((prev) => ({ ...prev, currentPage: page }));
        setError(null);
      } else if (Array.isArray(response)) {
        setQuotations(response);
        setPagination((prev) => ({ ...prev, currentPage: page }));
        setError(null);
      } else {
        console.error("Invalid response format:", response);
        setError("Invalid data format received from server");
        setQuotations([]);
      }
    } catch (err) {
      console.error("Error fetching factory quotations:", err);
      setError("Failed to fetch factory quotations");
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch grouped quotations (completed + previous)
  const fetchGroupedQuotations = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      // Fetch quotations with status='renewal' for Completed tab
      const response = await factoryQuotationAPI.getAllQuotations({ 
        page, 
        pageSize,
        status: 'renewal' // Only fetch quotations with renewal status
      });
      
      if (response.success) {
        setGroupedQuotations(response.quotations || response.data);
        setQuotations(response.quotations || response.data); // Set to quotations for display
        
        setPagination({
          currentPage: response.currentPage || page,
          pageSize: response.pageSize || pageSize,
          totalPages: response.totalPages || 1,
          totalItems: response.totalItems || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching grouped quotations:', error);
      setError('Failed to fetch grouped quotations');
    } finally {
      setLoading(false);
    }
  };

  // Handle tab switching
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setStatusFilter('all'); // Reset filter when switching tabs
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    
    if (tab === 'all') {
      fetchQuotations(1, pagination.pageSize);
    } else if (tab === 'completed') {
      fetchGroupedQuotations(1, pagination.pageSize);
    }
  };

  const fetchFactoryQuotationStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await factoryQuotationAPI.getStatistics();
      if (response && response.data) {
        setStatistics(response.data);
      } else {
        console.error("Failed to fetch factory quotation statistics:", response);
        setStatistics({
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          plan: 0,
          stability: 0,
          application: 0,
          renewal: 0
        });
      }
    } catch (error) {
      console.error("Error fetching factory quotation statistics:", error);
      setStatistics({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        plan: 0,
        stability: 0,
        application: 0,
        renewal: 0
      });
    } finally {
      setStatsLoading(false);
    }
  };


  const handleEdit = (quotation) => {
    setSelectedQuotation(quotation);
    setShowModal(true);
  };

  const handleViewQuotation = (quotation) => {
    setViewingQuotation(quotation);
    setShowViewModal(true);
  };

  const handleModalClose = () => {
    console.log("Modal closing");
    setSelectedQuotation(null);
    setShowModal(false);
  };

  const handleQuotationUpdated = async () => {
    console.log("Factory quotation updated, refreshing list");
    await fetchQuotations(pagination.currentPage, pagination.pageSize);
    handleModalClose();
  };

  const handlePageChange = async (page) => {
    console.log("FactoryQuotation: Page changed to:", page);
    if (activeTab === 'completed') {
      await fetchGroupedQuotations(page, pagination.pageSize);
    } else {
      await fetchQuotations(page, pagination.pageSize);
    }
  };

  const handlePageSizeChange = async (newPageSize) => {
    console.log("FactoryQuotation: Page size changed to:", newPageSize);
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));
    if (activeTab === 'completed') {
      await fetchGroupedQuotations(1, newPageSize);
    } else {
      await fetchQuotations(1, newPageSize);
    }
  };

  const handleStatusChange = async (quotationId, newStatus) => {
    try {
      if (newStatus === 'plan') {
        // Show plan manager selection modal
        const quotation = quotations.find(q => q.id === quotationId);
        
        // Check if plan management already exists
        if (quotation.planManagement) {
          toast.error('Plan management already exists for this quotation');
          return;
        }
        
        // Prevent opening modal if already open
        if (showPlanManagerModal) {
          return;
        }
        
        setSelectedQuotation(quotation);
        setShowPlanManagerModal(true);
        return;
      }

      if (newStatus === 'stability') {
        // Show stability manager selection modal
        const quotation = quotations.find(q => q.id === quotationId);
        
        // Check if stability management already exists
        if (quotation.stabilityManagement) {
          toast.error('Stability management already exists for this quotation');
          return;
        }
        
        // Prevent opening modal if already open
        if (showStabilityManagerModal) {
          return;
        }
        
        setSelectedQuotation(quotation);
        setShowStabilityManagerModal(true);
        return;
      }

      if (newStatus === 'application') {
        // Application status is handled automatically in the backend
        // No need to show manual selection modal
        const response = await factoryQuotationAPI.updateStatus(quotationId, { status: newStatus });
        if (response.success) {
          toast.success(`Status updated to ${newStatus} successfully`);
          await fetchQuotations(pagination.currentPage, pagination.pageSize);
        }
        return;
      }

      const response = await factoryQuotationAPI.updateStatus(quotationId, { status: newStatus });
      if (response.success) {
        toast.success(`Status updated to ${newStatus} successfully`);
        await fetchQuotations(pagination.currentPage, pagination.pageSize);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handlePlanManagerSelect = async (planManagerId) => {
    try {
      const response = await planManagementAPI.createPlanManagement({
        factory_quotation_id: selectedQuotation.id,
        plan_manager_id: planManagerId
      });
      
      if (response.success) {
        toast.success('Plan manager assigned successfully');
        await fetchQuotations(pagination.currentPage, pagination.pageSize);
        // Close modal after successful assignment
        setShowPlanManagerModal(false);
      }
    } catch (error) {
      console.error('Error assigning plan manager:', error);
      if (error.message?.includes('already exists')) {
        toast.error('Plan manager already assigned to this quotation');
        // Close modal if plan already exists
        setShowPlanManagerModal(false);
      } else {
      toast.error('Failed to assign plan manager');
      }
    }
  };

  const handleStabilityManagerSelect = async (stabilityManagerId, loadType) => {
    try {
      console.log('🔄 Factory Quotation - Assigning to Stability Manager');
      console.log('📋 Selected quotation:', {
        id: selectedQuotation.id,
        companyName: selectedQuotation.companyName,
        status: selectedQuotation.status
      });
      console.log('👤 Assignment details:', {
        factory_quotation_id: selectedQuotation.id,
        stability_manager_id: stabilityManagerId,
        load_type: loadType
      });
      
      const response = await stabilityManagementAPI.createStabilityManagement({
        factory_quotation_id: selectedQuotation.id,
        stability_manager_id: stabilityManagerId,
        load_type: loadType
      });
      
      console.log('📡 Stability Management API Response:', response);
      
      if (response.success) {
        console.log('✅ Stability manager assigned successfully');
        toast.success('Stability manager assigned successfully');
        await fetchQuotations(pagination.currentPage, pagination.pageSize);
        // Close modal after successful assignment
        setShowStabilityManagerModal(false);
      } else {
        console.error('❌ API returned success: false:', response);
        toast.error('Failed to assign stability manager');
      }
    } catch (error) {
      console.error('❌ Error assigning stability manager:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      if (error.message?.includes('already exists')) {
        console.log('⚠️ Stability management already exists for this quotation');
        toast.error('Stability manager already assigned to this quotation');
        // Close modal if stability management already exists
        setShowStabilityManagerModal(false);
      } else {
        toast.error('Failed to assign stability manager');
      }
    }
  };

  // Handle stability status change
  const handleStabilityStatusChange = async (stabilityId, newStatus, stabilityDate) => {
    try {
      const updateData = { status: newStatus };
      
      if (newStatus === 'Approved' && stabilityDate) {
        updateData.stability_date = stabilityDate;
      }

      const response = await stabilityManagementAPI.updateStabilityStatus(stabilityId, updateData);
      if (response.success) {
        toast.success('Stability status updated successfully');
        await fetchQuotations(pagination.currentPage, pagination.pageSize);
      }
    } catch (error) {
      toast.error('Failed to update stability status');
    }
  };

  // Handle stability file upload
  const handleStabilityFileUpload = async (stabilityId, files, stabilityDate) => {
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      // First update status with date
      await stabilityManagementAPI.updateStabilityStatus(stabilityId, {
        status: 'Approved',
        stability_date: stabilityDate
      });

      // Then upload files
      const response = await stabilityManagementAPI.uploadStabilityFiles(stabilityId, formData);
      if (response.success) {
        toast.success('Files uploaded and stability approved successfully');
        await fetchQuotations(pagination.currentPage, pagination.pageSize);
      }
    } catch (error) {
      toast.error('Failed to upload stability files');
    }
  };



  // Handle application status change
  const handleApplicationStatusChange = async (applicationId, newStatus, applicationDate, remarks) => {
    try {
      const updateData = { status: newStatus };
      
      if (newStatus === 'Approved' && applicationDate) {
        updateData.application_date = applicationDate;
      }
      
      if (newStatus === 'Reject' && remarks) {
        updateData.remarks = remarks;
      }

      const response = await applicationManagementAPI.updateApplicationStatus(applicationId, updateData);
      if (response.success) {
        toast.success('Application status updated successfully');
        await fetchQuotations(pagination.currentPage, pagination.pageSize);
      }
    } catch (error) {
      toast.error('Failed to update application status');
    }
  };

  // Handle application file upload
  const handleApplicationFileUpload = async (applicationId, files, applicationDate, expiryDate) => {
    try {
      // First update status with dates
      await applicationManagementAPI.updateApplicationStatus(applicationId, {
        status: 'Approved',
        application_date: applicationDate,
        expiry_date: expiryDate
      });

      // Then upload files if any were selected
      if (files && files.length > 0) {
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });

        const response = await applicationManagementAPI.uploadApplicationFiles(applicationId, formData);
        if (response.success) {
          toast.success('Files uploaded and application approved successfully');
          await fetchQuotations(pagination.currentPage, pagination.pageSize);
        }
      } else {
        // No files selected, just approve the application
        toast.success('Application approved successfully');
        await fetchQuotations(pagination.currentPage, pagination.pageSize);
      }
    } catch (error) {
      console.error('Error in application file upload:', error);
      toast.error('Failed to process application approval');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'maked':
        return 'status-badge-maked';
      case 'approved':
      case 'Approved':
        return 'status-badge-approved';
      case 'plan':
        return 'status-badge-plan';
      case 'stability':
        return 'status-badge-stability';
      case 'application':
        return 'status-badge-application';
      case 'renewal':
        return 'status-badge-renewal';
      case 'submit':
        return 'status-badge-submit';
      case 'reject':
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

  // Base columns that are always shown
  const baseColumns = [
    {
      key: "sr_no",
      label: "Sr No.",
      sortable: true,
      render: (_, __, index) => {
        // Calculate serial number based on current page and page size
        return (pagination.currentPage - 1) * pagination.pageSize + index + 1;
      },
    },
  ];

  // Rest of the columns
  const restColumns = [
    {
      key: "companyName",
      label: "Company Name",
      sortable: true,
      render: (_, quotation) => quotation.companyName || "-",
    },
    {
      key: "companyAddress",
      label: "Address",
      sortable: true,
      render: (_, quotation) => quotation.companyAddress || "-",
    },
    {
      key: "contact",
      label: "Contact Details",
      sortable: true,
      render: (_, quotation) => (
        <div>
          <div>{quotation.phone || "-"}</div>
          <div className="text-sm text-gray-600">{quotation.email || "-"}</div>
        </div>
      ),
    },
    {
      key: "workers",
      label: "Workers",
      sortable: true,
      render: (_, quotation) => quotation.noOfWorkers || "-",
    },
    {
      key: "horsePower",
      label: "Horse Power",
      sortable: true,
      render: (_, quotation) => quotation.horsePower || "-",
    },
    {
      key: "calculatedAmount",
      label: "Base Amount",
      sortable: true,
      render: (_, quotation) => `₹${quotation.calculatedAmount?.toLocaleString() || "0"}`,
    },
    {
      key: "totalAmount",
      label: "Total Amount",
      sortable: true,
      render: (_, quotation) => `₹${quotation.totalAmount?.toLocaleString() || "0"}`,
    },
    {
      key: "year",
      label: "Years",
      sortable: true,
      render: (_, quotation) => `${quotation.year || 1} year${quotation.year > 1 ? 's' : ''}`,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (_, quotation) => {
        const statusClass =
          quotation.status === "approved"
            ? "status-badge-approved"
            : quotation.status === "maked"
            ? "status-badge-maked"
            : quotation.status === "plan"
            ? "status-badge-plan"
            : quotation.status === "stability"
            ? "status-badge-stability"
            : quotation.status === "application"
            ? "status-badge-application"
            : quotation.status === "renewal"
            ? "status-badge-renewal"
            : "status-badge-maked";
        
        // If status is renewal, always show as badge (not editable)
        if (quotation.status === "renewal") {
          return (
            <span className={`status-badge ${statusClass}`}>
              Renewal
            </span>
          );
        }
        
        return canEdit ? (
          <select
            value={quotation.status || "maked"}
            onChange={(e) => handleStatusChange(quotation.id, e.target.value)}
            className={`status-badge-dropdown ${statusClass}`}
          >
            <option value="maked">Maked</option>
            <option value="approved">Approved</option>
            <option value="plan">Plan</option>
            <option value="stability">Stability</option>
            <option value="application">Application</option>
          </select>
        ) : (
          <span className={`status-badge-dropdown ${statusClass}`}>
            {quotation.status?.charAt(0).toUpperCase() + quotation.status?.slice(1) || "-"}
          </span>
        );
      },
    },
    {
      key: "planStatus",
      label: "Plan Status",
      sortable: true,
      render: (_, quotation) => {
        const planStatus = quotation.planManagement?.status;
        if (!planStatus) {
          return "-";
        }
        
        const planStatusClass = 
          planStatus === 'plan' ? 'status-badge-plan' :
          planStatus === 'submit' ? 'status-badge-submit' :
          planStatus === 'Approved' ? 'status-badge-approved' :
          planStatus === 'Reject' ? 'status-badge-reject' :
          'status-badge-maked';
        
        return (
          <span className={`status-badge-dropdown ${planStatusClass}`}>
            {planStatus}
          </span>
        );
      },
    },
    {
      key: "stabilityStatus",
      label: "Stability Status",
      sortable: true,
      render: (_, quotation) => {
        const stabilityStatus = quotation.stabilityManagement?.status;
        if (!stabilityStatus) {
          return "-";
        }
        
        const stabilityStatusClass = 
          stabilityStatus === 'stability' ? 'status-badge-stability' :
          stabilityStatus === 'submit' ? 'status-badge-submit' :
          stabilityStatus === 'Approved' ? 'status-badge-approved' :
          stabilityStatus === 'Reject' ? 'status-badge-reject' :
          'status-badge-maked';
        
        return (
          <span className={`status-badge-dropdown ${stabilityStatusClass}`}>
            {stabilityStatus}
          </span>
        );
      },
    },
    {
      key: "applicationStatus",
      label: "Application Status",
      sortable: true,
      render: (_, quotation) => {
        const applicationRecord = quotation.applicationManagement;
        
        // If no application management record exists and quotation status is 'application'
        if (!applicationRecord && quotation.status === 'application') {
          return (
            <div className="application-status-container">
              <span className="status-badge status-badge-not-assigned">Pending Auto-Assignment</span>
              <small className="text-gray-500" style={{ display: 'block', marginTop: '4px' }}>
                Will be automatically assigned when stability is approved
              </small>
            </div>
          );
        }
        
        // If application management record exists
        if (applicationRecord) {
          // If user is compliance manager or admin, show interactive dropdown
        if (userRoles.includes("compliance_manager") || userRoles.includes("admin")) {
          return (
            <div className="application-status-container">
              <select
                value={applicationRecord.status}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  if (newStatus === 'Approved') {
                    // Show modal for dates and files
                    setSelectedQuotation(quotation);
                    setShowApplicationModal(true);
                  } else if (newStatus === 'Reject') {
                    // Show reject modal
                    setSelectedQuotation(quotation);
                    setShowApplicationRejectModal(true);
                  } else {
                    // Direct status update
                    handleApplicationStatusChange(applicationRecord.id, newStatus);
                  }
                }}
                className={`status-badge-dropdown ${getStatusBadgeClass(applicationRecord.status)}`}
              >
                <option value="application">Application</option>
                <option value="submit">Submit</option>
                <option value="Approved">Approved</option>
                  <option value="renewal">Renewal</option>
                <option value="Reject">Reject</option>
              </select>
            </div>
          );
        }
        
        // For other users, show read-only status
        return (
          <div>
            <span className={`status-badge ${getStatusBadgeClass(applicationRecord.status)}`}>
              {applicationRecord.status}
            </span>
          </div>
        );
        }
        
        // Default case
        return <span className="status-badge status-badge-not-assigned">Not Assigned</span>;
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, quotation) => {
        return (
          <div className="insurance-actions">
            {/* Only show View and Edit buttons for non-completed tabs */}
            {activeTab !== 'completed' && (
              <>
                <ActionButton
                  onClick={() => handleViewQuotation(quotation)}
                  variant="secondary"
                  size="small"
                  title="View Quotation Details"
                >
                  <BiShow />
                </ActionButton>
                
                <ActionButton
                  onClick={() => handleEdit(quotation)}
                  variant="secondary"
                  size="small"
                  disabled={!canEdit}
                  title="Edit Quotation"
                >
                  <BiEdit />
                </ActionButton>
              </>
            )}
            
            <ActionButton
              onClick={async () => {
                try {
                  const response = await factoryQuotationAPI.downloadPDF(quotation.id);
                  const blob = new Blob([response], { type: 'application/pdf' });
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `factory-quotation-${quotation.id}.pdf`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                  toast.success('PDF downloaded successfully');
                } catch (error) {
                  console.error('Error downloading PDF:', error);
                  toast.error('Failed to download PDF');
                }
              }}
              variant="secondary"
              size="small"
              title="Download PDF"
            >
              <BiDownload />
            </ActionButton>
          </div>
        );
      },
    },
  ];

  // Combine columns based on active tab
  // Don't add Type column for Completed tab - not needed
  const columns = [...baseColumns, ...restColumns];

  // Don't filter client-side when using server-side pagination
  // The filtering is already done on the server
  const displayQuotations = quotations;

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "maked", label: "Maked" },
    { value: "approved", label: "Approved" },
    { value: "plan", label: "Plan" },
    { value: "stability", label: "Stability" },
    { value: "application", label: "Application" },
    { value: "renewal", label: "Renewal" },
  ];


  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Factory Quotation</h1>
            <div className="list-container">
              {canEdit && (
                <Button
                  variant="contained"
                  onClick={() => setShowModal(true)}
                  icon={<BiPlus />}
                >
                  Add Quotation
                </Button>
              )}
              {/* Show status filter only on All Quotations tab */}
              {activeTab === 'all' && (
                <div className="dashboard-header-dropdown-container">
                  <Dropdown
                    options={statusOptions}
                    value={statusOptions.find((opt) => opt.value === statusFilter)}
                    onChange={(option) => {
                      const newStatus = option ? option.value : "all";
                      setStatusFilter(newStatus);
                      // Refetch with new filter - pass the new status directly
                      fetchQuotations(1, pagination.pageSize, newStatus);
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
              className={`tab-button ${activeTab === "all" ? "active" : ""}`}
              onClick={() => handleTabSwitch("all")}
            >
              <BiShield className="tab-icon" />
              All Quotations
            </button>
            <button
              className={`tab-button ${activeTab === "completed" ? "active" : ""}`}
              onClick={() => handleTabSwitch("completed")}
            >
              <BiTrendingUp className="tab-icon" />
              Completed
            </button>
          </div>
          
          {error && (
            <div className="insurance-error">
              <BiErrorCircle className="inline mr-2" /> {error}
            </div>
          )}

      {loading ? (
        <Loader size="large" color="primary" />
      ) : (
          <TableWithControl
            data={displayQuotations}
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
        title={selectedQuotation ? "Edit Factory Quotation" : "Add New Factory Quotation"}
      >
        <FactoryQuotationForm
          quotation={selectedQuotation}
          onClose={handleModalClose}
          onQuotationUpdated={handleQuotationUpdated}
        />
      </Modal>
      <PlanManagerSelectionModal
        isOpen={showPlanManagerModal}
        onClose={() => setShowPlanManagerModal(false)}
        onSelect={handlePlanManagerSelect}
        quotation={selectedQuotation}
      />
      <StabilityManagerSelectionModal
        isOpen={showStabilityManagerModal}
        onClose={() => setShowStabilityManagerModal(false)}
        onSelect={handleStabilityManagerSelect}
        quotation={selectedQuotation}
      />

      {/* Application Modals */}
      <ApplicationApprovalModal
        isOpen={showApplicationModal}
        onClose={() => setShowApplicationModal(false)}
        onApprove={(files, applicationDate, expiryDate) => 
          handleApplicationFileUpload(selectedQuotation?.applicationManagement?.id, files, applicationDate, expiryDate)
        }
        currentApplication={selectedQuotation?.applicationManagement}
      />
      
      <ApplicationRejectModal
        isOpen={showApplicationRejectModal}
        onClose={() => setShowApplicationRejectModal(false)}
        onReject={(remarks) => 
          handleApplicationStatusChange(selectedQuotation?.applicationManagement?.id, 'Reject', null, remarks)
        }
      />

        {/* Renewal Modal */}
        <RenewalModal
          isOpen={showRenewalModal}
          onClose={() => setShowRenewalModal(false)}
          quotation={selectedQuotation}
          onRenewalCreated={handleQuotationUpdated}
        />

        {/* View Quotation Modal */}
        <ViewQuotationModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setViewingQuotation(null);
          }}
          quotation={viewingQuotation}
        />
      </div>
    </div>
  );
}

export default FactoryQuotation;


