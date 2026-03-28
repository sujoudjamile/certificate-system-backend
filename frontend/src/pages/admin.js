import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  GraduationCap,
  Users,
  User,
  AlertTriangle,
  Bell,
  Shield,
  RefreshCw,
  LogOut,
  ChevronRight,
  Plus,
  CheckCircle2,
} from "lucide-react";
import "./Admin.css";

/* ─── NAVBAR ─── */
function UniNavbar({ universityName, adminName, onSignOut }) {
  return (
    <nav className="uni-nav">
      <div className="uni-nav__brand">
        <div className="uni-nav__logo">
          <GraduationCap size={24} />
        </div>
        <div className="uni-nav__titles">
          <h2 className="uni-nav__title">{universityName}</h2>
          <p className="uni-nav__subtitle">Admin Dashboard · {adminName}</p>
        </div>
      </div>
      <div className="uni-nav__actions">
        <button className="uni-nav__icon-btn">
          <Bell size={20} />
        </button>
        <button
          className="uni-nav__icon-btn"
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={20} />
        </button>
        <button className="uni-nav__signout" onClick={onSignOut}>
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </nav>
  );
}

/* ─── TAB BAR ─── */
function TabBar({ activeTab, onChange, staffCount }) {
  return (
    <div className="uni-tabs">
      <button
        className={`uni-tab ${activeTab === "overview" ? "active" : ""}`}
        onClick={() => onChange("overview")}
      >
        <Shield size={16} /> Overview
      </button>
      <button
        className={`uni-tab ${activeTab === "staff" ? "active" : ""}`}
        onClick={() => onChange("staff")}
      >
        <Users size={16} /> Staff ({staffCount})
      </button>
      <button
        className={`uni-tab ${activeTab === "alerts" ? "active" : ""}`}
        onClick={() => onChange("alerts")}
      >
        <AlertTriangle size={16} /> Alerts
      </button>
    </div>
  );
}

/* ─── STATS ROW ─── */
function StatsRow({ staffCount }) {
  return (
    <div className="uni-stats">
      <div className="uni-stat uni-stat--blue">
        <div className="uni-stat__icon uni-stat__icon--blue">
          <Users size={28} />
        </div>
        <p className="uni-stat__label">Staff Members</p>
        <p className="uni-stat__value">{staffCount}</p>
      </div>

      <div className="uni-stat uni-stat--red">
        <div className="uni-stat__icon uni-stat__icon--red">
          <AlertTriangle size={28} />
        </div>
        <p className="uni-stat__label">Fraud Alerts</p>
        <p className="uni-stat__value">0</p>
      </div>

      <div className="uni-stat uni-stat--dark">
        <div className="uni-stat__icon uni-stat__icon--amber">
          <Bell size={28} />
        </div>
        <p className="uni-stat__label">Unread Alerts</p>
        <p className="uni-stat__value">0</p>
      </div>

      <div className="uni-stat uni-stat--teal">
        <div className="uni-stat__icon uni-stat__icon--green">
          <Shield size={28} />
        </div>
        <p className="uni-stat__label">Security Status</p>
        <p className="uni-stat__value--active">Active</p>
      </div>
    </div>
  );
}

