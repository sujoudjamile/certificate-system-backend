import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, RefreshCw, LogOut, Plus } from "lucide-react";
import { GraduationCap } from "lucide-react";
import "./SuperAdmin.css";

/* ────────────────────────────────
   Navbar Component
──────────────────────────────── */
function AdminNavbar({ onSignOut, onRefresh }) {
  return (
    <nav className="admin-nav">
      <div className="admin-nav__brand">
        <div className="admin-nav__logo">
          <Crown size={22} />
        </div>
        <div className="admin-nav__titles">
          <h2 className="admin-nav__title">System Administration</h2>
          <p className="admin-nav__subtitle">CertifyLB — Lebanese University Network</p>
        </div>
      </div>
      <div className="admin-nav__actions">
        <button className="admin-nav__icon-btn" onClick={onRefresh} title="Refresh">
          <RefreshCw size={20} />
        </button>
        <button className="admin-nav__signout" onClick={onSignOut}>
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </nav>
  );
}

/* ────────────────────────────────
   Stats Row Component
──────────────────────────────── */
function StatsRow({ adminCount }) {
  return (
    <div className="admin-stats">
      <div className="stat-card">
        <span className="stat-card__label">Registered Universities</span>
        <span className="stat-card__number">{adminCount}</span>
      </div>
      <div className="stat-card stat-card--active">
        <span className="stat-card__label">System Status</span>
        <div className="stat-card__status">
          <span className="stat-card__dot" /> Operational
        </div>
      </div>
      <div className="stat-card stat-card--secure">
        <span className="stat-card__label">Security Level</span>
        <span className="stat-card__secure">SHA-256 Encrypted</span>
      </div>
    </div>
  );
}

/* ────────────────────────────────
   Admin List Component
──────────────────────────────── */
function AdminList({ admins }) {
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
    } catch (err) {
      console.error(err);
      alert("Failed to resend activation email");
    }
  };

  if (!admins || admins.length === 0) {
    return <p className="admin-empty-text">No admins found.</p>;
  }

  return (
    <div className="admin-cards">
      {admins.map((admin) => {
        const now = new Date();
        const expired =
          admin.verification_expires &&
          now > new Date(admin.verification_expires);

        const status = admin.is_verified
          ? "Activated"
          : expired
          ? "Expired"
          : "Pending";

        return (
          <div
            key={admin.id}
            className={`admin-card ${expired ? "expired" : ""}`}
          >
            {/* LEFT SIDE */}
            <div className="admin-left">
              <div className="admin-title-row">
                <GraduationCap className="admin-icon" size={22} />
                <h2 className="admin-name">{admin.university_name}</h2>
              </div>

              <p className="admin-email">{admin.name}</p>
              <p className="admin-uni">{admin.email}</p>
            </div>
            {/* RIGHT SIDE */}
            <div className="admin-right">
              <span
                className={`status-badge ${
                  status === "Activated"
                    ? "verified"
                    : status === "Expired"
                    ? "expired"
                    : "pending"
                }`}
              >
                {status}
              </span>

              {expired && (
                <button
                  className="resend-btn"
                  onClick={() => handleResend(admin.email)}
                >
                  Resend Token
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
/* ────────────────────────────────
   Register University Modal
──────────────────────────────── */
function RegisterUniversityModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !adminName || !email) {
      alert("All fields are required");
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/universities", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ universityName: name, adminName, adminEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create university");
      onSubmit({ id: data.universityId, name, adminName, email });
      alert("University created successfully ✅");
      setName(""); setAdminName(""); setEmail("");
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h2>Register New University</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label>University Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. American University of Beirut" />
          <label>Admin Name</label>
          <input type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="e.g. Dr. Ahmad Khalil" />
          <label>Admin Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@university.edu.lb" />
          <button className="modal-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? "Registering..." : "Register & Send Verification Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────
   Main SuperAdmin Page
──────────────────────────────── */
export default function SuperAdmin() {
  const navigate = useNavigate();
  const [admins, setAdmins] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSignOut = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const fetchAdmins = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/users/admins", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      console.log("Admins:", data);
      if (res.ok) setAdmins(data.admins || []);
    } catch (err) {
      console.error("Failed to fetch admins:", err);
    }
  };

  useEffect(() => { fetchAdmins(); }, []);

  return (
    <div className="admin-dashboard">
      <AdminNavbar onSignOut={handleSignOut} onRefresh={fetchAdmins} />
      <main className="admin-body">
        <StatsRow adminCount={admins.length} />
        <div className="admin-section-header">
          <h2>Registered Universities</h2>
          <button className="btn-register-uni"onClick={() => setIsModalOpen(true)}>
            <Plus size={17} /> Register University
          </button>
        </div>
        <AdminList admins={admins} />
      </main>
      {isModalOpen && <RegisterUniversityModal onClose={() => setIsModalOpen(false)} onSubmit={fetchAdmins} />}
    </div>
  );
}