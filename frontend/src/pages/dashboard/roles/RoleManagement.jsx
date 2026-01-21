import React, { useState, useEffect } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiAlertCircle } from "react-icons/fi";
import { roleAPI } from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import "../../../styles/pages/dashboard/roles/Role.css";
import { toast } from "react-toastify";

const RoleForm = ({ role, onClose, onRoleUpdated }) => {
  const [formData, setFormData] = useState({
    role_name: "",
    description: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (role) {
        if (!role.role_id) {
          throw new Error("Invalid role ID");
        }
        await roleAPI.updateRole(role.role_id, formData);
      } else {
        await roleAPI.createRole(formData);
      }
      onRoleUpdated();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || "Failed to save role";
      toast.error(errorMsg);
    }
  };

  const [error, setError] = useState("");

  useEffect(() => {
    if (role) {
      setFormData({
        role_name: role.role_name || "",
        description: role.description || "",
      });
    }
  }, [role]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <>
      {/* Removed inline error display */}

      <form onSubmit={handleSubmit} className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
            <input
              type="text"
              name="role_name"
              value={formData.role_name}
              onChange={handleChange}
              className="insurance-form-input"
              placeholder="Role Name"
              required
            />
          </div>

          <div className="insurance-form-group">
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="insurance-form-input"
              placeholder="Description"
            />
          </div>
        </div>

        <div className="insurance-form-actions">
          <Button type="button" variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            {role ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </>
  );
};

function RoleManagement() {
  const [showModal, setShowModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });

  useEffect(() => {
    fetchRoles(1, 10);
  }, []);

  const fetchRoles = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      const data = await roleAPI.getAllRoles({ page, pageSize });
      if (data && data.roles && Array.isArray(data.roles)) {
        setRoles(data.roles);
        setPagination({
          currentPage: data.currentPage || page,
          pageSize: data.pageSize || pageSize,
          totalPages: data.totalPages || 1,
          totalItems: data.totalItems || 0,
        });
      } else if (Array.isArray(data)) {
        setRoles(data);
        setPagination((prev) => ({ ...prev, currentPage: page }));
      } else {
        setRoles([]);
      }
      setError(null);
    } catch (err) {
      setError("Failed to fetch roles");
      console.error("Error fetching roles:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (roleId) => {
    if (window.confirm("Are you sure you want to delete this role?")) {
      try {
        await roleAPI.deleteRole(roleId);
        await fetchRoles(pagination.currentPage, pagination.pageSize);
        toast.success("Role deleted successfully!");
      } catch (err) {
        setError("Failed to delete role");
        console.error("Error deleting role:", err);
        toast.error("An error occurred. Please try again.");
      }
    }
  };

  const handleEdit = (role) => {
    if (!role || !role.role_id) {
      setError("Invalid role data");
      return;
    }
    setSelectedRole(role);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setSelectedRole(null);
    setShowModal(false);
  };

  const handleRoleUpdated = async () => {
    await fetchRoles(pagination.currentPage, pagination.pageSize);
    handleModalClose();
    toast.success("Role updated successfully!");
  };

  const handlePageChange = async (page) => {
    await fetchRoles(page, pagination.pageSize);
  };

  const handlePageSizeChange = async (newPageSize) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));
    await fetchRoles(1, newPageSize);
  };

  const columns = [
    { key: "role_name", label: "Role Name", sortable: true },
    { key: "description", label: "Description", sortable: true },
    {
      key: "actions",
      label: "Actions",
      render: (_, role) => (
        <div className="insurance-actions">
          <ActionButton
            onClick={() => handleEdit(role)}
            variant="secondary"
            size="small"
          >
            <FiEdit2 />
          </ActionButton>
          <ActionButton
            onClick={() => handleDelete(role.role_id)}
            variant="danger"
            size="small"
          >
            <FiTrash2 />
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
            <h1 className="insurance-title">Role Management</h1>
            <Button
              variant="contained"
              onClick={() => setShowModal(true)}
              icon={<FiPlus />}
            >
              Add Role
            </Button>
          </div>

          {error && (
            <div className="insurance-error">
              <FiAlertCircle className="inline mr-2" /> {error}
            </div>
          )}

          {loading ? (
            <Loader size="large" color="primary" />
          ) : (
            <TableWithControl
              data={roles}
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
          title={selectedRole ? "Edit Role" : "Add New Role"}
        >
          <RoleForm
            role={selectedRole}
            onClose={handleModalClose}
            onRoleUpdated={handleRoleUpdated}
          />
        </Modal>
      </div>
    </div>
  );
}

export default RoleManagement;
