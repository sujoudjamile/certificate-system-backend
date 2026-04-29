import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  GraduationCap, Users, User, AlertTriangle, Bell, Shield,
  RefreshCw, LogOut, ChevronRight, Plus, CheckCircle2,
  XCircle, Clock, FileText, Zap, AlertOctagon, X,
} from "lucide-react";
import "./Admin.css";

const API = "http://localhost:5000/api";
const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

// ── Human-readable labels for auto-detected rules ──
const RULE_LABELS = {
  DUPLICATE_CERT_CROSS_UNI:  "Cross-University Duplicate",
  CONCURRENT_ACTIVE_CERTS:   "Concurrent Active Certificates",
  PREMATURE_GRADUATION:      "Premature Graduation Date",
  AGE_DEGREE_MISMATCH:       "Age / Degree Mismatch",
  RAPID_STAFF_ISSUANCE:      "Rapid Staff Issuance",
  ACCELERATED_PROGRESSION:   "Accelerated Degree Progression",
  GPA_ANOMALY:               "GPA Anomaly",
};

const parseRuleLabel = (source) => {
  if (!source) return "Manual Report";
  if (source.startsWith("AUTO:")) {
    const id = source.replace("AUTO:", "");
    return RULE_LABELS[id] ?? id;
  }
  return "Manual Report";
};

