import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

// Simple in-memory cache for API responses
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache helper functions
const getCacheKey = (url, params) => {
  return `${url}${params ? JSON.stringify(params) : ''}`;
};

const getCachedData = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCachedData = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
  // Limit cache size to prevent memory issues
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
};

// Clear cache for specific patterns (useful after mutations)
const clearCachePattern = (pattern) => {
  const keysToDelete = [];
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => cache.delete(key));
};

// Export cache utilities
export const cacheUtils = {
  clear: () => cache.clear(),
  clearPattern: clearCachePattern,
  invalidate: (url) => cache.delete(url)
};

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout (increased from 10s)
});

// Auth state management
let isAuthenticating = false;
let authPromise = null;

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!navigator.onLine) {
      return Promise.reject({
        message:
          "Network connection error. Please check your internet connection.",
        isNetworkError: true,
      });
    }

    if (error.code === "ECONNABORTED") {
      return Promise.reject({
        message:
          "Request timeout. Please check your internet connection and try again.",
        isNetworkError: true,
      });
    }

    if (!error.response) {
      return Promise.reject({
        message:
          "Unable to connect to the server. Please check your internet connection.",
        isNetworkError: true,
      });
    }

    // Handle specific error status codes
    switch (error.response.status) {
      case 401:
        // Clear token and redirect to login if unauthorized
        localStorage.removeItem("token");
        window.location.href = "/login";
        return Promise.reject({
          message: error.response.data?.message || error.response.data?.error || "Session expired. Please login again.",
          status: 401,
        });
      case 403:
        return Promise.reject({
          message: error.response.data?.message || error.response.data?.error || "You do not have permission to perform this action.",
          status: 403,
        });
      case 404:
        return Promise.reject({
          message: error.response.data?.message || error.response.data?.error || "The requested resource was not found.",
          status: 404,
        });
      case 500:
        return Promise.reject({
          message: error.response.data?.message || error.response.data?.error || "Server error. Please try again later.",
          status: 500,
        });
      default:
        return Promise.reject({
          message: error.response.data?.message || error.response.data?.error || "An unexpected error occurred.",
          status: error.response.status,
        });
    }
  }
);

// Auth API
export const authAPI = {
  login: async (email, password) => {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { token, user } = response.data;
      localStorage.setItem("token", token);
      return { token, user };
    } catch (error) {
      throw error;
    }
  },

  googleLogin: async (credential) => {
    try {
      const response = await api.post("/auth/google", { token: credential });
      const { token, user } = response.data;
      localStorage.setItem("token", token);
      return { token, user };
    } catch (error) {
      throw error;
    }
  },

  // Add WhatsApp OTP functions
  sendWhatsAppOTP: async (phone) => {
    try {
      const response = await api.post("/auth/whatsapp/send-otp", { phone });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  verifyWhatsAppOTP: async (phone, otp) => {
    try {
      const response = await api.post("/auth/whatsapp/verify-otp", {
        phone,
        otp,
      });
      const { token, user } = response.data;
      localStorage.setItem("token", token);
      return { token, user };
    } catch (error) {
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get("/auth/me");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async register(username, email, password, role_name = "user") {
    try {
      console.log("API Service: Attempting registration for:", email);
      const response = await api.post("/auth/register", {
        username,
        email,
        password,
        role_name,
      });
      const { token, user } = response.data;

      if (token && user) {
        console.log(
          "API Service: Registration successful, storing token and user data"
        );
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
      } else {
        console.error(
          "API Service: Invalid registration response - missing token or user"
        );
      }

      return { token, user };
    } catch (error) {
      console.error("API Service: Registration error:", error);
      throw error;
    }
  },

  async forgotPassword(email) {
    try {
      console.log("API Service: Sending forgot password request for:", email);
      const response = await api.post("/auth/forgot-password", { email });
      console.log("API Service: Forgot password request successful");
      return response.data;
    } catch (error) {
      console.error("API Service: Forgot password error:", error);
      throw error;
    }
  },

  async resetPassword(token, password) {
    try {
      console.log("API Service: Sending reset password request");
      const response = await api.post(`/auth/reset-password/${token}`, {
        password,
      });
      console.log("API Service: Reset password request successful");
      return response.data;
    } catch (error) {
      console.error("API Service: Reset password error:", error);
      throw error;
    }
  },
};

// User API
export const userAPI = {
  // Get all users (with caching)
  getAllUsers: async () => {
    const cacheKey = getCacheKey('/users');
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    const response = await api.get('/users');
    setCachedData(cacheKey, response.data);
    return response.data;
  },

  // Get users by role
  getUsersByRole: async (role) => {
    const response = await api.get(`/users?role=${role}`);
    return response.data;
  },

  // Get user by ID
  getUserById: async (id) => {
    const response = await api.get(`/users/${id}`);
      return response.data;
  },

  createUser: async (userData) => {
    try {
      console.log("API Service: Creating user");
      const response = await api.post("/users", userData);
      console.log("API Service: User created successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error creating user:", error);
      throw error;
    }
  },

  getCurrentUser: async () => {
    try {
      console.log("API Service: Fetching current user");
      const response = await api.get("/auth/me");
      console.log("API Service: Current user fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching current user:", error);
      throw error;
    }
  },

  updateUser: async (userId, data) => {
    try {
      console.log("API Service: Updating user:", userId);

      // Check if data is FormData (file upload)
      const isFormData = data instanceof FormData;
      console.log("Is FormData:", isFormData);

      // Configure headers based on data type
      const config = {
        headers: {
          "Content-Type": isFormData ? undefined : "application/json",
        },
      };

      console.log("Sending update request with config:", config);
      const response = await api.put(`/users/${userId}`, data, config);
      console.log("API Service: User updated successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error updating user:", error);
      if (error.response) {
        console.error("Server response:", error.response.data);
      }
      throw error;
    }
  },

  deleteUser: async (id) => {
    try {
      console.log("API Service: Deleting user:", id);
      const response = await api.delete(`/users/${id}`);
      console.log("API Service: User deleted successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error deleting user:", error);
      throw error;
    }
  },

  getCompanyUsers: async (params = {}) => {
    try {
      console.log("API Service: Fetching company users", params);
      const queryParams = new URLSearchParams({
        role: 'company',
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize })
      }).toString();
      const response = await api.get(`/users?${queryParams}`);
      console.log("API Service: Company users fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching company users:", error);
      throw error;
    }
  },

  getConsumerUsers: async (params = {}) => {
    try {
      console.log("API Service: Fetching consumer users", params);
      const queryParams = new URLSearchParams({
        role: 'consumer',
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize })
      }).toString();
      const response = await api.get(`/users?${queryParams}`);
      console.log("API Service: Consumer users fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching consumer users:", error);
      throw error;
    }
  },

  getOtherUsers: async (params = {}) => {
    try {
      console.log("API Service: Fetching other users", params);
      const queryParams = new URLSearchParams({
        role: 'other',
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize })
      }).toString();
      const response = await api.get(`/users?${queryParams}`);
      console.log("API Service: Other users fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching other users:", error);
      throw error;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      console.log("API Service: Changing password");
      const response = await api.post("/users/change-password", {
        currentPassword,
        newPassword,
      });
      console.log("API Service: Password changed successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error changing password:", error);
      throw error;
    }
  },

  forgotPassword: async (email) => {
    const response = await api.post("/users/forgot-password", { email });
    return response.data;
  },

  resetPassword: async (token, password) => {
    const response = await api.post(`/users/reset-password/${token}`, {
      password,
    });
    return response.data;
  },

  updateProfileImage: async (userId, file) => {
    try {
      console.log("API Service: Updating profile image for user:", userId);
      const formData = new FormData();
      formData.append("image", file);
      const response = await api.post(
        `/users/${userId}/profile-image`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      console.log("API Service: Profile image updated successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error updating profile image:", error);
      throw error;
    }
  },
};

