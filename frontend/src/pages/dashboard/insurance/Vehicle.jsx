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
  vehiclePolicyAPI,
  insuranceCompanyAPI,
  employeeCompensationAPI,
} from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import "../../../styles/pages/dashboard/insurance/Insurance.css";
import "../../../styles/components/StatCards.css";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import PhoneInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import Select, { components } from "react-select";
import { useAuth } from "../../../contexts/AuthContext";
import DocumentDownload from "../../../components/common/DocumentDownload/DocumentDownload";
import "../../../styles/pages/dashboard/renewals/RenewalDashboard.css";

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
    policyNumber: "",
    email: "",
    mobileNumber: "",
    policyStartDate: "",
    policyEndDate: "",
    subProduct: "",
    vehicleNumber: "",
    segment: "",
    manufacturingCompany: "",
    model: "",
    manufacturingYear: "",
    idv: "",
    netPremium: "",
    remarks: "",
    organisation_or_holder_name: "",
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
      setFormData({
        businessType: policy.business_type || "",
        customerType: policy.customer_type || "",
        insuranceCompanyId: policy.insurance_company_id || "",
        companyId: policy.company_id || "",
        consumerId: policy.consumer_id || "",
        policyNumber: policy.policy_number || "",
        email: policy.email || "",
        mobileNumber: policy.mobile_number || "",
        policyStartDate: policy.policy_start_date
          ? policy.policy_start_date.slice(0, 10)
          : "",
        policyEndDate: policy.policy_end_date
          ? policy.policy_end_date.slice(0, 10)
          : "",
        subProduct: policy.sub_product || "",
        vehicleNumber: policy.vehicle_number || "",
        segment: policy.segment || "",
        manufacturingCompany: policy.manufacturing_company || "",
        model: policy.model || "",
        manufacturingYear: policy.manufacturing_year || "",
        idv: policy.idv || "",
        netPremium: policy.net_premium || "",
        remarks: policy.remarks || "",
        organisation_or_holder_name: policy.organisation_or_holder_name || "",
      });
      setFileNames({ policyDocument: policy.policy_document_path || "" });
    }
  }, [policy]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch companies
        const companiesResponse = await vehiclePolicyAPI.getActiveCompanies();
        setCompanies(companiesResponse);

        // Fetch consumers
        const consumersResponse = await vehiclePolicyAPI.getActiveConsumers();
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
        const data = await insuranceCompanyAPI.getAllCompanies({
          pageSize: 9999,
        });
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
        organisation_or_holder_name: "",
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
        organisation_or_holder_name: data.company_name,
      }));
    } else if (type === "consumer") {
      setFormData((prev) => ({
        ...prev,
        companyId: "",
        consumerId: data.consumer_id,
        email: data.email,
        mobileNumber: data.phone_number,
        organisation_or_holder_name: data.name,
      }));
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      console.log(`[Vehicle] File selected for ${type}:`, {
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
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Log initial state
    console.log("[Vehicle] Initial form state:", {
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
      "policyNumber",
      "email",
      "mobileNumber",
      "policyStartDate",
      "policyEndDate",
      "subProduct",
      "vehicleNumber",
      "segment",
      "manufacturingCompany",
      "model",
      "manufacturingYear",
      "idv",
      "netPremium",
      "organisation_or_holder_name",
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
      const msg = "Policy document is required for new policies";
      toast.error(msg);
      setLoading(false);
      return;
    }

    const submitData = new FormData();

    try {
      // Log form data before conversion
      console.log("[Vehicle] Form data before conversion:", formData);

      // Add all form fields with proper type conversion
      Object.entries(formData).forEach(([key, value]) => {
        // Skip empty strings for ID fields (company_id, consumer_id)
        if ((key === "companyId" || key === "consumerId") && value === "") {
          return;
        }

        if (value !== undefined && value !== null && value !== "") {
          // Convert camelCase to snake_case for API
          const apiKey = key.replace(
            /[A-Z]/g,
            (letter) => `_${letter.toLowerCase()}`
          );

          // Handle numeric fields
          if (["idv", "netPremium"].includes(key)) {
            submitData.append(apiKey, parseFloat(value).toFixed(2));
          }
          // Handle date fields
          else if (["policyStartDate", "policyEndDate"].includes(key)) {
            submitData.append(apiKey, new Date(value).toISOString());
          }
          // Handle all other fields
          else {
            submitData.append(apiKey, value);
          }
          console.log(`[Vehicle] Appending form field: ${apiKey} = ${value}`);
        }
      });

      // Add calculated fields with proper decimal formatting
      submitData.append("gst", gst.toFixed(2));
      submitData.append("gross_premium", grossPremium.toFixed(2));
      console.log("[Vehicle] Appended calculated fields:", {
        gst: gst.toFixed(2),
        gross_premium: grossPremium.toFixed(2),
      });

      // Handle file upload
      if (files.policyDocument) {
        console.log("[Vehicle] File details before upload:", {
          name: files.policyDocument.name,
          type: files.policyDocument.type,
          size: `${(files.policyDocument.size / 1024 / 1024).toFixed(2)}MB`,
          lastModified: new Date(
            files.policyDocument.lastModified
          ).toISOString(),
        });

        // Use the field name expected by the backend's multer configuration
        submitData.append(
          "policyDocument",
          files.policyDocument,
          files.policyDocument.name
        );
        console.log(
          "[Vehicle] File appended to FormData with field name 'policyDocument'"
        );
      } else {
        console.log("[Vehicle] No file to upload");
      }

      // Log the complete FormData contents
      console.log("[Vehicle] Complete FormData contents:");
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
        console.log("[Vehicle] Updating existing policy:", policy.id);
        resp = await vehiclePolicyAPI.updatePolicy(policy.id, submitData);
        console.log("[Vehicle] Update response:", resp);
        toast.success("Policy updated successfully!");
      } else {
        console.log("[Vehicle] Creating new policy");
        resp = await vehiclePolicyAPI.createPolicy(submitData);
        console.log("[Vehicle] Create response:", resp);
        toast.success("Policy created successfully!");
      }

      onPolicyUpdated();
    } catch (err) {
      console.error("[Vehicle] API error:", {
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
      setError(errorMessage);
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
            <input
              type="text"
              name="organisation_or_holder_name"
              value={formData.organisation_or_holder_name}
              readOnly
              className="insurance-form-input"
              placeholder="Organisation Name / Policy Holder Name"
            />
          </div>
          <div className="insurance-form-group">
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
            <select
              name="subProduct"
              value={formData.subProduct}
              onChange={handleChange}
              className="insurance-form-input"
            >
              <option value="">Select Sub Product</option>
              <option value="Two Wheeler">Two Wheeler</option>
              <option value="Private car">Private car</option>
              <option value="Passanger Vehicle">Passanger Vehicle</option>
              <option value="Goods Vehicle">Goods Vehicle</option>
              <option value="Misc - D Vehicle">Misc - D Vehicle</option>
              <option value="Standalone CPA">Standalone CPA</option>
            </select>
          </div>
          <div className="insurance-form-group">
            <input
              type="text"
              name="vehicleNumber"
              value={formData.vehicleNumber}
              onChange={handleChange}
              placeholder="Vehicle Number"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <select
              name="segment"
              value={formData.segment}
              onChange={handleChange}
              className="insurance-form-input"
            >
              <option value="">Select Segment</option>
              <option value="Comprehensive">Comprehensive</option>
              <option value="TP Only">TP Only</option>
              <option value="SAOD">SAOD</option>
            </select>
          </div>
          <div className="insurance-form-group">
            <input
              type="text"
              name="manufacturingCompany"
              value={formData.manufacturingCompany}
              onChange={handleChange}
              placeholder="Manufacturing Company"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <input
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
              placeholder="Model"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <input
              type="text"
              name="manufacturingYear"
              value={formData.manufacturingYear}
              onChange={handleChange}
              placeholder="Manufacturing Year"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
            <input
              type="number"
              name="idv"
              value={formData.idv}
              onChange={handleChange}
              placeholder="IDV"
              className="insurance-form-input"
            />
          </div>
          <div className="insurance-form-group">
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
            <input
              type="number"
              name="gst"
              value={gst}
              placeholder="GST (18%)"
              className="insurance-form-input"
              readOnly
            />
          </div>
          <div className="insurance-form-group">
            <input
              type="number"
              name="grossPremium"
              value={grossPremium}
              placeholder="Gross Premium"
              className="insurance-form-input"
              readOnly
            />
          </div>
          <div className="insurance-form-group">
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
                <div
                  className="loading-placeholder"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: "#e5e7eb",
                  }}
                ></div>
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  <div
                    className="loading-placeholder"
                    style={{
                      width: 60,
                      height: 24,
                      backgroundColor: "#e5e7eb",
                      borderRadius: 4,
                    }}
                  ></div>
                </div>
                <div className="stat-label">
                  <div
                    className="loading-placeholder"
                    style={{
                      width: 100,
                      height: 16,
                      backgroundColor: "#e5e7eb",
                      borderRadius: 4,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const {
    total_policies = 0,
    active_policies = 0,
    recent_policies = 0,
  } = statistics;
  const activePercentage =
    total_policies > 0
      ? Math.round((active_policies / total_policies) * 100)
      : 0;
  const recentPercentage =
    total_policies > 0
      ? Math.round((recent_policies / total_policies) * 100)
      : 0;

  return (
    <div className="statistics-section">
      <div className="statistics-grid">
        <div className="stat-card total">
          <div className="stat-icon">
            <BiShield />
          </div>
          <div className="stat-content">
            <div className="stat-number">{total_policies}</div>
            <div className="stat-label">Total Policies</div>
          </div>
        </div>
        <div className="stat-card active">
          <div className="stat-icon">
            <BiTrendingUp />
          </div>
          <div className="stat-content">
            <div className="stat-number">{active_policies}</div>
            <div className="stat-label">Active Policies</div>
            <div className="stat-percentage">{activePercentage}%</div>
          </div>
        </div>
        <div className="stat-card recent">
          <div className="stat-icon">
            <BiCalendar />
          </div>
          <div className="stat-content">
            <div className="stat-number">{recent_policies}</div>
            <div className="stat-label">Recent Policies</div>
            <div className="stat-percentage">{recentPercentage}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Renewal Form Component for Vehicle Policy
const RenewalForm = ({ policy, onClose, onRenewalCompleted }) => {
  const [formData, setFormData] = useState({
    businessType: "Renewal/Rollover",
    customerType: "",
    insuranceCompanyId: "",
    companyId: "",
    consumerId: "",
    policyNumber: "",
    email: "",
    mobileNumber: "",
    policyStartDate: "",
    policyEndDate: "",
    subProduct: "",
    vehicleNumber: "",
    segment: "",
    manufacturingCompany: "",
    model: "",
    manufacturingYear: "",
    idv: "",
    netPremium: "",
    remarks: "",
    organisation_or_holder_name: "",
  });

  const [files, setFiles] = useState({
    policyDocument: null,
  });

  const [fileNames, setFileNames] = useState({
    policyDocument: "",
  });

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
      console.log("RenewalForm: Received policy data:", policy);
      const formatDate = (dateStr) => (dateStr ? dateStr.slice(0, 10) : "");

      // Pre-fill form with current policy data, but clear policy number for new renewal
      const formDataToSet = {
        businessType: "Renewal/Rollover", // Always set to Renewal
        customerType: policy.customerType || policy.customer_type || "",
        insuranceCompanyId:
          policy.insuranceCompanyId || policy.insurance_company_id || "",
        companyId: policy.companyId || policy.company_id || "",
        consumerId: policy.consumerId || policy.consumer_id || "",
        policyNumber: "", // Clear policy number - user must enter new one
        email: policy.email || "",
        mobileNumber: policy.mobileNumber || policy.mobile_number || "",
        policyStartDate: "", // Clear dates - user must enter new dates
        policyEndDate: "",
        subProduct: policy.subProduct || policy.sub_product || "",
        vehicleNumber: policy.vehicleNumber || policy.vehicle_number || "",
        segment: policy.segment || "",
        manufacturingCompany:
          policy.manufacturingCompany || policy.manufacturing_company || "",
        model: policy.model || "",
        manufacturingYear:
          policy.manufacturingYear || policy.manufacturing_year || "",
        idv: "", // Clear IDV - user must enter new value
        netPremium: "", // Clear premium - user must enter new values
        remarks: "",
        organisation_or_holder_name: policy.organisation_or_holder_name || "",
      };

      console.log("RenewalForm: Setting form data:", formDataToSet);
      setFormData(formDataToSet);
    }
  }, [policy]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch companies
        const companiesResponse = await vehiclePolicyAPI.getActiveCompanies();
        setCompanies(companiesResponse);

        // Fetch consumers
        const consumersResponse = await vehiclePolicyAPI.getActiveConsumers();
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
        const data = await insuranceCompanyAPI.getAllCompanies({
          pageSize: 9999,
        });
        // Support both array and {success, data: array} and {success, companies: array}
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
    // eslint-disable-next-line
  }, [showCreateICModal]);

  useEffect(() => {
    const netPremium = parseFloat(formData.netPremium) || 0;
    const calculatedGst = netPremium * 0.18; // 18% GST
    const calculatedGross = netPremium + calculatedGst;
    setGst(calculatedGst.toFixed(2));
    setGrossPremium(calculatedGross.toFixed(2));
  }, [formData.netPremium]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      setFiles((prev) => ({ ...prev, [type]: file }));
      setFileNames((prev) => ({ ...prev, [type]: file.name }));
    }
  };

  const handleHolderChange = (option) => {
    if (!option) {
      setFormData((prev) => ({
        ...prev,
        companyId: "",
        consumerId: "",
        email: "",
        mobileNumber: "",
        organisation_or_holder_name: "",
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
        organisation_or_holder_name: data.company_name,
      }));
    } else if (type === "consumer") {
      setFormData((prev) => ({
        ...prev,
        companyId: "",
        consumerId: data.consumer_id,
        email: data.email,
        mobileNumber: data.phone_number,
        organisation_or_holder_name: data.name,
      }));
    }
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate required fields
    if (
      (!formData.companyId || formData.companyId === "") &&
      (!formData.consumerId || formData.consumerId === "")
    ) {
      setError("Company or Consumer selection is required");
      setLoading(false);
      toast.error("Please select a company or consumer");
      return;
    }

    if (!formData.insuranceCompanyId || formData.insuranceCompanyId === "") {
      setError("Insurance company selection is required");
      setLoading(false);
      toast.error("Please select an insurance company");
      return;
    }

    if (!formData.policyNumber || formData.policyNumber.trim() === "") {
      setError("Policy number is required");
      setLoading(false);
      toast.error("Please enter a policy number");
      return;
    }

    if (!formData.policyStartDate) {
      setError("Policy start date is required");
      setLoading(false);
      toast.error("Please select a policy start date");
      return;
    }

    if (!formData.policyEndDate) {
      setError("Policy end date is required");
      setLoading(false);
      toast.error("Please select a policy end date");
      return;
    }

    try {
      const formDataToSend = new FormData();

      // Validate company_id or consumer_id is explicitly selected
      if (
        (!formData.companyId ||
          formData.companyId === "" ||
          formData.companyId === "undefined") &&
        (!formData.consumerId ||
          formData.consumerId === "" ||
          formData.consumerId === "undefined")
      ) {
        setError("Company or Consumer selection is required");
        setLoading(false);
        toast.error("Please select a company or consumer");
        return;
      }

      // Append all form fields
      Object.keys(formData).forEach((key) => {
        const value = formData[key];
        if (value !== null && value !== undefined && value !== "") {
          // Convert camelCase to snake_case for backend
          const snakeKey = key
            .replace(/([A-Z])/g, "_$1")
            .toLowerCase()
            .replace(/^_/, "");
          formDataToSend.append(snakeKey, value);
        }
      });

      // Explicitly append company_id and consumer_id to ensure they're sent
      if (formData.companyId) {
        formDataToSend.append("company_id", formData.companyId);
      }
      if (formData.consumerId) {
        formDataToSend.append("consumer_id", formData.consumerId);
      }

      // Append GST and gross premium
      formDataToSend.append("gst", gst);
      formDataToSend.append("gross_premium", grossPremium);

      // Append file
      if (files.policyDocument) {
        formDataToSend.append("policyDocument", files.policyDocument);
      } else {
        setError("Policy document is required");
        setLoading(false);
        return;
      }

      console.log("[RenewalForm] Submitting renewal for policy:", policy.id);
      await vehiclePolicyAPI.renewPolicy(policy.id, formDataToSend);

      toast.success("Policy renewed successfully!");
      onRenewalCompleted();
      onClose();
    } catch (err) {
      console.error("Error renewing policy:", err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to renew policy";
      setError(errorMessage);
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
            <label>
              Company / Consumer <span style={{ color: "red" }}>*</span>
            </label>
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
              placeholder="Select Company or Consumer (Required)"
              isClearable
              isSearchable={true}
              required
              styles={{
                menu: (provided) => ({ 
                  ...provided, 
                  zIndex: 9999,
                  position: 'absolute'
                }),
                menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
                control: (provided, state) => ({
                  ...provided,
                  minHeight: "44px",
                  borderRadius: "8px",
                  borderColor:
                    !formData.companyId && !formData.consumerId
                      ? "#dc2626"
                      : state.isFocused
                      ? "#1F4F9C"
                      : "#d1d5db",
                  boxShadow: state.isFocused
                    ? "0 0 0 1px #1F4F9C"
                    : provided.boxShadow,
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
            {!formData.companyId && !formData.consumerId && (
              <span
                style={{
                  color: "#dc2626",
                  fontSize: "12px",
                  marginTop: "4px",
                  display: "block",
                }}
              >
                Company or Consumer selection is required
              </span>
            )}
          </div>

          <div className="insurance-form-group">
            <input
              type="text"
              name="organisation_or_holder_name"
              value={formData.organisation_or_holder_name}
              readOnly
              className="insurance-form-input"
              placeholder="Organisation Name / Policy Holder Name"
            />
          </div>

          <div className="insurance-form-group">
            <label>
              Insurance Company <span style={{ color: "red" }}>*</span>
            </label>
            <Select
              options={insuranceCompanyOptions}
              value={
                insuranceCompanyOptions.find((opt) => {
                  // Handle both string and number comparison
                  const optValue = opt.value;
                  const formValue = formData.insuranceCompanyId;
                  return (
                    String(optValue) === String(formValue) ||
                    optValue === formValue
                  );
                }) || null
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
                control: (provided, state) => ({
                  ...provided,
                  minHeight: "44px",
                  borderRadius: "8px",
                  borderColor: !formData.insuranceCompanyId
                    ? "#dc2626"
                    : state.isFocused
                    ? "#1F4F9C"
                    : "#d1d5db",
                  boxShadow: state.isFocused
                    ? "0 0 0 1px #1F4F9C"
                    : provided.boxShadow,
                }),
              }}
            />
            {!formData.insuranceCompanyId && (
              <span
                style={{
                  color: "#dc2626",
                  fontSize: "12px",
                  marginTop: "4px",
                  display: "block",
                }}
              >
                Insurance company selection is required
              </span>
            )}
          </div>

          <div className="insurance-form-group">
            <label>Policy Number *</label>
            <input
              type="text"
              name="policyNumber"
              value={formData.policyNumber}
              onChange={handleChange}
              className="insurance-form-input"
              placeholder="Enter new policy number"
              required
            />
          </div>

          <div className="insurance-form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="insurance-form-input"
            />
          </div>

          <div className="insurance-form-group">
            <label>Mobile Number</label>
            <PhoneInput
              international
              defaultCountry="IN"
              flags={flags}
              value={formData.mobileNumber}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, mobileNumber: value || "" }))
              }
              className="phone-input-container"
            />
          </div>

          <div className="insurance-form-group">
            <label>Policy Start Date *</label>
            <input
              type="date"
              name="policyStartDate"
              value={formData.policyStartDate}
              onChange={handleChange}
              className="insurance-form-input"
              required
            />
          </div>

          <div className="insurance-form-group">
            <label>Policy End Date *</label>
            <input
              type="date"
              name="policyEndDate"
              value={formData.policyEndDate}
              onChange={handleChange}
              className="insurance-form-input"
              required
            />
          </div>

          <div className="insurance-form-group">
            <label>Sub Product *</label>
            <select
              name="subProduct"
              value={formData.subProduct}
              onChange={handleChange}
              className="insurance-form-input"
              required
            >
              <option value="">Select Sub Product</option>
              <option value="Two Wheeler">Two Wheeler</option>
              <option value="Private car">Private car</option>
              <option value="Passanger Vehicle">Passanger Vehicle</option>
              <option value="Goods Vehicle">Goods Vehicle</option>
              <option value="Misc - D Vehicle">Misc - D Vehicle</option>
              <option value="Standalone CPA">Standalone CPA</option>
            </select>
          </div>

          <div className="insurance-form-group">
            <label>Vehicle Number *</label>
            <input
              type="text"
              name="vehicleNumber"
              value={formData.vehicleNumber}
              onChange={handleChange}
              className="insurance-form-input"
              required
            />
          </div>

          <div className="insurance-form-group">
            <label>Segment *</label>
            <select
              name="segment"
              value={formData.segment}
              onChange={handleChange}
              className="insurance-form-input"
              required
            >
              <option value="">Select Segment</option>
              <option value="Comprehensive">Comprehensive</option>
              <option value="TP Only">TP Only</option>
              <option value="SAOD">SAOD</option>
            </select>
          </div>

          <div className="insurance-form-group">
            <label>Manufacturing Company *</label>
            <input
              type="text"
              name="manufacturingCompany"
              value={formData.manufacturingCompany}
              onChange={handleChange}
              className="insurance-form-input"
              required
            />
          </div>

          <div className="insurance-form-group">
            <label>Model *</label>
            <input
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
              className="insurance-form-input"
              required
            />
          </div>

          <div className="insurance-form-group">
            <label>Manufacturing Year *</label>
            <input
              type="text"
              name="manufacturingYear"
              value={formData.manufacturingYear}
              onChange={handleChange}
              className="insurance-form-input"
              required
            />
          </div>

          <div className="insurance-form-group">
            <label>IDV *</label>
            <input
              type="number"
              name="idv"
              value={formData.idv}
              onChange={handleChange}
              className="insurance-form-input"
              step="0.01"
              required
            />
          </div>

          <div className="insurance-form-group">
            <label>Net Premium *</label>
            <input
              type="number"
              name="netPremium"
              value={formData.netPremium}
              onChange={handleChange}
              className="insurance-form-input"
              step="0.01"
              required
            />
          </div>

          <div className="insurance-form-group">
            <label>GST (18%)</label>
            <input
              type="text"
              value={gst}
              readOnly
              className="insurance-form-input"
            />
          </div>

          <div className="insurance-form-group">
            <label>Gross Premium</label>
            <input
              type="text"
              value={grossPremium}
              readOnly
              className="insurance-form-input"
            />
          </div>

          <div className="insurance-form-group">
            <label>Policy Document *</label>
            <div className="file-upload-container">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleFileChange(e, "policyDocument")}
                className="file-input"
                required
              />
              <label htmlFor="policyDocument" className="file-upload-label">
                <BiUpload className="upload-icon" />
                {fileNames.policyDocument || "Choose File"}
              </label>
            </div>
          </div>

          <div className="insurance-form-group full-width">
            <label>Remarks</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="insurance-form-input"
              rows="3"
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

      <CreateInsuranceCompanyModal
        isOpen={showCreateICModal}
        onClose={() => setShowCreateICModal(false)}
        onCreated={(newCompany) => {
          setNewICId(newCompany.id);
          setShowCreateICModal(false);
        }}
      />
    </>
  );
};

function Vehicle({ searchQuery = "" }) {
  const [activeTab, setActiveTab] = useState("running"); // "running" or "all"
  const [showModal, setShowModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [selectedPolicyForRenewal, setSelectedPolicyForRenewal] =
    useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [policies, setPolicies] = useState([]);
  const [groupedPolicies, setGroupedPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupedLoading, setGroupedLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState({
    total_policies: 0,
    active_policies: 0,
    recent_policies: 0,
    monthly_stats: [],
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

  useEffect(() => {
    fetchPolicies(1, 10);
    fetchVehicleStatistics();
    if (activeTab === "all") {
      fetchGroupedPolicies();
    }
  }, [activeTab]);

  // Handle search when searchQuery changes
  useEffect(() => {
    console.log("Vehicle: searchQuery changed:", searchQuery);
    if (searchQuery && searchQuery.length >= 3) {
      console.log("Vehicle: Triggering server search for:", searchQuery);
      if (activeTab === "running") {
        handleSearchPolicies(searchQuery);
      }
      // For "All Policy" tab, search is client-side, so no API call here
    } else if (searchQuery === "") {
      console.log("Vehicle: Clearing search, fetching all policies");
      if (activeTab === "running") {
        fetchPolicies(1, pagination.pageSize);
      } else if (activeTab === "all") {
        fetchGroupedPolicies(); // Refetch all grouped policies
      }
    }
  }, [searchQuery, pagination.pageSize, activeTab]);

  const fetchPolicies = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      console.log(
        "Vehicle: Fetching policies for page:",
        page,
        "pageSize:",
        pageSize
      );
      const response = await vehiclePolicyAPI.getAllPolicies({
        page,
        pageSize,
      });
      console.log("Vehicle: Fetch response:", response);

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
      console.error("Vehicle: Error fetching policies:", err);
      setError("");
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchPolicies = async (query) => {
    try {
      setLoading(true);
      setError(null);
      console.log("Vehicle: Searching policies with query:", query);
      const response = await vehiclePolicyAPI.searchPolicies({ q: query });
      console.log("Vehicle: Search response:", response);

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
        console.log(
          "Vehicle: Server search failed, falling back to client-side search"
        );
      }
    } catch (err) {
      console.error("Error searching vehicle policies:", err);
      // Fallback to client-side search if server search fails
      console.log(
        "Vehicle: Server search error, falling back to client-side search"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicleStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await vehiclePolicyAPI.getVehicleStatistics();
      setStatistics(response);
    } catch (err) {
      console.error("[Vehicle] Error fetching vehicle policy statistics:", err);
    } finally {
      setStatsLoading(false);
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

      // Search in policy fields
      const policyFields = [
        policy.policy_number,
        policy.business_type,
        policy.customer_type,
        policy.email,
        policy.mobile_number,
        policy.organisation_or_holder_name,
        policy.vehicle_number,
        policy.manufacturing_company,
        policy.model,
        policy.net_premium,
        policy.remarks,
      ].some(
        (field) => field && field.toString().toLowerCase().includes(searchLower)
      );

      // Search in company name
      const companyName =
        policy.companyPolicyHolder?.company_name ||
        policy.company?.company_name ||
        policy.company_name;
      const companyMatch =
        companyName && companyName.toLowerCase().includes(searchLower);

      // Search in consumer name
      const consumerName =
        policy.consumerPolicyHolder?.name ||
        policy.consumer?.name ||
        policy.consumer_name;
      const consumerMatch =
        consumerName && consumerName.toLowerCase().includes(searchLower);

      // Search in insurance company name
      const insuranceCompanyName = policy.provider?.name;
      const insuranceMatch =
        insuranceCompanyName &&
        insuranceCompanyName.toLowerCase().includes(searchLower);

      const matches =
        policyFields || companyMatch || consumerMatch || insuranceMatch;

      if (matches) {
        console.log("Vehicle: Policy matches search:", {
          id: policy.id,
          policy_number: policy.policy_number,
          companyName,
          consumerName,
          insuranceCompanyName,
        });
      }

      return matches;
    });
  }, [filteredPolicies, searchQuery]);

  // Client-side search for "All Policy" tab - moved to top level to avoid conditional hook
  const searchFilteredGroupedPolicies = React.useMemo(() => {
    if (!searchQuery || searchQuery.length < 3) {
      return groupedPolicies;
    }

    const searchLower = searchQuery.toLowerCase();
    return groupedPolicies
      .map((group) => {
        const filteredRunning = group.running.filter((policy) => {
          const policyFields = [
            policy.policy_number,
            policy.business_type,
            policy.customer_type,
            policy.email,
            policy.mobile_number,
            policy.vehicle_number,
            policy.manufacturing_company,
            policy.model,
            policy.net_premium,
            policy.remarks,
            policy.status,
          ].some(
            (field) =>
              field && field.toString().toLowerCase().includes(searchLower)
          );
          const companyName =
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
          return (
            policyFields || companyMatch || consumerMatch || insuranceMatch
          );
        });

        const filteredPrevious = group.previous.filter((policy) => {
          const policyFields = [
            policy.policy_number,
            policy.business_type,
            policy.customer_type,
            policy.email,
            policy.mobile_number,
            policy.vehicle_number,
            policy.manufacturing_company,
            policy.model,
            policy.net_premium,
            policy.remarks,
            policy.status,
          ].some(
            (field) =>
              field && field.toString().toLowerCase().includes(searchLower)
          );
          const companyName =
            policy.policyHolder?.company_name ||
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
          return (
            policyFields || companyMatch || consumerMatch || insuranceMatch
          );
        });

        return {
          ...group,
          running: filteredRunning,
          previous: filteredPrevious,
        };
      })
      .filter((group) => group.running.length > 0 || group.previous.length > 0);
  }, [groupedPolicies, searchQuery]);

  const handleDelete = async (policyId) => {
    if (window.confirm("Are you sure you want to delete this policy?")) {
      try {
        await vehiclePolicyAPI.deletePolicy(policyId);
        toast.success("Policy deleted successfully!");
        await fetchPolicies(pagination.currentPage, pagination.pageSize);
        await fetchVehicleStatistics();
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
    await fetchVehicleStatistics();
    if (activeTab === "all") {
      await fetchGroupedPolicies();
    }
    handleModalClose();
  };

  const handleRenewal = (policy) => {
    // Transform the policy data to camelCase for the renewal form
    const transformedPolicy = {
      id: policy.id,
      businessType: policy.business_type,
      customerType: policy.customer_type,
      insuranceCompanyId: policy.insurance_company_id,
      companyId: policy.company_id,
      consumerId: policy.consumer_id,
      policyNumber: policy.policy_number,
      email: policy.email,
      mobileNumber: policy.mobile_number,
      policyStartDate: policy.policy_start_date,
      policyEndDate: policy.policy_end_date,
      subProduct: policy.sub_product,
      vehicleNumber: policy.vehicle_number,
      segment: policy.segment,
      manufacturingCompany: policy.manufacturing_company,
      model: policy.model,
      manufacturingYear: policy.manufacturing_year,
      idv: policy.idv,
      netPremium: policy.net_premium,
      organisation_or_holder_name: policy.organisation_or_holder_name,
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
    await fetchVehicleStatistics();
    if (activeTab === "all") {
      await fetchGroupedPolicies();
    }
  };

  const fetchGroupedPolicies = async () => {
    try {
      setGroupedLoading(true);
      const response = await vehiclePolicyAPI.getAllPoliciesGrouped();
      if (response.success && response.policies) {
        setGroupedPolicies(response.policies);
      } else {
        setGroupedPolicies([]);
      }
    } catch (err) {
      console.error("Error fetching grouped vehicle policies:", err);
      setGroupedPolicies([]);
      toast.error("Failed to fetch grouped policies");
    } finally {
      setGroupedLoading(false);
    }
  };

  const handlePageChange = async (page) => {
    console.log("Vehicle: Page changed to:", page);
    await fetchPolicies(page, pagination.pageSize);
  };

  const handlePageSizeChange = async (newPageSize) => {
    console.log("Vehicle: Page size changed to:", newPageSize);

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
          "-"
        );
      },
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
              padding: "6px 14px",
              borderRadius: "16px",
              fontSize: "12px",
              fontWeight: "600",
              backgroundColor: colors.bg,
              color: colors.color,
              border: `1px solid ${colors.border}`,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
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
              system="vehicle-policies"
              recordId={policy.original_policy_id || policy.id}
              buttonText=""
              buttonClass="action-button action-button-secondary action-button-small"
              showIcon={true}
              filePath={
                policy.policy_document_path
                  ? `/uploads/vehicle_policies/${policy.policy_document_path}`
                  : null
              }
              fileName={policy.policy_document_path || "policy-document.pdf"}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Vehicle Insurance Policies</h1>
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
              // Flatten all policies grouped by company/consumer: running first, then previous
              const allPoliciesFlat = [];
              searchFilteredGroupedPolicies.forEach((group) => {
                // Add running policies first
                group.running.forEach((policy) => {
                  allPoliciesFlat.push({
                    ...policy,
                    status: "active", // Ensure status is active for running policies
                    policy_type: "running", // Ensure policy_type is running
                    companyPolicyHolder:
                      policy.companyPolicyHolder || policy.policyHolder,
                    consumerPolicyHolder:
                      policy.consumerPolicyHolder ||
                      policy.consumerPolicyHolder,
                    group_name: group.company_name,
                    group_id: group.company_id || group.consumer_id,
                  });
                });
                // Then add previous policies
                group.previous.forEach((policy) => {
                  allPoliciesFlat.push({
                    ...policy,
                    status: "expired", // Ensure status is expired for previous policies
                    policy_type: "previous", // Ensure policy_type is previous
                    companyPolicyHolder:
                      policy.policyHolder || policy.companyPolicyHolder,
                    consumerPolicyHolder:
                      policy.consumerPolicyHolder ||
                      policy.consumerPolicyHolder,
                    group_name: group.company_name,
                    group_id: group.company_id || group.consumer_id,
                  });
                });
              });

              // Use the same columns for grouped view
              const groupedColumns = columns.map((col) => {
                if (col.key === "company_or_consumer") {
                  return {
                    ...col,
                    render: (_, policy, index) => {
                      // Show company/consumer name only for the first policy of a group
                      const isFirstInGroup =
                        index === 0 ||
                        allPoliciesFlat[index - 1]?.group_id !==
                          policy.group_id;

                      if (isFirstInGroup) {
                        return (
                          <div>
                            <div
                              style={{
                                background: "#f3f4f6",
                                padding: "8px 12px",
                                borderRadius: "6px",
                                marginBottom: "8px",
                                fontWeight: "600",
                                fontSize: "14px",
                                color: "#111827",
                              }}
                            >
                              {policy.group_name}
                            </div>
                            <div>
                              {policy.companyPolicyHolder?.company_name ||
                                policy.consumerPolicyHolder?.name ||
                                policy.company_name ||
                                policy.consumer_name ||
                                "-"}
                            </div>
                          </div>
                        );
                      }
                      return (
                        policy.companyPolicyHolder?.company_name ||
                        policy.consumerPolicyHolder?.name ||
                        policy.company_name ||
                        policy.consumer_name ||
                        "-"
                      );
                    },
                  };
                }
                return col;
              });

              return allPoliciesFlat.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px" }}>
                  <p>
                    No policies found
                    {searchQuery && searchQuery.length >= 3
                      ? ` matching "${searchQuery}"`
                      : ""}
                  </p>
                </div>
              ) : (
                <TableWithControl
                  data={allPoliciesFlat}
                  columns={groupedColumns}
                  defaultPageSize={pagination.pageSize}
                  currentPage={1}
                  totalPages={Math.ceil(
                    allPoliciesFlat.length / pagination.pageSize
                  )}
                  totalItems={allPoliciesFlat.length}
                  onPageChange={(page) => {}}
                  onPageSizeChange={(newSize) => {
                    setPagination((prev) => ({
                      ...prev,
                      pageSize: newSize,
                    }));
                  }}
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
          title="Renew Policy"
        >
          <RenewalForm
            policy={selectedPolicyForRenewal}
            onClose={handleRenewalModalClose}
            onRenewalCompleted={handleRenewalCompleted}
          />
        </Modal>

        {/* Document Download Modal */}
        {showDocumentModal && selectedPolicy && (
          <DocumentDownload
            system="vehicle-policies"
            recordId={selectedPolicy.id}
          />
        )}
      </div>
    </div>
  );
}

export default Vehicle;
