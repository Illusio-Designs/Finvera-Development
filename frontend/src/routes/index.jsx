import { createBrowserRouter, RouterProvider } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import PublicLayout from "../layouts/PublicLayout";
import AuthLayout from "../layouts/AuthLayout";
import Login from "../pages/dashboard/auth/Login";
import Register from "../pages/dashboard/auth/Register";
import ForgotPassword from "../pages/dashboard/auth/ForgotPassword";
import ResetPassword from "../pages/dashboard/auth/ResetPassword";
import CombinedDashboard from "../pages/dashboard/home/CombinedDashboard";
import Unauthorized from "../pages/dashboard/auth/Unauthorized";
import RoleManagement from "../pages/dashboard/roles/RoleManagement";
import CompanyUsers from "../pages/dashboard/users/CompanyUsers";
import ConsumerUsers from "../pages/dashboard/users/ConsumerUsers";
import OtherUsers from "../pages/dashboard/users/OtherUsers";
import CompanyList from "../pages/dashboard/companies/CompanyList";
import ConsumerList from "../pages/dashboard/consumers/ConsumerList";
import ProtectedRoute from "../components/ProtectedRoute";
import Profile from "../pages/dashboard/profile/Profile";
import ChangePassword from "../pages/dashboard/auth/ChangePassword";
import Support from "../pages/dashboard/support/Support";
import Widget from "../pages/dashboard/widget/widget";
import ECP from "../pages/dashboard/insurance/ECP";
import Health from "../pages/dashboard/insurance/Health";
import Fire from "../pages/dashboard/insurance/Fire";
import Vehicle from "../pages/dashboard/insurance/Vehicle";
import Companies from "../pages/dashboard/insurance/Companies";
import FactoryQuotation from "../pages/dashboard/compliance/FactoryQuotation";
import LabourInspection from "../pages/dashboard/labour/Inspection";
import LabourLicense from "../pages/dashboard/labour/License";
import DSC from "../pages/dashboard/dsc/DSC";
import NotFound from "../pages/NotFound";
import Home from "../pages/Home";
import About from "../pages/About";
import Insurance from "../pages/Insurance";
import Compliance from "../pages/Compliance";
import Contact from "../pages/Contact";
import Blog from "../pages/Blog";
import Bloginner from "../pages/Bloginner";
import ServiceDetail from "../pages/ServiceDetail";

const router = createBrowserRouter(
  [
    // Public Routes
    {
      path: "/",
      element: <PublicLayout />,
      children: [
        {
          index: true,
          element: <Home />,
        },
        {
          path: "/about",
          element: <About />,
        },
        {
          path: "/insurance",
          element: <Insurance />,
        },
        {
          path: "/compliance",
          element: <Compliance />,
        },
        {
          path: "/contact",
          element: <Contact />,
        },
        {
          path: "/blog",
          element: <Blog />,
        },
        {
          path: "/bloginner",
          element: <Bloginner />,
        },
        {
          path: "/:category/:slug",
          element: <ServiceDetail />,
        },
        {
          path: "unauthorized",
          element: <Unauthorized />,
        },
        {
          path: "*",
          element: <NotFound />,
        },
      ],
    },
    // Auth Routes
    {
      path: "/",
      element: <AuthLayout />,
      children: [
        {
          path: "login",
          element: <Login />,
        },
        {
          path: "register",
          element: <Register />,
        },
        {
          path: "forgot-password",
          element: <ForgotPassword />,
        },
        {
          path: "reset-password/:token",
          element: <ResetPassword />,
        },
      ],
    },
    // Dashboard Routes (Protected)
    {
      path: "/dashboard",
      element: (
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      ),
    },
    {
      path: "/dashboard/*",
      element: (
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      ),
    },
    // Exclude health check endpoint from frontend routing
    {
      path: "/health",
      element: null,
    },
    {
      path: "/api/health",
      element: null,
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

// Create a wrapper component that uses the router with future flags
export const Router = () => {
  return (
    <RouterProvider
      router={router}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    />
  );
};

export { router };
export default router;