/* ─── QUICK ACTIONS ─── */
function QuickActions({ onAddStaff, onViewAlerts }) {
  return (
    <div className="uni-panel">
      <h3 className="uni-panel__title">Quick Actions</h3>
      <button className="uni-action" onClick={onAddStaff}>
        <span className="uni-action__left">
          <Plus size={18} className="uni-action__icon--plus" /> Add New Staff Member
        </span>
        <ChevronRight size={18} />
      </button>

      <button className="uni-action" onClick={onViewAlerts}>
        <span className="uni-action__left">
          <AlertTriangle size={18} className="uni-action__icon--alert" /> View Fraud Alerts
        </span>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

/* ─── RECENT ALERTS ─── */
function RecentAlerts({ alerts }) {
  return (
    <div className="uni-panel">
      <h3 className="uni-panel__title">Recent Alerts</h3>
      {alerts.length === 0 ? (
        <div className="uni-alerts-empty">
          <CheckCircle2 size={52} />
          <p>No fraud alerts detected</p>
        </div>
      ) : (
        alerts.map((a, i) => (
          <div key={i} className="uni-action">{a.message}</div>
        ))
      )}
    </div>
  );
}

/* ─── ADD STAFF MODAL ─── */
function AddStaffModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email) return alert("Please fill all fields");
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        "http://localhost:5000/api/staff",
        { name, email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      onSubmit({ 
        id: res.data.staffId, 
        name, 
        email, 
        is_verified: false, 
        verification_expires: res.data.verification_expires,
        university_name: res.data.university_name
      });
      alert("Staff member added successfully! ✅");
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h2>Add New Staff Member</h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>
        <div className="modal-body">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="modal-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? "Adding..." : "Add Staff"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── STAFF CARDS ─── */
function StaffCards({ staffList, handleResend }) {
  if (!staffList || staffList.length === 0) {
    return <p className="staff-empty-text">No staff added yet.</p>;
  }

  return (
    <div className="admin-cards">
      {staffList.map((staff) => {
        const now = new Date();
        const expired = staff.verification_expires && new Date(staff.verification_expires) < now;

        let status = "Pending";
        if (staff.is_verified) status = "Active";
        else if (expired) status = "Inactive";

        return (
          <div
            key={staff.id}
            className={`admin-card ${status === "Inactive" ? "expired" : ""}`}
          >
            <div className="admin-left">
              <div className="admin-title-row">
                <User className="admin-icon" size={22} />
                <h2 className="admin-name">{staff.name}</h2>
              </div>
              <p className="admin-email">{staff.email}</p>
              <p className="admin-uni">{staff.university_name}</p>
            </div>

            <div className="admin-right">
              <span
                className={`status-badge ${
                  status === "Active"
                    ? "verified"
                    : status === "Inactive"
                    ? "expired"
                    : "pending"
                }`}
              >
                {status}
              </span>

              {status === "Inactive" && (
                <button
                  className="resend-btn"
                  onClick={() => handleResend(staff.email)}
                >
                  Resend Activation
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function UniversityAdmin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const alerts = [];

  /* Fetch current admin */
  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdmin(res.data.user);
    } catch (err) {
      console.error("Failed to fetch admin:", err);
    } finally {
      setLoadingAdmin(false);
    }
  };

  /* Fetch staff of the same university */
  const fetchStaff = async () => {
    if (!admin) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/staff/staffs", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const staff = res.data.staffs
        .filter((s) => s.university_name === admin.university_name)
        .map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          is_verified: s.is_verified,
          verification_expires: s.verification_expires,
          university_name: s.university_name,
        }));

      setStaffList(staff);
    } catch (err) {
      console.error("Failed to fetch staff:", err);
      if (err.response?.status === 401) navigate("/login");
    }
  };

  /* Resend activation email */
  const handleResend = async (email) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/users/resend-activation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      alert(data.message || "Activation email sent!");
      fetchStaff(); // refresh staff list after resend
    } catch (err) {
      console.error(err);
      alert("Failed to resend activation email");
    }
  };

  useEffect(() => { fetchCurrentUser(); }, []);
  useEffect(() => { if (admin) fetchStaff(); }, [admin]);

  if (loadingAdmin) return <div className="loading">Loading admin info...</div>;

  return (
    <div className="uni-dashboard">
      <UniNavbar
        universityName={admin?.university_name ?? "No University Assigned"}
        adminName={admin?.name ?? "Unknown Admin"}
        onSignOut={() => { localStorage.removeItem("token"); navigate("/login"); }}
      />

      <main className="uni-body">
        <TabBar activeTab={activeTab} onChange={setActiveTab} staffCount={staffList.length} />

        {activeTab === "overview" && (
          <>
            <StatsRow staffCount={staffList.length} />
            <div className="uni-bottom">
              <QuickActions
                onAddStaff={() => setIsModalOpen(true)}
                onViewAlerts={() => setActiveTab("alerts")}
              />
              <RecentAlerts alerts={alerts} />
            </div>
          </>
        )}

       {activeTab === "staff" && (
          <>
            <h3 >Staff Member</h3>
            <StaffCards staffList={staffList} handleResend={handleResend} />
          </>
        )}

        {activeTab === "alerts" && <RecentAlerts alerts={alerts} />}
      </main>

      {isModalOpen && (
        <AddStaffModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={(staff) => setStaffList((prev) => [...prev, staff])}
        />
      )}
    </div>
  );
}