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
  XCircle,
  Clock,
  FileText,
} from "lucide-react";
import "./Admin.css";

const API = "http://localhost:5000/api";
const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

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
function TabBar({ activeTab, onChange, staffCount, pendingFlagsCount }) {
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
        <AlertTriangle size={16} /> Fraud Alerts
        {pendingFlagsCount > 0 && (
          <span style={{
            background: "#e10600",
            color: "white",
            borderRadius: "50%",
            width: 18,
            height: 18,
            fontSize: 11,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 6,
          }}>
            {pendingFlagsCount}
          </span>
        )}
      </button>
    </div>
  );
}

/* ─── STATS ROW ─── */
function StatsRow({ staffCount, pendingFlagsCount }) {
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
        <p className="uni-stat__label">Pending Fraud Alerts</p>
        <p className="uni-stat__value">{pendingFlagsCount}</p>
      </div>

      <div className="uni-stat uni-stat--dark">
        <div className="uni-stat__icon uni-stat__icon--amber">
          <Bell size={28} />
        </div>
        <p className="uni-stat__label">Unread Alerts</p>
        <p className="uni-stat__value">{pendingFlagsCount}</p>
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
          <AlertTriangle size={18} className="uni-action__icon--alert" /> Review Fraud Alerts
        </span>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

/* ─── RECENT ALERTS PREVIEW (Overview tab only) ─── */
function RecentAlertsPreview({ flags, onViewAll }) {
  const pending = flags.filter((f) => f.status === "pending").slice(0, 3);

  return (
    <div className="uni-panel">
      <h3 className="uni-panel__title">Recent Fraud Alerts</h3>
      {pending.length === 0 ? (
        <div className="uni-alerts-empty">
          <CheckCircle2 size={52} color="#2dce8a" />
          <p style={{ color: "rgba(255,255,255,0.4)", margin: 0 }}>
            No pending fraud alerts
          </p>
        </div>
      ) : (
        <>
          {pending.map((flag) => (
            <div key={flag.id} className="uni-action" style={{ cursor: "default" }}>
              <span className="uni-action__left" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "#ff6b6b" }}>
                  ⚠️ {flag.student_name}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  {flag.cert_number} · {flag.degree} in {flag.major}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                  Reason: {flag.reason}
                </span>
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 20,
                background: "rgba(255,107,107,0.15)",
                color: "#ff6b6b",
                whiteSpace: "nowrap",
              }}>
                PENDING
              </span>
            </div>
          ))}
          <button
            className="uni-action"
            onClick={onViewAll}
            style={{ justifyContent: "center", color: "rgba(255,255,255,0.5)", marginTop: 4 }}
          >
            View all alerts
          </button>
        </>
      )}
    </div>
  );
}

