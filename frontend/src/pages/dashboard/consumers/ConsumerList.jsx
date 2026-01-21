import React, { useState, useEffect } from "react";
import {
  BiPlus,
  BiEdit,
  BiTrash,
  BiErrorCircle,
  BiUser,
  BiTrendingUp,
  BiCalendar,
} from "react-icons/bi";
import { consumerAPI } from "../../../services/api";
import TableWithControl from "../../../components/common/Table/TableWithControl";
import Button from "../../../components/common/Button/Button";
import ActionButton from "../../../components/common/ActionButton/ActionButton";
import Modal from "../../../components/common/Modal/Modal";
import Loader from "../../../components/common/Loader/Loader";
import "../../../styles/pages/dashboard/companies/Vendor.css";
import "../../../styles/components/StatCards.css";
import PhoneInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

const ConsumerForm = ({ consumer, onClose, onConsumerUpdated }) => {
  const [formData, setFormData] = useState({
    name: consumer?.name || "",
    email: consumer?.email || "",
    phone_number: consumer?.phone_number || "",
    contact_address: consumer?.contact_address || "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (consumer) {
      setFormData({
        name: consumer.name || "",
        email: consumer.email || "",
        phone_number: consumer.phone_number || "",
        contact_address: consumer.contact_address || "",
      });
    }
  }, [consumer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      console.log("[ConsumerList] Starting form submission");
      console.log("[ConsumerList] Form data:", formData);

      // Validate required fields
      const requiredFields = [
        "name",
        "email",
        "phone_number",
        "contact_address",
      ];
      const missingFields = requiredFields.filter(
        (field) => !formData[field] || formData[field].trim() === ""
      );

      if (missingFields.length > 0) {
        toast.error(`Missing required fields: ${missingFields.join(", ")}`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error("Please enter a valid email address", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
        return;
      }

      // Validate phone number (should have at least 10 digits)
      const phoneDigits = formData.phone_number.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        toast.error("Please enter a valid phone number with at least 10 digits", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
        return;
      }

      // Create FormData object
      const formDataToSend = new FormData();

      // Append basic fields
      formDataToSend.append("name", formData.name);
      formDataToSend.append("email", formData.email);
      formDataToSend.append("phone_number", formData.phone_number);
      formDataToSend.append("contact_address", formData.contact_address);



      console.log("[ConsumerList] Sending data to API");

      let response;
      if (consumer) {
        response = await consumerAPI.updateConsumer(
          consumer.consumer_id,
          formDataToSend
        );
        toast.success("Consumer updated successfully!", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
      } else {
        response = await consumerAPI.createConsumer(formDataToSend);
        toast.success("Consumer created successfully!", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
      }

      console.log("[ConsumerList] API Response:", response);

      // Refresh the consumer list
      await onConsumerUpdated();

      // Reset form
      setFormData({
        name: "",
        email: "",
        phone_number: "",
        contact_address: "",
      });
      setSuccess("");
    } catch (error) {
      console.error("[ConsumerList] Error during submission:", error);
      if (error.message && error.message !== "An error occurred") {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };



  return (
    <>
      <form onSubmit={handleSubmit} className="insurance-form">
        <div className="insurance-form-grid">
          <div className="insurance-form-group">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Consumer Name"
              required
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
              required
              className="insurance-form-input"
            />
          </div>

          <div className="insurance-form-group">
            <PhoneInput
              international
              defaultCountry="IN"
              value={formData.phone_number}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, phone_number: value }))
              }
              placeholder="Enter phone number"
              required
              className="insurance-form-input phone-input-custom"
              flags={flags}
              countrySelectProps={{
                className: "phone-input-country-select",
              }}
            />
          </div>

          <div className="insurance-form-group">
            <textarea
              name="contact_address"
              value={formData.contact_address}
              onChange={handleChange}
              placeholder="Contact Address"
              required
              className="insurance-form-input"
              rows="3"
            />
          </div>


        </div>

        <div className="insurance-form-actions">
          <Button type="button" variant="outlined" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? (
              <>
                <Loader size="small" color="white" />
                {consumer ? "Updating..." : "Creating..."}
              </>
            ) : (
              consumer ? "Update" : "Create"
            )}
          </Button>
        </div>
      </form>
    </>
  );
};