const riskColor = (score) => {
  if (score >= 80) return { text: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" };
  if (score >= 60) return { text: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" };
  return             { text: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)"  };
};

// ══════════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATION COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.severity}`}>
          <div className="toast__icon">
            {t.severity === "high"   ? <AlertOctagon size={18} /> :
             t.severity === "medium" ? <AlertTriangle size={18} /> :
                                       <Bell size={18} />}
          </div>
          <div className="toast__body">
            <p className="toast__title">{t.title}</p>
            <p className="toast__text">{t.message}</p>
          </div>
          <button className="toast__close" onClick={() => onDismiss(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NAVBAR
// ══════════════════════════════════════════════════════════════════════════════
function UniNavbar({ universityName, adminName, onSignOut, pendingCount, onBellClick, hasNew }) {
  return (
    <nav className="uni-nav">
      <div className="uni-nav__brand">
        <div className="uni-nav__logo"><GraduationCap size={24} /></div>
        <div className="uni-nav__titles">
          <h2 className="uni-nav__title">{universityName}</h2>
          <p className="uni-nav__subtitle">Admin Dashboard · {adminName}</p>
        </div>
      </div>
      <div className="uni-nav__actions">
        {/* Notification Bell */}
        <button
          className={`uni-nav__icon-btn notif-bell ${hasNew ? "notif-bell--pulse" : ""}`}
          onClick={onBellClick}
          title="Fraud Alerts"
        >
          <Bell size={20} />
          {pendingCount > 0 && (
            <span className="notif-badge">{pendingCount > 99 ? "99+" : pendingCount}</span>
          )}
        </button>

        <button className="uni-nav__icon-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={20} />
        </button>
        <button className="uni-nav__signout" onClick={onSignOut}>
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </nav>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB BAR
// ══════════════════════════════════════════════════════════════════════════════
function TabBar({ activeTab, onChange, staffCount, pendingFlagsCount }) {
  return (
    <div className="uni-tabs">
      <button className={`uni-tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => onChange("overview")}>
        <Shield size={16} /> Overview
      </button>
      <button className={`uni-tab ${activeTab === "staff" ? "active" : ""}`} onClick={() => onChange("staff")}>
        <Users size={16} /> Staff ({staffCount})
      </button>
      <button className={`uni-tab ${activeTab === "alerts" ? "active" : ""}`} onClick={() => onChange("alerts")}>
        <AlertTriangle size={16} /> Fraud Alerts
        {pendingFlagsCount > 0 && (
          <span className="tab-badge">{pendingFlagsCount}</span>
        )}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STATS ROW
// ══════════════════════════════════════════════════════════════════════════════
function StatsRow({ staffCount, pendingFlagsCount, highRiskCount }) {
  return (
    <div className="uni-stats">
      <div className="uni-stat uni-stat--blue">
        <div className="uni-stat__icon uni-stat__icon--blue"><Users size={28} /></div>
        <p className="uni-stat__label">Staff Members</p>
        <p className="uni-stat__value">{staffCount}</p>
      </div>
      <div className="uni-stat uni-stat--red">
        <div className="uni-stat__icon uni-stat__icon--red"><AlertTriangle size={28} /></div>
        <p className="uni-stat__label">Pending Fraud Alerts</p>
        <p className="uni-stat__value">{pendingFlagsCount}</p>
      </div>
      <div className="uni-stat uni-stat--dark">
        <div className="uni-stat__icon uni-stat__icon--amber"><AlertOctagon size={28} /></div>
        <p className="uni-stat__label">High-Risk Flags (≥ 80)</p>
        <p className="uni-stat__value">{highRiskCount}</p>
      </div>
      <div className="uni-stat uni-stat--teal">
        <div className="uni-stat__icon uni-stat__icon--green"><Shield size={28} /></div>
        <p className="uni-stat__label">Security Status</p>
        <p className="uni-stat__value--active">{pendingFlagsCount > 0 ? "⚠ Alert" : "Active"}</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// QUICK ACTIONS
// ══════════════════════════════════════════════════════════════════════════════
function QuickActions({ onAddStaff, onViewAlerts }) {
  return (
    <div className="uni-panel">
      <h3 className="uni-panel__title">Quick Actions</h3>
      <button className="uni-action" onClick={onAddStaff}>
        <span className="uni-action__left"><Plus size={18} className="uni-action__icon--plus" /> Add New Staff Member</span>
        <ChevronRight size={18} />
      </button>
      <button className="uni-action" onClick={onViewAlerts}>
        <span className="uni-action__left"><AlertTriangle size={18} className="uni-action__icon--alert" /> Review Fraud Alerts</span>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RECENT ALERTS PREVIEW (overview tab)
// ══════════════════════════════════════════════════════════════════════════════
function RecentAlertsPreview({ flags, onViewAll }) {
  const pending = flags.filter(f => f.status === "pending").slice(0, 3);
  return (
    <div className="uni-panel">
      <h3 className="uni-panel__title">Recent Fraud Alerts</h3>
      {pending.length === 0 ? (
        <div className="uni-alerts-empty">
          <CheckCircle2 size={52} color="#2dce8a" />
          <p className="uni-alerts-empty__text">No pending fraud alerts</p>
        </div>
      ) : (
        <>
          {pending.map(flag => {
            const rc = riskColor(flag.risk_score || 50);
            return (
              <div key={flag.id} className="uni-action" style={{ cursor: "default", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: rc.text }}>
                    ⚠ {flag.student_name}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 10,
                    background: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}>
                    Risk {flag.risk_score}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {parseRuleLabel(flag.source)} · {flag.degree} in {flag.major}
                </div>
              </div>
            );
          })}
          <button className="uni-action" onClick={onViewAll}
            style={{ justifyContent: "center", color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            View all alerts →
          </button>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FRAUD ALERTS TAB — full list with resolve actions
// ══════════════════════════════════════════════════════════════════════════════
function FraudAlertsTab({ flags, onResolve, loading }) {
  const [reviewNote, setReviewNote] = useState("");
  const [activeFlag, setActiveFlag] = useState(null);
  const [resolving,  setResolving]  = useState(false);

  const handleAction = async (flagId, action) => {
    setResolving(true);
    await onResolve(flagId, action, reviewNote);
    setResolving(false);
    setActiveFlag(null);
    setReviewNote("");
  };

  const statusColor = s =>
    s === "pending" ? "#f59e0b" : s === "resolved" ? "#22c55e" : "#94a3b8";
  const statusIcon  = s =>
    s === "pending" ? <Clock size={14} /> : s === "resolved" ? <XCircle size={14} /> : <CheckCircle2 size={14} />;

  if (loading) return (
    <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>
      Loading fraud alerts…
    </div>
  );

  if (flags.length === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 0" }}>
      <CheckCircle2 size={64} color="#2dce8a" />
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, margin: 0 }}>
        No fraud alerts for your university
      </p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {flags.map(flag => {
        const rc = riskColor(flag.risk_score || 50);
        const isAuto = flag.is_auto_flag ?? flag.source?.startsWith("AUTO:");
        return (
          <div key={flag.id} style={{
            background: "rgba(17,30,58,0.85)",
            border: `1px solid ${flag.status === "pending" ? rc.border : "rgba(40,60,100,0.5)"}`,
            borderRadius: 16, padding: 24,
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <FileText size={16} color={rc.text} />
                  <span style={{ fontWeight: 700, fontSize: 16, color: "white" }}>{flag.student_name}</span>
                  {/* Auto vs Manual badge */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                    background: isAuto ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.08)",
                    color: isAuto ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${isAuto ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.1)"}`,
                  }}>
                    {isAuto ? "⚡ AUTO-DETECTED" : "👤 MANUAL"}
                  </span>
                </div>
                {/* Rule label */}
                <p style={{ margin: 0, fontSize: 13, color: rc.text, fontWeight: 600 }}>
                  {parseRuleLabel(flag.source)}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
                  {flag.cert_number}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                {/* Risk score */}
                <span style={{
                  fontSize: 13, fontWeight: 800, padding: "5px 12px", borderRadius: 20,
                  background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`,
                }}>
                  Risk {flag.risk_score ?? "—"}
                </span>
                {/* Status */}
                <span style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                  color: statusColor(flag.status),
                  background: statusColor(flag.status) + "22",
                  border: `1px solid ${statusColor(flag.status)}44`,
                  padding: "3px 10px", borderRadius: 12,
                }}>
                  {statusIcon(flag.status)} {flag.status}
                </span>
              </div>
            </div>

            {/* Cert / student info strip */}
            <div style={{
              background: "rgba(255,255,255,0.04)", borderRadius: 10,
              padding: "10px 14px", marginBottom: 12,
              display: "flex", gap: 20, flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>🏛 {flag.university_name}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>🎓 {flag.degree} · {flag.major}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                📅 {flag.graduation_date?.toString().split("T")[0]}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: flag.cert_status === "revoked" ? "#ef4444" : "#22c55e",
              }}>
                Cert: {flag.cert_status?.toUpperCase()}
              </span>
            </div>

            {/* Reason box */}
            <div style={{
              background: rc.bg, border: `1px solid ${rc.border}`,
              borderRadius: 10, padding: "10px 14px",
              marginBottom: flag.status === "pending" ? 12 : 0,
            }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: rc.text, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>
                Detection Reason
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
                {flag.reason}
              </p>
              {flag.flagged_by_name && (
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                  Flagged by: {flag.flagged_by_name}
                </p>
              )}
            </div>

            {/* Review note (resolved flags) */}
            {flag.review_note && (
              <div style={{
                background: "rgba(255,255,255,0.04)", borderRadius: 10,
                padding: "10px 14px", marginTop: 10,
              }}>
                <p style={{ margin: "0 0 3px", fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>
                  REVIEW NOTE — {flag.reviewed_by_name}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{flag.review_note}</p>
              </div>
            )}

            {/* Action buttons — pending only, cert not yet revoked */}
            {flag.status === "pending" && flag.cert_status !== "revoked" && (
              <>
                {activeFlag === flag.id ? (
                  <div style={{ marginTop: 14 }}>
                    <textarea
                      placeholder="Optional review note…"
                      value={reviewNote}
                      onChange={e => setReviewNote(e.target.value)}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "10px 12px", borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.05)", color: "white",
                        fontSize: 13, resize: "vertical", minHeight: 70,
                        fontFamily: "Arial, sans-serif", marginBottom: 12,
                      }}
                    />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        onClick={() => handleAction(flag.id, "revoke")}
                        disabled={resolving}
                        style={{
                          flex: 1, padding: "11px 0", borderRadius: 12, border: "none",
                          background: "linear-gradient(135deg,#e10600,#ff3b30)",
                          color: "white", fontWeight: 700, fontSize: 14,
                          cursor: resolving ? "not-allowed" : "pointer",
                          opacity: resolving ? 0.6 : 1,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          fontFamily: "Arial, sans-serif",
                        }}
                      >
                        <XCircle size={16} />
                        {resolving ? "Processing…" : "Revoke Certificate"}
                      </button>
                      <button
                        onClick={() => handleAction(flag.id, "dismiss")}
                        disabled={resolving}
                        style={{
                          flex: 1, padding: "11px 0", borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.15)",
                          background: "rgba(255,255,255,0.06)",
                          color: "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: 14,
                          cursor: resolving ? "not-allowed" : "pointer",
                          opacity: resolving ? 0.6 : 1,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          fontFamily: "Arial, sans-serif",
                        }}
                      >
                        <CheckCircle2 size={16} />
                        {resolving ? "Processing…" : "Dismiss Flag"}
                      </button>
                      <button
                        onClick={() => { setActiveFlag(null); setReviewNote(""); }}
                        style={{
                          padding: "11px 18px", borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.1)",
                          background: "transparent", color: "rgba(255,255,255,0.4)",
                          cursor: "pointer", fontFamily: "Arial, sans-serif",
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
                      marginTop: 12, width: "100%", padding: "11px 0",
                      borderRadius: 12, border: `1px solid ${rc.border}`,
                      background: rc.bg, color: rc.text,
                      fontWeight: 600, fontSize: 14, cursor: "pointer",
                      fontFamily: "Arial, sans-serif",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <Zap size={15} /> Review This Alert
                  </button>
                )}
              </>
            )}

            {/* Already revoked, pending flag */}
            {flag.status === "pending" && flag.cert_status === "revoked" && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 10,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                fontSize: 13, color: "#ef4444",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                ⚠ Certificate is already revoked.
                <button
                  onClick={() => handleAction(flag.id, "dismiss")}
                  style={{
                    padding: "4px 12px", borderRadius: 8,
                    border: "1px solid rgba(239,68,68,0.3)", background: "transparent",
                    color: "#ef4444", cursor: "pointer", fontSize: 12, fontFamily: "Arial, sans-serif",
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADD STAFF MODAL
// ══════════════════════════════════════════════════════════════════════════════
function AddStaffModal({ onClose, onSubmit }) {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email) return alert("Please fill all fields");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/staff`, { name, email }, authHeader());
      onSubmit({ id: res.data.staffId, name, email, is_verified: false });
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
          <input value={name}  onChange={e => setName(e.target.value)}  />
          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} />
          <button className="modal-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? "Adding…" : "Add Staff"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STAFF CARDS
// ══════════════════════════════════════════════════════════════════════════════
function StaffCards({ staffList, handleResend }) {
  if (!staffList || staffList.length === 0)
    return <p className="staff-empty-text">No staff added yet.</p>;

  return (
    <div className="admin-cards">
      {staffList.map(staff => {
        const now     = new Date();
        const expired = staff.verification_expires && new Date(staff.verification_expires) < now;
        let status    = "Pending";
        if (staff.is_verified) status = "Active";
        else if (expired)      status = "Inactive";

        return (
          <div key={staff.id} className={`admin-card ${status === "Inactive" ? "expired" : ""}`}>
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
                status === "Active" ? "verified" : status === "Inactive" ? "expired" : "pending"
              }`}>{status}</span>
              {status === "Inactive" && (
                <button className="resend-btn" onClick={() => handleResend(staff.email)}>
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

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function UniversityAdmin() {
  const navigate = useNavigate();

  const [activeTab,    setActiveTab]    = useState("overview");
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [staffList,    setStaffList]    = useState([]);
  const [fraudFlags,   setFraudFlags]   = useState([]);
  const [admin,        setAdmin]        = useState(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [loadingFlags, setLoadingFlags] = useState(false);

  // Notification state
  const [toasts,       setToasts]       = useState([]);
  const [hasNewAlerts, setHasNewAlerts] = useState(false);
  const lastFlagCountRef = useRef(null);
  const sseRef           = useRef(null);

  const pendingFlagsCount = fraudFlags.filter(f => f.status === "pending").length;
  const highRiskCount     = fraudFlags.filter(f => f.status === "pending" && (f.risk_score ?? 0) >= 80).length;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const addToast = useCallback((title, message, severity = "high") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, message, severity }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 8000);
  }, []);

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchCurrentUser = async () => {
    try {
      const res = await axios.get(`${API}/users/me`, authHeader());
      setAdmin(res.data.user);
    } catch { /* ignore */ }
    finally { setLoadingAdmin(false); }
  };

  const fetchStaff = useCallback(async () => {
    if (!admin) return;
    try {
      const res   = await axios.get(`${API}/staff/staffs`, authHeader());
      const staff = (res.data.staffs || [])
        .filter(s => s.university_name === admin.university_name);
      setStaffList(staff);
    } catch (err) {
      if (err.response?.status === 401) navigate("/login");
    }
  }, [admin, navigate]);

  const fetchFraudFlags = useCallback(async () => {
    setLoadingFlags(true);
    try {
      const res   = await axios.get(`${API}/fraud/flags`, authHeader());
      const flags = res.data.flags || [];
      setFraudFlags(flags);

      // Check if count increased since last fetch
      const pendingNow = flags.filter(f => f.status === "pending").length;
      if (lastFlagCountRef.current !== null && pendingNow > lastFlagCountRef.current) {
        const diff = pendingNow - lastFlagCountRef.current;
        setHasNewAlerts(true);
        addToast(
          `🚨 ${diff} New Fraud Alert${diff > 1 ? "s" : ""} Detected`,
          `Your university has ${pendingNow} pending fraud alert${pendingNow > 1 ? "s" : ""} requiring review.`,
          pendingNow >= highRiskCount && highRiskCount > 0 ? "high" : "medium"
        );
      }
      lastFlagCountRef.current = pendingNow;
    } catch { /* ignore */ }
    finally { setLoadingFlags(false); }
  }, [addToast, highRiskCount]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => { fetchCurrentUser(); }, []);

  useEffect(() => {
    if (!admin) return;
    fetchStaff();
    fetchFraudFlags();
  }, [admin]); // eslint-disable-line

  // ── SSE — real-time fraud alerts ──────────────────────────────────────────
  useEffect(() => {
    if (!admin) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const connect = () => {
      const url = `${API}/fraud/notifications/stream?token=${encodeURIComponent(token)}`;
      const es  = new EventSource(url);
      sseRef.current = es;

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);

          if (data.type === "FRAUD_ALERT") {
            const count = data.count || 1;
            const topFlag = data.flags?.[0];
            const label   = topFlag ? parseRuleLabel(topFlag.source) : "Unknown Rule";
            const risk    = topFlag?.risk_score ?? 50;

            setHasNewAlerts(true);

            addToast(
              `🚨 ${count} Auto-Detected Alert${count > 1 ? "s" : ""}`,
              `Rule: ${label} · Risk Score: ${risk}`,
              risk >= 80 ? "high" : "medium"
            );

            // Refresh flags list to reflect new data
            fetchFraudFlags();
          }
        } catch { /* ignore malformed events */ }
      };

      es.onerror = () => {
        // SSE disconnected — reconnect after 5 seconds
        es.close();
        setTimeout(connect, 5000);
      };
    };

    connect();

    // Polling fallback every 60 seconds (catches any missed SSE events)
    const pollInterval = setInterval(fetchFraudFlags, 60000);

    return () => {
      sseRef.current?.close();
      clearInterval(pollInterval);
    };
  }, [admin]); // eslint-disable-line

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleResolveFlag = async (flagId, action, reviewNote) => {
    try {
      await axios.patch(
        `${API}/fraud/flags/${flagId}/resolve`,
        { action, review_note: reviewNote },
        authHeader()
      );
      await fetchFraudFlags();
    } catch (err) {
      alert(err.response?.data?.message || "Action failed. Please try again.");
    }
  };

  const handleResend = async (email) => {
    try {
      const res = await fetch(`${API}/users/resend-activation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      alert(data.message || "Activation email sent!");
      fetchStaff();
    } catch {
      alert("Failed to resend activation email");
    }
  };

  const handleBellClick = () => {
    setHasNewAlerts(false);
    setActiveTab("alerts");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadingAdmin) return <div className="loading">Loading…</div>;

  return (
    <div className="uni-dashboard">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <UniNavbar
        universityName={admin?.university_name ?? "No University Assigned"}
        adminName={admin?.name ?? "Unknown Admin"}
        onSignOut={() => { localStorage.removeItem("token"); navigate("/login"); }}
        pendingCount={pendingFlagsCount}
        onBellClick={handleBellClick}
        hasNew={hasNewAlerts}
      />

      <main className="uni-body">
        <TabBar
          activeTab={activeTab}
          onChange={(tab) => { setActiveTab(tab); if (tab === "alerts") setHasNewAlerts(false); }}
          staffCount={staffList.length}
          pendingFlagsCount={pendingFlagsCount}
        />

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <>
            <StatsRow
              staffCount={staffList.length}
              pendingFlagsCount={pendingFlagsCount}
              highRiskCount={highRiskCount}
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

        {/* ── STAFF ── */}
        {activeTab === "staff" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "white", margin: 0 }}>Staff Members ({staffList.length})</h3>
              <button
                onClick={() => setIsModalOpen(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 12, border: "none",
                  background: "#e10600", color: "white",
                  fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "Arial, sans-serif",
                }}
              >
                <Plus size={16} /> Add Staff
              </button>
            </div>
            <StaffCards staffList={staffList} handleResend={handleResend} />
          </>
        )}

        {/* ── FRAUD ALERTS ── */}
        {activeTab === "alerts" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "white", margin: 0 }}>
                Fraud Alerts
                {pendingFlagsCount > 0 && (
                  <span style={{ marginLeft: 10, fontSize: 14, color: "#f59e0b", fontWeight: 400 }}>
                    ({pendingFlagsCount} pending)
                  </span>
                )}
              </h3>
              <button
                onClick={fetchFraudFlags}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.6)", cursor: "pointer",
                  fontSize: 13, fontFamily: "Arial, sans-serif",
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

      {/* Add Staff Modal */}
      {isModalOpen && (
        <AddStaffModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={(staff) => setStaffList(prev => [...prev, staff])}
        />
      )}
    </div>
  );
}