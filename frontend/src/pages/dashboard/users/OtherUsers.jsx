import React, { useState, useEffect } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiAlertCircle } from "react-icons/fi";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import Input from "../../../components/common/Input/Input";
import Dropdown from "../../../components/common/Dropdown/Dropdown";
import { userAPI, roleAPI } from "../../../services/api";
import Select from "react-select";
import "../../../styles/pages/dashboard/users/User.css";
import { useAuth } from "../../../contexts/AuthContext";
import { useData } from "../../../contexts/DataContext";
import { toast } from "react-toastify";

// UserForm component
const UserForm = ({ user, onClose, onUserUpdated }) => {
  const [formData, setFormData] = useState({
    username: user?.username || "",
    email: user?.email || "",
    password: "",
    role_ids: user?.roles?.map((role) => role.id) || [],
    user_type_id: user?.user_type_id || 1,
    status: user?.status || "Active",
  });
  const [error, setError] = useState(null);
  const { roles } = useData();
  const otherRoles = roles.filter((role) =>
    [
      "User",
      "Vendor_manager",
      "User_manager",
      "Insurance_manager",
      "Compliance_manager",
      "DSC_manager",
      "Labour_law_manager",
      "Website_manager",
    ].includes(role.role_name)
  );

  // Fix: Only update formData if values actually change
  useEffect(() => {
    console.log("UserForm useEffect - user changed:", user);
    console.log("Available roles in context:", roles);
    
    if (user && roles && roles.length > 0) {
      console.log("User roles:", user.roles);
      const roleIds = user.roles?.map((role) => {
        // Handle both object and primitive role structures
        if (typeof role === 'object' && role.id) {
          return role.id;
        }
        // If role is an object with role_name, we need to find the role ID from the roles context
        if (typeof role === 'object' && role.role_name) {
          const foundRole = roles.find(r => r.role_name === role.role_name);
          console.log(`Looking for role ${role.role_name}, found:`, foundRole);
          return foundRole ? foundRole.id : null;
        }
        // If role is just a string (role name), find the corresponding role ID
        if (typeof role === 'string') {
          const foundRole = roles.find(r => r.role_name === role);
          console.log(`Looking for role ${role}, found:`, foundRole);
          return foundRole ? foundRole.id : null;
        }
        return role;
      }).filter(id => id !== null) || [];
      console.log("Extracted role IDs:", roleIds);
      
      setFormData((prev) => {
        const newFormData = {
          username: user.username || "",
          email: user.email || "",
          password: "",
          role_ids: roleIds,
          user_type_id: user.user_type_id || 1,
          status: user.status || "Active",
        };
        console.log("Setting formData to:", newFormData);
        return newFormData;
      });
    } else if (!user) {
      // For new users, don't set any default roles - let user choose
      setFormData({
        username: "",
        email: "",
        password: "",
        role_ids: [],
        user_type_id: 1,
        status: "Active",
      });
    } else {
      console.log("Waiting for roles to load...");
    }
  }, [user, roles]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.role_ids.length === 0) {
        toast.error("At least one role must be selected");
        return;
      }

      const userData = {
        username: formData.username,
        email: formData.email,
        role_ids: formData.role_ids,
        user_type_id: formData.user_type_id,
        status: formData.status,
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

  // react-select options
  const roleOptions = otherRoles.map((role) => ({
    value: role.id,
    label: role.role_name,
  }));

  console.log("Available role options:", roleOptions);
  console.log("Current formData.role_ids:", formData.role_ids);

  // Get current selected values for react-select
  const selectedValues = roleOptions.filter((opt) =>
    formData.role_ids.includes(opt.value)
  );
  
  console.log("Selected values for react-select:", selectedValues);

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
                setFormData((prev) => ({ ...prev, username: e.target.value }))
              }
              className="insurance-form-input"
              placeholder="Enter User Name"
              required
            />
          </div>

          <div className="insurance-form-group">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
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
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                className="insurance-form-input"
                placeholder="Password"
                required={!user}
              />
            </div>
          )}

          <div className="insurance-form-group">
            <label className="insurance-form-label">Select Roles:</label>
            <Select
              isMulti
              options={roleOptions}
              value={selectedValues}
              onChange={(selected) => {
                console.log("Selected:", selected);
                const newRoleIds = selected
                  ? selected.map((opt) => opt.value)
                  : [];
                console.log("New role_ids:", newRoleIds);
                setFormData((prev) => ({
                  ...prev,
                  role_ids: newRoleIds,
                }));
              }}
              classNamePrefix="react-select"
              placeholder="Select roles..."
              isClearable={true}
              closeMenuOnSelect={false}
            />
          </div>

          <div className="insurance-form-group">
            <select
              name="status"
              value={formData.status}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, status: e.target.value }))
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

function OtherUserList({ searchQuery = "" }) {
  const { user } = useAuth();
  const { roles, loading, error: dataError, refreshData } = useData();
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ status: "" });
  const [localLoading, setLocalLoading] = useState(true);
  const [otherUsers, setOtherUsers] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0,
  });

  // Fetch other users function
  const fetchOtherUsers = async () => {
    try {
      setLocalLoading(true);
      const response = await userAPI.getOtherUsers();
      console.log("Other users response:", response);
      
      if (response && response.users && Array.isArray(response.users)) {
        setOtherUsers(response.users);
      } else if (Array.isArray(response)) {
        setOtherUsers(response);
      } else {
        setOtherUsers([]);
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching other users:", err);
      setError("Failed to load users");
      setOtherUsers([]);
    } finally {
      setLocalLoading(false);
    }
  };

  // Add effect to handle initial data loading
  useEffect(() => {
    const initializeData = async () => {
      try {
        await refreshData();
        await fetchOtherUsers();
      } catch (err) {
        console.error("Error initializing data:", err);
        setError("Failed to load users");
      }
    };

    initializeData();
  }, []);

  // Debug: Log users data structure
  useEffect(() => {
    console.log("Other users data:", otherUsers);
    console.log("Roles data:", roles);
  }, [otherUsers, roles]);

  const getRoleNames = (user) => {
    console.log("Getting role names for user:", user);

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
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await userAPI.deleteUser(userId);
        await refreshData();
        await fetchOtherUsers();
        toast.success("User deleted successfully!");
      } catch (err) {
        setError("Failed to delete user");
        console.error(err);
        toast.error("An error occurred. Please try again.");
      }
    }
  };

  const handleEdit = (user) => {
    console.log("Editing user:", user); // Debug log
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
      await fetchOtherUsers();
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
        const serialNumber = (currentPage - 1) * pageSize + index + 1;
        return serialNumber;
      },
    },
    { key: "username", label: "User Name", sortable: true },
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

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Other Users</h1>
            <Button
              variant="contained"
              onClick={() => setShowModal(true)}
              icon={<FiPlus />}
            >
              Add User
            </Button>
          </div>

          {(error || dataError) && (
            <div className="insurance-error">
              <FiAlertCircle className="inline mr-2" /> {error || dataError}
            </div>
          )}

          {loading || localLoading ? (
            <Loader size="large" color="primary" />
          ) : (
            <TableWithControl
              data={otherUsers}
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
          title={selectedUser ? "Edit User" : "Add User"}
        >
          <UserForm
            user={selectedUser}
            onClose={handleModalClose}
            onUserUpdated={handleUserUpdated}
          />
        </Modal>
      </div>
    </div>
  );
}

export default OtherUserList;
