import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

console.log("AuthContext: Initializing context");

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log("AuthContext: Setting up provider with initial state:", {
    user,
    loading,
    error,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("AuthContext: No token found, skipping auth check");
        setLoading(false);
        return;
      }

      console.log("AuthContext: Checking authentication with token");
      const response = await api.get("/auth/me");
      console.log("AuthContext: User data from /me endpoint:", response.data);

      // Extract user data from the response
      if (response.data && response.data.user) {
        setUser(response.data.user);
        console.log("AuthContext: User data set from /me endpoint");
      } else {
        console.error("AuthContext: Invalid response format from /me endpoint");
        localStorage.removeItem("token");
      }
    } catch (error) {
      console.error("AuthContext: Auth check error:", error);
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      console.log("AuthContext: Starting login process for:", email);
      setError(null);
      const response = await api.post("/auth/login", { email, password });
      const { token, user } = response.data;

      console.log("AuthContext: Login response:", { token, user });

      localStorage.setItem("token", token);
      setUser(user);

      return user;
    } catch (error) {
      console.error("AuthContext: Login error:", error);
      setError(error.response?.data?.error || "Login failed");
      throw error;
    }
  };

  const loginWithGoogle = (user, token) => {
    try {
      localStorage.setItem("token", token);
      setUser(user);
    } catch (error) {
      console.error("AuthContext: Google login error:", error);
      setError("Google login failed");
      throw error;
    }
  };

  const register = async (username, email, password, role_id = 2) => {
    try {
      console.log("AuthContext: Starting registration process for:", email);
      setError(null);
      const response = await api.post("/auth/register", { 
        username, 
        email, 
        password, 
        role_id 
      });
      
      console.log("AuthContext: Registration response:", response.data);
      
      // Registration successful, but don't auto-login
      // User needs to login manually after registration
      return response.data;
    } catch (error) {
      console.error("AuthContext: Registration error:", error);
      setError(error.response?.data?.error || "Registration failed");
      throw error;
    }
  };

  const logout = () => {
    console.log("AuthContext: Logging out user");
    localStorage.removeItem("token");
    setUser(null);
  };
  // Helper: get all roles as lowercase (supports string or object)
  const userRoles = user?.roles
    ? user.roles.map((r) =>
        typeof r === "string"
          ? r.toLowerCase()
          : r.role_name
          ? r.role_name.toLowerCase()
          : ""
      )
    : [];
  const hasRole = (role) => userRoles.includes(role.toLowerCase());

  const value = {
    user,
    loading,
    error,
    login,
    loginWithGoogle,
    register,
    logout,
    isAuthenticated: !!user,
    hasRole,
    userRoles,
    isAdmin: hasRole("admin"),
    isCompany: hasRole("company"),
    isConsumer: hasRole("consumer"),
    isVendorManager: hasRole("vendor_manager"),
    isUserManager: hasRole("user_manager"),
    isInsuranceManager: hasRole("insurance_manager"),
    isComplianceManager: hasRole("compliance_manager"),
    isDSCManager: hasRole("dsc_manager"),
  };

  console.log("AuthContext: Providing context value:", value);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
