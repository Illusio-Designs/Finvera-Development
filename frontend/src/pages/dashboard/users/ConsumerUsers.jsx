import React, { useState, useEffect } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiAlertCircle } from "react-icons/fi";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import Button from "../../../components/common/Button/Button";
import { userAPI } from "../../../services/api";
import "../../../styles/pages/dashboard/users/User.css";
import { useAuth } from "../../../contexts/AuthContext";
import { useData } from "../../../contexts/DataContext";
import { toast } from "react-toastify";

// UserForm component
const UserForm = ({ user, onClose, onUserUpdated, roles = [] }) => {
  const [formData, setFormData] = useState({
    username: user?.username || "",
    email: user?.email || "",
    password: "",
    status: user?.status || "Active",
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || "",
        email: user.email || "",
        password: "",
        status: user.status || "Active",
      });
    } else {
      setFormData({
        username: "",
        email: "",
        password: "",
        status: "Active",
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Find the Consumer role ID
      const consumerRole = roles.find((role) => role.role_name === "Consumer");
      if (!consumerRole) {
        setError("Consumer role not found");
        return;
      }

      const userData = {
        username: formData.username,
        email: formData.email,
        status: formData.status,
        role_ids: [consumerRole.id], // Automatically assign Consumer role
      };

      if (formData.password) {
        userData.password = formData.password;
      }

      if (user) {
        await userAPI.updateUser(user.user_id, userData);
      } else {
        await userAPI.createUser(userData);
      }
      onUserUpdated();
    } catch (err) {
      console.error("Error saving user:", err);
      if (err.message && err.message !== "An error occurred") {
        toast.error(err.message);
      }
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
              name="username"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              className="insurance-form-input"
              placeholder="Enter Consumer Name"
              required
            />
          </div>

          <div className="insurance-form-group">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="insurance-form-input"
              placeholder="Enter Email"
              required
            />
          </div>

          {!user && (
            <div className="insurance-form-group">
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="insurance-form-input"
                placeholder="Password"
                required={!user}
              />
            </div>
          )}

          <div className="insurance-form-group">
            <select
              name="status"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="insurance-form-input"
              placeholder="Status"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="insurance-form-actions">
          <Button type="button" variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            {user ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </>
  );
};

function ConsumerUserList({ searchQuery = "" }) {
  const { user } = useAuth();
  const { roles, loading, error: dataError, refreshData } = useData();
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ status: "" });
  const [localLoading, setLocalLoading] = useState(true);
  const [consumerUsers, setConsumerUsers] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });

  // Fetch consumer users function
  const fetchConsumerUsers = async () => {
    try {
      setLocalLoading(true);
      const response = await userAPI.getConsumerUsers();
      console.log("Consumer users response:", response);
      
      if (response && response.users && Array.isArray(response.users)) {
        setConsumerUsers(response.users);
      } else if (Array.isArray(response)) {
        setConsumerUsers(response);
      } else {
        setConsumerUsers([]);
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching consumer users:", err);
      setError("Failed to load users");
      setConsumerUsers([]);
    } finally {
      setLocalLoading(false);
    }
  };

  // Add effect to handle initial data loading
  useEffect(() => {
    const initializeData = async () => {
      try {
        await refreshData();
        await fetchConsumerUsers();
      } catch (err) {
        console.error("Error initializing data:", err);
        setError("Failed to load users");
      }
    };

    initializeData();
  }, []);

  // Debug: Log users data structure
  useEffect(() => {
    console.log("Consumer users data:", consumerUsers);
    console.log("Roles data:", roles);
  }, [consumerUsers, roles]);

  const getRoleNames = (user) => {
    console.log("Getting role names for consumer user:", user);

    // Check for new multiple roles structure with role_name property
    if (user.roles && user.roles.length > 0) {
      const roleNames = user.roles.map((role) => {
        console.log("Processing role:", role);
        // Check if role is an object with role_name property
        if (typeof role === "object" && role.role_name) {
          const isPrimary = role.UserRole?.is_primary;
          return `${role.role_name}${isPrimary ? " (Primary)" : ""}`;
        }
        // If role is just a string
        if (typeof role === "string") {
          return role;
        }
        return "Unknown Role";
      });
      console.log("Role names:", roleNames);
      return roleNames.join(", ");
    }

    // Fallback for old single role structure
    if (user.Role?.role_name) {
      return user.Role.role_name;
    }

    // If role is not in user object, try to find it in roles array
    const userRole = roles.find((role) => role.id === user.role_id);
    return userRole ? userRole.role_name : "Unknown";
  };

  const handleDelete = async (userId) => {
    if (window.confirm("Are you sure you want to delete this consumer user?")) {
      try {
        await userAPI.deleteUser(userId);
        await refreshData();
        await fetchConsumerUsers();
        toast.success("User deleted successfully!");
      } catch (err) {
        setError("Failed to delete user");
        console.error(err);
        toast.error("An error occurred. Please try again.");
      }
    }
  };

  const handleEdit = (user) => {
    console.log("Editing consumer user:", user); // Debug log
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setSelectedUser(null);
    setShowModal(false);
  };

  const handleUserUpdated = async () => {
    try {
      await refreshData();
      await fetchConsumerUsers();
      toast.success("User updated successfully!");
    } catch (err) {
      console.error("Error refreshing users:", err);
      toast.error("An error occurred. Please try again.");
    }
    handleModalClose();
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
    { key: "username", label: "Consumer Name", sortable: true },
    { key: "email", label: "Email", sortable: true },
    {
      key: "roles",
      label: "Roles",
      sortable: true,
      render: (_, user) => getRoleNames(user),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            value === "Active"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {value || "Active"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, user) => (
        <div className="insurance-actions">
          <ActionButton
            onClick={() => handleEdit(user)}
            variant="secondary"
            size="small"
          >
            <FiEdit2 />
          </ActionButton>
          <ActionButton
            onClick={() => handleDelete(user.user_id)}
            variant="danger"
            size="small"
          >
            <FiTrash2 />
          </ActionButton>
        </div>
      ),
    },
  ];

  if (
    !user ||
    !user.roles?.some((role) =>
      ["admin", "Admin", "vendor_manager", "Vendor_manager"].includes(role)
    )
  ) {
    return (
      <div className="insurance-error">
        <FiAlertCircle className="inline mr-2" /> You don't have permission to
        access this page.
      </div>
    );
  }

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Consumer Users</h1>
          </div>

          {(error || dataError) && (
            <div className="insurance-error">
              <FiAlertCircle className="inline mr-2" />
              {error || dataError}
            </div>
          )}

          {loading || localLoading ? (
            <Loader size="large" color="primary" />
          ) : (
            <TableWithControl
              data={consumerUsers}
              columns={columns}
              defaultPageSize={10}
              serverSidePagination={false}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          )}
        </div>

        <Modal
          isOpen={showModal}
          onClose={handleModalClose}
          title={selectedUser ? "Edit Consumer User" : "Add Consumer User"}
        >
          <UserForm
            user={selectedUser}
            onClose={handleModalClose}
            onUserUpdated={handleUserUpdated}
            roles={roles}
          />
        </Modal>
      </div>
    </div>
  );
}

export default ConsumerUserList;