// Role API
export const roleAPI = {
  getAllRoles: async (params = {}) => {
    const queryParams = new URLSearchParams({
      ...(params.page && { page: params.page }),
      ...(params.pageSize && { pageSize: params.pageSize })
    }).toString();
    const url = queryParams ? `/roles?${queryParams}` : '/roles';
    const response = await api.get(url);
    return response.data;
  },
  getRoleById: async (id) => {
      const response = await api.get(`/roles/${id}`);
      return response.data;
  },
  createRole: async (roleData) => {
    const response = await api.post('/roles', roleData);
      return response.data;
  },
  updateRole: async (id, roleData) => {
      const response = await api.put(`/roles/${id}`, roleData);
      return response.data;
  },
  deleteRole: async (id) => {
      const response = await api.delete(`/roles/${id}`);
      return response.data;
  },
  assignRoleToUser: async (userId, roleId, isPrimary = false) => {
    const response = await api.post('/roles/assign', { userId, roleId, isPrimary });
      return response.data;
  },
  removeRoleFromUser: async (userId, roleId) => {
    const response = await api.delete(`/roles/assign/${userId}/${roleId}`);
      return response.data;
  },
  getUserRoles: async (userId) => {
    const response = await api.get(`/roles/user/${userId}`);
      return response.data;
  },
  setPrimaryRole: async (userId, roleId) => {
    const response = await api.put(`/roles/user/${userId}/primary/${roleId}`);
      return response.data;
  }
};