function ConsumerList({ searchQuery = "" }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedConsumer, setSelectedConsumer] = useState(null);
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState("");
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
      handleSearchConsumers(searchQuery);
    } else {
      fetchConsumers(1, 10);
    }
    fetchConsumerStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const fetchConsumers = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await consumerAPI.getAllConsumers({ page, pageSize });

      // Check if response has consumers property with pagination
      if (response && response.consumers && Array.isArray(response.consumers)) {
        setConsumers(response.consumers);
        setPagination({
          currentPage: response.currentPage || page,
          pageSize: response.pageSize || pageSize,
          totalPages: response.totalPages || 1,
          totalItems: response.totalItems || 0,
        });
      }
      // Check if response is an array directly
      else if (Array.isArray(response)) {
        setConsumers(response);
        setPagination((prev) => ({ ...prev, currentPage: page }));
      }
      // Check if response has data property and it's an array
      else if (response && response.data && Array.isArray(response.data)) {
        setConsumers(response.data);
        setPagination((prev) => ({ ...prev, currentPage: page }));
      }
      // Check if response has data property and it's an object with data array
      else if (
        response &&
        response.data &&
        response.data.data &&
        Array.isArray(response.data.data)
      ) {
        setConsumers(response.data.data);
        setPagination((prev) => ({ ...prev, currentPage: page }));
      } else {
        console.error("Invalid response format:", response);
        setError("Invalid data format received from server");
        setConsumers([]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to fetch consumers. Please try again.");
      setConsumers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchConsumers = async (query) => {
    try {
      setLoading(true);
      setError(null);
      
      if (!query.trim()) {
        await fetchConsumers(1, pagination.pageSize);
        return;
      }
      
      const response = await consumerAPI.searchConsumers({ 
        q: query,
        page: 1,
        pageSize: pagination.pageSize 
      });
      if (Array.isArray(response)) {
        setConsumers(response);
      } else if (response && response.data && Array.isArray(response.data)) {
        setConsumers(response.data);
      } else if (
        response &&
        response.data &&
        response.data.data &&
        Array.isArray(response.data.data)
      ) {
        setConsumers(response.data.data);
      } else {
        setError("Invalid data format received from server");
        setConsumers([]);
      }
      
      if (response && Array.isArray(response) && response.length === 0) {
        setError(`No consumers found matching "${query}"`);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search consumers. Please try again.");
      setConsumers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (consumerId) => {
    const consumerName = consumers.find(c => c.consumer_id === consumerId)?.name || 'this consumer';
    
    if (window.confirm(`Are you sure you want to delete ${consumerName}? This action cannot be undone.`)) {
      try {
        setLoading(true);
        await consumerAPI.deleteConsumer(consumerId);
        toast.success('Consumer deleted successfully!', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
        await fetchConsumers(pagination.currentPage, pagination.pageSize);
        await fetchConsumerStatistics();
      } catch (err) {
        const errorMessage = "Failed to delete consumer";
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
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEdit = (consumer) => {
    setSelectedConsumer(consumer);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setSelectedConsumer(null);
    setShowModal(false);
  };

  const fetchConsumerStatistics = async () => {
    try {
      console.log('[ConsumerList] fetchConsumerStatistics called');
      setStatsLoading(true);
      
      console.log('[ConsumerList] Calling getConsumerStatistics API...');
      const response = await consumerAPI.getConsumerStatistics();
      console.log('[ConsumerList] API response received:', response);
      
      if (response.success) {
        console.log('[ConsumerList] Setting statistics:', response.data);
        setStatistics(response.data);
      } else {
        console.log('[ConsumerList] API returned success: false');
      }
    } catch (error) {
      console.error('[ConsumerList] Error fetching consumer statistics:', error);
      console.error('[ConsumerList] Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const handleConsumerUpdated = async () => {
    await fetchConsumers(pagination.currentPage, pagination.pageSize);
    await fetchConsumerStatistics();
    handleModalClose();
    toast.success("Consumer updated successfully!", {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };

  const handlePageChange = async (page) => {
    await fetchConsumers(page, pagination.pageSize);
  };

  const handlePageSizeChange = async (newPageSize) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize: newPageSize,
    }));
    await fetchConsumers(1, newPageSize);
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

    { key: "name", label: "Name", sortable: true },
    { key: "email", label: "Email", sortable: true },
    { key: "phone_number", label: "Phone Number", sortable: true },
    { key: "contact_address", label: "Contact Address", sortable: true },
    {
      key: "actions",
      label: "Actions",
      render: (_, consumer) => (
        <div className="insurance-actions">
          <ActionButton
            onClick={() => handleEdit(consumer)}
            variant="secondary"
            size="small"
          >
            <BiEdit />
          </ActionButton>
          <ActionButton
            onClick={() => handleDelete(consumer.consumer_id)}
            variant="danger"
            size="small"
          >
            <BiTrash />
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

    // Get consumer statistics from the response
    const totalConsumers = statistics.total_consumers || 0;
    const activeConsumers = statistics.active_consumers || 0;
    const recentConsumers = statistics.recent_consumers || 0;

    const activePercentage = statistics.percent_active || 0;
    const recentPercentage = statistics.percent_recent || 0;

    return (
      <div className="statistics-section">
        <div className="statistics-grid">
          {/* Total Consumers Card */}
          <div className="stat-card total">
            <div className="stat-icon">
              <BiUser />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{totalConsumers}</h3>
              <p className="stat-label">Total Consumers</p>
            </div>
          </div>

          {/* Active Consumers Card */}
          <div className="stat-card active">
            <div className="stat-icon">
              <BiTrendingUp />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{activeConsumers}</h3>
              <p className="stat-label">Active Consumers</p>
              <p className="stat-percentage">{activePercentage}% of total</p>
            </div>
          </div>

          {/* Recent Consumers Card */}
          <div className="stat-card recent">
            <div className="stat-icon">
              <BiCalendar />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{recentConsumers}</h3>
              <p className="stat-label">Recent Consumers (30 days)</p>
              <p className="stat-percentage">{recentPercentage}% of total</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="insurance">
      <div className="insurance-container">
        <div className="insurance-content">
          <div className="insurance-header">
            <h1 className="insurance-title">Consumers</h1>
            <Button
              variant="contained"
              onClick={() => setShowModal(true)}
              icon={<BiPlus />}
            >
              Add Consumer
            </Button>
          </div>

          {/* Consumer Statistics */}
          <StatisticsCards />

          {error && (
            <div className="insurance-error">
              <BiErrorCircle className="inline mr-2" /> {error}
            </div>
          )}

        {loading ? (
          <Loader size="large" color="primary" />
        ) : (
          <TableWithControl
            data={consumers}
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
          title={selectedConsumer ? "Edit Consumer" : "Add New Consumer"}
        >
          <ConsumerForm
            consumer={selectedConsumer}
            onClose={handleModalClose}
            onConsumerUpdated={handleConsumerUpdated}
          />
        </Modal>
      </div>
    </div>
  );
}

export default ConsumerList;
