import React, { useState, useEffect } from "react";
import { BiPlus, BiEdit, BiTrash, BiErrorCircle } from "react-icons/bi";
import { insuranceCompanyAPI } from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../../styles/pages/dashboard/insurance/ECP.css";

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
      toast.success("Insurance company created successfully!");
      onCreated(created);
      onClose();
      setForm({ name: "" }); // Reset form after successful creation
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
      {/* Remove inline error display */}
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

const EditInsuranceCompanyModal = ({ isOpen, onClose, company, onUpdated }) => {
  const [form, setForm] = useState({ name: company?.name || "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (company) {
      setForm({ name: company.name });
    }
  }, [company]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleUpdate = async () => {
    if (!form.name.trim()) {
      setError("Please enter a company name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await insuranceCompanyAPI.updateCompany(company.id, { name: form.name });
      toast.success("Insurance company updated successfully!");
      onUpdated();
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to update insurance company";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Insurance Company">
      <input
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Enter company name"
        required
        className="insurance-form-input"
      />
      {/* Remove inline error display */}
      <div className="insurance-form-actions">
        <Button type="button" variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="contained"
          disabled={loading}
          onClick={handleUpdate}
        >
          {loading ? "Updating..." : "Update"}
        </Button>
      </div>
    </Modal>
  );
};

// Accept searchQuery as a prop
const Companies = ({ searchQuery = "" }) => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const fetchCompanies = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      const data = await insuranceCompanyAPI.getAllCompanies({ page, pageSize });
      if (data && data.companies && Array.isArray(data.companies)) {
        setCompanies(data.companies);
        setPagination({
          currentPage: data.currentPage || page,
          pageSize: data.pageSize || pageSize,
          totalPages: data.totalPages || 1,
          totalItems: data.totalItems || 0,
        });
      } else {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];
        setCompanies(list);
        setPagination((prev) => ({ ...prev, currentPage: page }));
      }
      setError(null);
    } catch (err) {
      setError("Failed to fetch insurance companies");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchCompanies = async (query) => {
    try {
      setLoading(true);
      const response = await insuranceCompanyAPI.searchCompanies({ 
        q: query,
        page: 1,
        pageSize: pagination.pageSize 
      });
      const list = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response?.data?.data)
        ? response.data.data
        : [];
      setCompanies(list);
      setError(null);
    } catch (err) {
      setError("Failed to search insurance companies");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreated = async (newCompany) => {
    await fetchCompanies(pagination.currentPage, pagination.pageSize);
  };

  const handleUpdated = async () => {
    await fetchCompanies(pagination.currentPage, pagination.pageSize);
  };

  const handlePageChange = async (page) => {
    await fetchCompanies(page, pagination.pageSize);
  };

  const handlePageSizeChange = async (newPageSize) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));
    await fetchCompanies(1, newPageSize);
  };

  const handleEdit = (company) => {
    setSelectedCompany(company);
    setShowEditModal(true);
  };

  const columns = [
    {
      key: "serial",
      label: "S.No",
      sortable: false,
      render: (_, __, index) => index + 1,
      className: "serial-number",
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, company) => (
        <div className="insurance-actions">
          <ActionButton
            onClick={() => handleEdit(company)}
            variant="secondary"
            size="small"
            title="Edit"
          >
            <BiEdit />
          </ActionButton>
        </div>
      ),
    },
  ];

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Insurance Companies</h1>
            <Button
              variant="contained"
              onClick={() => setShowCreateModal(true)}
              icon={<BiPlus />}
            >
              Add Insurance Company
            </Button>
          </div>
          {/* Removed local search bar */}
          {error && (
            <div className="insurance-error">
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
              emptyMessage="No insurance companies found"
              className="insurance-table"
            />
          )}
        </div>

      <CreateInsuranceCompanyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
      />

      <EditInsuranceCompanyModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedCompany(null);
        }}
        company={selectedCompany}
        onUpdated={handleUpdated}
      />
    </div>
    </div>
  );
};

export default Companies;
