import React, { useState, useEffect, useMemo } from "react";
import {
  BiPlus,
  BiEdit,
  BiTrash,
  BiErrorCircle,
  BiUpload,
  BiShield,
  BiTrendingUp,
  BiCalendar,
  BiDownload,
  BiRefresh,
} from "react-icons/bi";
import { firePolicyAPI, insuranceCompanyAPI } from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Pagination from "../../../components/common/Pagination/Pagination";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import Select, { components } from "react-select";
import { toast } from "react-toastify";
import PhoneInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import "../../../styles/pages/dashboard/insurance/Insurance.css";
import "../../../styles/components/StatCards.css";
import { useAuth } from "../../../contexts/AuthContext";
import DocumentDownload from "../../../components/common/DocumentDownload/DocumentDownload";

// --- CreateInsuranceCompanyModal (copied from Vehicle.jsx) ---
const CreateInsuranceCompanyModal = ({ isOpen, onClose, onCreated }) => {
  const [form, setForm] = useState({ name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError("Please enter a company name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const created = await insuranceCompanyAPI.createCompany({
        name: form.name,
      });
      toast.success("Insurance company created!");
      onCreated(created);
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to create insurance company";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Insurance Company">
      <input
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Enter company name"
        required
        className="insurance-form-input"
      />
      {error && (
        <div className="insurance-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      <div className="insurance-form-actions">
        <Button type="button" variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="contained"
          disabled={loading}
          onClick={handleCreate}
        >
          {loading ? "Creating..." : "Create"}
        </Button>
      </div>
    </Modal>
  );
};

const PolicyForm = ({ policy, onClose, onPolicyUpdated }) => {
  const [formData, setFormData] = useState({
    businessType: "",
    customerType: "",
    insuranceCompanyId: "",
    companyId: null,
    consumerId: null,
    proposer_name: "",
    policyNumber: "",
    email: "",
    mobileNumber: "",
    policyStartDate: "",
    policyEndDate: "",
    totalSumInsured: "",
    gstNumber: "",
    panNumber: "",
    netPremium: "",
    gst: 0,
    grossPremium: 0,
    remarks: "",
  });
  const [files, setFiles] = useState({ policyDocument: null });
  const [fileNames, setFileNames] = useState({ policyDocument: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [combinedOptions, setCombinedOptions] = useState([]);
  const [showCreateICModal, setShowCreateICModal] = useState(false);
  const [newICId, setNewICId] = useState(null);
  const [insuranceCompanies, setInsuranceCompanies] = useState([]);
  const [gst, setGst] = useState(0);
  const [grossPremium, setGrossPremium] = useState(0);

  useEffect(() => {
    if (policy) {
      setFormData({
        businessType: policy.business_type || "",
        customerType: policy.customer_type || "",
        insuranceCompanyId: policy.insurance_company_id || "",
        companyId: policy.company_id || null,
        consumerId: policy.consumer_id || null,
        proposer_name: policy.proposer_name || "",
        policyNumber: policy.policy_number || "",
        email: policy.email || "",
        mobileNumber: policy.mobile_number || "",
        policyStartDate: policy.policy_start_date
          ? policy.policy_start_date.slice(0, 10)
          : "",
        policyEndDate: policy.policy_end_date
          ? policy.policy_end_date.slice(0, 10)
          : "",
        totalSumInsured: policy.total_sum_insured || "",
        gstNumber: policy.gst_number || "",
        panNumber: policy.pan_number || "",
        netPremium: policy.net_premium || "",
        gst: policy.gst || 0,
        grossPremium: policy.gross_premium || 0,
        remarks: policy.remarks || "",
      });
      setFileNames({ policyDocument: policy.policy_document_path || "" });
    }
  }, [policy]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const companiesResponse = await firePolicyAPI.getActiveCompanies();
        setCompanies(companiesResponse);
        const consumersResponse = await firePolicyAPI.getActiveConsumers();
        setConsumers(consumersResponse);
        const options = [
          {
            label: "Companies",
            options: companiesResponse.map((company) => ({
              value: `company_${company.company_id}`,
              label: company.company_name,
              type: "company",
              data: company,
            })),
          },
          {
            label: "Consumers",
            options: consumersResponse.map((consumer) => ({
              value: `consumer_${consumer.consumer_id}`,
              label: consumer.name,
              type: "consumer",
              data: consumer,
            })),
          },
        ];
        setCombinedOptions(options);
      } catch (err) {
        toast.error("Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchICs = async () => {
      try {
        // Fetch all insurance companies with a large page size to ensure we get all companies
        const data = await insuranceCompanyAPI.getAllCompanies({ pageSize: 9999 });
        const companies = Array.isArray(data)
          ? data
          : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.companies)
          ? data.companies
          : [];
        setInsuranceCompanies(companies);
        if (newICId) {
          setFormData((prev) => ({ ...prev, insuranceCompanyId: newICId }));
          setNewICId(null);
        }
      } catch {
        setInsuranceCompanies([]);
      }
    };
    fetchICs();
  }, [showCreateICModal]);

  useEffect(() => {
    const netPremium = parseFloat(formData.netPremium) || 0;
    const calculatedGst = netPremium * 0.18; // 18% GST
    const calculatedGross = netPremium + calculatedGst;
    setGst(calculatedGst.toFixed(2));
    setGrossPremium(calculatedGross.toFixed(2));
  }, [formData.netPremium]);

  useEffect(() => {
    const net = parseFloat(formData.netPremium) || 0;
    const gstVal = +(net * 0.18).toFixed(2);
    setGst(gstVal);
    setGrossPremium(+(net + gstVal).toFixed(2));
  }, [formData.netPremium]);

  const handleHolderChange = (option) => {
    if (!option) {
      setFormData((prev) => ({
        ...prev,
        companyId: null,
        consumerId: null,
        email: "",
        mobileNumber: "",
        proposer_name: "",
        customerType: "",
        gstNumber: "",
        panNumber: "",
      }));
      return;
    }
    const { type, data } = option;
    if (type === "company") {
      setFormData((prev) => ({
        ...prev,
        companyId: Number(data.company_id),
        consumerId: null,
        email: data.company_email,
        mobileNumber: data.contact_number,
        proposer_name: data.company_name,
        customerType: "Organisation",
        gstNumber: data.gst_number || "",
        panNumber: data.pan_number || "",
      }));
    } else if (type === "consumer") {
      setFormData((prev) => ({
        ...prev,
        companyId: null,
        consumerId: Number(data.consumer_id),
        email: data.email,
        mobileNumber: data.phone_number,
        proposer_name: data.name,
        customerType: "Individual",
        gstNumber: "",
        panNumber: "",
      }));
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Only PDF and Word documents are allowed");
        e.target.value = null;
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size should not exceed 5MB");
        e.target.value = null;
        return;
      }
      setFiles((prev) => ({ ...prev, [type]: file }));
      setFileNames((prev) => ({ ...prev, [type]: file.name }));
    }
  };

  const handlePhoneChange = (value) => {
    setFormData((prev) => ({ ...prev, mobileNumber: value }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // If GST number is being updated, auto-fill PAN number
    if (name === 'gstNumber' && value.length >= 12) {
      const extractedPAN = value.substring(2, 12).toUpperCase();
      setFormData((prev) => ({ 
        ...prev, 
        [name]: value.toUpperCase(),
        panNumber: extractedPAN
      }));
    } else if (name === 'gstNumber') {
      setFormData((prev) => ({ 
        ...prev, 
        [name]: value.toUpperCase()
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    // Validate required fields
    const requiredFields = {
      businessType: "Business Type",
      customerType: "Customer Type",
      insuranceCompanyId: "Insurance Company",
      policyNumber: "Policy Number",
      email: "Email",
      mobileNumber: "Mobile Number",
      policyStartDate: "Policy Start Date",
      policyEndDate: "Policy End Date",
      totalSumInsured: "Total Sum Insured",
      netPremium: "Net Premium",
      proposer_name: "Proposer Name",
    };
    const missingFields = Object.entries(requiredFields)
      .filter(([key]) => !formData[key])
      .map(([_, label]) => label);
    if (missingFields.length > 0) {
      const msg = `Missing required fields: ${missingFields.join(", ")}`;
      toast.error(msg);
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
      const msg = "Please select either a company or a consumer";
      toast.error(msg);
      setLoading(false);
      return;
    }
    if (hasCompanyId && hasConsumerId) {
      const msg = "Please select either a company or a consumer, not both";
      toast.error(msg);
      setLoading(false);
      return;
    }
    // Validate file
    if (!policy && !files.policyDocument) {
      const msg = "Policy document is required for new policies";
      toast.error(msg);
      setLoading(false);
      return;
    }
    // Validate dates
    const startDate = new Date(formData.policyStartDate);
    const endDate = new Date(formData.policyEndDate);
    if (endDate <= startDate) {
      toast.error("Policy end date must be after start date");
      setLoading(false);
      return;
    }
    // Validate numeric fields
    const numericFields = ["totalSumInsured", "netPremium"];
    const invalidNumericFields = numericFields.filter((field) => {
      const value = parseFloat(formData[field]);
      return isNaN(value) || value < 0;
    });
    if (invalidNumericFields.length > 0) {
      toast.error(
        `Please enter valid numbers for: ${invalidNumericFields.join(", ")}`
      );
      setLoading(false);
      return;
    }
    try {
      const sanitizedFormData = { ...formData };
      // Set the appropriate ID based on what was selected
      if (hasCompanyId) {
        sanitizedFormData.companyId = Number(sanitizedFormData.companyId);
        sanitizedFormData.consumerId = null;
      } else {
        sanitizedFormData.consumerId = Number(sanitizedFormData.consumerId);
        sanitizedFormData.companyId = null;
      }
      const submitData = new FormData();
      // Add all form fields (excluding calculated fields that are added separately)
      Object.entries(sanitizedFormData).forEach(([key, value]) => {
        // Skip gst and grossPremium as they are calculated and added separately
        if (key === 'gst' || key === 'grossPremium') {
          return;
        }
        if (
          value !== undefined &&
          value !== null &&
          value !== "" &&
          value !== "null"
        ) {
          const apiKey = key.replace(
            /[A-Z]/g,
            (letter) => `_${letter.toLowerCase()}`
          );
          submitData.append(apiKey, value);
        }
      });
      // Add calculated fields
      submitData.append("gst", parseFloat(gst).toFixed(2));
      submitData.append("gross_premium", parseFloat(grossPremium).toFixed(2));
      // Add file if selected
      if (files.policyDocument) {
        submitData.append(
          "policyDocument",
          files.policyDocument,
          files.policyDocument.name
        );
      }
      let response;
      if (policy) {
        response = await firePolicyAPI.updatePolicy(policy.id, submitData);
        toast.success("Policy updated successfully!");
      } else {
        response = await firePolicyAPI.createPolicy(submitData);
        toast.success("Policy created successfully!");
      }
      onPolicyUpdated();
    } catch (err) {
      const errorMessage =
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to save policy";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const insuranceCompanyOptions = insuranceCompanies.map((ic) => ({
    value: ic.id,
    label: ic.name,
  }));

  // --- CustomMenuList for react-select ---
  const CustomMenuList = (props) => (
    <>
      <components.MenuList {...props}>
        {props.children}
        <div style={{ padding: 8, borderTop: "1px solid #eee" }}>
          <button
            style={{
              width: "100%",
              background: "#1F4F9C",
              color: "#fff",
              border: "none",
              padding: 8,
              borderRadius: 4,
              cursor: "pointer",
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setShowCreateICModal(true);
            }}
          >
            + Create Insurance Company
          </button>
        </div>
      </components.MenuList>
    </>
  );

  return (
    <>
      {/* Remove inline error display */}
      <form onSubmit={handleSubmit} className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
            <label>Company/Consumer</label>
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
                menu: (provided) => ({ 
                  ...provided, 
                  zIndex: 9999,
                  position: 'absolute'
                }),
                menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
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
            <label>Business Type</label>
            <select
              name="businessType"
              value={formData.businessType}
              onChange={handleChange}
              className="insurance-form-input"
            >
              <option value="">Select Business Type</option>
              <option value="Fresh/New">Fresh/New</option>
              <option value="Renewal/Rollover">Renewal/Rollover</option>
              <option value="Endorsement">Endorsement</option>
            </select>
          </div>
          <div className="insurance-form-group">
            <label>Customer Type</label>
            <select
              name="customerType"
              value={formData.customerType}
              onChange={handleChange}
              className="insurance-form-input"
            >
              <option value="">Select Customer Type</option>
              <option value="Organisation">Organisation</option>
              <option value="Individual">Individual</option>
            </select>
          </div>
          <div className="insurance-form-group">
            <label>Proposer Name</label>
            <input
              type="text"
              name="proposer_name"
              value={formData.proposer_name}
              readOnly
              className="insurance-form-input"
              placeholder="Organisation Name / Policy Holder Name"
            />
          </div>
          <div className="insurance-form-group">
            <label>Policy Number</label>
            <input
              type="text"
              name="policyNumber"
              value={formData.policyNumber}
              onChange={handleChange}
              placeholder="Policy Number"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email"
              className="insurance-form-input"
              readOnly={!!formData.companyId}
            />
          </div>
          <div className="insurance-form-group">
            <label>Mobile Number</label>
            <PhoneInput
              international
              defaultCountry="IN"
              value={formData.mobileNumber}
              onChange={handlePhoneChange}
              placeholder="Mobile Number"
              required
              className="insurance-form-input phone-input-custom"
              flags={flags}
              readOnly={!!formData.companyId}
            />
          </div>
          <div className="insurance-form-group">
            <label>Policy Start Date</label>
            <input
              type="date"
              name="policyStartDate"
              value={formData.policyStartDate}
              onChange={handleChange}
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <label>Policy End Date</label>
            <input
              type="date"
              name="policyEndDate"
              value={formData.policyEndDate}
              onChange={handleChange}
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <label>Total Sum Insured</label>
            <input
              type="text"
              name="totalSumInsured"
              value={formData.totalSumInsured}
              onChange={handleChange}
              placeholder="Total Sum Insured"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <label>GST Number</label>
            <input
              type="text"
              name="gstNumber"
              value={formData.gstNumber}
              onChange={handleChange}
              placeholder="GST Number"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <label>PAN Number</label>
            <input
              type="text"
              name="panNumber"
              value={formData.panNumber}
              onChange={handleChange}
              placeholder="PAN Number"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <label>Net Premium</label>
            <input
              type="number"
              name="netPremium"
              value={formData.netPremium}
              onChange={handleChange}
              placeholder="Net Premium"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <label>GST (18%)</label>
            <input
              type="number"
              value={gst}
              placeholder="GST (18%)"
              className="insurance-form-input"
              readOnly
            />
          </div>
          <div className="insurance-form-group">
            <label>Gross Premium</label>
            <input
              type="number"
              value={grossPremium}
              placeholder="Gross Premium"
              className="insurance-form-input"
              readOnly
            />
          </div>
          <div className="insurance-form-group">
            <label>Insurance Company</label>
            <Select
              options={insuranceCompanyOptions}
              value={
                insuranceCompanyOptions.find(
                  (opt) => opt.value === formData.insuranceCompanyId
                ) || null
              }
              onChange={(option) =>
                setFormData((prev) => ({
                  ...prev,
                  insuranceCompanyId: option ? option.value : "",
                }))
              }
              placeholder="Select Insurance Company"
              isClearable
              styles={{
                menu: (provided) => ({ 
                  ...provided, 
                  zIndex: 9999,
                  position: 'absolute'
                }),
                menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
                control: (provided) => ({
                  ...provided,
                  minHeight: "44px",
                  borderRadius: "8px",
                  borderColor: "#d1d5db",
                }),
              }}
              components={{ MenuList: CustomMenuList }}
            />
          </div>
          <div className="insurance-form-group file-upload-group">
            <label className="file-upload-label">
              <span>Policy Document</span>
              <div className="file-upload-container">
                <input
                  type="file"
                  onChange={(e) => handleFileChange(e, "policyDocument")}
                  accept=".pdf,.doc,.docx"
                  className="file-upload-input"
                />
                <div className="file-upload-button">
                  <BiUpload />{" "}
                  {fileNames.policyDocument || "Upload Policy Document"}
                </div>
              </div>
            </label>
          </div>
          <div
            className="insurance-form-group"
            style={{ gridColumn: "span 2" }}
          >
            <label>Remarks</label>
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
            {policy ? "Update" : "Create"}
          </Button>
        </div>
      </form>
      <CreateInsuranceCompanyModal
        isOpen={showCreateICModal}
        onClose={() => setShowCreateICModal(false)}
        onCreated={(company) => {
          setNewICId(company.id);
        }}
      />
    </>
  );
};

// --- RenewalForm Component ---
const RenewalForm = ({ policy, onClose, onPolicyRenewed }) => {
  const [formData, setFormData] = useState({
    businessType: "Renewal/Rollover",
    customerType: "",
    insuranceCompanyId: "",
    companyId: "",
    consumerId: "",
    proposerName: "",
    policyNumber: "",
    email: "",
    mobileNumber: "",
    policyStartDate: "",
    policyEndDate: "",
    totalSumInsured: "",
    gstNumber: "",
    panNumber: "",
    netPremium: "",
    gst: "",
    grossPremium: "",
    remarks: "",
  });

  const [policyDocument, setPolicyDocument] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [combinedOptions, setCombinedOptions] = useState([]);
  const [insuranceCompanies, setInsuranceCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [gst, setGst] = useState(0);
  const [grossPremium, setGrossPremium] = useState(0);

  useEffect(() => {
    if (policy) {
      console.log("RenewalForm: Received policy data:", policy);
      const formatDate = (dateStr) => (dateStr ? dateStr.slice(0, 10) : "");

      // Pre-fill form with current policy data, but clear policy number for new renewal
      const formDataToSet = {
        businessType: "Renewal/Rollover", // Always set to Renewal
        customerType: policy.customerType || policy.customer_type || "",
        insuranceCompanyId: policy.insuranceCompanyId || policy.insurance_company_id || "",
        companyId: policy.companyId || policy.company_id || "",
        consumerId: policy.consumerId || policy.consumer_id || "",
        proposerName: policy.proposerName || policy.proposer_name || "",
        policyNumber: "", // Clear policy number - user must enter new one
        email: policy.email || "",
        mobileNumber: policy.mobileNumber || policy.mobile_number || "",
        policyStartDate: "", // Clear dates - user must enter new dates
        policyEndDate: "",
        totalSumInsured: policy.totalSumInsured || policy.total_sum_insured || "",
        gstNumber: policy.gstNumber || policy.gst_number || "",
        panNumber: policy.panNumber || policy.pan_number || "",
        netPremium: "", // Clear premium - user must enter new values
        gst: "",
        grossPremium: "",
        remarks: "",
      };

      console.log("RenewalForm: Setting form data:", formDataToSet);
      setFormData(formDataToSet);
    }
  }, [policy]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  useEffect(() => {
    const netPremium = parseFloat(formData.netPremium) || 0;
    const calculatedGst = netPremium * 0.18; // 18% GST
    const calculatedGross = netPremium + calculatedGst;
    setGst(calculatedGst.toFixed(2));
    setGrossPremium(calculatedGross.toFixed(2));
  }, [formData.netPremium]);

  const fetchDropdownData = async () => {
    try {
      const [companiesRes, consumersRes, insuranceRes] = await Promise.all([
        firePolicyAPI.getActiveCompanies(),
        firePolicyAPI.getActiveConsumers(),
        insuranceCompanyAPI.getAllCompanies({ pageSize: 9999 }),
      ]);
      
      setCompanies(companiesRes || []);
      setConsumers(consumersRes || []);
      
      // Handle insurance companies response format
      const companies = Array.isArray(insuranceRes)
        ? insuranceRes
        : Array.isArray(insuranceRes.data)
        ? insuranceRes.data
        : Array.isArray(insuranceRes.companies)
        ? insuranceRes.companies
        : [];
      setInsuranceCompanies(companies);

      // Create combined options like Vehicle component
      const options = [
        {
          label: "Companies",
          options: (companiesRes || []).map((company) => ({
            value: `company_${company.company_id}`,
            label: company.company_name,
            type: "company",
            data: company,
          })),
        },
        {
          label: "Consumers",
          options: (consumersRes || []).map((consumer) => ({
            value: `consumer_${consumer.consumer_id}`,
            label: consumer.name,
            type: "consumer",
            data: consumer,
          })),
        },
      ];
      setCombinedOptions(options);
    } catch (err) {
      console.error("Error fetching dropdown data:", err);
      toast.error("Failed to load form data");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setDocumentError('Please select a PDF or Word document');
        setPolicyDocument(null);
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setDocumentError('File size must be less than 10MB');
        setPolicyDocument(null);
        return;
      }

      setPolicyDocument(file);
      setDocumentError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!policyDocument) {
      setDocumentError('Policy document is required for renewal');
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formDataToSend = new FormData();
      
      // Add all form fields
      Object.keys(formData).forEach((key) => {
        let value = formData[key];
        
        // Convert camelCase to snake_case for backend
        const backendKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        // Handle special field mappings
        if (key === 'businessType') {
          formDataToSend.append('business_type', value);
        } else if (key === 'customerType') {
          formDataToSend.append('customer_type', value);
        } else if (key === 'insuranceCompanyId') {
          formDataToSend.append('insurance_company_id', value);
        } else if (key === 'companyId') {
          formDataToSend.append('company_id', value || '');
        } else if (key === 'consumerId') {
          formDataToSend.append('consumer_id', value || '');
        } else if (key === 'proposerName') {
          formDataToSend.append('proposer_name', value);
        } else if (key === 'policyNumber') {
          formDataToSend.append('policy_number', value);
        } else if (key === 'mobileNumber') {
          formDataToSend.append('mobile_number', value);
        } else if (key === 'policyStartDate') {
          formDataToSend.append('policy_start_date', value);
        } else if (key === 'policyEndDate') {
          formDataToSend.append('policy_end_date', value);
        } else if (key === 'propertyAddress') {
          formDataToSend.append('property_address', value);
        } else if (key === 'propertyType') {
          formDataToSend.append('property_type', value);
        } else if (key === 'sumInsured') {
          formDataToSend.append('sum_insured', value);
        } else if (key === 'netPremium') {
          formDataToSend.append('net_premium', value);
        } else if (key === 'gst') {
          // Skip - we'll add the calculated GST value separately
          return;
        } else if (key === 'grossPremium') {
          // Skip - we'll add the calculated gross premium value separately
          return;
        } else {
          formDataToSend.append(backendKey, value);
        }
      });

      // Add calculated GST and gross premium values
      formDataToSend.append('gst', parseFloat(gst).toFixed(2));
      formDataToSend.append('gross_premium', parseFloat(grossPremium).toFixed(2));

      // Add the policy document
      formDataToSend.append('policyDocument', policyDocument);

      // Call the renewal API
      await firePolicyAPI.renewPolicy(policy.id, formDataToSend);
      
      toast.success(`Fire policy renewed successfully! New policy number: ${formData.policyNumber}`);
      onPolicyRenewed();
    } catch (err) {
      console.error("Error renewing policy:", err);
      const errorMessage = err.response?.data?.message || "Failed to renew policy";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Create customer options for react-select
  const customerOptions = [
    {
      label: 'Companies',
      options: companies.map(company => ({
        value: company.company_id,
        label: company.company_name,
        type: 'Organisation',
        ...company
      }))
    },
    {
      label: 'Consumers',
      options: consumers.map(consumer => ({
        value: consumer.consumer_id,
        label: consumer.name,
        type: 'Individual',
        ...consumer
      }))
    }
  ];

  const insuranceCompanyOptions = insuranceCompanies.map(company => ({
    value: company.id,
    label: company.name
  }));

  return (
    <form onSubmit={handleSubmit} className="insurance-form">
      {error && (
        <div className="insurance-error" style={{ marginBottom: "16px" }}>
          {error}
        </div>
      )}

      <div className="insurance-form-grid">
        <div className="insurance-form-group">
          <label>Business Type</label>
          <select
            name="businessType"
            value={formData.businessType}
            onChange={handleChange}
            className="insurance-form-input"
            required
            disabled
          >
            <option value="Renewal/Rollover">Renewal/Rollover</option>
          </select>
        </div>

        <div className="insurance-form-group">
          <label>Customer Type</label>
          <select
            name="customerType"
            value={formData.customerType}
            onChange={handleChange}
            className="insurance-form-input"
            required
          >
            <option value="">Select Customer Type</option>
            <option value="Organisation">Organisation</option>
            <option value="Individual">Individual</option>
          </select>
        </div>

        <div className="insurance-form-group">
          <label>Company/Consumer</label>
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
            onChange={(option) => {
              if (!option) {
                setFormData((prev) => ({
                  ...prev,
                  companyId: "",
                  consumerId: "",
                  email: "",
                  mobileNumber: "",
                  proposerName: "",
                }));
                return;
              }
              const { type, data } = option;
              if (type === "company") {
                setFormData((prev) => ({
                  ...prev,
                  companyId: data.company_id,
                  consumerId: "",
                  email: data.company_email,
                  mobileNumber: data.contact_number,
                  proposerName: data.company_name,
                }));
              } else if (type === "consumer") {
                setFormData((prev) => ({
                  ...prev,
                  companyId: "",
                  consumerId: data.consumer_id,
                  email: data.email,
                  mobileNumber: data.phone_number,
                  proposerName: data.name,
                }));
              }
            }}
            placeholder="Select Company or Consumer"
            isClearable
            isSearchable={true}
            styles={{
              menu: (provided) => ({ 
                ...provided, 
                zIndex: 9999,
                position: 'absolute'
              }),
              menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
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
          <label>Proposer Name</label>
          <input
            type="text"
            name="proposerName"
            value={formData.proposerName}
            readOnly
            className="insurance-form-input"
            placeholder="Organisation Name / Policy Holder Name"
          />
        </div>

        <div className="insurance-form-group">
          <label>New Policy Number</label>
          <input
            type="text"
            name="policyNumber"
            value={formData.policyNumber}
            onChange={handleChange}
            placeholder="Enter new policy number"
            required
            className="insurance-form-input"
          />
        </div>

        <div className="insurance-form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="insurance-form-input"
            placeholder="Email"
          />
        </div>

        <div className="insurance-form-group">
          <label>Mobile Number</label>
          <PhoneInput
            international
            countryCallingCodeEditable={false}
            defaultCountry="IN"
            value={formData.mobileNumber}
            onChange={(value) => setFormData(prev => ({ ...prev, mobileNumber: value || '' }))}
            className="insurance-form-input phone-input-custom"
            flags={flags}
          />
        </div>

        <div className="insurance-form-group">
          <label>Policy Start Date</label>
          <input
            type="date"
            name="policyStartDate"
            value={formData.policyStartDate}
            onChange={handleChange}
            required
            className="insurance-form-input"
          />
        </div>

        <div className="insurance-form-group">
          <label>Policy End Date</label>
          <input
            type="date"
            name="policyEndDate"
            value={formData.policyEndDate}
            onChange={handleChange}
            required
            className="insurance-form-input"
          />
        </div>

        <div className="insurance-form-group">
          <label>Total Sum Insured</label>
          <input
            type="text"
            name="totalSumInsured"
            value={formData.totalSumInsured}
            onChange={handleChange}
            required
            className="insurance-form-input"
            placeholder="Total Sum Insured"
          />
        </div>

        <div className="insurance-form-group">
          <label>GST Number</label>
          <input
            type="text"
            name="gstNumber"
            value={formData.gstNumber}
            onChange={handleChange}
            className="insurance-form-input"
            placeholder="GST Number"
          />
        </div>

        <div className="insurance-form-group">
          <label>PAN Number</label>
          <input
            type="text"
            name="panNumber"
            value={formData.panNumber}
            onChange={handleChange}
            className="insurance-form-input"
            placeholder="PAN Number"
          />
        </div>

        <div className="insurance-form-group">
          <label>Net Premium</label>
          <input
            type="number"
            step="0.01"
            name="netPremium"
            value={formData.netPremium}
            onChange={handleChange}
            required
            className="insurance-form-input"
            placeholder="Net Premium"
          />
        </div>

        <div className="insurance-form-group">
          <label>GST (18%)</label>
          <input
            type="number"
            step="0.01"
            value={gst}
            readOnly
            className="insurance-form-input"
            placeholder="GST (18%)"
          />
        </div>

        <div className="insurance-form-group">
          <label>Gross Premium</label>
          <input
            type="number"
            step="0.01"
            value={grossPremium}
            readOnly
            className="insurance-form-input"
            placeholder="Gross Premium"
          />
        </div>

        <div className="insurance-form-group file-upload-group">
          <label className="file-upload-label">
            <span>Policy Document</span>
            <div className="file-upload-container">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="file-upload-input"
                required
              />
              <div className="file-upload-button">
                <BiUpload /> Upload Policy Document
              </div>
            </div>
          </label>
          {documentError && (
            <div className="insurance-error">{documentError}</div>
          )}
        </div>

        <div className="insurance-form-group" style={{ gridColumn: "span 2" }}>
          <label>Remarks</label>
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
          {loading ? "Renewing..." : "Renew Policy"}
        </Button>
      </div>
    </form>
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

  const { totalPolicies, activePolicies, recentPolicies } = statistics;
  const activePercentage = totalPolicies > 0 ? Math.round((activePolicies / totalPolicies) * 100) : 0;
  const recentPercentage = totalPolicies > 0 ? Math.round((recentPolicies / totalPolicies) * 100) : 0;

  return (
    <div className="statistics-section">
      <div className="statistics-grid">
        <div className="stat-card total">
          <div className="stat-icon">
            <BiShield />
          </div>
          <div className="stat-content">
            <div className="stat-number">{totalPolicies}</div>
            <div className="stat-label">Total Policies</div>
          </div>
        </div>
        <div className="stat-card active">
          <div className="stat-icon">
            <BiTrendingUp />
          </div>
          <div className="stat-content">
            <div className="stat-number">{activePolicies}</div>
            <div className="stat-label">Active Policies</div>
            <div className="stat-percentage">{activePercentage}%</div>
          </div>
        </div>
        <div className="stat-card recent">
          <div className="stat-icon">
            <BiCalendar />
          </div>
          <div className="stat-content">
            <div className="stat-number">{recentPolicies}</div>
            <div className="stat-label">Recent Policies</div>
            <div className="stat-percentage">{recentPercentage}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};

function Fire({ searchQuery = "" }) {
  const [activeTab, setActiveTab] = useState("running"); // "running" or "all"
  const [showModal, setShowModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [selectedPolicyForRenewal, setSelectedPolicyForRenewal] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [groupedPolicies, setGroupedPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupedLoading, setGroupedLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState({
    totalPolicies: 0,
    activePolicies: 0,
    recentPolicies: 0,
    monthlyStats: []
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });
  const { user, userRoles } = useAuth();
  const isCompany = userRoles.includes("company");
  const isConsumer = userRoles.includes("consumer");
  const companyId = user?.profile?.company_id || user?.company?.company_id;
  const consumerId = user?.profile?.consumer_id || user?.consumer?.consumer_id;
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  useEffect(() => {
    fetchPolicies(1, 10);
    fetchFireStatistics();
    if (activeTab === "all") {
      fetchGroupedPolicies();
    }
  }, [activeTab]);

  // Handle search when searchQuery changes
  useEffect(() => {
    console.log('Fire: searchQuery changed:', searchQuery);
    if (activeTab === "running") {
      if (searchQuery && searchQuery.length >= 3) {
        console.log('Fire: Triggering server search for:', searchQuery);
        handleSearchPolicies(searchQuery);
      } else if (searchQuery === "") {
        console.log('Fire: Clearing search, fetching all policies');
        fetchPolicies(1, pagination.pageSize);
      }
    } else if (activeTab === "all") {
      // For "All Policy" tab, we filter client-side after fetching grouped policies
      if (searchQuery === "") {
        fetchGroupedPolicies(); // Refetch all grouped policies
      }
    }
  }, [searchQuery, pagination.pageSize, activeTab]);

  const fetchPolicies = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      console.log('Fire: Fetching policies for page:', page, 'pageSize:', pageSize);
      const response = await firePolicyAPI.getAllPolicies({
        page,
        pageSize,
      });
      console.log('Fire: Fetch response:', response);

      if (response && response.policies && Array.isArray(response.policies)) {
        setPolicies(response.policies);
        setPagination({
          currentPage: response.currentPage || page,
          pageSize: response.pageSize || pageSize,
          totalPages: response.totalPages || 1,
          totalItems: response.totalItems || 0,
        });
        setError(null);
      } else if (Array.isArray(response)) {
        setPolicies(response);
        setPagination((prev) => ({ ...prev, currentPage: page }));
        setError(null);
      } else {
        setError("Invalid data format received from server");
        setPolicies([]);
      }
    } catch (err) {
      console.error('Fire: Error fetching policies:', err);
      setError("");
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFireStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await firePolicyAPI.getFireStatistics();
      setStatistics(response);
    } catch (err) {
      console.error('[Fire] Error fetching fire policy statistics:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSearchPolicies = async (query) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fire: Searching policies with query:', query);
      const response = await firePolicyAPI.searchPolicies({ q: query });
      console.log('Fire: Search response:', response);
      
      // Handle both expected format and direct array response
      if (response && response.success && Array.isArray(response.policies)) {
        setPolicies(response.policies);
        setError(null);
      } else if (Array.isArray(response)) {
        // Handle case where response is directly an array
        setPolicies(response);
        setError(null);
      } else {
        console.error("Invalid search response format:", response);
        // Fallback to client-side search if server search fails
        console.log('Fire: Server search failed, falling back to client-side search');
      }
    } catch (err) {
      console.error("Error searching fire policies:", err);
      // Fallback to client-side search if server search fails
      console.log('Fire: Server search error, falling back to client-side search');
    } finally {
      setLoading(false);
    }
  };

  const filteredPolicies = React.useMemo(() => {
    if (isCompany) {
      return policies.filter((p) => p.company_id === companyId);
    }
    if (isConsumer) {
      return policies.filter((p) => p.consumer_id === consumerId);
    }
    return policies;
  }, [policies, isCompany, isConsumer, companyId, consumerId]);

  const searchFilteredPolicies = React.useMemo(() => {
    if (!searchQuery || searchQuery.length < 3) {
      return filteredPolicies;
    }
    return filteredPolicies.filter((policy) => {
      const searchLower = searchQuery.toLowerCase();
      const policyFields = [
        policy.policy_number,
        policy.business_type,
        policy.customer_type,
        policy.email,
        policy.mobile_number,
        policy.proposer_name,
        policy.property_address,
        policy.property_type,
        policy.net_premium,
        policy.remarks
      ].some(field => field && field.toString().toLowerCase().includes(searchLower));
      const companyName = policy.companyPolicyHolder?.company_name || policy.company?.company_name || policy.company_name;
      const companyMatch = companyName && companyName.toLowerCase().includes(searchLower);
      const consumerName = policy.consumerPolicyHolder?.name || policy.consumer?.name || policy.consumer_name;
      const consumerMatch = consumerName && consumerName.toLowerCase().includes(searchLower);
      const insuranceCompanyName = policy.provider?.name;
      const insuranceMatch = insuranceCompanyName && insuranceCompanyName.toLowerCase().includes(searchLower);
      return policyFields || companyMatch || consumerMatch || insuranceMatch;
    });
  }, [filteredPolicies, searchQuery]);

  const handleDelete = async (policyId) => {
    if (window.confirm("Are you sure you want to delete this policy?")) {
      try {
        await firePolicyAPI.deletePolicy(policyId);
        toast.success("Policy deleted successfully!");
        await fetchPolicies(pagination.currentPage, pagination.pageSize);
        await fetchFireStatistics();
      } catch (err) {
        setError("Failed to delete policy");
        toast.error("Failed to delete policy");
      }
    }
  };

  const handleEdit = (policy) => {
    setSelectedPolicy(policy);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setSelectedPolicy(null);
    setShowModal(false);
  };

  const handlePolicyUpdated = async () => {
    await fetchPolicies(pagination.currentPage, pagination.pageSize);
    await fetchFireStatistics();
    if (activeTab === "all") {
      await fetchGroupedPolicies();
    }
    handleModalClose();
  };

  const handleRenewal = (policy) => {
    // Transform the policy data to camelCase for the renewal form
    const transformedPolicy = {
      id: policy.id,
      business_type: policy.business_type,
      customer_type: policy.customer_type,
      insurance_company_id: policy.insurance_company_id,
      company_id: policy.company_id,
      consumer_id: policy.consumer_id,
      proposer_name: policy.proposer_name,
      policy_number: policy.policy_number,
      email: policy.email,
      mobile_number: policy.mobile_number,
      policy_start_date: policy.policy_start_date,
      policy_end_date: policy.policy_end_date,
      total_sum_insured: policy.total_sum_insured,
      gst_number: policy.gst_number,
      pan_number: policy.pan_number,
      net_premium: policy.net_premium,
    };
    setSelectedPolicyForRenewal(transformedPolicy);
    setShowRenewalModal(true);
  };

  const handleRenewalModalClose = () => {
    setSelectedPolicyForRenewal(null);
    setShowRenewalModal(false);
  };

  const handleRenewalCompleted = async () => {
    await fetchPolicies(pagination.currentPage, pagination.pageSize);
    await fetchFireStatistics();
    if (activeTab === "all") {
      await fetchGroupedPolicies();
    }
    handleRenewalModalClose();
  };

  const fetchGroupedPolicies = async () => {
    try {
      setGroupedLoading(true);
      const response = await firePolicyAPI.getAllPoliciesGrouped();
      if (response.success && response.policies) {
        setGroupedPolicies(response.policies);
      } else {
        setGroupedPolicies([]);
      }
    } catch (err) {
      console.error("Error fetching grouped fire policies:", err);
      setGroupedPolicies([]);
      toast.error("Failed to fetch grouped policies");
    } finally {
      setGroupedLoading(false);
    }
  };

  const handlePageChange = async (page) => {
    console.log("Fire: Page changed to:", page);
    await fetchPolicies(page, pagination.pageSize);
  };

  const handlePageSizeChange = async (newPageSize) => {
    console.log("Fire: Page size changed to:", newPageSize);
    
    // Update pagination state first
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));
    
    // Then fetch policies with the new page size
    await fetchPolicies(1, newPageSize);
  };

  const handleDownloadDocuments = (policy) => {
    setSelectedPolicy(policy);
    setShowDocumentModal(true);
  };

  const columns = [
    {
      key: "sr_no",
      label: "Sr No.",
      sortable: true,
      render: (_, __, index, pagination = {}) => {
        const { currentPage = 1, pageSize = 10 } = pagination;
        return (currentPage - 1) * pageSize + index + 1;
      },
    },
    {
      key: "company_or_consumer",
      label: "Company Name / Consumer Name",
      sortable: false,
      render: (_, policy) => {
        return (
          policy.companyPolicyHolder?.company_name ||
          policy.consumerPolicyHolder?.name ||
          policy.company_name ||
          policy.consumer_name ||
          policy.company?.company_name ||
          policy.consumer?.name ||
          '-'
        );
      }
    },
    { key: "policy_number", label: "Policy Number", sortable: true },
    { key: "business_type", label: "Business Type", sortable: true },
    { key: "customer_type", label: "Customer Type", sortable: true },
    { key: "email", label: "Email", sortable: true },
    { key: "mobile_number", label: "Mobile Number", sortable: true },
    { key: "net_premium", label: "Net Premium", sortable: true },
    {
      key: "policy_type",
      label: "Policy Type",
      sortable: true,
      render: (_, policy) => {
        const isRunning =
          policy.status === "active" || policy.policy_type === "running";
        const isPrevious =
          policy.status === "expired" || policy.policy_type === "previous";

        if (isRunning) {
          return (
            <span
              style={{
                display: "inline-block",
                padding: "6px 14px",
                borderRadius: "16px",
                fontSize: "12px",
                fontWeight: "600",
                backgroundColor: "#d1fae5",
                color: "#065f46",
                border: "1px solid #6ee7b7",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Running
            </span>
          );
        } else if (isPrevious) {
          return (
            <span
              style={{
                display: "inline-block",
                padding: "6px 14px",
                borderRadius: "16px",
                fontSize: "12px",
                fontWeight: "600",
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                border: "1px solid #fca5a5",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Previous
            </span>
          );
        }

        return null;
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => {
        const statusText = value
          ? value.charAt(0).toUpperCase() + value.slice(1)
          : "Unknown";
        const statusColors = {
          active: { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" },
          expired: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
          cancelled: { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
        };
        const colors =
          statusColors[value?.toLowerCase()] || statusColors.cancelled;

        return (
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: "600",
              backgroundColor: colors.bg,
              color: colors.color,
              border: `1px solid ${colors.border}`,
            }}
          >
            {statusText}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, policy) => (
        <div className="insurance-actions">
          <ActionButton
            onClick={() => handleEdit(policy)}
            variant="secondary"
            size="small"
          >
            <BiEdit />
          </ActionButton>
          <ActionButton
            onClick={() => handleRenewal(policy)}
            variant="secondary"
            size="small"
            title="Renew Policy"
          >
            <BiRefresh />
          </ActionButton>
          <ActionButton
            onClick={() => handleDelete(policy.id)}
            variant="danger"
            size="small"
          >
            <BiTrash />
          </ActionButton>
          <DocumentDownload
            system="fire-policies"
            recordId={policy.id}
            buttonText=""
            buttonClass="action-button action-button-secondary action-button-small"
            showIcon={true}
            filePath={policy.policy_document_path ? `/uploads/fire_policies/${policy.policy_document_path}` : null}
            fileName={policy.policy_document_path || 'policy-document.pdf'}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Fire Insurance Policies</h1>
            <Button
              variant="contained"
              onClick={() => setShowModal(true)}
              icon={<BiPlus />}
            >
              Add Policy
            </Button>
          </div>
          
          <StatisticsCards statistics={statistics} loading={statsLoading} />
          
          {/* Tab Navigation */}
          <div className="tab-navigation" style={{ marginBottom: "24px" }}>
            <button
              className={`tab-button ${
                activeTab === "running" ? "active" : ""
              }`}
              onClick={() => setActiveTab("running")}
            >
              <BiTrendingUp className="tab-icon" />
              Running
            </button>
            <button
              className={`tab-button ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              <BiShield className="tab-icon" />
              All Policy
            </button>
          </div>
          
          {error && (
            <div className="insurance-error">
              <BiErrorCircle className="inline mr-2" /> {error}
            </div>
          )}

          {/* Tab Content */}
          {activeTab === "running" ? (
            loading ? (
              <Loader size="large" color="primary" />
            ) : (
              <TableWithControl
                data={searchFilteredPolicies}
                columns={columns}
                defaultPageSize={pagination.pageSize}
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                serverSidePagination={true}
              />
            )
          ) : groupedLoading ? (
            <Loader size="large" color="primary" />
          ) : (
            (() => {
              // Flatten all policies grouped by company: running first, then previous
              let allPoliciesFlat = [];
              groupedPolicies.forEach((companyGroup) => {
                // Add running policies first
                companyGroup.running.forEach((policy) => {
                  allPoliciesFlat.push({
                    ...policy,
                    status: "active", // Ensure status is active for running policies
                    policy_type: "running", // Ensure policy_type is running
                    companyPolicyHolder:
                      policy.companyPolicyHolder || policy.policyHolder,
                    consumerPolicyHolder:
                      policy.consumerPolicyHolder || policy.consumer,
                    company_group_name: companyGroup.company_name,
                    company_group_id: companyGroup.company_id,
                    consumer_group_id: companyGroup.consumer_id,
                  });
                });
                // Then add previous policies
                companyGroup.previous.forEach((policy) => {
                  allPoliciesFlat.push({
                    ...policy,
                    status: "expired", // Ensure status is expired for previous policies
                    policy_type: "previous", // Ensure policy_type is previous
                    companyPolicyHolder:
                      policy.companyPolicyHolder || policy.policyHolder,
                    consumerPolicyHolder:
                      policy.consumerPolicyHolder || policy.consumer,
                    company_group_name: companyGroup.company_name,
                    company_group_id: companyGroup.company_id,
                    consumer_group_id: companyGroup.consumer_id,
                  });
                });
              });

              // Apply search filter if searchQuery exists
              if (searchQuery && searchQuery.length >= 3) {
                const searchLower = searchQuery.toLowerCase();
                allPoliciesFlat = allPoliciesFlat.filter((policy) => {
                  const policyFields = [
                    policy.policy_number,
                    policy.business_type,
                    policy.customer_type,
                    policy.email,
                    policy.mobile_number,
                    policy.property_address,
                    policy.property_type,
                    policy.total_sum_insured,
                    policy.net_premium,
                    policy.remarks,
                    policy.status,
                  ].some(
                    (field) =>
                      field &&
                      field.toString().toLowerCase().includes(searchLower)
                  );
                  const companyName =
                    policy.companyPolicyHolder?.company_name ||
                    policy.company?.company_name ||
                    policy.company_name ||
                    policy.company_group_name;
                  const consumerName =
                    policy.consumerPolicyHolder?.name ||
                    policy.consumer?.name ||
                    policy.consumer_name;
                  const holderName = companyName || consumerName;

                  return (
                    policyFields ||
                    (holderName &&
                      holderName.toLowerCase().includes(searchLower))
                  );
                });
              }

              return (
                <TableWithControl
                  data={allPoliciesFlat}
                  columns={[
                    ...columns.slice(0, -1), // All columns except actions
                    {
                      key: "actions",
                      label: "Actions",
                      render: (_, policy) => {
                        const isActive =
                          policy.status === "active" || policy.policy_type === "running";
                        const isPrevious =
                          policy.status === "expired" || policy.policy_type === "previous";

                        return (
                          <div className="insurance-actions">
                            {isActive && (
                              <>
                                <ActionButton
                                  onClick={() => handleEdit(policy)}
                                  variant="secondary"
                                  size="small"
                                >
                                  <BiEdit />
                                </ActionButton>
                                <ActionButton
                                  onClick={() => handleRenewal(policy)}
                                  variant="secondary"
                                  size="small"
                                  title="Renew Policy"
                                >
                                  <BiRefresh />
                                </ActionButton>
                                <ActionButton
                                  onClick={() => handleDelete(policy.id)}
                                  variant="danger"
                                  size="small"
                                >
                                  <BiTrash />
                                </ActionButton>
                              </>
                            )}
                            {isPrevious && (
                              <span style={{ color: "#6b7280", fontSize: "12px" }}>
                                Expired
                              </span>
                            )}
                            <DocumentDownload
                              system="fire-policies"
                              recordId={policy.original_policy_id || policy.id}
                              buttonText=""
                              buttonClass="action-button action-button-secondary action-button-small"
                              showIcon={true}
                              filePath={policy.policy_document_path ? `/uploads/fire_policies/${policy.policy_document_path}` : null}
                              fileName={policy.policy_document_path || 'policy-document.pdf'}
                            />
                          </div>
                        );
                      },
                    },
                  ]}
                  defaultPageSize={10}
                  serverSidePagination={false}
                />
              );
            })()
          )}
        </div>
        <Modal
          isOpen={showModal}
          onClose={handleModalClose}
          title={selectedPolicy ? "Edit Policy" : "Add New Policy"}
        >
          <PolicyForm
            policy={selectedPolicy}
            onClose={handleModalClose}
            onPolicyUpdated={handlePolicyUpdated}
          />
        </Modal>
        <Modal
          isOpen={showRenewalModal}
          onClose={handleRenewalModalClose}
          title="Renew Fire Policy"
        >
          <RenewalForm
            policy={selectedPolicyForRenewal}
            onClose={handleRenewalModalClose}
            onPolicyRenewed={handleRenewalCompleted}
          />
        </Modal>
        {/* Document Download Modal */}
        {showDocumentModal && selectedPolicy && (
          <DocumentDownload
            isOpen={showDocumentModal}
            onClose={() => setShowDocumentModal(false)}
            system="fire"
            recordId={selectedPolicy.id}
            recordName={selectedPolicy.policyNumber || selectedPolicy.clientName}
          />
        )}
      </div>
    </div>
  );
}

export default Fire;
