import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./pages/home";
import Login from "./pages/login";
import SuperAdmin from "./pages/superAdmin";   
import UniversityAdmin from "./pages/admin";
import Staff from "./pages/staff";
import ActivationPage from "./pages/ActivationPage";

function App() {
  return (
    <Router>
      <Routes>

        {/* Home page */}
        <Route path="/" element={<Home />} />

        {/* Login page */}
        <Route path="/login" element={<Login />} />

        {/* Super-admin dashboard */}
        <Route path="/admin" element={<SuperAdmin />} />

        <Route path="/university-admin" element={<UniversityAdmin />} />

        <Route path="/staff" element={<Staff />} />

        <Route path="/activate-account" element={<ActivationPage />} />

      </Routes>
    </Router>
  );
}

export default App;