/* ─── FRAUD ALERTS TAB ─── */
function FraudAlertsTab({ flags, onResolve, loading }) {
  const [reviewNote, setReviewNote]   = useState("");
  const [activeFlag, setActiveFlag]   = useState(null);
  const [resolving, setResolving]     = useState(false);

  const handleAction = async (flagId, action) => {
    setResolving(true);
    await onResolve(flagId, action, reviewNote);
    setResolving(false);
    setActiveFlag(null);
    setReviewNote("");
  };

  const statusColor = (s) => {
    if (s === "pending")  return "#f59e0b";
    if (s === "resolved") return "#22c55e";
    if (s === "dismissed") return "#94a3b8";
    return "#94a3b8";
  };

  const statusIcon = (s) => {
    if (s === "pending")   return <Clock size={14} />;
    if (s === "resolved")  return <XCircle size={14} />;
    if (s === "dismissed") return <CheckCircle2 size={14} />;
    return null;
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>
        Loading fraud alerts...
      </div>
    );
  }

  if (flags.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 16, padding: "60px 0",
      }}>
        <CheckCircle2 size={64} color="#2dce8a" />
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, margin: 0 }}>
          No fraud alerts for your university
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {flags.map((flag) => (
        <div
          key={flag.id}
          style={{
            background: "rgba(17,30,58,0.85)",
            border: `1px solid ${
              flag.status === "pending"
                ? "rgba(245,158,11,0.4)"
                : "rgba(40,60,100,0.5)"
            }`,
            borderRadius: 16,
            padding: 24,
          }}
        >
          {/* ── Flag header ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <FileText size={18} color="#e10600" />
                <span style={{ fontWeight: 700, fontSize: 16, color: "white" }}>
                  {flag.student_name}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
                🎓 {flag.degree} in {flag.major}
                {flag.GPA ? ` · GPA ${parseFloat(flag.GPA).toFixed(2)}` : ""}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                {flag.cert_number}
              </p>
            </div>

            {/* Status badge */}
            <span style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              color:       statusColor(flag.status),
              background:  statusColor(flag.status) + "22",
              border:      `1px solid ${statusColor(flag.status)}44`,
            }}>
              {statusIcon(flag.status)}
              {flag.status}
            </span>
          </div>

          {/* ── Certificate current status ── */}
          <div style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 14,
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              🏛 {flag.university_name}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              📅 Graduated: {flag.graduation_date?.toString().split("T")[0]}
            </span>
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: flag.cert_status === "revoked" ? "#ef4444" : "#22c55e",
            }}>
              Certificate: {flag.cert_status?.toUpperCase()}
            </span>
            {flag.risk_score && (
              <span style={{
                fontSize: 12,
                color: flag.risk_score > 70 ? "#ef4444" : flag.risk_score > 40 ? "#f59e0b" : "#22c55e",
                fontWeight: 600,
              }}>
                Risk Score: {flag.risk_score}%
              </span>
            )}
          </div>

          {/* ── Reason ── */}
          <div style={{
            background: "rgba(255,107,107,0.07)",
            border: "1px solid rgba(255,107,107,0.15)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: flag.status === "pending" ? 14 : 0,
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 700, marginBottom: 3 }}>
              REASON FOR FLAG:
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
              {flag.reason}
            </p>
            {flag.flagged_by_name && (
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                Flagged by: {flag.flagged_by_name} · {new Date(flag.flagged_at).toLocaleString()}
              </p>
            )}
          </div>

          {/* ── Review note if resolved ── */}
          {flag.review_note && (
            <div style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: 10,
              padding: "10px 14px",
              marginTop: 10,
            }}>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, marginBottom: 3 }}>
                REVIEW NOTE:
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                {flag.review_note}
              </p>
            </div>
          )}

          {/* ── Action buttons (only for pending flags) ── */}
          {flag.status === "pending" && flag.cert_status !== "revoked" && (
            <>
              {activeFlag === flag.id ? (
                <div style={{ marginTop: 14 }}>
                  <textarea
                    placeholder="Optional review note (reason for decision)..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.05)",
                      color: "white",
                      fontSize: 13,
                      resize: "vertical",
                      minHeight: 70,
                      fontFamily: "Arial, sans-serif",
                      marginBottom: 12,
                    }}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    {/* REVOKE */}
                    <button
                      onClick={() => handleAction(flag.id, "revoke")}
                      disabled={resolving}
                      style={{
                        flex: 1,
                        padding: "11px 0",
                        borderRadius: 12,
                        border: "none",
                        background: "linear-gradient(135deg, #e10600, #ff3b30)",
                        color: "white",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: resolving ? "not-allowed" : "pointer",
                        opacity: resolving ? 0.6 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        fontFamily: "Arial, sans-serif",
                      }}
                    >
                      <XCircle size={16} />
                      {resolving ? "Processing..." : "Revoke Certificate"}
                    </button>

                    {/* DISMISS */}
                    <button
                      onClick={() => handleAction(flag.id, "dismiss")}
                      disabled={resolving}
                      style={{
                        flex: 1,
                        padding: "11px 0",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.7)",
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: resolving ? "not-allowed" : "pointer",
                        opacity: resolving ? 0.6 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        fontFamily: "Arial, sans-serif",
                      }}
                    >
                      <CheckCircle2 size={16} />
                      {resolving ? "Processing..." : "Dismiss Flag"}
                    </button>

                    {/* CANCEL */}
                    <button
                      onClick={() => { setActiveFlag(null); setReviewNote(""); }}
                      style={{
                        padding: "11px 18px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "transparent",
                        color: "rgba(255,255,255,0.4)",
                        cursor: "pointer",
                        fontFamily: "Arial, sans-serif",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setActiveFlag(flag.id)}
                  style={{
                    marginTop: 14,
                    width: "100%",
                    padding: "11px 0",
                    borderRadius: 12,
                    border: "1px solid rgba(245,158,11,0.3)",
                    background: "rgba(245,158,11,0.08)",
                    color: "#f59e0b",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "Arial, sans-serif",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <AlertTriangle size={16} />
                  Review This Alert
                </button>
              )}
            </>
          )}

          {/* Already revoked notice */}
          {flag.status === "pending" && flag.cert_status === "revoked" && (
            <div style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              fontSize: 13,
              color: "#ef4444",
            }}>
              ⚠️ Certificate is already revoked. You can dismiss this flag.
              <button
                onClick={() => handleAction(flag.id, "dismiss")}
                style={{
                  marginLeft: 12,
                  padding: "4px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.3)",
                  background: "transparent",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── ADD STAFF MODAL ─── */
function AddStaffModal({ onClose, onSubmit }) {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email) return alert("Please fill all fields");
    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/staff`,
        { name, email },
        authHeader()
      );
      onSubmit({
        id: res.data.staffId,
        name,
        email,
        is_verified: false,
        verification_expires: res.data.verification_expires,
        university_name: res.data.university_name,
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
          <input value={name}  onChange={(e) => setName(e.target.value)}  />
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
        const now     = new Date();
        const expired = staff.verification_expires &&
          new Date(staff.verification_expires) < now;

        let status = "Pending";
        if (staff.is_verified)  status = "Active";
        else if (expired)       status = "Inactive";

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
              <span className={`status-badge ${
                status === "Active"   ? "verified"
                : status === "Inactive" ? "expired"
                : "pending"
              }`}>
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
  const [activeTab,    setActiveTab]    = useState("overview");
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [staffList,    setStaffList]    = useState([]);
  const [fraudFlags,   setFraudFlags]   = useState([]);
  const [admin,        setAdmin]        = useState(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [loadingFlags, setLoadingFlags] = useState(false);

  const pendingFlagsCount = fraudFlags.filter((f) => f.status === "pending").length;

  /* ── Fetch current admin ── */
  const fetchCurrentUser = async () => {
    try {
      const res = await axios.get(`${API}/users/me`, authHeader());
      setAdmin(res.data.user);
    } catch (err) {
      console.error("Failed to fetch admin:", err);
    } finally {
      setLoadingAdmin(false);
    }
  };

  /* ── Fetch staff ── */
  const fetchStaff = async () => {
    if (!admin) return;
    try {
      const res  = await axios.get(`${API}/staff/staffs`, authHeader());
      const staff = res.data.staffs
        .filter((s) => s.university_name === admin.university_name)
        .map((s) => ({
          id:                   s.id,
          name:                 s.name,
          email:                s.email,
          is_verified:          s.is_verified,
          verification_expires: s.verification_expires,
          university_name:      s.university_name,
        }));
      setStaffList(staff);
    } catch (err) {
      console.error("Failed to fetch staff:", err);
      if (err.response?.status === 401) navigate("/login");
    }
  };

  /* ── Fetch fraud flags ── */
  const fetchFraudFlags = async () => {
    setLoadingFlags(true);
    try {
      const res = await axios.get(`${API}/fraud/flags`, authHeader());
      setFraudFlags(res.data.flags || []);
    } catch (err) {
      console.error("Failed to fetch fraud flags:", err);
    } finally {
      setLoadingFlags(false);
    }
  };

  /* ── Resolve a fraud flag (revoke or dismiss) ── */
  const handleResolveFlag = async (flagId, action, reviewNote) => {
    try {
      await axios.patch(
        `${API}/fraud/flags/${flagId}/resolve`,
        { action, review_note: reviewNote },
        authHeader()
      );
      // Refresh flags after action
      await fetchFraudFlags();
    } catch (err) {
      alert(err.response?.data?.message || "Action failed. Please try again.");
    }
  };

  /* ── Resend activation email ── */
  const handleResend = async (email) => {
    try {
      const res = await fetch(`${API}/users/resend-activation`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      alert(data.message || "Activation email sent!");
      fetchStaff();
    } catch (err) {
      console.error(err);
      alert("Failed to resend activation email");
    }
  };

  useEffect(() => { fetchCurrentUser(); }, []);

  useEffect(() => {
    if (admin) {
      fetchStaff();
      fetchFraudFlags();
    }
  }, [admin]);

  if (loadingAdmin)
    return <div className="loading">Loading admin info...</div>;

  return (
    <div className="uni-dashboard">
      <UniNavbar
        universityName={admin?.university_name ?? "No University Assigned"}
        adminName={admin?.name ?? "Unknown Admin"}
        onSignOut={() => {
          localStorage.removeItem("token");
          navigate("/login");
        }}
      />

      <main className="uni-body">
        <TabBar
          activeTab={activeTab}
          onChange={setActiveTab}
          staffCount={staffList.length}
          pendingFlagsCount={pendingFlagsCount}
        />

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            <StatsRow
              staffCount={staffList.length}
              pendingFlagsCount={pendingFlagsCount}
            />
            <div className="uni-bottom">
              <QuickActions
                onAddStaff={() => setIsModalOpen(true)}
                onViewAlerts={() => setActiveTab("alerts")}
              />
              <RecentAlertsPreview
                flags={fraudFlags}
                onViewAll={() => setActiveTab("alerts")}
              />
            </div>
          </>
        )}

        {/* ── STAFF TAB ── */}
        {activeTab === "staff" && (
          <>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}>
              <h3 style={{ color: "white", margin: 0 }}>
                Staff Members ({staffList.length})
              </h3>
              <button
                onClick={() => setIsModalOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "none",
                  background: "#e10600",
                  color: "white",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                <Plus size={16} /> Add Staff
              </button>
            </div>
            <StaffCards staffList={staffList} handleResend={handleResend} />
          </>
        )}

        {/* ── FRAUD ALERTS TAB ── */}
        {activeTab === "alerts" && (
          <>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}>
              <h3 style={{ color: "white", margin: 0 }}>
                Fraud Alerts
                {pendingFlagsCount > 0 && (
                  <span style={{
                    marginLeft: 10,
                    fontSize: 14,
                    color: "#f59e0b",
                    fontWeight: 400,
                  }}>
                    ({pendingFlagsCount} pending)
                  </span>
                )}
              </h3>
              <button
                onClick={fetchFraudFlags}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
            <FraudAlertsTab
              flags={fraudFlags}
              onResolve={handleResolveFlag}
              loading={loadingFlags}
            />
          </>
        )}
      </main>

      {/* ── ADD STAFF MODAL ── */}
      {isModalOpen && (
        <AddStaffModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={(staff) => setStaffList((prev) => [...prev, staff])}
        />
      )}
    </div>
  );
}