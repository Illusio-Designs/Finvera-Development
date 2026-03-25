import { useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import Header from "../components/dashboard/Header";
import Footer from "../components/dashboard/Footer";
import "../styles/layout/DashboardLayout.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../contexts/AuthContext";

// Import all dashboard pages
import CombinedDashboard from "../pages/dashboard/home/CombinedDashboard";
import Profile from "../pages/dashboard/profile/Profile";
import ChangePassword from "../pages/dashboard/auth/ChangePassword";
import Support from "../pages/dashboard/support/Support";
import RoleManagement from "../pages/dashboard/roles/RoleManagement";
import Widget from "../pages/dashboard/widget/widget";
import CompanyUsers from "../pages/dashboard/users/CompanyUsers";
import ConsumerUsers from "../pages/dashboard/users/ConsumerUsers";
import OtherUsers from "../pages/dashboard/users/OtherUsers";
import CompanyList from "../pages/dashboard/companies/CompanyList";
import ConsumerList from "../pages/dashboard/consumers/ConsumerList";
import ECP from "../pages/dashboard/insurance/ECP";
import Health from "../pages/dashboard/insurance/Health";
import Fire from "../pages/dashboard/insurance/Fire";
import Vehicle from "../pages/dashboard/insurance/Vehicle";
import Life from "../pages/dashboard/insurance/Life";
import Companies from "../pages/dashboard/insurance/Companies";
import FactoryQuotation from "../pages/dashboard/compliance/FactoryQuotation";
import LabourInspection from "../pages/dashboard/labour/Inspection";
import LabourLicense from "../pages/dashboard/labour/License";
import PlanManagement from "../pages/dashboard/compliance/PlanManagement";
import StabilityManagement from "../pages/dashboard/compliance/StabilityManagement";
import DSC from "../pages/dashboard/dsc/DSC";
import DSCLogs from "../pages/dashboard/logs/DSCLogs";
import RenewalDashboard from "../pages/dashboard/renewals/RenewalDashboard";
import RenewalLog from "../pages/dashboard/renewals/RenewalLog";
import FactoryQuotationRenewal from "../pages/dashboard/compliance/FactoryQuotationRenewal";
import UserRoleWorkLog from "../pages/dashboard/roles/UserRoleWorkLog";
import BlogManagement from "../pages/dashboard/blog/BlogManagement";
import ContactInquiries from "../pages/dashboard/contact/ContactInquiries";

function DashboardLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const { user } = useAuth();

  // Example notifications data
  const notifications = [
    { id: 1, text: "New user registered", time: "5 min ago" },
    { id: 2, text: "Server update completed", time: "1 hour ago" },
    { id: 3, text: "New report available", time: "3 hours ago" },
  ];

  // Example profile menu items
  const profileMenuItems = [
    { id: "profile", label: "Profile" },
    { id: "settings", label: "Settings" },
    { id: "logout", label: "Logout" },
  ];

  const handleProfileAction = (itemId) => {
    console.log(`Profile action: ${itemId}`);
    // Handle profile actions like logout, etc.
  };

  const handleSidebarCollapse = (collapsed) => {
    setIsCollapsed(collapsed);
  };

  const handleToggleSidebar = (collapsed) => {
    setIsCollapsed(collapsed);
  };

  // Function to render the appropriate page based on the current route
  const renderPage = () => {
    const path = location.pathname;

    // Role-based access control
    const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
    const isRole = (role) => userRoles.includes(role.toLowerCase());

    // Plan Management - accessible to plan_manager, admin, and compliance_manager
    if (path === "/dashboard/compliance/plan-management") {
      if (!isRole("plan_manager") && !isRole("admin") && !isRole("compliance_manager")) {
        return <Navigate to="/dashboard" replace />;
      }
    }

    // Stability Management - accessible to stability_manager, admin, and compliance_manager
    if (path === "/dashboard/compliance/stability-management") {
      if (!isRole("stability_manager") && !isRole("admin") && !isRole("compliance_manager")) {
        return <Navigate to="/dashboard" replace />;
      }
    }

    switch (path) {
      case "/dashboard":
      case "/dashboard/admin":
      case "/dashboard/company":
      case "/dashboard/consumer":
        return <CombinedDashboard />;
      case "/dashboard/profile":
        return <Profile />;
      case "/dashboard/change-password":
        return <ChangePassword />;
      case "/dashboard/support":
        return <Support />;
      case "/dashboard/roles":
        return <RoleManagement />;
      case "/dashboard/widget":
        return <Widget />;
      case "/dashboard/users/company":
        return <CompanyUsers searchQuery={searchQuery} />;
      case "/dashboard/users/consumer":
        return <ConsumerUsers searchQuery={searchQuery} />;
      case "/dashboard/users/other":
        return <OtherUsers searchQuery={searchQuery} />;
      case "/dashboard/companies":
        return <CompanyList searchQuery={searchQuery} />;
      case "/dashboard/consumers":
        return <ConsumerList searchQuery={searchQuery} />;
      case "/dashboard/insurance/ECP":
        return <ECP searchQuery={searchQuery} />;
      case "/dashboard/insurance/health":
        return <Health searchQuery={searchQuery} />;
      case "/dashboard/insurance/fire":
        return <Fire searchQuery={searchQuery} />;
      case "/dashboard/insurance/vehicle":
        return <Vehicle searchQuery={searchQuery} />;
      case "/dashboard/insurance/life":
        return <Life searchQuery={searchQuery} />;
      case "/dashboard/insurance/companies":
        return <Companies searchQuery={searchQuery} />;
      case "/dashboard/compliance/factory-quotation":
        return <FactoryQuotation searchQuery={searchQuery} />;
      case "/dashboard/labour/inspection":
        return <LabourInspection searchQuery={searchQuery} />;
      case "/dashboard/labour/license":
        return <LabourLicense searchQuery={searchQuery} />;
      case "/dashboard/compliance/plan-management":
        return <PlanManagement searchQuery={searchQuery} />;
      case "/dashboard/compliance/stability-management":
        return <StabilityManagement searchQuery={searchQuery} />;
      case "/dashboard/dsc":
        return <DSC searchQuery={searchQuery} />;
      case "/dashboard/dsc/logs":
        return <DSCLogs searchQuery={searchQuery} />;
      case "/dashboard/renewals/dashboard":
        return <RenewalDashboard />;
      case "/dashboard/renewals/log":
        return <RenewalLog />;
      case "/dashboard/compliance/factory-quotation-renewal":
        return <FactoryQuotationRenewal />;
      case "/dashboard/logs/user-role-work-log":
        return <UserRoleWorkLog searchQuery={searchQuery} />;
      case "/dashboard/blog":
        return <BlogManagement />;
      case "/dashboard/contact-inquiries":
        return <ContactInquiries />;
      default:
        return <CombinedDashboard />;
    }
  };

  return (
    <div className="dashboard-container">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      <div className="dashboard-layout">
        <aside
          className={`dashboard-sidebar ${isCollapsed ? "collapsed" : ""}`}
        >
          <Sidebar onCollapse={handleSidebarCollapse} isCollapsed={isCollapsed} />
        </aside>

        <div className="dashboard-main-content">
          <header className="dashboard-header">
            <Header
              isCollapsed={isCollapsed}
              notifications={notifications}
              showNotifications={showNotifications}
              setShowNotifications={setShowNotifications}
              onProfileAction={handleProfileAction}
              profileMenuItems={profileMenuItems}
              onSearch={setSearchQuery}
              onToggleSidebar={handleToggleSidebar}
            />
          </header>

          <main className="dashboard-main">
            <div className="dashboard-content">{renderPage()}</div>
          </main>

          <footer className="dashboard-footer">
            <Footer isCollapsed={isCollapsed} />
          </footer>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