// Company API
export const companyAPI = {
  getAllCompanies: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams({
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize })
      }).toString();
      const url = queryParams ? `/companies?${queryParams}` : '/companies';
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error("Error fetching companies:", error);
      throw error;
    }
  },

  getCompanyById: async (id) => {
    try {
      const response = await api.get(`/companies/${id}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching company:", error);
      throw error;
    }
  },

  getCompanyStatistics: async () => {
    try {
      const response = await api.get("/companies/statistics");
      return response.data;
    } catch (error) {
      console.error("Error fetching company statistics:", error);
      throw error;
    }
  },

  createCompany: async (formData) => {
    try {
      console.log("[API] Creating company:", {
        formDataEntries: Array.from(formData.entries()).map(([key, value]) => ({
          key,
          type: value instanceof File ? "File" : typeof value,
          value:
            value instanceof File
              ? {
                  name: value.name,
                  type: value.type,
                  size: value.size,
                  lastModified: value.lastModified,
                }
              : value,
        })),
      });

      const response = await api.post("/companies", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        transformRequest: [(data) => data], // Prevent axios from transforming FormData
        maxContentLength: 10 * 1024 * 1024, // 10MB
        maxBodyLength: 10 * 1024 * 1024, // 10MB
        timeout: 60000, // 60 seconds timeout for file uploads
      });

      console.log("[API] Company creation response:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "[API] Error creating company:",
        error.response?.data || error.message
      );
      throw error.response?.data || error;
    }
  },

  updateCompany: async (id, formData) => {
    try {
      console.log("[API] Updating company:", {
        id,
        formDataEntries: Array.from(formData.entries()),
      });

      // Log file details before sending
      const gstFile = formData.get("gst_document");
      const panFile = formData.get("pan_document");

      if (gstFile instanceof File) {
        console.log("[API] GST document details:", {
          name: gstFile.name,
          type: gstFile.type,
          size: gstFile.size,
        });
      }

      if (panFile instanceof File) {
        console.log("[API] PAN document details:", {
          name: panFile.name,
          type: panFile.type,
          size: panFile.size,
        });
      }

      const response = await api.put(`/companies/${id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        transformRequest: [(data) => data], // Prevent axios from transforming FormData
        maxContentLength: 10 * 1024 * 1024, // 10MB
        maxBodyLength: 10 * 1024 * 1024, // 10MB
        timeout: 60000, // 60 seconds timeout for file uploads
      });

      console.log("[API] Company update response:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "[API] Error updating company:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  deleteCompany: async (id) => {
    try {
      const response = await api.delete(`/companies/${id}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting company:", error);
      throw error;
    }
  },

  // Add searchCompanies method
  searchCompanies: async (params) => {
    try {
      const response = await api.get("/companies/search", { params });
      return response.data;
    } catch (error) {
      console.error("Error searching companies:", error);
      throw error;
    }
  },
};

// Consumer API
export const consumerAPI = {
  getConsumerStatistics: async () => {
    try {
      console.log("API Service: Fetching consumer statistics");
      const response = await api.get("/consumers/statistics");
      console.log("API Service: Consumer statistics fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching consumer statistics:", error);
      throw error;
    }
  },

  getAllConsumers: async (params = {}) => {
    try {
      console.log("API Service: Fetching all consumers", params);
      const queryParams = new URLSearchParams({
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize })
      }).toString();
      const url = queryParams ? `/consumers?${queryParams}` : '/consumers';
      const response = await api.get(url);
      console.log("API Service: Consumers fetched successfully");

      // Check if response has data property
      if (response && response.data) {
        // If response.data is an array, return it directly
        if (Array.isArray(response.data)) {
          return response.data;
        }
        // If response.data has a data property that's an array, return that
        else if (response.data.data && Array.isArray(response.data.data)) {
          return response.data.data;
        }
        // If response.data has consumers property with pagination
        else if (response.data.consumers && Array.isArray(response.data.consumers)) {
          return response.data;
        }
        // If response.data has a success property and a data property that's an array
        else if (
          response.data.success &&
          response.data.data &&
          Array.isArray(response.data.data)
        ) {
          return response.data.data;
        }
        // If none of the above, log the invalid format and return empty array
        else {
          console.error("API Service: Invalid response format:", response);
          return [];
        }
      } else {
        console.error("API Service: Invalid response format:", response);
        return [];
      }
    } catch (error) {
      console.error("API Service: Error fetching consumers:", error);
      throw error;
    }
  },

  searchConsumers: async (params) => {
    try {
      console.log("API Service: Searching consumers with params:", params);
      const response = await api.get("/consumers/search", { params });
      console.log("API Service: Consumer search completed successfully");

      // Check if response has data property
      if (response && response.data) {
        // If response.data is an array, return it directly
        if (Array.isArray(response.data)) {
          return response.data;
        }
        // If response.data has a data property that's an array, return that
        else if (response.data.data && Array.isArray(response.data.data)) {
          return response.data.data;
        }
        // If response.data has a success property and a data property that's an array
        else if (
          response.data.success &&
          response.data.data &&
          Array.isArray(response.data.data)
        ) {
          return response.data.data;
        }
        // If none of the above, log the invalid format and return empty array
        else {
          console.error("API Service: Invalid response format:", response);
          return [];
        }
      } else {
        console.error("API Service: Invalid response format:", response);
        return [];
      }
    } catch (error) {
      console.error("API Service: Error searching consumers:", error);
      throw error;
    }
  },

  getConsumerById: async (id) => {
    try {
      console.log("API Service: Fetching consumer by ID:", id);
      const response = await api.get(`/consumers/${id}`);
      console.log("API Service: Consumer fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching consumer:", error);
      throw error;
    }
  },

  updateConsumer: async (id, formData) => {
    try {
      console.log("[API] Updating consumer:", { id });

      // Log FormData contents for debugging
      if (formData instanceof FormData) {
        console.log("[API] FormData contents:");
        for (let [key, value] of formData.entries()) {
          if (value instanceof File) {
            console.log(`${key}:`, {
              name: value.name,
              type: value.type,
              size: value.size,
            });
          } else {
            console.log(`${key}:`, value);
          }
        }
      }

      const response = await api.put(`/consumers/${id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        transformRequest: [(data) => data], // Prevent axios from transforming FormData
        maxContentLength: 10 * 1024 * 1024, // 10MB
        maxBodyLength: 10 * 1024 * 1024, // 10MB
      });

      console.log("[API] Consumer update response:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "[API] Error updating consumer:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  createConsumer: async (formData) => {
    try {
      console.log("[API] Creating consumer");

      // Log FormData contents for debugging
      if (formData instanceof FormData) {
        console.log("[API] FormData contents:");
        for (let [key, value] of formData.entries()) {
          if (value instanceof File) {
            console.log(`${key}:`, {
              name: value.name,
              type: value.type,
              size: value.size,
            });
          } else {
            console.log(`${key}:`, value);
          }
        }
      }

      const response = await api.post("/consumers", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        transformRequest: [(data) => data], // Prevent axios from transforming FormData
        maxContentLength: 10 * 1024 * 1024, // 10MB
        maxBodyLength: 10 * 1024 * 1024, // 10MB
      });

      console.log("[API] Consumer creation response:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "[API] Error creating consumer:",
        error.response?.data || error.message
      );
      throw error.response?.data || error;
    }
  },
};

// Admin API
export const adminAPI = {
  async getAdminStats() {
    try {
      console.log("API Service: Fetching admin stats");
      const response = await api.get("/admin/stats");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching admin stats:", error);
      throw error;
    }
  },

  async getRecentActivities() {
    try {
      console.log("API Service: Fetching recent activities");
      const response = await api.get("/admin/activities");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching recent activities:", error);
      throw error;
    }
  },

  async getSystemHealth() {
    try {
      console.log("API Service: Fetching system health");
      const response = await api.get("/admin/health");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching system health:", error);
      throw error;
    }
  },
};

// Employee Compensation API
export const employeeCompensationAPI = {
  getAllPolicies: async (params = {}) => {
    try {
      console.log("API Service: Fetching all employee compensation policies");
      const response = await api.get("/employee-compensation", { params });
      console.log("API Service: Policies fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching policies:", error);
      throw error;
    }
  },

  getAllPoliciesGrouped: async () => {
    try {
      console.log("API Service: Fetching grouped employee compensation policies");
      const response = await api.get("/employee-compensation/all-grouped");
      console.log("API Service: Grouped policies fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching grouped policies:", error);
      throw error;
    }
  },

  getActiveCompanies: async () => {
    try {
      console.log("API Service: Fetching active companies");
      const response = await api.get("/employee-compensation/companies");
      console.log("API Service: Active companies fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching active companies:", error);
      throw error;
    }
  },

  getECPStatistics: async () => {
    try {
      console.log("API Service: Fetching ECP statistics");
      const response = await api.get("/employee-compensation/statistics");
      console.log("API Service: ECP statistics fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching ECP statistics:", error);
      throw error;
    }
  },

  searchPolicies: async (searchParams) => {
    try {
      console.log("API Service: Searching employee compensation policies");
      const response = await api.get("/employee-compensation/search", {
        params: searchParams,
      });
      console.log("API Service: Search completed successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error searching policies:", error);
      throw error;
    }
  },

  getPolicy: async (id) => {
    try {
      console.log("API Service: Fetching employee compensation policy:", id);
      const response = await api.get(`/employee-compensation/${id}`);
      console.log("API Service: Policy fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching policy:", error);
      throw error;
    }
  },

  createPolicy: async (formData) => {
    try {
      console.log("[API] Creating employee compensation policy");
      console.log("[API] FormData contents:");
      for (let pair of formData.entries()) {
        if (pair[1] instanceof File) {
          console.log(pair[0], {
            name: pair[1].name,
            type: pair[1].type,
            size: pair[1].size,
            lastModified: new Date(pair[1].lastModified).toISOString(),
          });
        } else {
          console.log(pair[0], pair[1]);
        }
      }

      const response = await api.post("/employee-compensation", formData, {
        headers: {
          "Content-Type": undefined, // Let the browser set the correct Content-Type with boundary
        },
        timeout: 30000, // 30 second timeout for large files
        maxContentLength: 10 * 1024 * 1024, // 10MB
        maxBodyLength: 10 * 1024 * 1024, // 10MB
        transformRequest: [(data) => data], // Prevent axios from transforming FormData
      });
      return response.data;
    } catch (error) {
      console.error(
        "[API] Error creating employee compensation policy:",
        error
      );
      if (error.response) {
        console.error("[API] Error response:", error.response.data);
      }
      throw error;
    }
  },

  updatePolicy: async (id, formData) => {
    try {
      console.log("[API] Updating employee compensation policy:", id);
      console.log("[API] FormData contents:");
      for (let pair of formData.entries()) {
        if (pair[1] instanceof File) {
          console.log(pair[0], {
            name: pair[1].name,
            type: pair[1].type,
            size: pair[1].size,
            lastModified: new Date(pair[1].lastModified).toISOString(),
          });
        } else {
          console.log(pair[0], pair[1]);
        }
      }

      const response = await api.put(`/employee-compensation/${id}`, formData, {
        headers: {
          "Content-Type": undefined, // Let the browser set the correct Content-Type with boundary
        },
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
        transformRequest: [(data) => data], // Prevent axios from transforming FormData
      });
      return response.data;
    } catch (error) {
      console.error(
        "[API] Error updating employee compensation policy:",
        error
      );
      if (error.response) {
        console.error("[API] Error response:", error.response.data);
      }
      throw error;
    }
  },

  deletePolicy: async (id) => {
    try {
      console.log("API Service: Deleting employee compensation policy:", id);
      const response = await api.delete(`/employee-compensation/${id}`);
      console.log("API Service: Policy deleted successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error deleting policy:", error);
      throw error;
    }
  },

  renewPolicy: async (id, formData) => {
    try {
      console.log("[API] Renewing employee compensation policy:", id);
      console.log("[API] FormData contents:");
      for (let pair of formData.entries()) {
        if (pair[1] instanceof File) {
          console.log(pair[0], {
            name: pair[1].name,
            type: pair[1].type,
            size: pair[1].size,
            lastModified: new Date(pair[1].lastModified).toISOString(),
          });
        } else {
          console.log(pair[0], pair[1]);
        }
      }

      const response = await api.post(`/employee-compensation/${id}/renew`, formData, {
        headers: {
          "Content-Type": undefined, // Let the browser set the correct Content-Type with boundary
        },
        timeout: 30000, // 30 second timeout for large files
        maxContentLength: 10 * 1024 * 1024, // 10MB
        maxBodyLength: 10 * 1024 * 1024, // 10MB
        transformRequest: [(data) => data], // Prevent axios from transforming FormData
      });
      console.log("API Service: Policy renewed successfully");
      return response.data;
    } catch (error) {
      console.error("[API] Error renewing employee compensation policy:", error);
      if (error.response) {
        console.error("[API] Error response:", error.response.data);
      }
      throw error;
    }
  },

  // Status filtering methods for ECP
  getAllPoliciesWithStatus: async (filter = 'all', params = {}) => {
    try {
      console.log(`[API] Fetching ECP policies with filter: ${filter}`, params);
      const response = await api.get(`/status-update/test-policies/ecp/${filter}`, { params });
      console.log(`[API] ECP ${filter} policies response:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`[API] Error fetching ECP ${filter} policies:`, error);
      throw error;
    }
  },

  getRunningPolicies: async (params = {}) => {
    try {
      console.log("[API] Fetching running ECP policies", params);
      const response = await api.get("/status-update/test-policies/ecp/running", { params });
      console.log("[API] Running ECP policies response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching running ECP policies:", error);
      throw error;
    }
  },

  getExpiredPolicies: async (params = {}) => {
    try {
      console.log("[API] Fetching expired ECP policies", params);
      const response = await api.get("/status-update/test-policies/ecp/expired", { params });
      console.log("[API] Expired ECP policies response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching expired ECP policies:", error);
      throw error;
    }
  },

  updateAllStatuses: async () => {
    try {
      console.log("[API] Triggering status update for all policies");
      const response = await api.post("/status-update/test-update");
      console.log("[API] Status update response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error updating statuses:", error);
      throw error;
    }
  },

  getStatusSummary: async () => {
    try {
      console.log("[API] Fetching status summary");
      const response = await api.get("/status-update/test-summary");
      console.log("[API] Status summary response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching status summary:", error);
      throw error;
    }
  },
};

// Insurance Company API
export const insuranceCompanyAPI = {
  getAllCompanies: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams({
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize })
      }).toString();
      const url = queryParams ? `/insurance-companies?${queryParams}` : '/insurance-companies';
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  createCompany: async (companyData) => {
    try {
      const response = await api.post("/insurance-companies", companyData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getCompany: async (id) => {
    try {
      console.log("API Service: Fetching insurance company:", id);
      const response = await api.get(`/insurance-companies/${id}`);
      console.log("API Service: Insurance company fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching insurance company:", error);
      throw error;
    }
  },

  updateCompany: async (id, companyData) => {
    try {
      console.log("API Service: Updating insurance company:", id);
      const response = await api.put(`/insurance-companies/${id}`, companyData);
      console.log("API Service: Insurance company updated successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error updating insurance company:", error);
      throw error;
    }
  },

  deleteCompany: async (id) => {
    try {
      console.log("API Service: Deleting insurance company:", id);
      const response = await api.delete(`/insurance-companies/${id}`);
      console.log("API Service: Insurance company deleted successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error deleting insurance company:", error);
      throw error;
    }
  },

  searchCompanies: async (params) => {
    try {
      const response = await api.get("/insurance-companies/search", { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

// Vehicle Policy API
export const vehiclePolicyAPI = {
  getAllPolicies: async (params = {}) => {
    try {
      const response = await api.get("/vehicle-policies", { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getActiveCompanies: async () => {
    try {
      const response = await api.get("/vehicle-policies/companies");
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getActiveConsumers: async () => {
    try {
      const response = await api.get("/vehicle-policies/consumers");
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  searchPolicies: async (searchParams) => {
    try {
      const response = await api.get("/vehicle-policies/search", {
        params: searchParams,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getPolicy: async (id) => {
    try {
      const response = await api.get(`/vehicle-policies/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  createPolicy: async (policyData) => {
    try {
      // Ensure we're sending the file with the correct field name
      if (policyData instanceof FormData) {
        // Log the FormData contents for debugging
        for (let [key, value] of policyData.entries()) {
          if (value instanceof File) {
            console.log("[API] File in FormData:", {
              field: key,
              name: value.name,
              type: value.type,
              size: value.size,
            });
          }
        }
      }

      const response = await api.post("/vehicle-policies", policyData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        // Add timeout and maxContentLength for large files
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024, // 10MB
        maxBodyLength: 10 * 1024 * 1024, // 10MB
        // Ensure proper handling of FormData
        transformRequest: [(data) => data],
      });
      return response.data;
    } catch (error) {
      console.error("[API] Error creating policy:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
        config: error.response?.config,
      });
      throw error;
    }
  },
  updatePolicy: async (id, policyData) => {
    try {
      const response = await api.put(`/vehicle-policies/${id}`, policyData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  deletePolicy: async (id) => {
    try {
      const response = await api.delete(`/vehicle-policies/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  renewPolicy: async (id, formData) => {
    try {
      console.log("[API] Renewing vehicle policy:", id);
      const response = await api.post(
        `/vehicle-policies/${id}/renew`,
        formData,
        {
          headers: {
            "Content-Type": undefined,
          },
          timeout: 30000,
          maxContentLength: 10 * 1024 * 1024,
          maxBodyLength: 10 * 1024 * 1024,
          transformRequest: [(data) => data],
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        "[API] Error renewing vehicle policy:",
        error
      );
      if (error.response) {
        console.error("[API] Error response:", error.response.data);
      }
      throw error;
    }
  },
  getAllPoliciesGrouped: async () => {
    try {
      const response = await api.get("/vehicle-policies/all-grouped");
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getVehicleStatistics: async () => {
    try {
      const response = await api.get("/vehicle-policies/statistics");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Status filtering methods
  getAllPoliciesWithStatus: async (filter = 'all', params = {}) => {
    try {
      console.log(`[API] Fetching vehicle policies with filter: ${filter}`, params);
      const response = await api.get(`/status-update/test-policies/vehicle/${filter}`, { params });
      console.log(`[API] Vehicle ${filter} policies response:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`[API] Error fetching vehicle ${filter} policies:`, error);
      throw error;
    }
  },

  getRunningPolicies: async (params = {}) => {
    try {
      console.log("[API] Fetching running vehicle policies", params);
      const response = await api.get("/status-update/test-policies/vehicle/running", { params });
      console.log("[API] Running vehicle policies response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching running vehicle policies:", error);
      throw error;
    }
  },

  getExpiredPolicies: async (params = {}) => {
    try {
      console.log("[API] Fetching expired vehicle policies", params);
      const response = await api.get("/status-update/test-policies/vehicle/expired", { params });
      console.log("[API] Expired vehicle policies response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching expired vehicle policies:", error);
      throw error;
    }
  },

  updateAllStatuses: async () => {
    try {
      console.log("[API] Triggering status update for all policies");
      const response = await api.post("/status-update/test-update");
      console.log("[API] Status update response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error updating statuses:", error);
      throw error;
    }
  },

  getStatusSummary: async () => {
    try {
      console.log("[API] Fetching status summary");
      const response = await api.get("/status-update/test-summary");
      console.log("[API] Status summary response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching status summary:", error);
      throw error;
    }
  },
  getVehicleStatistics: async () => {
    try {
      const response = await api.get("/vehicle-policies/statistics");
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Health Policy API
export const healthPolicyAPI = {
  getAllPolicies: async (params = {}) => {
    try {
      const response = await api.get("/health-policies", { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getActiveCompanies: async () => {
    try {
      const response = await api.get("/health-policies/companies");
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getActiveConsumers: async () => {
    try {
      const response = await api.get("/health-policies/consumers");
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getActiveInsuranceCompanies: async () => {
    try {
      const response = await api.get("/health-policies/insurance-companies");
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  searchPolicies: async (searchParams) => {
    try {
      const response = await api.get("/health-policies/search", {
        params: searchParams,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getPolicy: async (id) => {
    try {
      const response = await api.get(`/health-policies/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  createPolicy: async (policyData) => {
    try {
      if (policyData instanceof FormData) {
        for (let [key, value] of policyData.entries()) {
          if (value instanceof File) {
            console.log("[API] File in FormData:", {
              field: key,
              name: value.name,
              type: value.type,
              size: value.size,
            });
          }
        }
      }
      const response = await api.post("/health-policies", policyData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
        transformRequest: [(data) => data],
      });
      return response.data;
    } catch (error) {
      console.error("[API] Error creating health policy:", error);
      throw error;
    }
  },
  updatePolicy: async (id, policyData) => {
    try {
      const response = await api.put(`/health-policies/${id}`, policyData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  deletePolicy: async (id) => {
    try {
      const response = await api.delete(`/health-policies/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getHealthStatistics: async () => {
    try {
      const response = await api.get("/health-policies/statistics");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Status filtering methods for Health Insurance
  getAllPoliciesWithStatus: async (filter = 'all', params = {}) => {
    try {
      console.log(`[API] Fetching health policies with filter: ${filter}`, params);
      const response = await api.get(`/status-update/test-policies/health/${filter}`, { params });
      console.log(`[API] Health ${filter} policies response:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`[API] Error fetching health ${filter} policies:`, error);
      throw error;
    }
  },

  getRunningPolicies: async (params = {}) => {
    try {
      console.log("[API] Fetching running health policies", params);
      const response = await api.get("/status-update/test-policies/health/running", { params });
      console.log("[API] Running health policies response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching running health policies:", error);
      throw error;
    }
  },

  getExpiredPolicies: async (params = {}) => {
    try {
      console.log("[API] Fetching expired health policies", params);
      const response = await api.get("/status-update/test-policies/health/expired", { params });
      console.log("[API] Expired health policies response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching expired health policies:", error);
      throw error;
    }
  },

  updateAllStatuses: async () => {
    try {
      console.log("[API] Triggering status update for all policies");
      const response = await api.post("/status-update/test-update");
      console.log("[API] Status update response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error updating statuses:", error);
      throw error;
    }
  },

  getStatusSummary: async () => {
    try {
      console.log("[API] Fetching status summary");
      const response = await api.get("/status-update/test-summary");
      console.log("[API] Status summary response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching status summary:", error);
      throw error;
    }
  },

  getAllPoliciesGrouped: async () => {
    try {
      console.log("API Service: Fetching grouped health policies");
      const response = await api.get("/health-policies/all-grouped");
      console.log("API Service: Grouped health policies fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching grouped health policies:", error);
      throw error;
    }
  },

  renewPolicy: async (id, formData) => {
    try {
      console.log("[API] Renewing health policy:", id);
      console.log("[API] FormData contents:");
      for (let pair of formData.entries()) {
        if (pair[1] instanceof File) {
          console.log(pair[0], {
            name: pair[1].name,
            type: pair[1].type,
            size: pair[1].size,
            lastModified: new Date(pair[1].lastModified).toISOString(),
          });
        } else {
          console.log(pair[0], pair[1]);
        }
      }

      const response = await api.post(`/health-policies/${id}/renew`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
        transformRequest: [(data) => data],
      });

      console.log("[API] Health policy renewal response:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "[API] Error renewing health policy:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
};

// Fire Policy API
export const firePolicyAPI = {
  getAllPolicies: async (params = {}) => {
    try {
      const response = await api.get("/fire-policies", { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getActiveCompanies: async () => {
    try {
      const response = await api.get("/fire-policies/companies");
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getActiveConsumers: async () => {
    try {
      const response = await api.get("/fire-policies/consumers");
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getActiveInsuranceCompanies: async () => {
    try {
      const response = await api.get("/fire-policies/insurance-companies");
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  searchPolicies: async (searchParams) => {
    try {
      const response = await api.get("/fire-policies/search", {
        params: searchParams,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getPolicy: async (id) => {
    try {
      const response = await api.get(`/fire-policies/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  createPolicy: async (policyData) => {
    try {
      if (policyData instanceof FormData) {
        for (let [key, value] of policyData.entries()) {
          if (value instanceof File) {
            console.log("[API] File in FormData:", {
              field: key,
              name: value.name,
              type: value.type,
              size: value.size,
            });
          }
        }
      }
      const response = await api.post("/fire-policies", policyData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
        transformRequest: [(data) => data],
      });
      return response.data;
    } catch (error) {
      console.error("[API] Error creating fire policy:", error);
      throw error;
    }
  },
  updatePolicy: async (id, policyData) => {
    try {
      const response = await api.put(`/fire-policies/${id}`, policyData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  deletePolicy: async (id) => {
    try {
      const response = await api.delete(`/fire-policies/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getFireStatistics: async () => {
    try {
      const response = await api.get("/fire-policies/statistics");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getAllPoliciesGrouped: async () => {
    try {
      console.log("API Service: Fetching grouped fire policies");
      const response = await api.get("/fire-policies/all-grouped");
      console.log("API Service: Grouped fire policies fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching grouped fire policies:", error);
      throw error;
    }
  },

  renewPolicy: async (id, formData) => {
    try {
      console.log("[API] Renewing fire policy:", id);
      console.log("[API] FormData contents:");
      for (let pair of formData.entries()) {
        if (pair[1] instanceof File) {
          console.log(pair[0], {
            name: pair[1].name,
            type: pair[1].type,
            size: pair[1].size,
            lastModified: new Date(pair[1].lastModified).toISOString(),
          });
        } else {
          console.log(pair[0], pair[1]);
        }
      }

      const response = await api.post(`/fire-policies/${id}/renew`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
        transformRequest: [(data) => data],
      });

      console.log("[API] Fire policy renewal response:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "[API] Error renewing fire policy:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  // Status filtering methods for Fire Insurance
  getAllPoliciesWithStatus: async (filter = 'all', params = {}) => {
    try {
      console.log(`[API] Fetching Fire policies with filter: ${filter}`, params);
      const response = await api.get(`/status-update/test-policies/fire/${filter}`, { params });
      console.log(`[API] Fire ${filter} policies response:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`[API] Error fetching Fire ${filter} policies:`, error);
      throw error;
    }
  },

  getRunningPolicies: async (params = {}) => {
    try {
      console.log("[API] Fetching running Fire policies", params);
      const response = await api.get("/status-update/test-policies/fire/running", { params });
      console.log("[API] Running Fire policies response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching running Fire policies:", error);
      throw error;
    }
  },

  getExpiredPolicies: async (params = {}) => {
    try {
      console.log("[API] Fetching expired Fire policies", params);
      const response = await api.get("/status-update/test-policies/fire/expired", { params });
      console.log("[API] Expired Fire policies response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching expired Fire policies:", error);
      throw error;
    }
  }
};

// Life Policy API
export const lifePolicyAPI = {
  getAllPolicies: async (params = {}) => {
    try {
      console.log("API Service: Fetching all life policies");
      const response = await api.get("/life-policies", { params });
      console.log("API Service: Life policies fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching life policies:", error);
      throw error;
    }
  },

  getActiveCompanies: async () => {
    try {
      console.log("API Service: Fetching active companies for life policies");
      const response = await api.get("/life-policies/companies");
      console.log("API Service: Active companies fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching active companies:", error);
      throw error;
    }
  },

  getActiveConsumers: async () => {
    try {
      console.log("API Service: Fetching active consumers for life policies");
      const response = await api.get("/life-policies/consumers");
      console.log("API Service: Active consumers fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching active consumers:", error);
      throw error;
    }
  },

  searchPolicies: async (searchParams) => {
    try {
      console.log("API Service: Searching life policies");
      const response = await api.get("/life-policies/search", {
        params: searchParams,
      });
      console.log("API Service: Search completed successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error searching life policies:", error);
      throw error;
    }
  },

  getPolicy: async (id) => {
    try {
      console.log("API Service: Fetching life policy:", id);
      const response = await api.get(`/life-policies/${id}`);
      console.log("API Service: Life policy fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching life policy:", error);
      throw error;
    }
  },

  createPolicy: async (policyData) => {
    try {
      console.log("[API] Creating life policy");

      // Log FormData contents for debugging
      if (policyData instanceof FormData) {
        console.log("[API] FormData contents:");
        for (let [key, value] of policyData.entries()) {
          if (value instanceof File) {
            console.log(`${key}:`, {
              name: value.name,
              type: value.type,
              size: value.size,
            });
          } else {
            console.log(`${key}:`, value);
          }
        }
      }

      const response = await api.post("/life-policies", policyData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000, // 30 second timeout for large files
        maxContentLength: 10 * 1024 * 1024, // 10MB
        maxBodyLength: 10 * 1024 * 1024, // 10MB
        transformRequest: [(data) => data], // Prevent axios from transforming FormData
      });

      console.log("[API] Life policy creation response:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "[API] Error creating life policy:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  updatePolicy: async (id, policyData) => {
    try {
      console.log("[API] Updating life policy:", id);

      // Log FormData contents for debugging
      if (policyData instanceof FormData) {
        console.log("[API] FormData contents:");
        for (let [key, value] of policyData.entries()) {
          if (value instanceof File) {
            console.log(`${key}:`, {
              name: value.name,
              type: value.type,
              size: value.size,
            });
          } else {
            console.log(`${key}:`, value);
          }
        }
      }

      const response = await api.put(`/life-policies/${id}`, policyData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
        transformRequest: [(data) => data],
      });

      console.log("[API] Life policy update response:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "[API] Error updating life policy:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  deletePolicy: async (id) => {
    try {
      console.log("API Service: Deleting life policy:", id);
      const response = await api.delete(`/life-policies/${id}`);
      console.log("API Service: Life policy deleted successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error deleting life policy:", error);
      throw error;
    }
  },
  getLifeStatistics: async () => {
    try {
      const response = await api.get("/life-policies/statistics");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getAllPoliciesGrouped: async () => {
    try {
      console.log("API Service: Fetching grouped life policies");
      const response = await api.get("/life-policies/all-grouped");
      console.log("API Service: Grouped life policies fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching grouped life policies:", error);
      throw error;
    }
  },

  renewPolicy: async (id, formData) => {
    try {
      console.log("[API] Renewing life policy:", id);
      console.log("[API] FormData contents:");
      for (let pair of formData.entries()) {
        if (pair[1] instanceof File) {
          console.log(pair[0], {
            name: pair[1].name,
            type: pair[1].type,
            size: pair[1].size,
            lastModified: new Date(pair[1].lastModified).toISOString(),
          });
        } else {
          console.log(pair[0], pair[1]);
        }
      }

      const response = await api.post(`/life-policies/${id}/renew`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
        transformRequest: [(data) => data],
      });

      console.log("[API] Life policy renewal response:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "[API] Error renewing life policy:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  // Status filtering methods for Life Insurance
  getAllPoliciesWithStatus: async (filter = 'all', params = {}) => {
    try {
      console.log(`[API] Fetching Life policies with filter: ${filter}`, params);
      const response = await api.get(`/status-update/test-policies/life/${filter}`, { params });
      console.log(`[API] Life ${filter} policies response:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`[API] Error fetching Life ${filter} policies:`, error);
      throw error;
    }
  },

  getRunningPolicies: async (params = {}) => {
    try {
      console.log("[API] Fetching running Life policies", params);
      const response = await api.get("/status-update/test-policies/life/running", { params });
      console.log("[API] Running Life policies response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching running Life policies:", error);
      throw error;
    }
  },

  getExpiredPolicies: async (params = {}) => {
    try {
      console.log("[API] Fetching expired Life policies", params);
      const response = await api.get("/status-update/test-policies/life/expired", { params });
      console.log("[API] Expired Life policies response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error fetching expired Life policies:", error);
      throw error;
    }
  }
};

// DSC API
export const dscAPI = {
  getAllDSCs: async (params = {}) => {
    try {
      console.log("API Service: Fetching all DSCs", params);
      const queryParams = new URLSearchParams({
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize })
      }).toString();
      const url = queryParams ? `/dsc?${queryParams}` : '/dsc';
      const response = await api.get(url);
      console.log("API Service: DSCs fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching DSCs:", error);
      throw error;
    }
  },

  getDSCById: async (id) => {
    try {
      console.log("API Service: Fetching DSC by ID:", id);
      const response = await api.get(`/dsc/${id}`);
      console.log("API Service: DSC fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching DSC:", error);
      throw error;
    }
  },

  createDSC: async (dscData) => {
    try {
      console.log("API Service: Creating DSC");
      const response = await api.post("/dsc", dscData);
      console.log("API Service: DSC created successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error creating DSC:", error);
      throw error;
    }
  },

  updateDSC: async (id, dscData) => {
    try {
      console.log("API Service: Updating DSC:", id);
      const response = await api.put(`/dsc/${id}`, dscData);
      console.log("API Service: DSC updated successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error updating DSC:", error);
      throw error;
    }
  },

  changeDSCStatus: async (id, status) => {
    try {
      console.log("API Service: Changing DSC status:", id, status);
      const response = await api.patch(`/dsc/${id}/status`, { status });
      console.log("API Service: DSC status changed successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error changing DSC status:", error);
      throw error;
    }
  },

  deleteDSC: async (id) => {
    try {
      console.log("API Service: Deleting DSC:", id);
      const response = await api.delete(`/dsc/${id}`);
      console.log("API Service: DSC deleted successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error deleting DSC:", error);
      throw error;
    }
  },

  getActiveCompanies: async () => {
    try {
      console.log("API Service: Fetching active companies");
      const response = await api.get("/dsc/companies");
      console.log("API Service: Active companies fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching active companies:", error);
      return [];
    }
  },

  getActiveConsumers: async () => {
    try {
      console.log("API Service: Fetching active consumers");
      const response = await api.get("/dsc/consumers");
      console.log("API Service: Active consumers fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching active consumers:", error);
      return [];
    }
  },

  getDSCsByCompany: async (companyId, params = {}) => {
    try {
      console.log("API Service: Fetching DSCs by company:", companyId, params);
      const queryParams = new URLSearchParams({
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize })
      }).toString();
      const url = queryParams ? `/dsc/company/${companyId}?${queryParams}` : `/dsc/company/${companyId}`;
      const response = await api.get(url);
      console.log("API Service: Company DSCs fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching company DSCs:", error);
      throw error;
    }
  },

  getDSCsByConsumer: async (consumerId, params = {}) => {
    try {
      console.log("API Service: Fetching DSCs by consumer:", consumerId, params);
      const queryParams = new URLSearchParams({
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize })
      }).toString();
      const url = queryParams ? `/dsc/consumer/${consumerId}?${queryParams}` : `/dsc/consumer/${consumerId}`;
      const response = await api.get(url);
      console.log("API Service: Consumer DSCs fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching consumer DSCs:", error);
      throw error;
    }
  },

  searchDSCs: async (params) => {
    try {
      console.log("API Service: Searching DSCs with params:", params);
      const response = await api.get("/dsc/search", { params });
      console.log("API Service: DSC search completed successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error searching DSCs:", error);
      throw error;
    }
  },

  getLogs: async () => {
    try {
      const response = await api.get("/dsc-logs/logs");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching DSC logs:", error);
      throw error;
    }
  },
  getDSCStatistics: async () => {
    try {
      const response = await api.get("/dsc/statistics");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Renew DSC (similar to Factory Quotation renewal)
  renewDSC: async (id, data) => {
    try {
      console.log("API Service: Renewing DSC:", id);
      const response = await api.post(`/dsc/${id}/renew`, data);
      console.log("API Service: DSC renewed successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error renewing DSC:", error);
      throw error;
    }
  },

  // Get all DSCs grouped (for renewal page)
  getAllDSCsGrouped: async (params = {}) => {
    try {
      console.log("API Service: Fetching grouped DSCs for renewal", params);
      const queryParams = new URLSearchParams({
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize }),
        ...(params.limit && { limit: params.limit })
      }).toString();
      const url = queryParams ? `/dsc/all-grouped?${queryParams}` : '/dsc/all-grouped';
      
      const response = await api.get(url);
      console.log("API Service: Grouped DSCs fetched successfully");
      return response.data;
    } catch (error) {
      console.error("API Service: Error fetching grouped DSCs:", error);
      throw error;
    }
  }
};

// Renewal API
export const renewalAPI = {
  // Search renewals
  searchRenewals: async (query) => {
    try {
      const response = await api.get('/renewals/search', { params: { query } });
      return response.data;
    } catch (error) {
      console.error('[API] Error searching renewals:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },

  // Get all renewal configurations
  getAllConfigs: async () => {
    const response = await api.get('/renewals/configs');
    return response.data;
  },

  // Get configuration by service type
  getConfigByService: async (serviceType) => {
      const response = await api.get(`/renewals/configs/${serviceType}`);
      return response.data;
  },

  // Create new renewal configuration
  createConfig: async (data) => {
    const response = await api.post('/renewals/configs', data);
      return response.data;
  },

  // Update renewal configuration
  updateConfig: async (id, data) => {
    const response = await api.put(`/renewals/configs/${id}`, data);
      return response.data;
  },

  // Delete renewal configuration
  deleteConfig: async (id) => {
      const response = await api.delete(`/renewals/configs/${id}`);
      return response.data;
  },

  // Get default service types
  getDefaultServiceTypes: async () => {
    const response = await api.get('/renewals/service-types');
      return response.data;
  },

  // Get renewal logs
  getLogs: async () => {
    const response = await api.get('/renewals/logs');
      return response.data;
  },

  // Trigger renewal processing
  triggerRenewals: async () => {
    try {
      const response = await api.post('/renewals/trigger');
      return response.data;
    } catch (error) {
      console.error('[API] Error triggering renewals:', error);
      throw error;
    }
  },

  // Get renewal counts for different periods
  getCounts: async () => {
    try {
      const response = await api.get('/renewals/counts');
      return response.data;
    } catch (error) {
      console.error('[API] Error fetching renewal counts:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },

  // Get live renewal data for dashboard
  getLiveData: async () => {
    try {
      const response = await api.get('/renewals/live-data');
      return response.data;
    } catch (error) {
      console.error('[API] Error fetching live renewal data:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },

  // Get renewals by type and period
  getListByTypeAndPeriod: async (type, period) => {
    try {
      const response = await api.get('/renewals/list', { 
        params: { type, period } 
      });
      return response.data;
    } catch (error) {
      console.error('[API] Error fetching renewals by type and period:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  }
};

export const userRoleWorkLogAPI = {
  getAllLogs: async (params = {}) => {
    try {
      const response = await api.get('/user-role-logs', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getUserRoleWorkLogs: async (page = 1, pageSize = 10, search = '') => {
    try {
      const params = {
        page,
        pageSize,
        limit: pageSize
      };
      if (search && search.trim()) {
        params.search = search.trim();
      }
      const response = await api.get('/user-role-logs', { params });
      return response.data;
    } catch (error) {
      console.error('API Service: Error fetching user role work logs:', error);
      throw error;
    }
  },
  createLog: async (logData) => {
    try {
      const response = await api.post('/user-role-logs', logData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

// Factory Quotation API
export const factoryQuotationAPI = {
  // Get calculation options
  getCalculationOptions: async () => {
    const response = await api.get('/factory-quotations/options');
    return response.data;
  },
  // Calculate amount based on horse power and number of workers
  calculateAmount: async (horsePower, noOfWorkers) => {
    const response = await api.post('/factory-quotations/calculate', {
      horsePower,
      noOfWorkers
    });
    return response.data;
  },
  // Get all quotations
  getAllQuotations: async (params = {}) => {
    const queryParams = new URLSearchParams({
      ...(params.page && { page: params.page }),
      ...(params.pageSize && { pageSize: params.pageSize }),
      ...(params.status && { status: params.status })
    }).toString();
    const url = queryParams ? `/factory-quotations?${queryParams}` : '/factory-quotations';
    const response = await api.get(url);
    return response.data;
  },
  // Search quotations
  searchQuotations: async (query) => {
    try {
      const response = await api.get('/factory-quotations/search', { params: { query } });
      return response.data;
    } catch (error) {
      console.error('[API] Error searching factory quotations:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  // Get quotation by ID
  getQuotationById: async (id) => {
    const response = await api.get(`/factory-quotations/${id}`);
    return response.data;
  },
  // Create quotation
  createQuotation: async (data) => {
    const response = await api.post('/factory-quotations', data);
    return response.data;
  },
  // Update quotation
  updateQuotation: async (id, data) => {
    const response = await api.put(`/factory-quotations/${id}`, data);
    return response.data;
  },
  // Delete quotation
  deleteQuotation: async (id) => {
    const response = await api.delete(`/factory-quotations/${id}`);
    return response.data;
  },
  // Update status
  updateStatus: async (id, statusData) => {
    const response = await api.put(`/factory-quotations/${id}/status`, statusData);
    return response.data;
  },
  // Generate PDF for quotation
  generatePDF: async (id) => {
    const response = await api.post(`/factory-quotations/${id}/generate-pdf`);
    return response.data;
  },
  // Download PDF for quotation
  downloadPDF: async (id) => {
    const response = await api.get(`/factory-quotations/${id}/download-pdf`, {
      responseType: 'blob'
    });
    return response.data;
  },
  // Assign plan manager
  assignPlanManager: async (quotationId, planManagerId) => {
    const response = await api.post('/plan-management', {
      factory_quotation_id: quotationId,
      plan_manager_id: planManagerId
    });
    return response.data;
  },
  // Get statistics
  getStatistics: async () => {
    try {
      const response = await api.get("/factory-quotations/statistics");
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  // Renew factory quotation
  renewQuotation: async (id, data) => {
    try {
      const response = await api.post(`/factory-quotations/${id}/renew`, data);
      return response.data;
    } catch (error) {
      console.error('[API] Error renewing factory quotation:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  // Get previous quotations
  getPreviousQuotations: async (id, params = {}) => {
    try {
      const response = await api.get(`/factory-quotations/${id}/previous`, { params });
      return response.data;
    } catch (error) {
      console.error('[API] Error fetching previous quotations:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  // Get all quotations grouped (running + previous)
  getAllQuotationsGrouped: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams({
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize }),
        ...(params.limit && { limit: params.limit })
      }).toString();
      const url = queryParams ? `/factory-quotations/all-grouped?${queryParams}` : '/factory-quotations/all-grouped';
      
      const response = await api.get(url);
      console.log('[API] Grouped quotations response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API] Error fetching grouped quotations:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  }
};

// Labour Inspection API
export const labourInspectionAPI = {
  // Get all labour inspections with pagination and filters
  getAllInspections: async (params = {}) => {
    const response = await api.get('/labour-inspection', { params });
    return response.data;
  },
  // Get inspection by ID
  getInspectionById: async (id) => {
    const response = await api.get(`/labour-inspection/${id}`);
    return response.data;
  },
  // Create new inspection
  createInspection: async (data) => {
    const response = await api.post('/labour-inspection', data);
    return response.data;
  },
  // Update inspection
  updateInspection: async (id, data) => {
    const response = await api.put(`/labour-inspection/${id}`, data);
    return response.data;
  },
  // Delete inspection
  deleteInspection: async (id) => {
    const response = await api.delete(`/labour-inspection/${id}`);
    return response.data;
  },
  // Get inspections by company ID
  getInspectionsByCompany: async (companyId, params = {}) => {
    const response = await api.get(`/labour-inspection/company/${companyId}`, { params });
    return response.data;
  },
  // Get inspection statistics
  getStatistics: async () => {
    const response = await api.get('/labour-inspection/stats/overview');
    return response.data;
  },
  // Search inspections
  searchInspections: async (query) => {
    try {
      const response = await api.get('/labour-inspection/search', { params: { query } });
      return response.data;
    } catch (error) {
      console.error('[API] Error searching labour inspections:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  }
};

// Labour License API
export const labourLicenseAPI = {
  // Get all labour licenses with pagination and filters
  getAllLicenses: async (params = {}) => {
    const response = await api.get('/labour-license', { params });
    return response.data;
  },
  // Get license by ID
  getLicenseById: async (id) => {
    const response = await api.get(`/labour-license/${id}`);
    return response.data;
  },
  // Create new license
  createLicense: async (data) => {
    const response = await api.post('/labour-license', data);
    return response.data;
  },
  // Update license
  updateLicense: async (id, data) => {
    const response = await api.put(`/labour-license/${id}`, data);
    return response.data;
  },
  // Delete license
  deleteLicense: async (id) => {
    const response = await api.delete(`/labour-license/${id}`);
    return response.data;
  },
  // Get licenses by company ID
  getLicensesByCompany: async (companyId, params = {}) => {
    const response = await api.get(`/labour-license/company/${companyId}`, { params });
    return response.data;
  },
  // Get license statistics
  getStatistics: async () => {
    const response = await api.get('/labour-license/statistics');
    return response.data;
  },
  // Check and update expired licenses
  checkExpiredLicenses: async () => {
    try {
      const response = await api.post('/labour-license/check-expired');
      return response.data;
    } catch (error) {
      console.error('[API] Error checking expired licenses:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  // Search licenses
  searchLicenses: async (query) => {
    try {
      const response = await api.get('/labour-license/search', { params: { query } });
      return response.data;
    } catch (error) {
      console.error('[API] Error searching labour licenses:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  
  // Renew labour license
  renewLicense: async (id, data) => {
    try {
      const response = await api.post(`/labour-license/${id}/renew`, data);
      return response.data;
    } catch (error) {
      console.error('[API] Error renewing labour license:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  
  // Get previous licenses
  getPreviousLicenses: async (id, params = {}) => {
    try {
      const response = await api.get(`/labour-license/${id}/previous`, { params });
      return response.data;
    } catch (error) {
      console.error('[API] Error fetching previous licenses:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  
  // Get all licenses grouped (running + previous)
  getAllLicensesGrouped: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams({
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize }),
        ...(params.limit && { limit: params.limit })
      }).toString();
      const url = queryParams ? `/labour-license/all-grouped?${queryParams}` : '/labour-license/all-grouped';
      
      const response = await api.get(url);
      console.log('[API] Grouped licenses response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API] Error fetching grouped licenses:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  }
};

export const planManagementAPI = {
  // Get plan managers (users with Plan_manager role)
  getPlanManagers: async () => {
    const response = await api.get('/plan-management/managers');
    return response.data;
  },

  // Get all plan management records
  getAllPlanManagement: async () => {
    const response = await api.get('/plan-management');
    return response.data;
  },

  // Search plan management records
  searchPlans: async (query) => {
    try {
      const response = await api.get('/plan-management/search', { params: { query } });
      return response.data;
    } catch (error) {
      console.error('[API] Error searching plan management:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },

  // Get plan management by factory quotation ID
  getPlanManagementByQuotationId: async (quotationId) => {
    const response = await api.get(`/plan-management/quotation/${quotationId}`);
    return response.data;
  },

  // Create plan management (assign to plan manager)
  createPlanManagement: async (data) => {
    const response = await api.post('/plan-management', data);
    return response.data;
  },

  // Submit plan (Plan Manager only)
  submitPlan: async (id) => {
    const response = await api.put(`/plan-management/${id}/submit`);
    return response.data;
  },

  // Update plan status (Plan Manager only)
  updatePlanStatus: async (id, data) => {
    const response = await api.put(`/plan-management/${id}/status`, data);
    return response.data;
  },

  // Review plan (approve/reject) - Admin only
  reviewPlan: async (id, data) => {
    const response = await api.put(`/plan-management/${id}/review`, data);
    return response.data;
  },

  // Upload files for plan - Plan Manager only
  uploadPlanFiles: async (id, formData) => {
    const response = await api.put(`/plan-management/${id}/upload-files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get statistics
  getStatistics: async () => {
    try {
      const response = await api.get("/plan-management/statistics");
      return response.data;
    } catch (error) {
      console.error("Error fetching plan management statistics:", error);
      throw error;
    }
  },
};

export const stabilityManagementAPI = {
  // Get stability managers (users with Stability_manager role)
  getStabilityManagers: async () => {
    const response = await api.get('/stability-management/managers');
    return response.data;
  },

  // Get all stability management records
  getAllStabilityManagement: async (params = {}) => {
    const queryParams = new URLSearchParams({
      ...(params.page && { page: params.page }),
      ...(params.pageSize && { pageSize: params.pageSize })
    }).toString();
    const url = queryParams ? `/stability-management?${queryParams}` : '/stability-management';
    const response = await api.get(url);
    return response.data;
  },

  // Search stability management records
  searchStabilityRecords: async (query) => {
    try {
      const response = await api.get('/stability-management/search', { params: { query } });
    return response.data;
    } catch (error) {
      console.error('[API] Error searching stability management:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },

  // Create stability management (assign to stability manager)
  createStabilityManagement: async (data) => {
    const response = await api.post('/stability-management', data);
    return response.data;
  },

  // Update stability status
  updateStabilityStatus: async (id, data) => {
    const response = await api.put(`/stability-management/${id}/status`, data);
    return response.data;
  },

  // Update stability dates
  updateStabilityDates: async (id, data) => {
    const response = await api.put(`/stability-management/${id}/dates`, data);
    return response.data;
  },

  // Upload files for stability
  uploadStabilityFiles: async (id, formData) => {
    const response = await api.put(`/stability-management/${id}/upload-files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get stability files
  getStabilityFiles: async (id) => {
    const response = await api.get(`/stability-management/${id}/files`);
    return response.data;
  },

  // Delete stability file
  deleteStabilityFile: async (id, filename) => {
    const response = await api.delete(`/stability-management/${id}/files/${filename}`);
    return response.data;
  },

  // Get statistics
  getStatistics: async () => {
    const response = await api.get('/stability-management/statistics');
    return response.data;
  },

  // ===== RENEWAL SYSTEM FUNCTIONS =====

  // Renew stability
  renewStability: async (id, formData) => {
    try {
      console.log('[API] Renewing stability with ID:', id);
      console.log('[API] Form data keys:', Array.from(formData.keys()));
      
      const response = await api.post(`/stability-management/${id}/renew`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('[API] Stability renewal response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API] Error renewing stability:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },

  // Get previous stabilities
  getPreviousStabilities: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams({
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize }),
        ...(params.limit && { limit: params.limit })
      }).toString();
      const url = queryParams ? `/stability-management/previous?${queryParams}` : '/stability-management/previous';
      
      const response = await api.get(url);
      console.log('[API] Previous stabilities response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API] Error fetching previous stabilities:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },

  // Get previous stability by ID
  getPreviousStabilityById: async (id) => {
    try {
      const response = await api.get(`/stability-management/previous/${id}`);
      return response.data;
    } catch (error) {
      console.error('[API] Error fetching previous stability:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },

  // Get all stabilities grouped (running + previous)
  getAllStabilitiesGrouped: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams({
        ...(params.page && { page: params.page }),
        ...(params.pageSize && { pageSize: params.pageSize }),
        ...(params.limit && { limit: params.limit })
      }).toString();
      const url = queryParams ? `/stability-management/all-grouped?${queryParams}` : '/stability-management/all-grouped';
      
      const response = await api.get(url);
      console.log('[API] Grouped stabilities response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API] Error fetching grouped stabilities:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  }
};

export const applicationManagementAPI = {
  // Get compliance managers (users with Compliance_manager role)
  getComplianceManagers: async () => {
    const response = await api.get('/application-management/managers');
    return response.data;
  },

  // Get all application management records
  getAllApplicationManagement: async () => {
    const response = await api.get('/application-management');
    return response.data;
  },

  // Get application management by factory quotation ID
  getApplicationManagementByQuotationId: async (quotationId) => {
    const response = await api.get(`/application-management/quotation/${quotationId}`);
    return response.data;
  },

  // Create application management (assign to compliance manager)
  createApplicationManagement: async (data) => {
    const response = await api.post('/application-management', data);
    return response.data;
  },

  // Update application status (Compliance Manager only)
  updateApplicationStatus: async (id, data) => {
    const response = await api.put(`/application-management/${id}/status`, data);
    return response.data;
  },

  // Upload files for application (Compliance Manager only)
  uploadApplicationFiles: async (id, formData) => {
    const response = await api.put(`/application-management/${id}/upload-files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Renewal Status API
export const renewalStatusAPI = {
  // Get all renewal status records
  getAllRenewalStatus: async () => {
    const response = await api.get('/renewal-status');
    return response.data;
  },

  // Create renewal status record
  createRenewalStatus: async (data) => {
    const response = await api.post('/renewal-status', data);
    return response.data;
  },

  // Update renewal status record
  updateRenewalStatus: async (id, data) => {
    const response = await api.put(`/renewal-status/${id}`, data);
    return response.data;
  },

  // Delete renewal status record
  deleteRenewalStatus: async (id) => {
    const response = await api.delete(`/renewal-status/${id}`);
    return response.data;
  },
};



// Vendor API using VendorService
export const vendorAPI = {
  // Create new vendor
  createVendor: async (vendorData) => {
    try {
      console.log("[API] Creating vendor:", vendorData);
      const response = await api.post('/vendors', vendorData);
      console.log("[API] Vendor creation response:", response.data);
      return response.data;
    } catch (error) {
      console.error("[API] Error creating vendor:", error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },

  // Get all vendors
  getAllVendors: async () => {
    try {
      const response = await api.get('/vendors');
      return response.data;
    } catch (error) {
      console.error('Error fetching vendors:', error);
      throw error;
    }
  },

  // Get vendor by ID
  getVendorById: async (vendorId) => {
    try {
      const response = await api.get(`/vendors/${vendorId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching vendor:', error);
      throw error;
    }
  },

  // Update vendor
  updateVendor: async (vendorId, vendorData) => {
    try {
      const response = await api.put(`/vendors/${vendorId}`, vendorData);
      return response.data;
    } catch (error) {
      console.error('Error updating vendor:', error);
      throw error;
    }
  },

  // Delete vendor
  deleteVendor: async (vendorId) => {
    try {
      const response = await api.delete(`/vendors/${vendorId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting vendor:', error);
      throw error;
    }
  },
};

// Document Download API
export const documentDownloadAPI = {
  // Download a specific document
  downloadDocument: async (system, recordId, documentType, filename) => {
    const response = await api.get(`/documents/${system}/${recordId}/${documentType}/${filename}`, {
      responseType: 'blob'
    });
    return response;
  },

  // Get list of documents for a record
  getDocumentList: async (system, recordId) => {
    const response = await api.get(`/documents/${system}/${recordId}`);
    return response.data;
  }
};

export default api;
