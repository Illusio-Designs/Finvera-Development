import { Outlet } from "react-router-dom";
import "../styles/layout/PublicLayout.css";
import FloatingContact from "../components/FloatingContact";

const PublicLayout = () => {
  return (
    <div className="public-layout">
      <FloatingContact />
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default PublicLayout;
