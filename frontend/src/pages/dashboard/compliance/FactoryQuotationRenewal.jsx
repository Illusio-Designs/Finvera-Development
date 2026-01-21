import React, { useEffect, useState, useMemo, useCallback, memo } from "react";
import { factoryQuotationAPI } from "../../../services/api";
import Loader from "../../../components/common/Loader/Loader";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import { toast } from "react-toastify";
import { BiErrorCircle, BiShow, BiRefresh, BiDownload } from "react-icons/bi";
import "../../../styles/pages/dashboard/home/CombinedDashboard.css";
import DocumentDownload from "../../../components/common/DocumentDownload/DocumentDownload";
import Modal from "../../../components/common/Modal/Modal";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Button from "../../../components/common/Button/Button";
import "../../../styles/pages/dashboard/compliance/Compliance.css";

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
            <div className="view-field">{quotation.company_name || quotation.companyName || "-"}</div>
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
              {quotation.company_address || quotation.companyAddress || "-"}
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
            <div className="view-field">{quotation.no_of_workers || quotation.noOfWorkers || "-"}</div>
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
            <div className="view-field">{quotation.horse_power || quotation.horsePower || "-"}</div>
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
              ₹{(quotation.calculated_amount || quotation.calculatedAmount || 0).toLocaleString()}
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
              {quotation.stability_certificate_type === "with load"
                ? "With Load"
                : quotation.stability_certificate_type === "without load"
                ? "Without Load"
                : quotation.stabilityCertificateType === "with load"
                ? "With Load"
                : quotation.stabilityCertificateType === "without load"
                ? "Without Load"
                : quotation.stability_certificate_type || quotation.stabilityCertificateType || "-"}
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
              ₹{(quotation.stability_certificate_amount || quotation.stabilityCertificateAmount || 0).toLocaleString()}
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
              ₹{(quotation.administration_charge || quotation.administrationCharge || 0).toLocaleString()}
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
              ₹{(quotation.consultancy_fees || quotation.consultancyFees || 0).toLocaleString()}
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
              ₹{(quotation.plan_charge || quotation.planCharge || 0).toLocaleString()}
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
              ₹{parseFloat(quotation.total_amount || quotation.totalAmount || 0).toLocaleString('en-IN')}
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

          <div className="insurance-form-group">
            <label
              style={{
                fontWeight: 500,
                marginBottom: "0.5rem",
                display: "block",
              }}
            >
              Renewal Date
            </label>
            <div className="view-field">
              {formatDate(quotation.renewal_date || quotation.renewalDate)}
            </div>
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

