import React, { useState, useEffect } from "react";
import {
  BiPlus,
  BiEdit,
  BiTrash,
  BiErrorCircle,
  BiUpload,
  BiShield,
  BiTrendingUp,
  BiCalendar,
  BiRefresh,
} from "react-icons/bi";
import { dscAPI } from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import Dropdown from "../../../components/common/Dropdown/Dropdown";
import "../../../styles/pages/dashboard/dsc/Dsc.css";
import "../../../styles/components/StatCards.css";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Select from "react-select";
import PhoneInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import { FaEdit, FaTrash } from "react-icons/fa";
import { useAuth } from "../../../contexts/AuthContext";

const DSCForm = ({ dsc, onClose, onDSCUpdated }) => {
  const [formData, setFormData] = useState({
    companyId: "",
    consumerId: "",
    certificationName: "",
    expiryDate: "",
    status: "in",
    remarks: "",
    email: "",
    mobileNumber: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [combinedOptions, setCombinedOptions] = useState([]);

  useEffect(() => {
    if (dsc) {
      setFormData({
        companyId: dsc.company_id || "",
        consumerId: dsc.consumer_id || "",
        certificationName: dsc.certification_name || "",
        expiryDate: dsc.expiry_date ? dsc.expiry_date.slice(0, 10) : "",
        status: dsc.status || "in",
        remarks: dsc.remarks || "",
        email: dsc.company?.company_email || dsc.consumer?.email || "",
        mobileNumber:
          dsc.company?.contact_number || dsc.consumer?.phone_number || "",
      });
    }
  }, [dsc]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [companiesResponse, consumersResponse] = await Promise.all([
          dscAPI.getActiveCompanies(),
          dscAPI.getActiveConsumers(),
        ]);

        console.log("Companies response:", companiesResponse);
        console.log("Consumers response:", consumersResponse);

        setCompanies(companiesResponse || []);
        setConsumers(consumersResponse || []);

        const options = [
          {
            label: "Companies",
            options: (companiesResponse || []).map((company) => ({
              value: `company_${company.company_id}`,
              label: company.company_name,
              type: "company",
              data: company,
            })),
          },
          {
            label: "Consumers",
            options: (consumersResponse || []).map((consumer) => ({
              value: `consumer_${consumer.consumer_id}`,
              label: consumer.name,
              type: "consumer",
              data: consumer,
            })),
          },
        ];

        console.log("Combined options:", options);
        setCombinedOptions(options);
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.error("Failed to fetch data");
        setCompanies([]);
        setConsumers([]);
        setCombinedOptions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleHolderChange = (option) => {
    console.log("\n=== [DSC] Holder Change ===");
    console.log("Selected Option:", option);

    if (!option) {
      console.log("Clearing holder selection");
      setFormData((prev) => ({
        ...prev,
        companyId: null,
        consumerId: null,
        email: "",
        mobileNumber: "",
      }));
      return;
    }

    const { type, data } = option;
    console.log("Holder Type:", type);
    console.log("Holder Data:", data);

    if (type === "company") {
      console.log("Setting company holder");
      setFormData((prev) => ({
        ...prev,
        companyId: Number(data.company_id),
        consumerId: null,
        email: data.company_email,
        mobileNumber: data.contact_number,
      }));
    } else if (type === "consumer") {
      console.log("Setting consumer holder");
      setFormData((prev) => ({
        ...prev,
        companyId: null,
        consumerId: Number(data.consumer_id),
        email: data.email,
        mobileNumber: data.phone_number,
      }));
    }

    console.log("=== [DSC] Holder Change Complete ===\n");
  };

  const handlePhoneChange = (value) => {
    setFormData((prev) => ({ ...prev, mobileNumber: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("\n=== [DSC] Form Submit Started ===");
    console.log("Form Values:", formData);

    setLoading(true);
    setError("");

    // Validate required fields
    const requiredFields = {
      certificationName: "Certification Name",
      expiryDate: "Expiry Date",
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key]) => !formData[key])
      .map(([_, label]) => label);

    if (missingFields.length > 0) {
      console.error("[DSC] Missing required fields:", missingFields);
      setError(`Missing required fields: ${missingFields.join(", ")}`);
      setLoading(false);
      return;
    }

    // Validate that either companyId or consumerId is provided, but not both
    const hasCompanyId =
      formData.companyId &&
      formData.companyId !== "null" &&
      formData.companyId !== "";
    const hasConsumerId =
      formData.consumerId &&
      formData.consumerId !== "null" &&
      formData.consumerId !== "";

    if (!hasCompanyId && !hasConsumerId) {
      console.error("[DSC] Neither company nor consumer selected");
      setError("Please select either a company or a consumer");
      setLoading(false);
      return;
    }

    if (hasCompanyId && hasConsumerId) {
      console.error("[DSC] Both company and consumer selected");
      setError("Please select either a company or a consumer, not both");
      setLoading(false);
      return;
    }

    try {
      // Convert camelCase to snake_case
      const sanitizedFormData = {
        company_id: hasCompanyId ? Number(formData.companyId) : null,
        consumer_id: hasConsumerId ? Number(formData.consumerId) : null,
        certification_name: formData.certificationName,
        expiry_date: formData.expiryDate,
        status: formData.status,
        remarks: formData.remarks,
        email: formData.email,
        mobile_number: formData.mobileNumber,
      };

      console.log("Sanitized form data:", sanitizedFormData);

      let response;
      if (dsc) {
        console.log("\n[DSC] Updating DSC:", dsc.dsc_id);
        response = await dscAPI.updateDSC(dsc.dsc_id, sanitizedFormData);
        toast.success("DSC updated successfully!");
      } else {
        console.log("\n[DSC] Creating new DSC");
        response = await dscAPI.createDSC(sanitizedFormData);
        toast.success("DSC created successfully!");
      }

      onDSCUpdated();
    } catch (err) {
      console.error("\n[DSC] Error submitting form:", err);
      const errorMessage = err.response?.data?.message || "Failed to save DSC";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      console.log("=== [DSC] Form Submit Ended ===\n");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
            <Select
              options={combinedOptions}
              value={combinedOptions
                .flatMap((group) => group.options)
                .find(
                  (option) =>
                    (option.type === "company" &&
                      option.data.company_id === formData.companyId) ||
                    (option.type === "consumer" &&
                      option.data.consumer_id === formData.consumerId)
                )}
              onChange={handleHolderChange}
              placeholder="Select Company or Consumer"
              isClearable
              isSearchable={true}
              styles={{
                menu: (provided) => ({ ...provided, zIndex: 9999 }),
                control: (provided) => ({
                  ...provided,
                  minHeight: "44px",
                  borderRadius: "8px",
                  borderColor: "#d1d5db",
                }),
                groupHeading: (provided) => ({
                  ...provided,
                  fontWeight: "bold",
                  color: "#1F4F9C",
                  backgroundColor: "#f3f4f6",
                  padding: "8px 12px",
                  margin: 0,
                }),
              }}
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
              readOnly
            />
          </div>

          <div className="insurance-form-group">
            <PhoneInput
              international
              defaultCountry="IN"
              value={formData.mobileNumber}
              onChange={handlePhoneChange}
              placeholder="Mobile Number"
              className="insurance-form-input phone-input-custom"
              flags={flags}
              readOnly
            />
          </div>

          <div className="insurance-form-group">
            <input
              type="text"
              name="certificationName"
              value={formData.certificationName}
              onChange={handleChange}
              placeholder="Certification Name"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <input
              type="date"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleChange}
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="insurance-form-input"
            >
              <option value="in">In</option>
              <option value="out">Out</option>
            </select>
          </div>
          <div className="insurance-form-group" style={{ gridColumn: "span 2" }}>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              placeholder="Remarks"
              className="insurance-form-input"
              rows={2}
            />
          </div>
        </div>
        <div className="insurance-form-actions">
          <Button type="button" variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {dsc ? "Update" : "Create"}
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
          {[1, 2, 3].map((i) => (
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

  const { totalDSCs, inDSCs, outDSCs } = statistics;
  const inPercentage = totalDSCs > 0 ? Math.round((inDSCs / totalDSCs) * 100) : 0;
  const outPercentage = totalDSCs > 0 ? Math.round((outDSCs / totalDSCs) * 100) : 0;

  return (
    <div className="statistics-section">
      <div className="statistics-grid">
        <div className="stat-card total">
          <div className="stat-icon">
            <BiShield />
          </div>
          <div className="stat-content">
            <div className="stat-number">{totalDSCs}</div>
            <div className="stat-label">All DSCs</div>
          </div>
        </div>
        <div className="stat-card active">
          <div className="stat-icon">
            <BiTrendingUp />
          </div>
          <div className="stat-content">
            <div className="stat-number">{inDSCs}</div>
            <div className="stat-label">In DSCs</div>
            <div className="stat-percentage">{inPercentage}%</div>
          </div>
        </div>
        <div className="stat-card recent">
          <div className="stat-icon">
            <BiCalendar />
          </div>
          <div className="stat-content">
            <div className="stat-number">{outDSCs}</div>
            <div className="stat-label">Out DSCs</div>
            <div className="stat-percentage">{outPercentage}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// DSC Renewal Form Component
const DSCRenewalForm = ({ dsc, onClose, onRenewalCompleted }) => {
  const [formData, setFormData] = useState({
    expiry_date: "",
    remarks: dsc?.remarks || "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.expiry_date) {
      toast.error("Please select an expiry date");
      return;
    }

    try {
      setLoading(true);
      await onRenewalCompleted(formData);
    } catch (error) {
      // Error is handled in parent component
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="insurance-form">
      <div className="insurance-form-grid">
        <div className="insurance-form-group">
          <label htmlFor="current_expiry">Current Expiry Date</label>
          <input
            type="date"
            value={dsc?.expiry_date ? new Date(dsc.expiry_date).toISOString().split('T')[0] : ''}
            disabled
            className="insurance-form-input"
          />
        </div>

        <div className="insurance-form-group">
          <label htmlFor="expiry_date">New Expiry Date *</label>
          <input
            type="date"
            id="expiry_date"
            name="expiry_date"
            value={formData.expiry_date}
            onChange={handleChange}
            required
            className="insurance-form-input"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="insurance-form-group" style={{ gridColumn: "span 2" }}>
          <label htmlFor="remarks">Remarks</label>
          <textarea
            id="remarks"
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
            className="insurance-form-input"
            rows="3"
            placeholder="Enter any remarks for the renewal..."
          />
        </div>
      </div>

      <div className="insurance-form-actions">
        <Button type="button" variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          Renew DSC
        </Button>
      </div>
    </form>
  );
};

// Main DSC Component
function DSC({ searchQuery = "" }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedDSC, setSelectedDSC] = useState(null);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [selectedDSCForRenewal, setSelectedDSCForRenewal] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'renewal'
  const [dscs, setDSCs] = useState([]);
  const [renewalDSCs, setRenewalDSCs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [statistics, setStatistics] = useState({
    totalDSCs: 0,
    inDSCs: 0,
    outDSCs: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const { user, userRoles } = useAuth();
  const isCompany = userRoles.includes("company");
  const isConsumer = userRoles.includes("consumer");
  const companyId = user?.profile?.company_id || user?.company?.company_id;
  const consumerId = user?.profile?.consumer_id || user?.consumer?.consumer_id;
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });

  useEffect(() => {
    console.log("DSC component mounted");
    if (searchQuery && searchQuery.trim() !== "") {
      handleSearchDSCs(searchQuery);
    } else {
      // Load data based on active tab
      if (activeTab === 'all') {
        fetchDSCs(1, 10);
      } else {
        fetchRenewalDSCs(1, 10);
      }
    }
    fetchDSCStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isCompany, isConsumer, companyId, consumerId, activeTab]);

  const toCamelCase = (dsc) => ({
    dsc_id: dsc.dsc_id,
    company_id: dsc.company_id,
    consumer_id: dsc.consumer_id,
    certification_name: dsc.certification_name,
    expiry_date: dsc.expiry_date,
    status: dsc.status,
    remarks: dsc.remarks,
    created_at: dsc.created_at,
    updated_at: dsc.updated_at,
    company: dsc.company,
    consumer: dsc.consumer,
  });

  const fetchDSCs = async (page = 1, pageSize = 10) => {
    try {
      console.log("Fetching DSCs...", { page, pageSize });
      setLoading(true);
      let response;
      if (isCompany && companyId) {
        response = await dscAPI.getDSCsByCompany(companyId, { page, pageSize });
      } else if (isConsumer && consumerId) {
        response = await dscAPI.getDSCsByConsumer(consumerId, { page, pageSize });
      } else {
        response = await dscAPI.getAllDSCs({ page, pageSize });
      }
      console.log("DSCs API response:", response);

      if (response && response.dscs && Array.isArray(response.dscs)) {
        const mapped = response.dscs.map(toCamelCase);
        setDSCs(mapped);
        setPagination({
          currentPage: response.currentPage || page,
          pageSize: response.pageSize || pageSize,
          totalPages: response.totalPages || 1,
          totalItems: response.totalItems || 0,
        });
        setError(null);
      } else if (Array.isArray(response.dscs)) {
        const mapped = response.dscs.map(toCamelCase);
        console.log("Mapped DSCs:", mapped);
        setDSCs(mapped);
        setPagination((prev) => ({ ...prev, currentPage: page }));
        setError(null);
      } else {
        console.error("Invalid response format:", response);
        setError("Invalid data format received from server");
        setDSCs([]);
      }
    } catch (err) {
      console.error("Error fetching DSCs:", err);
      setError("Failed to fetch DSCs");
      setDSCs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDSCStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await dscAPI.getDSCStatistics();
      setStatistics(response);
    } catch (err) {
      console.error('[DSC] Error fetching DSC statistics:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSearchDSCs = async (query) => {
    try {
      console.log("Searching DSCs with query:", query);
      setLoading(true);
      const response = await dscAPI.searchDSCs({ 
        q: query,
        page: 1,
        pageSize: pagination.pageSize 
      });
      console.log("DSC search response:", response);

      if (response && Array.isArray(response.dscs)) {
        const mapped = response.dscs.map(toCamelCase);
        console.log("Mapped search DSCs:", mapped);
        setDSCs(mapped);
        setError(null);
      } else if (response && Array.isArray(response)) {
        const mapped = response.map(toCamelCase);
        console.log("Mapped search DSCs (direct array):", mapped);
        setDSCs(mapped);
        setError(null);
      } else {
        console.error("Invalid search response format:", response);
        setError("Invalid data format received from server");
        setDSCs([]);
      }
    } catch (err) {
      console.error("Error searching DSCs:", err);
      setError("Failed to search DSCs");
      setDSCs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (dscId) => {
    if (window.confirm("Are you sure you want to delete this DSC?")) {
      try {
        await dscAPI.deleteDSC(dscId);
        toast.success("DSC deleted successfully!");
        await fetchDSCs(pagination.currentPage, pagination.pageSize);
        await fetchDSCStatistics();
      } catch (err) {
        const errorMessage = "Failed to delete DSC";
        setError(errorMessage);
        toast.error(errorMessage);
        console.error(err);
      }
    }
  };

  const handleEdit = (dsc) => {
    setSelectedDSC(dsc);
    setShowModal(true);
  };

  const handleRenewal = (dsc) => {
    setSelectedDSCForRenewal(dsc);
    setShowRenewalModal(true);
  };

  const handleRenewalModalClose = () => {
    setShowRenewalModal(false);
    setSelectedDSCForRenewal(null);
  };

  const handleRenewalCompleted = async (formData) => {
    if (!selectedDSCForRenewal) return;
    
    try {
      await dscAPI.renewDSC(selectedDSCForRenewal.dsc_id, formData);
      
      await Promise.all([
        fetchDSCs(pagination.currentPage, pagination.pageSize),
        fetchRenewalDSCs(pagination.currentPage, pagination.pageSize),
        fetchDSCStatistics()
      ]);
      
      console.log('[handleRenewalCompleted] Result: Success');
      toast.success('DSC renewed successfully');
      handleRenewalModalClose();
    } catch (error) {
      console.error('[handleRenewalCompleted] Error:', error.message);
      toast.error(error.message || 'Failed to renew DSC');
      throw error;
    }
  };

  // Fetch DSCs for renewal tab
  const fetchRenewalDSCs = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      const response = await dscAPI.getAllDSCsGrouped({ page, pageSize });
      
      console.log("Renewal DSCs API response:", response);
      
      if (response && response.success && response.data) {
        const mapped = response.data.map(toCamelCase);
        setRenewalDSCs(mapped);
        setPagination({
          currentPage: response.currentPage || page,
          pageSize: response.pageSize || pageSize,
          totalPages: response.totalPages || 1,
          totalItems: response.totalItems || 0,
        });
        setError(null);
      } else {
        console.error("Invalid renewal DSCs response format:", response);
        setError("Invalid data format received from server");
        setRenewalDSCs([]);
      }
    } catch (err) {
      console.error("Error fetching renewal DSCs:", err);
      setError("Failed to fetch renewal DSCs");
      setRenewalDSCs([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle tab switching
  const handleTabSwitch = (tab) => {
    console.log(`[DSC] Switching to tab: ${tab}`);
    setActiveTab(tab);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setError(null); // Clear any previous errors
    
    if (tab === 'all') {
      console.log('[DSC] Loading all DSCs...');
      fetchDSCs(1, pagination.pageSize);
    } else {
      console.log('[DSC] Loading renewal DSCs...');
      fetchRenewalDSCs(1, pagination.pageSize);
    }
  };

  const handleModalClose = () => {
    console.log("Modal closing");
    setSelectedDSC(null);
    setShowModal(false);
  };

  const handleDSCUpdated = async () => {
    console.log("DSC updated, refreshing list");
    await fetchDSCs(pagination.currentPage, pagination.pageSize);
    await fetchDSCStatistics();
    handleModalClose();
  };

  const handlePageChange = async (page) => {
    if (activeTab === 'all') {
      await fetchDSCs(page, pagination.pageSize);
    } else {
      await fetchRenewalDSCs(page, pagination.pageSize);
    }
  };

  const handlePageSizeChange = async (newPageSize) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));
    
    if (activeTab === 'all') {
      await fetchDSCs(1, newPageSize);
    } else {
      await fetchRenewalDSCs(1, newPageSize);
    }
  };

  const columns = [
    {
      key: "sr_no",
      label: "Sr No.",
      sortable: true,
      render: (_, __, index) => (pagination.currentPage - 1) * pagination.pageSize + index + 1,
    },
    {
      key: "certification_name",
      label: "Certification Name",
      sortable: true,
      render: (_, dsc) => dsc.certification_name || "-",
    },
    {
      key: "holder_details",
      label: "Company Name / Consumer Name",
      sortable: true,
      render: (_, dsc) => (
        <div className="whitespace-pre-line">
          {dsc.company ? (
            <>
              <strong>{dsc.company.company_name}</strong>
            </>
          ) : dsc.consumer ? (
            <>
              <strong>{dsc.consumer.name}</strong>
              <br />
              <small className="text-gray-600">{dsc.consumer.email}</small>
            </>
          ) : (
            "-"
          )}
        </div>
      ),
    },
    {
      key: "contact_details",
      label: "Contact Details",
      sortable: true,
      render: (_, dsc) => (
        <div>
          {dsc.company
            ? dsc.company.contact_number || "-"
            : dsc.consumer
            ? dsc.consumer.phone_number || "-"
            : "-"}
        </div>
      ),
    },
    {
      key: "expiry_date",
      label: "Expiry Date",
      sortable: true,
      render: (_, dsc) => {
        if (!dsc.expiry_date) return "-";
        const date = new Date(dsc.expiry_date);
        return date.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (_, dsc) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            dsc.status === "in"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {dsc.status.toUpperCase()}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, dsc) => {
        const today = new Date();
        const expiryDate = new Date(dsc.expiry_date);
        const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        const needsRenewal = daysUntilExpiry <= 3; // Show renewal button if expiring within 3 days
        
        return (
          <div className="insurance-actions">
            {/* Show Edit button only on All tab */}
            {activeTab === 'all' && (
              <ActionButton
                onClick={() => handleEdit(dsc)}
                variant="secondary"
                size="small"
                disabled={!canEdit}
              >
                <BiEdit />
              </ActionButton>
            )}
            
            {/* Show Renewal button on Renewal tab or when needed on All tab */}
            {(activeTab === 'renewal' || (activeTab === 'all' && needsRenewal)) && (
              <ActionButton
                onClick={() => handleRenewal(dsc)}
                variant="secondary"
                size="small"
                title="Renew DSC"
              >
                <BiRefresh />
              </ActionButton>
            )}
            
            {/* Show Delete button only on All tab */}
            {activeTab === 'all' && (
              <ActionButton
                onClick={() => handleDelete(dsc.dsc_id)}
                variant="danger"
                size="small"
              >
                <BiTrash />
              </ActionButton>
            )}
          </div>
        );
      },
    },
  ];

  const filteredDSCs = React.useMemo(() => {
    let filtered = activeTab === 'all' ? dscs : renewalDSCs;
    
    // Apply role-based filtering
    if (isCompany) {
      filtered = filtered.filter((d) => d.company_id === companyId);
    }
    if (isConsumer) {
      filtered = filtered.filter((d) => d.consumer_id === consumerId);
    }
    
    // Apply status filtering only on All tab
    if (activeTab === 'all' && statusFilter && statusFilter !== "all") {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }
    
    return filtered;
  }, [dscs, renewalDSCs, activeTab, isCompany, isConsumer, companyId, consumerId, statusFilter]);

  // Disable update/edit for company/consumer users
  const canEdit = !(isCompany || isConsumer);

  const statusOptions = [
    { value: "all", label: "All" },
    { value: "in", label: "IN" },
    { value: "out", label: "OUT" },
  ];

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Digital Signature Certificates</h1>
            <div className="list-container">
              <Button
                variant="contained"
                onClick={() => setShowModal(true)}
                icon={<BiPlus />}
              >
                Add DSC
              </Button>
              {/* Show status filter only on All DSCs tab */}
              {activeTab === 'all' && (
                <div className="dashboard-header-dropdown-container">
                  <Dropdown
                    options={statusOptions}
                    value={statusOptions.find((opt) => opt.value === statusFilter)}
                    onChange={(option) =>
                      setStatusFilter(option ? option.value : "all")
                    }
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
              All DSCs
            </button>
            <button
              className={`tab-button ${activeTab === "renewal" ? "active" : ""}`}
              onClick={() => handleTabSwitch("renewal")}
            >
              <BiCalendar className="tab-icon" />
              Renewal
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
            data={filteredDSCs}
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
          title={selectedDSC ? "Edit DSC" : "Add New DSC"}
        >
          <DSCForm
            dsc={selectedDSC}
            onClose={handleModalClose}
            onDSCUpdated={handleDSCUpdated}
          />
        </Modal>

        {/* Renewal Modal */}
        <Modal
          isOpen={showRenewalModal}
          onClose={handleRenewalModalClose}
          title="Renew DSC"
        >
          <DSCRenewalForm
            dsc={selectedDSCForRenewal}
            onClose={handleRenewalModalClose}
            onRenewalCompleted={handleRenewalCompleted}
          />
        </Modal>
      </div>
    </div>
  );
}

export default DSC;
