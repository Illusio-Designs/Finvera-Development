import React, { useState, useEffect, useRef } from "react";
import { BiPlus, BiEdit, BiTrash, BiErrorCircle, BiUpload, BiBuilding, BiTrendingUp, BiCalendar } from "react-icons/bi";
import { companyAPI } from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import "../../../styles/pages/dashboard/companies/Vendor.css";
import "../../../styles/components/StatCards.css";
import PhoneInput from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Add custom styles for phone input
const phoneInputCustomStyles = {
  '.PhoneInput': {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #e2e8f0',
    borderRadius: '0.375rem',
    padding: '0.5rem',
    backgroundColor: '#fff',
  },
  '.PhoneInputCountry': {
    marginRight: '0.5rem',
  },
  '.PhoneInputInput': {
    flex: '1',
    border: 'none',
    outline: 'none',
    padding: '0.25rem',
    fontSize: '1rem',
    backgroundColor: 'transparent',
  },
  '.PhoneInputCountrySelect': {
    width: '90px',
  },
  '.PhoneInputCountryIcon': {
    width: '25px',
    height: '20px',
  }
};

const CompanyForm = ({ company, onClose, onCompanyUpdated }) => {
  const [formData, setFormData] = useState({
    company_name: '',
    company_code: '',
    owner_name: '',
    owner_address: '',
    designation: '',
    company_address: '',
    contact_number: '',
    company_email: '',
    gst_number: '',
    pan_number: '',
    firm_type: '',
    nature_of_work: '',
    factory_license_number: '',
    labour_license_number: '',
    type_of_company: ''
  });

  const [files, setFiles] = useState({
    gst_document: null,
    pan_document: null
  });

  const [fileNames, setFileNames] = useState({
    gst_document: '',
    pan_document: ''
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (company) {
      setFormData({
        company_name: company.company_name || '',
        company_code: company.company_code || '',
        owner_name: company.owner_name || '',
        owner_address: company.owner_address || '',
        designation: company.designation || '',
        company_address: company.company_address || '',
        contact_number: company.contact_number || '',
        company_email: company.company_email || '',
        gst_number: company.gst_number || '',
        pan_number: company.pan_number || '',
        firm_type: company.firm_type || '',
        nature_of_work: company.nature_of_work || '',
        factory_license_number: company.factory_license_number || '',
        labour_license_number: company.labour_license_number || '',
        type_of_company: company.type_of_company || ''
      });

      // Set file names from existing company data
      setFileNames({
        gst_document: company.gst_document_name || '',
        pan_document: company.pan_document_name || ''
      });
    }
  }, [company]);

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

    // Remove any spaces and convert to uppercase
    value = value.replace(/\s/g, "").toUpperCase();

    // Only allow alphanumeric characters
    value = value.replace(/[^A-Z0-9]/g, "");

    // Limit to 15 characters (GST number length)
    value = value.slice(0, 15);

    setFormData((prev) => {
      const newData = {
        ...prev,
        gst_number: value,
      };

      // If GST is valid (15 characters), auto-fill PAN
      if (value.length === 15) {
        // Extract PAN from GST (characters 2-12)
        const pan = value.substring(2, 12);
        newData.pan_number = pan;
      }

      return newData;
    });
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
        console.log(`[Company] File selected for ${type}:`, {
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
    setFormData((prev) => ({
      ...prev,
      contact_number: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[CompanyForm] Starting form submission');
    console.log('[CompanyForm] Form data:', formData);

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
      setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Validate GST number format
    if (!validateGST(formData.gst_number)) {
      setError('Invalid GST number format. Please enter a valid 15-character GST number.');
      return;
    }

    try {
      setError('');
      setLoading(true);

      // Create FormData object
      const submitData = new FormData();

      // Append all form fields
      Object.keys(formData).forEach(key => {
        if (key !== 'gst_document' && key !== 'pan_document') {
          submitData.append(key, formData[key]);
          console.log(`Appending ${key}:`, formData[key]);
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
      } else if (company?.gst_document) {
        // Keep existing file information
        submitData.append('existing_gst_document', company.gst_document);
        submitData.append('gst_document_name', company.gst_document_name);
      }

      if (files.pan_document instanceof File) {
        console.log('Appending PAN document:', {
          name: files.pan_document.name,
          type: files.pan_document.type,
          size: files.pan_document.size
        });
        submitData.append('pan_document', files.pan_document);
      } else if (company?.pan_document) {
        // Keep existing file information
        submitData.append('existing_pan_document', company.pan_document);
        submitData.append('pan_document_name', company.pan_document_name);
      }

      // Log final FormData entries
      console.log('Final FormData entries:', Array.from(submitData.entries()).map(([key, value]) => ({
        key,
        type: value instanceof File ? 'File' : typeof value,
        value: value instanceof File ? {
          name: value.name,
          type: value.type,
          size: value.size
        } : value
      })));

      console.log('Submitting form data...');
      let response;
      if (company) {
        console.log('Updating existing company:', company.company_id);
        response = await companyAPI.updateCompany(company.company_id, submitData);
      } else {
        console.log('Creating new company');
        response = await companyAPI.createCompany(submitData);
      }

      if (response.success) {
        console.log('Form submission successful');
        onCompanyUpdated();
        onClose();
      } else {
        throw new Error(response.message || 'Failed to save company');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      if (error.message && error.message !== 'An error occurred') {
        toast.error(error.message);
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
    <>
      {/* Removed inline error display */}

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

          <div className="insurance-form-group file-upload-group">
            <label className="file-upload-label">
              <span>GST Certificate</span>
              <div className="file-upload-container">
                <input
                  type="file"
                  onChange={(e) => handleFileChange(e, 'gst_document')}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="file-upload-input"
                />
                <div className="file-upload-button">
                  <BiUpload /> {fileNames.gst_document || 'Upload GST Certificate'}
                </div>
              </div>
            </label>
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

          <div className="insurance-form-group file-upload-group">
            <label className="file-upload-label">
              <span>PAN Card</span>
              <div className="file-upload-container">
                <input
                  type="file"
                  onChange={(e) => handleFileChange(e, 'pan_document')}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="file-upload-input"
                />
                <div className="file-upload-button">
                  <BiUpload /> {fileNames.pan_document || 'Upload PAN Card'}
                </div>
              </div>
            </label>
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
        </div>

        <div className="insurance-form-actions">
          <Button type="button" variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {company ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </>
  );
};

function CompanyList({ searchQuery = "" }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });

  useEffect(() => {
    if (searchQuery && searchQuery.trim() !== "") {
      handleSearchCompanies(searchQuery);
    } else {
      fetchCompanies(1, 10);
    }
    fetchCompanyStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const fetchCompanies = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      const response = await companyAPI.getAllCompanies({ page, pageSize });
      if (response && response.companies && Array.isArray(response.companies)) {
        setCompanies(response.companies);
        setPagination({
          currentPage: response.currentPage || page,
          pageSize: response.pageSize || pageSize,
          totalPages: response.totalPages || 1,
          totalItems: response.totalItems || 0,
        });
        setError(null);
      } else if (Array.isArray(response)) {
        setCompanies(response);
        setPagination((prev) => ({ ...prev, currentPage: page }));
        setError(null);
      } else if (response && response.data && Array.isArray(response.data)) {
        setCompanies(response.data);
        setPagination((prev) => ({ ...prev, currentPage: page }));
        setError(null);
      } else if (response && response.data && response.data.data && Array.isArray(response.data.data)) {
        setCompanies(response.data.data);
        setPagination((prev) => ({ ...prev, currentPage: page }));
        setError(null);
      } else {
        setError("Invalid data format received from server");
        setCompanies([]);
      }
    } catch (err) {
      setError("Failed to fetch companies");
      setCompanies([]);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    }
  };

  const handleSearchCompanies = async (query) => {
    try {
      setLoading(true);
      const response = await companyAPI.searchCompanies({ 
        q: query,
        page: 1,
        pageSize: pagination.pageSize 
      });
      if (Array.isArray(response)) {
        setCompanies(response);
        setError(null);
      } else if (response && response.data && Array.isArray(response.data)) {
        setCompanies(response.data);
        setError(null);
      } else if (response && response.data && response.data.data && Array.isArray(response.data.data)) {
        setCompanies(response.data.data);
        setError(null);
      } else {
        setError("Invalid data format received from server");
        setCompanies([]);
      }
    } catch (err) {
      setError("Failed to search companies");
      setCompanies([]);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    }
  };

  const handleDelete = async (companyId) => {
    if (window.confirm("Are you sure you want to delete this company?")) {
      try {
        await companyAPI.deleteCompany(companyId);
        toast.success('Company deleted successfully!', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
        await fetchCompanies();
      } catch (err) {
        const errorMessage = "Failed to delete company";
        setError(errorMessage);
        toast.error(errorMessage, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
        console.error(err);
      }
    }
  };

  const handleEdit = (company) => {
    setSelectedCompany(company);
    setShowModal(true);
  };

  const handleModalClose = () => {
    console.log('Modal closing');
    setSelectedCompany(null);
    setShowModal(false);
  };

  const handleCompanyUpdated = async () => {
    console.log('Company updated, refreshing list');
    await fetchCompanies(pagination.currentPage, pagination.pageSize);
    await fetchCompanyStatistics();
    handleModalClose();
  };

  const handlePageChange = async (page) => {
    console.log("CompanyList: Page changed to:", page);
    await fetchCompanies(page, pagination.pageSize);
  };

  const handlePageSizeChange = async (newPageSize) => {
    console.log("CompanyList: Page size changed to:", newPageSize);
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));
    await fetchCompanies(1, newPageSize);
  };

  const fetchCompanyStatistics = async () => {
    try {
      console.log('[CompanyList] fetchCompanyStatistics called');
      setStatsLoading(true);
      
      console.log('[CompanyList] Calling getCompanyStatistics API...');
      const response = await companyAPI.getCompanyStatistics();
      console.log('[CompanyList] API response received:', response);
      
      if (response.success) {
        console.log('[CompanyList] Setting statistics:', response.data);
        setStatistics(response.data);
      } else {
        console.log('[CompanyList] API returned success: false');
      }
    } catch (error) {
      console.error('[CompanyList] Error fetching company statistics:', error);
      console.error('[CompanyList] Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const columns = [
    {
      key: "sr_no",
      label: "Sr No.",
      sortable: true,
      render: (_, __, index, pagination = {}) => {
        const { currentPage = 1, pageSize = 10 } = pagination;
        const serialNumber = (currentPage - 1) * pageSize + index + 1;
        return serialNumber;
      },
    },
    { key: "company_name", label: "Company Name", sortable: true },
    { key: "company_code", label: "Company Code", sortable: true },
    { key: "owner_name", label: "Owner Name", sortable: true },
    { key: "contact_number", label: "Contact Number", sortable: true },
    { key: "company_email", label: "Email", sortable: true },
    { key: "gst_number", label: "GST Number", sortable: true },
    { key: "firm_type", label: "Firm Type", sortable: true },
    {
      key: "actions",
      label: "Actions",
      render: (_, company) => (
        <div className="vendor-management-actions">
          <ActionButton
            onClick={() => handleEdit(company)}
            variant="secondary"
            size="small"
          >
            <BiEdit />
          </ActionButton>
        </div>
      ),
    },
  ];

  // Statistics Cards Component
  const StatisticsCards = () => {
      if (statsLoading) {
    return (
      <div className="statistics-grid">
        <div className="stat-card loading">
          <Loader size="small" />
        </div>
        <div className="stat-card loading">
          <Loader size="small" />
        </div>
        <div className="stat-card loading">
          <Loader size="small" />
        </div>
      </div>
    );
  }

    if (!statistics) return null;

    // Calculate percentages
    const totalCompanies = statistics.total_companies || 0;
    const activeCompanies = statistics.active_companies || 0;
    const recentCompanies = statistics.recent_companies || 0;

    const activePercentage = totalCompanies > 0 ? Math.round((activeCompanies / totalCompanies) * 100) : 0;
    const recentPercentage = totalCompanies > 0 ? Math.round((recentCompanies / totalCompanies) * 100) : 0;

    return (
      <div className="statistics-section">
        
        <div className="statistics-grid">
          {/* Total Companies Card */}
          <div className="stat-card total">
            <div className="stat-icon">
              <BiBuilding />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{totalCompanies}</h3>
              <p className="stat-label">Total Companies</p>
            </div>
          </div>

          {/* Active Companies Card */}
          <div className="stat-card active">
            <div className="stat-icon">
              <BiTrendingUp />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{activeCompanies}</h3>
              <p className="stat-label">Active Companies</p>
              <p className="stat-percentage">{activePercentage}% of total</p>
            </div>
          </div>



          {/* Recent Companies Card */}
          <div className="stat-card recent">
            <div className="stat-icon">
              <BiCalendar />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{recentCompanies}</h3>
              <p className="stat-label">Recent Companies (30 days)</p>
              <p className="stat-percentage">{recentPercentage}% of total</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="vendor-management">
      <div className="vendor-management-content">
        <div className="vendor-management-header">
          <h1 className="vendor-management-title">Companies</h1>
          <Button
            variant="contained"
            onClick={() => setShowModal(true)}
            icon={<BiPlus />}
          >
            Add Company
          </Button>
        </div>

        {/* Company Statistics */}
        <StatisticsCards />

        {error && (
          <div className="vendor-management-error">
            <BiErrorCircle className="inline mr-2" /> {error}
          </div>
        )}

        {loading ? (
          <Loader size="large" color="primary" />
        ) : (
          <TableWithControl
            data={companies}
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
        title={selectedCompany ? "Edit Company" : "Add New Company"}
      >
        <CompanyForm
          company={selectedCompany}
          onClose={handleModalClose}
          onCompanyUpdated={handleCompanyUpdated}
        />
      </Modal>
    </div>
  );
}

export default CompanyList;