const FactoryQuotationRenewal = memo(() => {
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });

  // Fetch all quotations for renewal page (renewal, running, and previous)
  const fetchRenewals = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    setError(null);
    try {
      // Use the enhanced grouped quotations endpoint that includes everything
      const response = await factoryQuotationAPI.getAllQuotationsGrouped({
        page,
        pageSize
      });
      
      console.log('📋 Factory Renewal - API Response:', response);
      
      if (response && response.success) {
        console.log('📋 Factory Renewal - Data received:', response.data);
        console.log('📋 Factory Renewal - Total items:', response.totalItems);
        setRenewals(response.data || []);
        setPagination({
          currentPage: response.currentPage || page,
          pageSize: response.pageSize || pageSize,
          totalPages: response.totalPages || 1,
          totalItems: response.totalItems || 0,
        });
      } else {
        setRenewals([]);
      }
    } catch (err) {
      console.error('Error fetching renewal quotations:', err);
      setError("Failed to fetch renewal quotations");
      setRenewals([]);
      toast.error("Failed to fetch renewal quotations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRenewals(1, 10);
  }, [fetchRenewals]);

  const handlePageChange = async (page) => {
    await fetchRenewals(page, pagination.pageSize);
  };

  const handlePageSizeChange = async (newPageSize) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));
    await fetchRenewals(1, newPageSize);
  };

  const formatDate = useCallback((dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB");
  }, []);

  // Memoize handleDownloadDocuments
  const handleDownloadDocuments = useCallback((quotation) => {
    setSelectedQuotation(quotation);
    setShowDocumentModal(true);
  }, []);

  // Handle view quotation
  const handleViewQuotation = useCallback((quotation) => {
    setSelectedQuotation(quotation);
    setShowViewModal(true);
  }, []);

  // Handle renewal
  const handleRenewal = useCallback((quotation) => {
    setSelectedQuotation(quotation);
    setShowRenewalModal(true);
  }, []);

  // Memoize columns to prevent recreation on every render
  const columns = useMemo(
    () => [
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
        key: "companyName",
        label: "Company Name",
        sortable: true,
        render: (_, quotation) => quotation.company_name || quotation.companyName || "-",
      },
      {
        key: "companyAddress",
        label: "Address",
        sortable: true,
        render: (_, quotation) => quotation.company_address || quotation.companyAddress || "-",
      },
      {
        key: "contact",
        label: "Contact Details",
        sortable: true,
        render: (_, quotation) => (
          <div>
            <div>{quotation.phone || "-"}</div>
            <div className="text-sm text-gray-600">
              {quotation.email || "-"}
            </div>
          </div>
        ),
      },
      {
        key: "totalAmount",
        label: "Total Amount",
        sortable: true,
        render: (_, quotation) => {
          // Ensure consistent formatting by converting to number first
          const amount = parseFloat(quotation.total_amount || quotation.totalAmount) || 0;
          return `₹${amount.toLocaleString('en-IN')}`;
        },
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        render: (_, quotation) => (
          <span className="status-badge status-badge-renewal">
            Renewal
          </span>
        ),
      },
      {
        key: "renewalDate",
        label: "Expiry Date",
        sortable: true,
        render: (_, quotation) => {
          return quotation.renewal_date ? formatDate(quotation.renewal_date) : "Not Set";
        },
      },
      {
        key: "actions",
        label: "Actions",
        sortable: false,
        render: (_, quotation) => {
          return (
            <div className="insurance-actions">
              <ActionButton
                onClick={() => handleViewQuotation(quotation)}
                variant="secondary"
                size="small"
                title="View Quotation Details"
              >
                <BiShow />
              </ActionButton>
              
              <ActionButton
                onClick={() => handleRenewal(quotation)}
                variant="secondary"
                size="small"
                title="Renew Quotation"
              >
                <BiRefresh />
              </ActionButton>
              
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
    ],
    [formatDate, handleViewQuotation, pagination]
  );

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Factory Quotation Renewals</h1>
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
              data={renewals}
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

        {/* Document Download Modal */}
        {showDocumentModal && selectedQuotation && (
          <DocumentDownload
            isOpen={showDocumentModal}
            onClose={() => setShowDocumentModal(false)}
            system="renewal-status"
            recordId={selectedQuotation.id}
            recordName={
              selectedQuotation.companyName ||
              selectedQuotation.company?.company_name
            }
          />
        )}

        {/* View Quotation Modal */}
        <ViewQuotationModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedQuotation(null);
          }}
          quotation={selectedQuotation}
        />

        {/* Renewal Modal */}
        <RenewalModal
          isOpen={showRenewalModal}
          onClose={() => {
            setShowRenewalModal(false);
            setSelectedQuotation(null);
          }}
          quotation={selectedQuotation}
          onRenewalSuccess={() => {
            setShowRenewalModal(false);
            setSelectedQuotation(null);
            fetchRenewals(pagination.currentPage, pagination.pageSize);
          }}
        />
      </div>
    </div>
  );
});

FactoryQuotationRenewal.displayName = "FactoryQuotationRenewal";

// Simple Renewal Modal Component
const RenewalModal = ({ isOpen, onClose, quotation, onRenewalSuccess }) => {
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newExpiryDate) {
      toast.error('Please select a new expiry date');
      return;
    }

    setLoading(true);
    try {
      // Use the proper renewal endpoint that creates previous record and updates current
      await factoryQuotationAPI.renewQuotation(quotation.id, {
        renewal_date: newExpiryDate
      });
      
      toast.success('Quotation renewed successfully');
      onRenewalSuccess();
    } catch (error) {
      console.error('Error renewing quotation:', error);
      toast.error('Failed to renew quotation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Renew Factory Quotation">
      <form onSubmit={handleSubmit} className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
            <label className="insurance-form-label">Company Name</label>
            <div className="view-field">{quotation?.company_name || quotation?.companyName || "-"}</div>
          </div>

          <div className="insurance-form-group">
            <label className="insurance-form-label">Current Status</label>
            <div className="view-field">
              <span className="status-badge status-badge-renewal">Renewal</span>
            </div>
          </div>

          <div className="insurance-form-group">
            <label className="insurance-form-label">Total Amount</label>
            <div className="view-field">
              ₹{parseFloat(quotation?.total_amount || quotation?.totalAmount || 0).toLocaleString('en-IN')}
            </div>
          </div>

          <div className="insurance-form-group">
            <label className="insurance-form-label">New Expiry Date *</label>
            <input
              type="date"
              value={newExpiryDate}
              onChange={(e) => setNewExpiryDate(e.target.value)}
              className="insurance-form-input"
              required
            />
          </div>
        </div>

        <div className="insurance-form-actions">
          <Button type="button" onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Renewing...' : 'Renew Quotation'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default FactoryQuotationRenewal;
