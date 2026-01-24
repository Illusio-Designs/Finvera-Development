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
import {
  lifePolicyAPI,
  insuranceCompanyAPI,
} from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import DocumentDownload from "../../../components/common/DocumentDownload/DocumentDownload";
import "../../../styles/pages/dashboard/insurance/Insurance.css";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import PhoneInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import Select, { components } from "react-select";
import { useAuth } from "../../../contexts/AuthContext";

// Add CreateInsuranceCompanyModal component
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
      const msg =
        err?.response?.data?.message || "Failed to create insurance company";
      setError(msg);
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
    companyId: "",
    consumerId: "",
    currentPolicyNumber: "",
    proposerName: "",
    email: "",
    mobileNumber: "",
    policyStartDate: "",
    policyEndDate: "",
    issueDate: "",
    dateOfBirth: "",
    planName: "",
    subProduct: "",
    pt: "",
    ppt: "",
    paymentMode: "Yearly",
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
  const [insuranceCompanies, setInsuranceCompanies] = useState([]);
  const [gst, setGst] = useState(0);
  const [grossPremium, setGrossPremium] = useState(0);
  const [showCreateICModal, setShowCreateICModal] = useState(false);
  const [newICId, setNewICId] = useState(null);

  useEffect(() => {
    if (policy) {
      let holderName = "";
      let email = "";
      let mobile = "";
      // Check for consumer or company
      if (policy.consumerPolicyHolder) {
        holderName = policy.consumerPolicyHolder.name || "";
        email = policy.consumerPolicyHolder.email || "";
        mobile = policy.consumerPolicyHolder.phone_number || "";
      } else if (policy.companyPolicyHolder) {
        holderName = policy.companyPolicyHolder.company_name || "";
        email = policy.companyPolicyHolder.company_email || "";
        mobile = policy.companyPolicyHolder.contact_number || "";
      }
      setFormData({
        businessType: policy.business_type || "",
        customerType: policy.customer_type || "",
        insuranceCompanyId: policy.insurance_company_id || "",
        companyId: policy.company_id || "",
        consumerId: policy.consumer_id || "",
        currentPolicyNumber: policy.current_policy_number || "",
        proposerName: policy.proposer_name || holderName,
        email: email,
        mobileNumber: mobile,
        policyStartDate: policy.policy_start_date
          ? policy.policy_start_date.slice(0, 10)
          : "",
        policyEndDate: policy.policy_end_date
          ? policy.policy_end_date.slice(0, 10)
          : "",
        issueDate: policy.issue_date
          ? policy.issue_date.slice(0, 10)
          : "",
        dateOfBirth: policy.date_of_birth
          ? policy.date_of_birth.slice(0, 10)
          : "",
        planName: policy.plan_name || "",
        subProduct: policy.sub_product || "",
        pt: policy.pt || "",
        ppt: policy.ppt || "",
        paymentMode: policy.payment_mode || "Yearly",
        netPremium: policy.net_premium || "",
        gst: policy.gst || 0,
        grossPremium: policy.gross_premium || 0,
        remarks: policy.remarks || "",
      });
      setFileNames({ policyDocument: policy.policy_document_path || "" });
    }
  }, [policy]);

  useEffect(() => {
    // Calculate GST and Gross Premium whenever netPremium changes
    const net = parseFloat(formData.netPremium) || 0;
    const gstVal = +(net * 0.18).toFixed(2);
    setGst(gstVal);
    setGrossPremium(+(net + gstVal).toFixed(2));
  }, [formData.netPremium]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch companies
        const companiesResponse = await lifePolicyAPI.getActiveCompanies();
        setCompanies(companiesResponse);

        // Fetch consumers
        const consumersResponse = await lifePolicyAPI.getActiveConsumers();
        setConsumers(consumersResponse);

        // Create combined options
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
        console.error("Error fetching data:", err);
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
    // Calculate GST and Gross Premium whenever netPremium changes
    const net = parseFloat(formData.netPremium) || 0;
    const gstVal = +(net * 0.18).toFixed(2);
    setGst(gstVal);
    setGrossPremium(+(net + gstVal).toFixed(2));
  }, [formData.netPremium]);

  const handleHolderChange = (option) => {
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
        customerType: "Organisation",
      }));
    } else if (type === "consumer") {
      setFormData((prev) => ({
        ...prev,
        companyId: "",
        consumerId: data.consumer_id,
        email: data.email,
        mobileNumber: data.phone_number,
        proposerName: data.name,
        customerType: "Individual",
      }));
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      console.log(`[Life] File selected for ${type}:`, {
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      });

      // Validate file type
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

      // Validate file size (5MB limit)
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
    
    // Auto-calculate policy end date when PPT or policy start date changes
    if (name === "ppt" && formData.policyStartDate) {
      const startDate = new Date(formData.policyStartDate);
      const pptYears = parseInt(value) || 0;
      
      // Debug logging
      console.log("PolicyForm PPT Calculation:", {
        pptValue: value,
        pptYears: pptYears,
        startDate: startDate,
        startYear: startDate.getFullYear()
      });
      
      // Validate PPT value (should be reasonable - between 1 and 50 years)
      if (pptYears > 0 && pptYears <= 50 && !isNaN(startDate.getTime())) {
        const endDate = new Date(startDate);
        endDate.setFullYear(startDate.getFullYear() + pptYears);
        
        console.log("PolicyForm calculated end date:", endDate, "End year:", endDate.getFullYear());
        
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          policyEndDate: endDate.toISOString().split('T')[0]
        }));
      } else {
        // Invalid PPT, clear end date
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          policyEndDate: ""
        }));
      }
    } else if (name === "policyStartDate" && formData.ppt) {
      const startDate = new Date(value);
      const pptYears = parseInt(formData.ppt) || 0;
      
      // Validate values
      if (pptYears > 0 && pptYears <= 50 && !isNaN(startDate.getTime())) {
        const endDate = new Date(startDate);
        endDate.setFullYear(startDate.getFullYear() + pptYears);
        
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          policyEndDate: endDate.toISOString().split('T')[0]
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          policyEndDate: ""
        }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Log initial state
    console.log("[Life] Initial form state:", {
      formData,
      files,
      fileNames,
      policy,
    });

    // Validate required fields
    const requiredFields = [
      "businessType",
      "customerType", 
      "insuranceCompanyId",
      "currentPolicyNumber",
      "proposerName",
      "email",
      "mobileNumber",
      "policyStartDate",
      "issueDate",
      "dateOfBirth",
      "planName",
      "subProduct",
      "pt",
      "ppt",
      "netPremium",
    ];
    const missingFields = requiredFields.filter((field) => {
      const value = formData[field];
      return (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "") ||
        (typeof value === "number" && isNaN(value))
      );
    });
    if (missingFields.length > 0) {
      const msg = `Missing required fields: ${missingFields.join(", ")}`;
      toast.error(msg);
      setLoading(false);
      return;
    }

    // Validate file upload for new policies
    if (!policy && !files.policyDocument) {
      toast.error("Policy document is required for new policies");
      setLoading(false);
      return;
    }

    const submitData = new FormData();

    try {
      // Log form data before conversion
      console.log("[Life] Form data before conversion:", formData);

      // Add all form fields with proper type conversion
      Object.entries(formData).forEach(([key, value]) => {
        // Skip empty strings for ID fields (company_id, consumer_id)
        if ((key === 'companyId' || key === 'consumerId') && value === '') {
          return;
        }
        
        if (value !== undefined && value !== null && value !== '') {
          // Handle special field mappings first
          if (key === 'proposerName') {
            submitData.append('proposer_name', value);
          }
          else if (key === 'businessType') {
            submitData.append('business_type', value);
          }
          else if (key === 'customerType') {
            submitData.append('customer_type', value);
          }
          else if (key === 'insuranceCompanyId') {
            submitData.append('insurance_company_id', value);
          }
          else if (key === 'currentPolicyNumber') {
            submitData.append('current_policy_number', value);
          }
          else if (key === 'mobileNumber') {
            submitData.append('mobile_number', value);
          }
          else if (key === 'planName') {
            submitData.append('plan_name', value);
          }
          else if (key === 'subProduct') {
            submitData.append('sub_product', value);
          }
          else if (key === 'netPremium') {
            submitData.append('net_premium', parseFloat(value).toFixed(2));
          }
          else if (key === 'dateOfBirth') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              submitData.append('date_of_birth', date.toISOString().split('T')[0]);
            }
          }
          else if (key === 'policyStartDate') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              submitData.append('policy_start_date', date.toISOString().split('T')[0]);
            }
          }
          else if (key === 'policyEndDate') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              submitData.append('policy_end_date', date.toISOString().split('T')[0]);
            }
          }
          else if (key === 'issueDate') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              submitData.append('issue_date', date.toISOString().split('T')[0]);
            }
          }
          else if (key === 'pt') {
            submitData.append('pt', parseFloat(value).toFixed(2));
          }
          else if (key === 'ppt') {
            submitData.append('ppt', parseInt(value));
          }
          // Skip calculated fields that are added separately
          else if (key === 'gst' || key === 'grossPremium') {
            return;
          }
          // Handle all other fields with snake_case conversion
          else {
            const apiKey = key.replace(
              /[A-Z]/g,
              (letter) => `_${letter.toLowerCase()}`
            );
            submitData.append(apiKey, value);
          }
          console.log(`[Life] Appending form field: ${key} = ${value}`);
        }
      });

      // Add calculated fields with proper decimal formatting
      submitData.append("gst", gst.toFixed(2));
      submitData.append("gross_premium", grossPremium.toFixed(2));
      console.log("[Life] Appended calculated fields:", {
        gst: gst.toFixed(2),
        gross_premium: grossPremium.toFixed(2),
      });

      // Handle file upload
      if (files.policyDocument) {
        console.log("[Life] File details before upload:", {
          name: files.policyDocument.name,
          type: files.policyDocument.type,
          size: `${(files.policyDocument.size / 1024 / 1024).toFixed(2)}MB`,
          lastModified: new Date(
            files.policyDocument.lastModified
          ).toISOString(),
        });

        // Use the field name expected by the backend's multer configuration
        submitData.append(
          "policy_document",
          files.policyDocument,
          files.policyDocument.name
        );
        console.log(
          "[Life] File appended to FormData with field name 'policy_document'"
        );
      } else {
        console.log("[Life] No file to upload");
      }

      // Log the complete FormData contents
      console.log("[Life] Complete FormData contents:");
      for (let [key, value] of submitData.entries()) {
        if (value instanceof File) {
          console.log(`${key}:`, {
            name: value.name,
            type: value.type,
            size: `${(value.size / 1024 / 1024).toFixed(2)}MB`,
            lastModified: new Date(value.lastModified).toISOString(),
          });
        } else {
          console.log(`${key}: ${value}`);
        }
      }

      let resp;
      if (policy) {
        console.log("[Life] Updating existing policy:", policy.id);
        resp = await lifePolicyAPI.updatePolicy(policy.id, submitData);
        console.log("[Life] Update response:", resp);
        toast.success("Policy updated successfully!");
      } else {
        console.log("[Life] Creating new policy");
        resp = await lifePolicyAPI.createPolicy(submitData);
        console.log("[Life] Create response:", resp);
        toast.success("Policy created successfully!");
      }

      onPolicyUpdated();
    } catch (err) {
      console.error("[Life] API error:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        headers: err.response?.headers,
        config: err.response?.config,
        validationErrors: err.response?.data?.errors,
        requestData: {
          formData,
          files,
          submitData: Object.fromEntries(submitData.entries()),
        },
      });
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

  // Prepare options for react-select
  const insuranceCompanyOptions = insuranceCompanies.map((ic) => ({
    value: ic.id,
    label: ic.name,
  }));

  // Custom MenuList to add the "Create Insurance Company" button
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
            <label>Organisation/Holder Name</label>
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
            <label>Policy Number</label>
            <input
              type="text"
              name="currentPolicyNumber"
              value={formData.currentPolicyNumber}
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
              placeholder="Policy Start Date"
              title="Policy Start Date"
            />
          </div>
          <div className="insurance-form-group">
            <label>Issue Date</label>
            <input
              type="date"
              name="issueDate"
              value={formData.issueDate}
              onChange={handleChange}
              className="insurance-form-input"
              placeholder="Issue Date"
              title="Issue Date"
            />
          </div>
          <div className="insurance-form-group">
            <label>Policy End Date</label>
            <input
              type="text"
              name="policyEndDate"
              value={formData.policyEndDate && new Date(formData.policyEndDate).getFullYear() < 3000 ? new Date(formData.policyEndDate).toLocaleDateString('en-GB') : 'Invalid Date'}
              readOnly
              className="insurance-form-input"
              style={{ backgroundColor: '#f5f5f5' }}
              title="Auto-calculated based on Policy Start Date + PPT years"
            />
          </div>
          <div className="insurance-form-group">
            <label>Date of Birth</label>
            <input
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              className="insurance-form-input"
              placeholder="Date of Birth"
              title="Date of Birth"
            />
          </div>
          <div className="insurance-form-group">
            <label>Plan Name</label>
            <input
              type="text"
              name="planName"
              value={formData.planName}
              onChange={handleChange}
              placeholder="Plan Name"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <label>Sub Product</label>
            <input
              type="text"
              name="subProduct"
              value={formData.subProduct}
              onChange={handleChange}
              placeholder="Sub Product"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <label>Premium Term (PT)</label>
            <input
              type="number"
              name="pt"
              value={formData.pt}
              onChange={handleChange}
              placeholder="Enter amount (e.g., 100000)"
              className="insurance-form-input"
              min="1"
              step="0.01"
              title="Enter policy term amount"
            />
          </div>
          <div className="insurance-form-group">
            <label>Premium Payment Term (PPT)</label>
            <input
              type="number"
              name="ppt"
              value={formData.ppt}
              onChange={handleChange}
              placeholder="Enter 1 to 50 years"
              className="insurance-form-input"
              min="1"
              max="50"
              title="Enter premium payment term in years (1-50)"
            />
          </div>
          <div className="insurance-form-group">
            <label>Payment Mode</label>
            <select
              name="paymentMode"
              value={formData.paymentMode}
              onChange={handleChange}
              required
              className="insurance-form-input"
              title="Select premium payment frequency"
            >
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly (Every 3 months)</option>
              <option value="Half-Yearly">Half-Yearly (Every 6 months)</option>
              <option value="Yearly">Yearly</option>
            </select>
          </div>
          <div className="insurance-form-group">
            <label>Net Premium</label>
            <input
              type="number"
              step="0.01"
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
              step="0.01"
              value={gst}
              readOnly
              placeholder="GST (18%)"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <label>Gross Premium</label>
            <input
              type="number"
              step="0.01"
              value={grossPremium}
              readOnly
              placeholder="Gross Premium"
              className="insurance-form-input"
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
              components={{ MenuList: CustomMenuList }}
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
        onCreated={(created) => {
          setShowCreateICModal(false);
          if (created && created.id) setNewICId(created.id);
        }}
      />
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
    issueDate: "",
    dateOfBirth: "",
    planName: "",
    subProduct: "",
    pt: "",
    ppt: "",
    paymentMode: "Yearly",
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
        issueDate: "", // Clear issue date - user must enter new date
        dateOfBirth: policy.dateOfBirth || policy.date_of_birth ? (policy.dateOfBirth || policy.date_of_birth).slice(0, 10) : "",
        planName: policy.planName || policy.plan_name || "",
        subProduct: policy.subProduct || policy.sub_product || "",
        pt: policy.pt || "",
        ppt: policy.ppt || "",
        paymentMode: policy.paymentMode || policy.payment_mode || "Yearly",
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
        lifePolicyAPI.getActiveCompanies(),
        lifePolicyAPI.getActiveConsumers(),
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

    // Auto-calculate policy end date when PPT changes (Life policy specific)
    if (name === "ppt" && formData.policyStartDate) {
      const startDate = new Date(formData.policyStartDate);
      const pptYears = parseInt(value) || 0;
      
      // Debug logging
      console.log("PPT Calculation Debug:", {
        pptValue: value,
        pptYears: pptYears,
        startDate: startDate,
        startYear: startDate.getFullYear()
      });
      
      // Validate PPT value (should be reasonable - between 1 and 50 years)
      if (pptYears > 0 && pptYears <= 50 && !isNaN(startDate.getTime())) {
        const endDate = new Date(startDate);
        endDate.setFullYear(startDate.getFullYear() + pptYears);
        
        console.log("Calculated end date:", endDate, "End year:", endDate.getFullYear());
        
        setFormData((prev) => ({
          ...prev,
          policyEndDate: endDate.toISOString().split('T')[0],
        }));
      } else {
        // Invalid PPT or start date, clear end date
        console.log("Invalid PPT or start date, clearing end date");
        setFormData((prev) => ({
          ...prev,
          policyEndDate: "",
        }));
      }
    }

    // Auto-calculate policy end date when start date changes
    if (name === "policyStartDate" && formData.ppt) {
      const startDate = new Date(value);
      const pptYears = parseInt(formData.ppt) || 0;
      
      // Debug logging
      console.log("Start Date Change Debug:", {
        startDateValue: value,
        startDate: startDate,
        pptYears: pptYears
      });
      
      // Validate PPT value and start date
      if (pptYears > 0 && pptYears <= 50 && !isNaN(startDate.getTime())) {
        const endDate = new Date(startDate);
        endDate.setFullYear(startDate.getFullYear() + pptYears);
        
        console.log("Calculated end date:", endDate, "End year:", endDate.getFullYear());
        
        setFormData((prev) => ({
          ...prev,
          policyEndDate: endDate.toISOString().split('T')[0],
        }));
      } else {
        // Invalid values, clear end date
        console.log("Invalid start date or PPT, clearing end date");
        setFormData((prev) => ({
          ...prev,
          policyEndDate: "",
        }));
      }
    }
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
    
    // Validate required fields
    const requiredFields = {
      'companyId': formData.companyId || formData.consumerId ? null : 'Company or Consumer selection is required',
      'policyNumber': !formData.policyNumber ? 'New policy number is required' : null,
      'email': !formData.email ? 'Email is required' : null,
      'policyStartDate': !formData.policyStartDate ? 'Policy start date is required' : null,
      'issueDate': !formData.issueDate ? 'Issue date is required' : null,
      'planName': !formData.planName ? 'Plan name is required' : null,
      'subProduct': !formData.subProduct ? 'Sub product is required' : null,
      'pt': !formData.pt ? 'PT (Policy Term) is required' : null,
      'ppt': !formData.ppt ? 'PPT (Premium Payment Term) is required' : null,
      'dateOfBirth': !formData.dateOfBirth ? 'Date of birth is required' : null,
      'netPremium': !formData.netPremium ? 'Net premium is required' : null,
      'proposerName': !formData.proposerName ? 'Proposer name is required' : null
    };

    const errors = Object.values(requiredFields).filter(error => error !== null);
    if (errors.length > 0) {
      setError(errors[0]);
      toast.error(errors[0]);
      return;
    }
    
    if (!policyDocument) {
      setDocumentError('Policy document is required for renewal');
      setError('Policy document is required for renewal');
      toast.error('Policy document is required for renewal');
      return;
    }

    setLoading(true);
    setError("");
    setDocumentError("");

    try {
      const formDataToSend = new FormData();
      
      // Add all form fields
      Object.keys(formData).forEach((key) => {
        let value = formData[key];
        
        // Skip empty values
        if (value === undefined || value === null || value === '') {
          return;
        }
        
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
          formDataToSend.append('current_policy_number', value);
        } else if (key === 'mobileNumber') {
          formDataToSend.append('mobile_number', value);
        } else if (key === 'policyStartDate') {
          formDataToSend.append('policy_start_date', value);
        } else if (key === 'policyEndDate') {
          formDataToSend.append('policy_end_date', value);
        } else if (key === 'issueDate') {
          formDataToSend.append('issue_date', value);
        } else if (key === 'dateOfBirth') {
          formDataToSend.append('date_of_birth', value);
        } else if (key === 'planName') {
          formDataToSend.append('plan_name', value);
        } else if (key === 'subProduct') {
          formDataToSend.append('sub_product', value);
        } else if (key === 'pt') {
          formDataToSend.append('pt', parseFloat(value).toFixed(2));
        } else if (key === 'ppt') {
          formDataToSend.append('ppt', parseInt(value));
        } else if (key === 'netPremium') {
          formDataToSend.append('net_premium', value);
        } else if (key === 'gst') {
          // Skip - we'll add the calculated GST value separately
          return;
        } else if (key === 'grossPremium') {
          // Skip - we'll add the calculated gross premium value separately
          return;
        } else {
          // Convert camelCase to snake_case for other fields
          const backendKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          formDataToSend.append(backendKey, value);
        }
      });

      // Add calculated GST and gross premium values
      formDataToSend.append('gst', parseFloat(gst).toFixed(2));
      formDataToSend.append('gross_premium', parseFloat(grossPremium).toFixed(2));

      // Add the policy document
      formDataToSend.append('policy_document', policyDocument);

      // Call the renewal API
      await lifePolicyAPI.renewPolicy(policy.id, formDataToSend);
      
      toast.success(`Life policy renewed successfully! New policy number: ${formData.policyNumber}`);
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
      <div className="insurance-form-section">
        <h3>Renewal Information</h3>
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
            <label>Business Type *</label>
            <input
              type="text"
              name="businessType"
              value={formData.businessType}
              readOnly
              className="insurance-form-input"
              style={{ backgroundColor: '#f5f5f5' }}
            />
          </div>

          <div className="insurance-form-group">
            <label>Customer Type *</label>
            <input
              type="text"
              name="customerType"
              value={formData.customerType}
              readOnly
              className="insurance-form-input"
              style={{ backgroundColor: '#f5f5f5' }}
            />
          </div>

          <div className="insurance-form-group">
            <label>Company/Consumer *</label>
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
                if (option) {
                  if (option.type === "company") {
                    setFormData(prev => ({
                      ...prev,
                      companyId: option.data.company_id,
                      consumerId: "",
                      proposerName: option.data.company_name,
                      email: option.data.company_email || prev.email,
                      mobileNumber: option.data.contact_number || prev.mobileNumber
                    }));
                  } else if (option.type === "consumer") {
                    setFormData(prev => ({
                      ...prev,
                      companyId: "",
                      consumerId: option.data.consumer_id,
                      proposerName: option.data.name,
                      email: option.data.email || prev.email,
                      mobileNumber: option.data.phone_number || prev.mobileNumber
                    }));
                  }
                } else {
                  setFormData(prev => ({
                    ...prev,
                    companyId: "",
                    consumerId: "",
                    proposerName: "",
                    email: "",
                    mobileNumber: ""
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
            <label>Proposer Name *</label>
            <input
              type="text"
              name="proposerName"
              value={formData.proposerName}
              readOnly
              className="insurance-form-input"
              style={{ backgroundColor: '#f5f5f5' }}
            />
          </div>

          <div className="insurance-form-group">
            <label>Insurance Company *</label>
            <Select
              value={insuranceCompanyOptions.find(opt => opt.value === formData.insuranceCompanyId)}
              onChange={(selected) => setFormData(prev => ({ ...prev, insuranceCompanyId: selected?.value || '' }))}
              options={insuranceCompanyOptions}
              placeholder="Select insurance company"
              className="insurance-form-select"
              isDisabled={true}
              styles={{
                control: (base) => ({
                  ...base,
                  backgroundColor: '#f5f5f5'
                }),
                menu: (provided) => ({ 
                  ...provided, 
                  zIndex: 9999,
                  position: 'absolute'
                }),
                menuPortal: (provided) => ({ ...provided, zIndex: 9999 })
              }}
            />
          </div>

          <div className="insurance-form-group">
            <label>New Policy Number *</label>
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
            <label>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="insurance-form-input"
            />
          </div>

          <div className="insurance-form-group">
            <label>Mobile Number *</label>
            <PhoneInput
              international
              countryCallingCodeEditable={false}
              defaultCountry="IN"
              value={formData.mobileNumber}
              onChange={(value) => setFormData(prev => ({ ...prev, mobileNumber: value || '' }))}
              className="insurance-form-phone"
              flags={flags}
            />
          </div>

          <div className="insurance-form-group">
            <label>Policy Start Date *</label>
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
            <label>Issue Date *</label>
            <input
              type="date"
              name="issueDate"
              value={formData.issueDate}
              onChange={handleChange}
              required
              className="insurance-form-input"
            />
          </div>

          <div className="insurance-form-group">
            <label>Policy End Date *</label>
            <input
              type="text"
              name="policyEndDate"
              value={formData.policyEndDate && new Date(formData.policyEndDate).getFullYear() < 3000 ? new Date(formData.policyEndDate).toLocaleDateString('en-GB') : 'Invalid Date'}
              readOnly
              className="insurance-form-input"
              style={{ backgroundColor: '#f5f5f5' }}
              title="Auto-calculated based on PPT"
            />
          </div>

          <div className="insurance-form-group">
            <label>Date of Birth *</label>
            <input
              type="text"
              name="dateOfBirth"
              value={formData.dateOfBirth ? new Date(formData.dateOfBirth).toLocaleDateString('en-GB') : ''}
              readOnly
              className="insurance-form-input"
              style={{ backgroundColor: '#f5f5f5' }}
              title="Date of Birth cannot be changed during renewal"
            />
          </div>

          <div className="insurance-form-group">
            <label>Plan Name *</label>
            <input
              type="text"
              name="planName"
              value={formData.planName}
              readOnly
              className="insurance-form-input"
              style={{ backgroundColor: '#f5f5f5' }}
              title="Plan Name cannot be changed during renewal"
            />
          </div>

          <div className="insurance-form-group">
            <label>Sub Product *</label>
            <input
              type="text"
              name="subProduct"
              value={formData.subProduct}
              onChange={handleChange}
              required
              className="insurance-form-input"
              placeholder="Enter sub product"
            />
          </div>

          <div className="insurance-form-group">
            <label>PT (Policy Term) *</label>
            <input
              type="number"
              name="pt"
              value={formData.pt}
              onChange={handleChange}
              required
              className="insurance-form-input"
              placeholder="Enter amount (e.g., 100000)"
              min="1"
              step="0.01"
              title="Enter policy term amount"
            />
          </div>

          <div className="insurance-form-group">
            <label>PPT (Premium Paying Term) *</label>
            <input
              type="number"
              name="ppt"
              value={formData.ppt}
              onChange={handleChange}
              placeholder="Enter 1 to 50 years"
              required
              className="insurance-form-input"
              min="1"
              max="50"
              title="Enter premium payment term in years (1-50)"
            />
          </div>

          <div className="insurance-form-group">
            <label>Net Premium *</label>
            <input
              type="number"
              step="0.01"
              name="netPremium"
              value={formData.netPremium}
              onChange={handleChange}
              required
              className="insurance-form-input"
              placeholder="Enter net premium"
            />
          </div>

          <div className="insurance-form-group">
            <label>GST (18%) *</label>
            <input
              type="number"
              step="0.01"
              value={gst}
              readOnly
              className="insurance-form-input"
              style={{ backgroundColor: '#f5f5f5' }}
            />
          </div>

          <div className="insurance-form-group">
            <label>Gross Premium *</label>
            <input
              type="number"
              step="0.01"
              value={grossPremium}
              readOnly
              className="insurance-form-input"
              style={{ backgroundColor: '#f5f5f5' }}
            />
          </div>

          <div className="insurance-form-group insurance-form-group-full">
            <label>Policy Document *</label>
            <div className="insurance-file-upload">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="insurance-form-input"
                required
              />
              <small className="insurance-form-help">
                Upload new policy document (PDF or Word, max 10MB)
              </small>
              {documentError && (
                <div className="insurance-error">{documentError}</div>
              )}
            </div>
          </div>

          <div className="insurance-form-group insurance-form-group-full">
            <label>Remarks</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              placeholder="Enter any remarks for the renewal"
              className="insurance-form-textarea"
              rows="3"
            />
          </div>
        </div>
      </div>

      {error && <div className="insurance-error">{error}</div>}

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

function Life({ searchQuery = "" }) {
  const [activeTab, setActiveTab] = useState("running"); // "running" or "all"
  const [showModal, setShowModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [selectedPolicyForRenewal, setSelectedPolicyForRenewal] = useState(null);
  const [policies, setPolicies] = useState([]);
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

  const { user, userRoles } = useAuth();
  const isCompany = userRoles.includes("company");
  const isConsumer = userRoles.includes("consumer");
  const companyId = user?.profile?.company_id || user?.company?.company_id;
  const consumerId = user?.profile?.consumer_id || user?.consumer?.consumer_id;

  useEffect(() => {
    // Fetch policies based on active tab
    if (activeTab === "running") {
      fetchRunningPolicies(1, 10);
    } else {
      fetchAllPolicies(1, 10);
    }
    fetchLifeStatistics();
  }, [activeTab]);

  // Handle search when searchQuery changes
  useEffect(() => {
    console.log("Life: searchQuery changed:", searchQuery);
    if (searchQuery && searchQuery.length >= 3) {
      console.log("Life: Triggering server search for:", searchQuery);
      if (activeTab === "running") {
        handleSearchPolicies(searchQuery);
      }
      // For "All Policy" tab, search is client-side, so no API call here
    } else if (searchQuery === "") {
      console.log("Life: Clearing search, fetching all policies");
      if (activeTab === "running") {
        fetchRunningPolicies(1, pagination.pageSize);
      } else {
        fetchAllPolicies(1, pagination.pageSize);
      }
    }
  }, [searchQuery, pagination.pageSize, activeTab]);

  const fetchRunningPolicies = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      setError(null);
      console.log("Life: Fetching running policies for page:", page, "pageSize:", pageSize);
      
      const response = await lifePolicyAPI.getRunningPolicies({
        page,
        pageSize,
      });
      console.log("Life: Running policies response:", response);

      if (response && response.success && Array.isArray(response.data)) {
        setPolicies(response.data);
        setPagination({
          currentPage: response.pagination?.page || page,
          pageSize: response.pagination?.pageSize || pageSize,
          totalPages: response.pagination?.totalPages || 1,
          totalItems: response.pagination?.total || 0,
        });
        setError(null);
      } else if (response && Array.isArray(response.data)) {
        // Handle case where success flag might be missing
        setPolicies(response.data);
        setPagination({
          currentPage: page,
          pageSize: pageSize,
          totalPages: Math.ceil((response.data.length || 0) / pageSize),
          totalItems: response.data.length || 0,
        });
        setError(null);
      } else {
        console.error("Invalid response format:", response);
        setError("Invalid data format received from server");
        setPolicies([]);
      }
    } catch (err) {
      console.error("Life: Error fetching running policies:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to fetch running policies";
      setError(errorMessage);
      setPolicies([]);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPolicies = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      setError(null);
      console.log("Life: Fetching all policies for page:", page, "pageSize:", pageSize);
      
      const response = await lifePolicyAPI.getAllPoliciesWithStatus('all', {
        page,
        pageSize,
      });
      console.log("Life: All policies response:", response);

      if (response && response.success && Array.isArray(response.data)) {
        setPolicies(response.data);
        setPagination({
          currentPage: response.pagination?.page || page,
          pageSize: response.pagination?.pageSize || pageSize,
          totalPages: response.pagination?.totalPages || 1,
          totalItems: response.pagination?.total || 0,
        });
        setError(null);
      } else if (response && Array.isArray(response.data)) {
        // Handle case where success flag might be missing
        setPolicies(response.data);
        setPagination({
          currentPage: page,
          pageSize: pageSize,
          totalPages: Math.ceil((response.data.length || 0) / pageSize),
          totalItems: response.data.length || 0,
        });
        setError(null);
      } else {
        console.error("Invalid response format:", response);
        setError("Invalid data format received from server");
        setPolicies([]);
      }
    } catch (err) {
      console.error("Life: Error fetching all policies:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to fetch all policies";
      setError(errorMessage);
      setPolicies([]);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicies = async (page = 1, pageSize = 10) => {
    // Legacy method - redirect to appropriate new method
    if (activeTab === "running") {
      return fetchRunningPolicies(page, pageSize);
    } else {
      return fetchAllPolicies(page, pageSize);
    }
  };

  const fetchLifeStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await lifePolicyAPI.getLifeStatistics();
      setStatistics(response);
    } catch (err) {
      console.error('[Life] Error fetching life policy statistics:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSearchPolicies = async (query) => {
    try {
      setLoading(true);
      setError(null);
      console.log("Life: Searching policies with query:", query);
      const response = await lifePolicyAPI.searchPolicies({
        q: query,
        page: 1,
        pageSize: pagination.pageSize,
      });
      console.log("Life: Search response:", response);

      // Handle both expected format and direct array response
      if (response && response.success && Array.isArray(response.policies)) {
        setPolicies(response.policies);
        setPagination({
          currentPage: response.currentPage || 1,
          pageSize: response.pageSize || pagination.pageSize,
          totalPages: response.totalPages || 1,
          totalItems: response.totalItems || response.policies.length,
        });
        setError(null);
      } else if (Array.isArray(response)) {
        // Handle case where response is directly an array
        setPolicies(response);
        setPagination((prev) => ({
          ...prev,
          currentPage: 1,
          totalItems: response.length,
        }));
        setError(null);
      } else {
        console.error("Invalid search response format:", response);
        // Fallback to client-side search if server search fails
        console.log("Life: Server search failed, falling back to client-side search");
      }
    } catch (err) {
      console.error("Error searching life policies:", err);
      // Fallback to client-side search if server search fails
      console.log("Life: Server search error, falling back to client-side search");
    } finally {
      setLoading(false);
    }
  };

  // Filter policies based on search query (client-side fallback)
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
        policy.current_policy_number,
        policy.business_type,
        policy.customer_type,
        policy.email,
        policy.mobile_number,
        policy.organisation_or_holder_name,
        policy.plan_name,
        policy.sum_assured,
        policy.net_premium,
        policy.remarks,
      ].some(
        (field) => field && field.toString().toLowerCase().includes(searchLower)
      );
      const companyName =
        policy.organisation_or_holder_name ||
        policy.companyPolicyHolder?.company_name ||
        policy.company?.company_name ||
        policy.company_name;
      const companyMatch =
        companyName && companyName.toLowerCase().includes(searchLower);
      const consumerName =
        policy.consumerPolicyHolder?.name ||
        policy.consumer?.name ||
        policy.consumer_name;
      const consumerMatch =
        consumerName && consumerName.toLowerCase().includes(searchLower);
      const insuranceCompanyName = policy.provider?.name;
      const insuranceMatch =
        insuranceCompanyName &&
        insuranceCompanyName.toLowerCase().includes(searchLower);
      return policyFields || companyMatch || consumerMatch || insuranceMatch;
    });
  }, [filteredPolicies, searchQuery]);

  const handleDelete = async (policyId) => {
    if (window.confirm("Are you sure you want to delete this policy?")) {
      try {
        await lifePolicyAPI.deletePolicy(policyId);
        toast.success("Policy deleted successfully!");
        // Refresh current tab data
        if (activeTab === "running") {
          await fetchRunningPolicies(pagination.currentPage, pagination.pageSize);
        } else {
          await fetchAllPolicies(pagination.currentPage, pagination.pageSize);
        }
        await fetchLifeStatistics();
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
    // Refresh current tab data
    if (activeTab === "running") {
      await fetchRunningPolicies(pagination.currentPage, pagination.pageSize);
    } else {
      await fetchAllPolicies(pagination.currentPage, pagination.pageSize);
    }
    await fetchLifeStatistics();
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
      issue_date: policy.issue_date,
      date_of_birth: policy.date_of_birth,
      plan_name: policy.plan_name,
      sub_product: policy.sub_product,
      pt: policy.pt,
      ppt: policy.ppt,
      net_premium: policy.net_premium,
      gst: policy.gst,
      gross_premium: policy.gross_premium,
    };
    setSelectedPolicyForRenewal(transformedPolicy);
    setShowRenewalModal(true);
  };

  const handleRenewalModalClose = () => {
    setSelectedPolicyForRenewal(null);
    setShowRenewalModal(false);
  };

  const handleRenewalCompleted = async () => {
    // Refresh current tab data
    if (activeTab === "running") {
      await fetchRunningPolicies(pagination.currentPage, pagination.pageSize);
    } else {
      await fetchAllPolicies(pagination.currentPage, pagination.pageSize);
    }
    await fetchLifeStatistics();
    handleRenewalModalClose();
  };

  const handlePageChange = async (page) => {
    console.log("Life: Page changed to:", page);
    if (activeTab === "running") {
      await fetchRunningPolicies(page, pagination.pageSize);
    } else {
      await fetchAllPolicies(page, pagination.pageSize);
    }
  };

  const handlePageSizeChange = async (newPageSize) => {
    console.log("Life: Page size changed to:", newPageSize);

    // Update pagination state first
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));

    // Then fetch policies with the new page size
    if (activeTab === "running") {
      await fetchRunningPolicies(1, newPageSize);
    } else {
      await fetchAllPolicies(1, newPageSize);
    }
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
    { key: "current_policy_number", label: "Policy Number", sortable: true },
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
            system="life-policies"
            recordId={policy.id}
            buttonText=""
            buttonClass="action-button action-button-secondary action-button-small"
            showIcon={true}
            filePath={policy.policy_document_path ? `/uploads/life_policies/${policy.policy_document_path}` : null}
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
            <h1 className="insurance-title">Life Insurance Policies</h1>
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
          {loading ? (
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
              pageSizeOptions={[10, 25, 50, 100]}
            />
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
          title="Renew Life Policy"
        >
          <RenewalForm
            policy={selectedPolicyForRenewal}
            onClose={handleRenewalModalClose}
            onPolicyRenewed={handleRenewalCompleted}
          />
        </Modal>
      </div>
    </div>
  );
}

export default Life; 
