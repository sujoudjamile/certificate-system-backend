import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, RefreshCw, LogOut, Plus, UserPlus, GraduationCap } from "lucide-react";
import "./SuperAdmin.css";

const API = "http://localhost:5000/api";
const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

/* ─────────────────────────────────────────────
   HELPERS — coerce MySQL 0/1 to real booleans
───────────────────────────────────────────── */
const isActive   = (v) => v === 1 || v === true;
const isVerified = (v) => v === 1 || v === true;

function getStatus(admin) {
  if (!isActive(admin.is_active)) return "deactivated";
  if (!isVerified(admin.is_verified)) {
    const expired =
      admin.verification_expires && new Date() > new Date(admin.verification_expires);
    return expired ? "expired" : "pending";
  }
  return "active";
}

/* ─────────────────────────────────────────────
   NAVBAR
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   STATS ROW
───────────────────────────────────────────── */
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
        <span className="stat-card__secure">SHA-256 Encrypted & X.509</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ADMIN CARD
───────────────────────────────────────────── */
function AdminCard({ admin, onRefresh }) {
  const status   = getStatus(admin);
  const active   = isActive(admin.is_active);
  const verified = isVerified(admin.is_verified);

  const handleResend = async () => {
    try {
      const res = await fetch(`${API}/users/resend-activation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader().headers },
        body: JSON.stringify({ email: admin.email }),
      });
      const data = await res.json();
      alert(data.message || "Activation email sent!");
    } catch {
      alert("Failed to resend activation email");
    }
  };

  const handleToggle = async () => {
    const action = active ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${admin.name}'s account?`)) return;
    try {
      const res = await fetch(`${API}/users/admins/${admin.id}/toggle-status`, {
        method: "PATCH",
        headers: authHeader().headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const cardClass = [
    "admin-card",
    status === "expired"     ? "expired"     : "",
    status === "deactivated" ? "deactivated" : "",
  ].filter(Boolean).join(" ");

  const badgeClass = [
    "status-badge",
    status === "active"      ? "verified"    : "",
    status === "pending"     ? "pending"     : "",
    status === "expired"     ? "expired"     : "",
    status === "deactivated" ? "deactivated" : "",
  ].filter(Boolean).join(" ");

  const statusLabel = {
    active:      "Active",
    pending:     "Pending",
    expired:     "Expired",
    deactivated: "Deactivated",
  }[status];

  return (
    <div className={cardClass}>
      {/* Left */}
      <div className="admin-left">
        <div className="admin-title-row">
          <GraduationCap
            className="admin-icon"
            size={22}
            style={{ opacity: active ? 1 : 0.4 }}
          />
          <h2 className="admin-name" style={{ opacity: active ? 1 : 0.5 }}>
            {admin.university_name}
          </h2>
        </div>
        <p className="admin-email">{admin.name}</p>
        <p className="admin-uni">{admin.email}</p>
      </div>

      {/* Right */}
      <div className="admin-right">
        <span className={badgeClass}>{statusLabel}</span>

        {/* Toggle active/inactive — only for verified admins */}
        {verified && (
          <button
            className={`resend-btn ${active ? "btn-deactivate" : "btn-activate"}`}
            onClick={handleToggle}
          >
            {active ? "Deactivate" : "Activate"}
          </button>
        )}

        {/* Resend token — only for unverified active accounts */}
        {!verified && active && (
          <button className="resend-btn" onClick={handleResend}>
            Resend Token
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ADMIN LIST
───────────────────────────────────────────── */
function AdminList({ admins, onRefresh }) {
  if (!admins || admins.length === 0)
    return <p className="admin-empty-text">No admins found.</p>;

  return (
    <div className="admin-cards">
      {admins.map((admin) => (
        <AdminCard key={admin.id} admin={admin} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   REGISTER NEW UNIVERSITY MODAL
───────────────────────────────────────────── */
function RegisterUniversityModal({ onClose, onSubmit }) {
  const [name,      setName]      = useState("");
  const [adminName, setAdminName] = useState("");
  const [email,     setEmail]     = useState("");
  const [loading,   setLoading]   = useState(false);

  const handleSubmit = async () => {
    if (!name || !adminName || !email) { alert("All fields are required"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/universities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader().headers },
        body: JSON.stringify({ universityName: name, adminName, adminEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      alert("University registered successfully ✅");
      onSubmit();
      onClose();
    } catch (err) {
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
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. American University of Beirut" />
          <label>Admin Name</label>
          <input value={adminName} onChange={e => setAdminName(e.target.value)}
            placeholder="e.g. Dr. Ahmad Khalil" />
          <label>Admin Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="admin@university.edu.lb" />
          <button className="modal-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? "Registering..." : "Register & Send Verification Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ADD ADMIN TO EXISTING UNIVERSITY MODAL
───────────────────────────────────────────── */
function AddAdminModal({ onClose, onSubmit, admins }) {
  const [universities, setUniversities] = useState([]);
  const [uniId,        setUniId]        = useState("");
  const [adminName,    setAdminName]    = useState("");
  const [email,        setEmail]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [fetching,     setFetching]     = useState(true);

  const takenUniIds = useMemo(() => {
    const s = new Set();
    (admins || []).forEach(a => {
      if (isActive(a.is_active)) s.add(String(a.university_id));
    });
    return s;
  }, [admins]);

  const availableUniversities = useMemo(
    () => universities.filter(u => !takenUniIds.has(String(u.id))),
    [universities, takenUniIds]
  );

  useEffect(() => {
    fetch(`${API}/universities`, { headers: authHeader().headers })
      .then(r => r.json())
      .then(d => setUniversities(d.universities || []))
      .catch(() => alert("Failed to load universities"))
      .finally(() => setFetching(false));
  }, []);

  const selectedUni = universities.find(u => String(u.id) === String(uniId));

  const handleSubmit = async () => {
    if (!uniId || !adminName || !email) { alert("All fields are required"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/admins/add-to-university`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader().headers },
        body: JSON.stringify({ adminName, adminEmail: email, university_id: uniId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      alert(data.message);
      onSubmit();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h2>Add Admin to University</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {fetching ? (
            <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
              Loading universities…
            </p>
          ) : availableUniversities.length === 0 ? (
            <div style={{
              padding: "24px 20px", borderRadius: 14, textAlign: "center",
              background: "rgba(232,24,14,0.07)",
              border: "1px solid rgba(232,24,14,0.22)",
            }}>
              <p style={{ color: "#ff9090", fontWeight: 700, margin: "0 0 8px", fontSize: 15 }}>
                No universities available
              </p>
              <p style={{ color: "rgba(255,255,255,0.45)", margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
                Every registered university already has an active admin.
                Deactivate an existing admin first to assign a new one.
              </p>
            </div>
          ) : (
            <>
              <label>University</label>
              <select
                value={uniId}
                onChange={e => setUniId(e.target.value)}
                style={{
                  padding: "14px 15px", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.07)", color: "white",
                  fontSize: "14.5px", fontFamily: "var(--font)",
                  outline: "none", width: "100%", appearance: "none",
                }}
              >
                <option value="" style={{ background: "#192c50" }}>
                  Select a university…
                </option>
                {availableUniversities.map(u => (
                  <option key={u.id} value={u.id} style={{ background: "#192c50" }}>
                    {u.name}
                  </option>
                ))}
              </select>

              {selectedUni && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(61,223,152,0.08)",
                  border: "1px solid rgba(61,223,152,0.25)",
                  color: "#3ddf98", fontSize: 13, fontWeight: 600,
                }}>
                  ✓ {selectedUni.name} has no active admin — you can assign one
                </div>
              )}

              <label>Admin Name</label>
              <input
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                placeholder="e.g. Dr. Sara Khalil"
              />

              <label>Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="newadmin@university.edu.lb"
              />

              <button
                className="modal-submit"
                onClick={handleSubmit}
                disabled={loading || !uniId || !adminName || !email}
              >
                {loading ? "Creating..." : "Create Admin & Send Verification Email"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function SuperAdmin() {
  const navigate = useNavigate();
  const [admins,       setAdmins]       = useState([]);
  const [showRegUni,   setShowRegUni]   = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);

  const handleSignOut = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const fetchAdmins = async () => {
    try {
      const res  = await fetch(`${API}/users/admins`, { headers: authHeader().headers });
      const data = await res.json();
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
          <h2 className="admin-section-title">University Admins</h2>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn-add-admin" onClick={() => setShowAddAdmin(true)}>
              <UserPlus size={17} /> Add Admin
            </button>
            <button className="btn-register-uni" onClick={() => setShowRegUni(true)}>
              <Plus size={17} /> Register University
            </button>
          </div>
        </div>

        <AdminList admins={admins} onRefresh={fetchAdmins} />
      </main>

      {showRegUni   && <RegisterUniversityModal onClose={() => setShowRegUni(false)}   onSubmit={fetchAdmins} />}
      {showAddAdmin && <AddAdminModal           onClose={() => setShowAddAdmin(false)} onSubmit={fetchAdmins} admins={admins} />}
    </div>
  );
}
