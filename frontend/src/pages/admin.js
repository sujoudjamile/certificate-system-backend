// admin.js — University Admin Dashboard
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  GraduationCap, Users, User, AlertTriangle, Bell,
  Shield, RefreshCw, LogOut, ChevronRight, Plus,
  CheckCircle2, XCircle, Clock, FileText, X,
  TrendingUp, Zap, Eye, AlertOctagon, BookOpen,
  Layers, Trash2, ChevronDown, Search, Calendar,
} from "lucide-react";
import "./Admin.css";

const API = "http://localhost:5000/api";

const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

// ─────────────────────────────────────────────────────────────
// TOAST NOTIFICATION SYSTEM
// ─────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <div className="toast__icon">
            {t.type === "fraud"   && <AlertOctagon size={18} />}
            {t.type === "success" && <CheckCircle2 size={18} />}
            {t.type === "info"    && <Bell size={18} />}
          </div>
          <div className="toast__body">
            <p className="toast__title">{t.title}</p>
            <p className="toast__msg">{t.message}</p>
          </div>
          <button className="toast__close" onClick={() => onDismiss(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RISK BADGE
// ─────────────────────────────────────────────────────────────
function RiskBadge({ score }) {
  const level =
    score >= 150 ? "critical" :
    score >= 100 ? "high"     :
    score >= 60  ? "medium"   : "low";
  const labels = { critical: "CRITICAL", high: "HIGH", medium: "MEDIUM", low: "LOW" };
  return (
    <span className={`risk-badge risk-badge--${level}`}>
      {labels[level]} {score}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// RULE LABELS
// ─────────────────────────────────────────────────────────────
const RULE_LABELS = {
  RULE_VELOCITY:            "High Velocity",
  RULE_CROSS_UNI_DUPLICATE: "Cross-Uni Duplicate",
  RULE_SUSPICIOUS_DATE:     "Suspicious Date",
  RULE_GPA_OUTLIER:         "GPA Outlier",
  RULE_EDIT_BEFORE_ISSUE:   "Edit Before Issue",
  RULE_REVOKE_REISSUE:      "Revoke & Reissue",
  RULE_OFF_HOURS:           "Off-Hours",
  RULE_NEW_ACCOUNT_ISSUE:   "New Account",
};

// ─────────────────────────────────────────────────────────────
// DEGREE LEVEL → COLOUR
// ─────────────────────────────────────────────────────────────
const LEVEL_COLOR = {
  undergraduate: { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.30)",  text: "#818cf8" },
  graduate:      { bg: "rgba(236,72,153,0.12)",  border: "rgba(236,72,153,0.30)",  text: "#f472b6" },
  doctoral:      { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.30)",  text: "#fbbf24" },
  professional:  { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.30)",   text: "#4ade80" },
};

// ─────────────────────────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────────────────────────
function UniNavbar({ universityName, adminName, pendingCount, onSignOut, onBellClick }) {
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
        <button className="uni-nav__icon-btn uni-nav__bell-btn" onClick={onBellClick}>
          <Bell size={20} />
          {pendingCount > 0 && (
            <span className="bell-badge">{pendingCount > 99 ? "99+" : pendingCount}</span>
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

// ─────────────────────────────────────────────────────────────
// TAB BAR
// ─────────────────────────────────────────────────────────────
function TabBar({ activeTab, onChange, staffCount, pendingFlagsCount, programCount }) {
  return (
    <div className="uni-tabs">
      <button className={`uni-tab ${activeTab === "overview" ? "active" : ""}`}
        onClick={() => onChange("overview")}>
        <Shield size={16} /> Overview
      </button>
      <button className={`uni-tab ${activeTab === "staff" ? "active" : ""}`}
        onClick={() => onChange("staff")}>
        <Users size={16} /> Staff ({staffCount})
      </button>
      <button className={`uni-tab ${activeTab === "programs" ? "active" : ""}`}
        onClick={() => onChange("programs")}>
        <Layers size={16} /> Programs ({programCount})
      </button>
      <button className={`uni-tab ${activeTab === "alerts" ? "active" : ""}`}
        onClick={() => onChange("alerts")}>
        <AlertTriangle size={16} /> Fraud Alerts
        {pendingFlagsCount > 0 && (
          <span className="tab-badge">{pendingFlagsCount}</span>
        )}
      </button>
      <button className={`uni-tab ${activeTab === "schedule" ? "active" : ""}`}
        onClick={() => onChange("schedule")}>
        <Calendar size={16} /> Schedule
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATS ROW
// ─────────────────────────────────────────────────────────────
function StatsRow({ staffCount, pendingFlagsCount, totalRisk, programCount }) {
  return (
    <div className="uni-stats">
      <div className="uni-stat uni-stat--blue">
        <div className="uni-stat__icon uni-stat__icon--blue"><Users size={28} /></div>
        <p className="uni-stat__label">Staff Members</p>
        <p className="uni-stat__value">{staffCount}</p>
      </div>
      <div className="uni-stat uni-stat--purple">
        <div className="uni-stat__icon uni-stat__icon--purple"><Layers size={28} /></div>
        <p className="uni-stat__label">Active Programs</p>
        <p className="uni-stat__value">{programCount}</p>
      </div>
      <div className="uni-stat uni-stat--red">
        <div className="uni-stat__icon uni-stat__icon--red"><AlertTriangle size={28} /></div>
        <p className="uni-stat__label">Pending Fraud Alerts</p>
        <p className="uni-stat__value">{pendingFlagsCount}</p>
      </div>
      <div className="uni-stat uni-stat--teal">
        <div className="uni-stat__icon uni-stat__icon--green"><Shield size={28} /></div>
        <p className="uni-stat__label">Security Status</p>
        <p className={`uni-stat__value--active ${pendingFlagsCount > 0 ? "uni-stat__value--warn" : ""}`}>
          {pendingFlagsCount > 0 ? "Review" : "Active"}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FRAUD STATS WIDGET
// ─────────────────────────────────────────────────────────────
function FraudStatsWidget({ stats }) {
  if (!stats) return null;
  const { rule_breakdown = [], top_suspects = [] } = stats;
  return (
    <div className="uni-panel fraud-stats-widget">
      <h3 className="uni-panel__title">
        <TrendingUp size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
        Fraud Detection Insights
      </h3>
      <p className="fraud-stats-section-label">Most Triggered Rules</p>
      {rule_breakdown.length === 0 ? (
        <p className="fraud-stats-empty">No rules have fired yet</p>
      ) : (
        rule_breakdown.slice(0, 4).map((r) => (
          <div key={r.source} className="fraud-rule-row">
            <span className="fraud-rule-name">{RULE_LABELS[r.source] || r.source}</span>
            <span className="fraud-rule-count">{r.count}×</span>
            <div className="fraud-rule-bar">
              <div className="fraud-rule-bar__fill"
                style={{ width: `${Math.min(100, (r.count / rule_breakdown[0].count) * 100)}%` }} />
            </div>
          </div>
        ))
      )}
      {top_suspects.length > 0 && (
        <>
          <p className="fraud-stats-section-label" style={{ marginTop: 20 }}>Staff With Most Flags</p>
          {top_suspects.slice(0, 3).map((s) => (
            <div key={s.id} className="fraud-suspect-row">
              <User size={14} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="fraud-suspect-name">{s.name}</p>
                <p className="fraud-suspect-email">{s.email}</p>
              </div>
              <RiskBadge score={parseFloat(s.total_risk || 0)} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RECENT ALERTS PREVIEW
// ─────────────────────────────────────────────────────────────
function RecentAlertsPreview({ flags, onViewAll }) {
  const pending = flags.filter((f) => f.flag_status === "pending").slice(0, 3);
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
          {pending.map((flag) => (
            <div key={flag.flag_id} className="uni-action" style={{ cursor: "default" }}>
              <span className="uni-action__left"
                style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "#ff6b6b" }}>
                  ⚠️ {flag.student_name}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  {flag.cert_number} · {RULE_LABELS[flag.rule_name] || flag.rule_name}
                </span>
              </span>
              <RiskBadge score={parseFloat(flag.risk_score)} />
            </div>
          ))}
          <button className="uni-action" onClick={onViewAll}
            style={{ justifyContent: "center", color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            View all alerts <ChevronRight size={14} />
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REVOKE CONFIRMATION MODAL
// ─────────────────────────────────────────────────────────────
function RevokeConfirmModal({ flag, onConfirm, onCancel, loading }) {
  const [note, setNote] = useState("");
  return (
    <div className="modal-overlay">
      <div className="modal-box revoke-modal-box">
        <div className="revoke-modal-header">
          <div className="revoke-modal-icon"><AlertOctagon size={26} /></div>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <p className="revoke-modal-title">Confirm Certificate Revocation</p>
        <p className="revoke-modal-name">{flag.student_name}</p>
        <p className="revoke-modal-email">{flag.cert_number} · {flag.degree} in {flag.major}</p>
        <div className="revoke-warning-box">
          <AlertTriangle size={16} />
          <span>This will permanently revoke the certificate. This action cannot be undone through the dashboard.</span>
        </div>
        <div className="modal-body" style={{ marginBottom: 16 }}>
          <label>Review Note (required)</label>
          <textarea
            placeholder="Explain why this certificate is being revoked..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            style={{
              padding: "12px 14px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.07)", color: "white",
              fontSize: 14, resize: "vertical", width: "100%",
              boxSizing: "border-box", fontFamily: "inherit", outline: "none",
            }}
          />
        </div>
        <div className="revoke-modal-actions">
          <button className="revoke-confirm-btn" onClick={() => onConfirm(note)}
            disabled={loading || !note.trim()}>
            {loading ? "Revoking..." : "Yes, Revoke Certificate"}
          </button>
          <button className="revoke-cancel-btn" onClick={onCancel} disabled={loading}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SINGLE FRAUD FLAG CARD
// ─────────────────────────────────────────────────────────────
function FlagCard({ flag, onDismiss, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isPending = flag.flag_status === "pending";
  const isRevoked = flag.cert_status === "revoked";

  const statusColor = {
    pending: "#f59e0b", resolved: "#22c55e", dismissed: "#64748b", reviewed: "#60b0ff",
  }[flag.flag_status] || "#94a3b8";

  const statusIcon = {
    pending: <Clock size={13} />, resolved: <XCircle size={13} />, dismissed: <CheckCircle2 size={13} />,
  }[flag.flag_status];

  const handleDismiss = async () => {
    setActionLoading(true);
    await onDismiss(flag.flag_id);
    setActionLoading(false);
  };

  const handleResolve = async (note) => {
    setActionLoading(true);
    await onResolve(flag.flag_id, note);
    setActionLoading(false);
    setShowRevoke(false);
  };

  return (
    <>
      {showRevoke && (
        <RevokeConfirmModal flag={flag} onConfirm={handleResolve}
          onCancel={() => setShowRevoke(false)} loading={actionLoading} />
      )}
      <div className="flag-card">
        <div className="flag-card__header">
          <div className="flag-card__left">
            <span className="flag-rule-tag">{RULE_LABELS[flag.rule_name] || flag.rule_name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <FileText size={16} color="#e10600" />
              <span className="flag-card__student">{flag.student_name}</span>
            </div>
            <p className="flag-card__cert">
              {flag.cert_number} · {flag.degree} in {flag.major}
              {flag.GPA ? ` · GPA ${parseFloat(flag.GPA).toFixed(2)}` : ""}
            </p>
            <p className="flag-card__meta">
              {flag.university_name} · Issued by{" "}
              <strong style={{ color: "rgba(255,255,255,0.7)" }}>{flag.issued_by_name || "Unknown"}</strong>
            </p>
          </div>
          <div className="flag-card__right">
            <span className="flag-status-badge" style={{
              color: statusColor, background: statusColor + "22", border: `1px solid ${statusColor}44`,
            }}>
              {statusIcon} {flag.flag_status}
            </span>
            <RiskBadge score={parseFloat(flag.risk_score)} />
            <button className="flag-expand-btn" onClick={() => setExpanded(!expanded)}>
              <Eye size={14} /> {expanded ? "Less" : "Details"}
            </button>
          </div>
        </div>
        <div className="flag-reason-box">
          <p className="flag-reason-label">REASON</p>
          <p className="flag-reason-text">{flag.reason}</p>
        </div>
        {expanded && (
          <div className="flag-details">
            <div className="flag-details__grid">
              <div className="flag-detail-item">
                <span className="flag-detail-label">National ID</span>
                <span className="flag-detail-value">{flag.national_id}</span>
              </div>
              <div className="flag-detail-item">
                <span className="flag-detail-label">Cert Status</span>
                <span className="flag-detail-value" style={{ color: isRevoked ? "#ef4444" : "#22c55e" }}>
                  {(flag.cert_status || "").toUpperCase()}
                </span>
              </div>
              <div className="flag-detail-item">
                <span className="flag-detail-label">Issued By Email</span>
                <span className="flag-detail-value">{flag.issued_by_email || "—"}</span>
              </div>
              <div className="flag-detail-item">
                <span className="flag-detail-label">Flagged At</span>
                <span className="flag-detail-value">{new Date(flag.flagged_at).toLocaleString()}</span>
              </div>
            </div>
            {flag.review_note && (
              <div className="flag-review-note">
                <p className="flag-detail-label">REVIEW NOTE</p>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{flag.review_note}</p>
                {flag.reviewed_by_name && (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    Reviewed by {flag.reviewed_by_name}
                    {flag.resolved_at ? ` · ${new Date(flag.resolved_at).toLocaleString()}` : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {isPending && (
          <div className="flag-actions">
            {isRevoked ? (
              <div className="flag-already-revoked">
                <AlertTriangle size={14} />
                Certificate already revoked.
                <button className="flag-dismiss-btn" onClick={handleDismiss}
                  disabled={actionLoading} style={{ marginLeft: 12 }}>
                  Dismiss Flag
                </button>
              </div>
            ) : (
              <>
                <button className="flag-dismiss-btn" onClick={handleDismiss} disabled={actionLoading}>
                  <CheckCircle2 size={14} />
                  {actionLoading ? "Processing..." : "Dismiss (False Positive)"}
                </button>
                <button className="flag-revoke-btn" onClick={() => setShowRevoke(true)} disabled={actionLoading}>
                  <XCircle size={14} />
                  {actionLoading ? "Processing..." : "Revoke Certificate"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// FRAUD ALERTS TAB
// ─────────────────────────────────────────────────────────────
function FraudAlertsTab({ flags, onDismiss, onResolve, loading, onRefresh }) {
  const [filter, setFilter] = useState("pending");
  const filtered = filter === "all" ? flags : flags.filter((f) => f.flag_status === filter);
  const counts = {
    pending:   flags.filter((f) => f.flag_status === "pending").length,
    dismissed: flags.filter((f) => f.flag_status === "dismissed").length,
    resolved:  flags.filter((f) => f.flag_status === "resolved").length,
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)" }}>
        <RefreshCw size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
        <p style={{ margin: 0 }}>Loading fraud alerts...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flag-filter-bar">
        {[
          { key: "pending",   label: "Pending",   count: counts.pending },
          { key: "resolved",  label: "Resolved",  count: counts.resolved },
          { key: "dismissed", label: "Dismissed", count: counts.dismissed },
          { key: "all",       label: "All" },
        ].map(({ key, label, count }) => (
          <button key={key} className={`flag-filter-btn ${filter === key ? "active" : ""}`}
            onClick={() => setFilter(key)}>
            {label}
            {count !== undefined && <span className="flag-filter-count">{count}</span>}
          </button>
        ))}
        <button className="flag-refresh-btn" onClick={onRefresh}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      {filtered.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 16, padding: "60px 0" }}>
          <CheckCircle2 size={64} color="#2dce8a" />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, margin: 0 }}>
            No {filter === "all" ? "" : filter} fraud alerts
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((flag) => (
            <FlagCard key={flag.flag_id} flag={flag} onDismiss={onDismiss} onResolve={onResolve} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADD PROGRAM MODAL
// ─────────────────────────────────────────────────────────────
function AddProgramModal({ onClose, onSubmit }) {
  const [allMajors,      setAllMajors]      = useState([]);
  const [allowedDegrees, setAllowedDegrees] = useState([]);
  const [selectedMajor,  setSelectedMajor]  = useState("");
  const [selectedDegree, setSelectedDegree] = useState("");
  const [majorSearch,    setMajorSearch]    = useState("");
  const [loading,        setLoading]        = useState(false);
  const [fetchingDeg,    setFetchingDeg]    = useState(false);
  const [error,          setError]          = useState("");

  // Group majors by field
  useEffect(() => {
    axios.get(`${API}/program/majors`, authHeader())
      .then(r => setAllMajors(r.data.majors || []))
      .catch(() => setError("Failed to load majors."));
  }, []);

  // When major changes → fetch allowed degrees
  useEffect(() => {
    if (!selectedMajor) { setAllowedDegrees([]); setSelectedDegree(""); return; }
    setFetchingDeg(true);
    setSelectedDegree("");
    axios.get(`${API}/program/majors/${selectedMajor}/degrees`, authHeader())
      .then(r => setAllowedDegrees(r.data.degrees || []))
      .catch(() => setError("Failed to load degrees."))
      .finally(() => setFetchingDeg(false));
  }, [selectedMajor]);

  const filteredMajors = allMajors.filter(m =>
    m.name.toLowerCase().includes(majorSearch.toLowerCase()) ||
    m.field.toLowerCase().includes(majorSearch.toLowerCase())
  );

  // Group filtered majors by field
  const grouped = filteredMajors.reduce((acc, m) => {
    if (!acc[m.field]) acc[m.field] = [];
    acc[m.field].push(m);
    return acc;
  }, {});

  const selectedMajorObj = allMajors.find(m => String(m.id) === String(selectedMajor));

  const handleSubmit = async () => {
    if (!selectedMajor || !selectedDegree) {
      setError("Please select both a major and a degree."); return;
    }
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API}/program/university`,
        { major_id: Number(selectedMajor), degree_id: Number(selectedDegree) },
        authHeader()
      );
      onSubmit();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add program.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box prog-modal-box">
        <div className="modal-header">
          <div>
            <h2>Add Program</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              Activate a degree program for your university
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 16,
            background: "rgba(232,24,14,0.09)", border: "1px solid rgba(232,24,14,0.22)",
            color: "#ff9090", fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {/* Major search */}
        <div style={{ marginBottom: 14 }}>
          <label className="prog-form-label">Search Major</label>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%",
              transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)" }} />
            <input
              className="prog-search-input"
              placeholder="e.g. Computer Science, Medicine..."
              value={majorSearch}
              onChange={e => setMajorSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Major picker */}
        <div style={{ marginBottom: 16 }}>
          <label className="prog-form-label">Select Major</label>
          <div className="prog-major-picker">
            {Object.keys(grouped).length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.3)", padding: "12px 0", textAlign: "center", fontSize: 13 }}>
                {allMajors.length === 0 ? "Loading..." : "No majors match your search"}
              </p>
            ) : Object.entries(grouped).map(([field, majors]) => (
              <div key={field} style={{ marginBottom: 10 }}>
                <p className="prog-field-label">{field}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {majors.map(m => (
                    <button key={m.id}
                      className={`prog-major-chip ${String(selectedMajor) === String(m.id) ? "selected" : ""}`}
                      onClick={() => setSelectedMajor(m.id)}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Degree picker */}
        <div style={{ marginBottom: 20 }}>
          <label className="prog-form-label">
            Select Degree
            {selectedMajorObj && (
              <span style={{ marginLeft: 8, fontSize: 11, color: "rgba(255,255,255,0.35)",
                fontWeight: 400 }}>for {selectedMajorObj.name}</span>
            )}
          </label>
          {!selectedMajor ? (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, margin: 0 }}>
              Select a major first
            </p>
          ) : fetchingDeg ? (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, margin: 0 }}>Loading degrees…</p>
          ) : allowedDegrees.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, margin: 0 }}>No degrees available</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {allowedDegrees.map(d => {
                const lc = LEVEL_COLOR[d.level] || LEVEL_COLOR.undergraduate;
                const isSelected = String(selectedDegree) === String(d.id);
                return (
                  <button key={d.id}
                    onClick={() => setSelectedDegree(d.id)}
                    style={{
                      padding: "8px 16px", borderRadius: 20, cursor: "pointer",
                      border: `1px solid ${isSelected ? lc.text : lc.border}`,
                      background: isSelected ? lc.bg : "transparent",
                      color: isSelected ? lc.text : "rgba(255,255,255,0.55)",
                      fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                      fontFamily: "var(--font)",
                    }}>
                    {d.name}
                    <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>
                      {d.abbreviation}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary */}
        {selectedMajor && selectedDegree && (() => {
          const maj = allMajors.find(m => String(m.id) === String(selectedMajor));
          const deg = allowedDegrees.find(d => String(d.id) === String(selectedDegree));
          if (!maj || !deg) return null;
          return (
            <div className="prog-summary-box">
              <GraduationCap size={16} style={{ color: "#60b0ff", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                Will activate: <strong>{deg.name}</strong> in <strong>{maj.name}</strong>
              </span>
            </div>
          );
        })()}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="modal-submit" onClick={handleSubmit}
            disabled={loading || !selectedMajor || !selectedDegree}
            style={{ flex: 1, opacity: (!selectedMajor || !selectedDegree) ? 0.5 : 1 }}>
            {loading ? "Adding…" : "Activate Program"}
          </button>
          <button onClick={onClose} style={{
            padding: "14px 20px", borderRadius: 13, border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)",
            cursor: "pointer", fontFamily: "var(--font)", fontSize: 14,
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROGRAMS TAB
// ─────────────────────────────────────────────────────────────
function ProgramsTab({ programs, onAdd, onRemove, loading }) {
  const [removing, setRemoving] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [expanded, setExpanded] = useState({});

  // Group by field
  const grouped = programs
  .filter(p => p.is_active) // 👈 IMPORTANT FIX
  .reduce((acc, p) => {
    if (!acc[p.major_id]) {
      acc[p.major_id] = {
        major_name: p.major_name,
        field: p.field,
        degrees: []
      };
    }

    acc[p.major_id].degrees.push(p);
    return acc;
  }, {});

  const handleRemove = async (programId) => {
    setRemoving(programId);
    await onRemove(programId);
    setRemoving(null);
    setConfirmRemove(null);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)" }}>
        <RefreshCw size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
        <p style={{ margin: 0 }}>Loading programs...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Confirm remove overlay */}
      {confirmRemove && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div className="revoke-modal-icon" style={{ width: 46, height: 46 }}>
                <Trash2 size={22} />
              </div>
              <button className="modal-close" onClick={() => setConfirmRemove(null)}>✕</button>
            </div>
            <p style={{ fontSize: 17, fontWeight: 800, color: "white", margin: "0 0 6px" }}>
              Deactivate Program?
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 18px" }}>
              <strong style={{ color: "white" }}>{confirmRemove.degree_name}</strong> in{" "}
              <strong style={{ color: "white" }}>{confirmRemove.major_name}</strong> will be deactivated.
              Existing student records are not affected.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => handleRemove(confirmRemove.id)}
                disabled={removing === confirmRemove.id}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12, border: "none",
                  background: "#dc2626", color: "white", fontWeight: 700, fontSize: 14,
                  cursor: "pointer", fontFamily: "var(--font)",
                  opacity: removing === confirmRemove.id ? 0.5 : 1,
                }}>
                {removing === confirmRemove.id ? "Removing…" : "Yes, Deactivate"}
              </button>
              <button onClick={() => setConfirmRemove(null)} style={{
                flex: 1, padding: "12px", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)",
                cursor: "pointer", fontFamily: "var(--font)", fontSize: 14,
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h3 style={{ color: "white", margin: 0, fontSize: 18, fontWeight: 800 }}>
            University Programs
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              {programs.filter(p => p.is_active).length} active program
              {programs.filter(p => p.is_active).length !== 1 ? "s" : ""} across your university
          </p>
        </div>
        <button onClick={onAdd} className="staff-add-btn">
          <Plus size={16} /> Add Program
        </button>
      </div>

      {programs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ width: 72, height: 72, borderRadius: 20,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px" }}>
            <Layers size={32} color="rgba(255,255,255,0.2)" />
          </div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, margin: "0 0 8px" }}>
            No programs activated yet
          </p>
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, margin: 0 }}>
            Add programs that your university offers so staff can enrol students
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([majorId, data]) => (
  <div key={majorId} className="prog-major-card">

    {/* MAJOR HEADER */}
    <div
      className="prog-major-header"
      onClick={() =>
        setExpanded(prev => ({
          ...prev,
          [majorId]: !prev[majorId]
        }))
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Layers size={14} />
        <div>
          <p className="prog-major-title">{data.major_name}</p>
          <p className="prog-major-sub">{data.field}</p>
        </div>
      </div>

      <span className="prog-expand-btn">
        {expanded[majorId] ? "Hide" : "Show"}
      </span>
    </div>

    {/* DEGREE LIST */}
    {expanded[majorId] && (
      <div className="prog-degree-list">
        {data.degrees.map(d => {
          const lc = LEVEL_COLOR[d.level] || LEVEL_COLOR.undergraduate;

          return (
            <div key={d.id} className="prog-degree-row">
              <span
                className="prog-degree-pill"
                style={{
                  background: lc.bg,
                  border: `1px solid ${lc.border}`,
                  color: lc.text
                }}
              >
                {d.degree_name}
              </span>

              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                {d.level}
              </span>

              <button
                className="prog-remove-btn"
                onClick={() => setConfirmRemove(d)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
    )}
  </div>
))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADD STAFF MODAL
// ─────────────────────────────────────────────────────────────
function AddStaffModal({ onClose, onSubmit }) {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email) return alert("Please fill all fields");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/staff`, { name, email }, authHeader());
      onSubmit({
        id: res.data.staffId, name, email,
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
          <input value={name}  onChange={(e) => setName(e.target.value)} />
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

// ─────────────────────────────────────────────────────────────
// STAFF CARDS
// ─────────────────────────────────────────────────────────────
function StaffCards({ staffList, handleResend }) {
  if (!staffList || staffList.length === 0) {
    return (
      <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 40 }}>
        No staff added yet.
      </p>
    );
  }
  return (
    <div className="admin-cards">
      {staffList.map((staff) => {
        const now     = new Date();
        const expired = staff.verification_expires &&
          new Date(staff.verification_expires) < now;
        const status  = staff.is_verified ? "Active" : expired ? "Inactive" : "Pending";
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

// ─────────────────────────────────────────────────────────────
// QUICK ACTIONS
// ─────────────────────────────────────────────────────────────
function QuickActions({ onAddStaff, onViewAlerts, onManagePrograms }) {
  return (
    <div className="uni-panel">
      <h3 className="uni-panel__title">Quick Actions</h3>
      <button className="uni-action" onClick={onAddStaff}>
        <span className="uni-action__left">
          <Plus size={18} className="uni-action__icon--plus" /> Add New Staff Member
        </span>
        <ChevronRight size={18} />
      </button>
      <button className="uni-action" onClick={onManagePrograms}>
        <span className="uni-action__left">
          <Layers size={18} className="uni-action__icon--plus" /> Manage Programs
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

// ─────────────────────────────────────────────────────────────
// SCHEDULE SUMMARY WIDGET (shown on Overview tab)
// ─────────────────────────────────────────────────────────────
const DAY_NAMES_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_NAMES_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function ScheduleSummaryWidget({ data, onManage }) {
  if (!data) return null;
  const { schedule, holidays } = data;
  if (!schedule) return null;

  const workDays   = Array.isArray(schedule.work_days) ? schedule.work_days : [];
  const workStart  = schedule.work_start?.slice(0, 5) || "08:00";
  const workEnd    = schedule.work_end?.slice(0, 5)   || "17:00";

  // Format time to 12h
  const fmt12 = (t) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour   = h % 12 || 12;
    return `${hour}:${String(m).padStart(2,"0")} ${period}`;
  };

  // Shift duration
  const [sh, sm] = workStart.split(":").map(Number);
  const [eh, em] = workEnd.split(":").map(Number);
  const shiftMins = (eh * 60 + em) - (sh * 60 + sm);
  const shiftLabel = shiftMins > 0
    ? `${Math.floor(shiftMins/60)}h${shiftMins%60>0?" "+shiftMins%60+"m":""}` : "";

  // Upcoming holidays (next 3)
  const today = new Date().toISOString().split("T")[0];
  const upcoming = holidays
    .filter(h => String(h.holiday_date).split("T")[0] >= today)
    .slice(0, 3);

  // Next holiday countdown
  const nextHoliday = upcoming[0];
  let daysUntil = null;
  if (nextHoliday) {
    const p = String(nextHoliday.holiday_date).split("T")[0].split("-");
    const hDate = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
    const now   = new Date(); now.setHours(0,0,0,0);
    daysUntil = Math.round((hDate - now) / 86400000);
  }

  return (
    <div className="uni-panel sched-summary-widget">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
        <h3 className="uni-panel__title" style={{ margin:0 }}>
          <Clock size={15} style={{ marginRight:8, verticalAlign:"middle", color:"#e8180e" }} />
          Office Schedule
        </h3>
        <button onClick={onManage} style={{
          fontSize:12, color:"rgba(255,255,255,0.4)", background:"transparent",
          border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"4px 10px",
          cursor:"pointer", fontFamily:"var(--font)", transition:"all 0.2s",
        }}
          onMouseEnter={e => e.currentTarget.style.color="white"}
          onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.4)"}
        >
          Manage →
        </button>
      </div>

      {/* Hours row */}
      <div className="sched-sum-hours-row">
        <div className="sched-sum-time-block">
          <span className="sched-sum-time-label">START</span>
          <span className="sched-sum-time-val">{fmt12(workStart)}</span>
        </div>
        <div className="sched-sum-divider">
          <div className="sched-sum-divider-line" />
          {shiftLabel && <span className="sched-sum-shift">{shiftLabel}</span>}
          <div className="sched-sum-divider-line" />
        </div>
        <div className="sched-sum-time-block sched-sum-time-block--right">
          <span className="sched-sum-time-label">END</span>
          <span className="sched-sum-time-val">{fmt12(workEnd)}</span>
        </div>
      </div>

      {/* Day chips */}
      <div className="sched-sum-days">
        {DAY_NAMES_SHORT.map((label, i) => (
          <span key={i} className={`sched-sum-day ${workDays.includes(i) ? "active" : ""}`}>
            {label}
          </span>
        ))}
      </div>

      {/* Timezone */}
      <p className="sched-sum-tz">🌍 {schedule.timezone || "Asia/Beirut"}</p>

      {/* Upcoming holidays */}
      {upcoming.length > 0 && (
        <div className="sched-sum-holidays">
          <p className="sched-sum-hol-title">
            <Calendar size={12} style={{ marginRight:5, verticalAlign:"middle" }} />
            Upcoming Holidays
          </p>
          {upcoming.map(h => {
            const parts = String(h.holiday_date).split("T")[0].split("-");
            const mon   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(parts[1],10)-1];
            const d     = parseInt(parts[2], 10);
            return (
              <div key={h.id} className="sched-sum-hol-row">
                <span className="sched-sum-hol-date">{mon} {d}</span>
                <span className="sched-sum-hol-label">{h.label}</span>
              </div>
            );
          })}
          {nextHoliday && daysUntil !== null && (
            <p className="sched-sum-countdown">
              {daysUntil === 0 ? "🎉 Holiday today!" :
               daysUntil === 1 ? "⏳ Holiday tomorrow" :
               `⏳ Next holiday in ${daysUntil} days`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SCHEDULE TAB
// ─────────────────────────────────────────────────────────────
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function HolidayRow({ holiday, onDelete, deletingId, past }) {
  // Parse "YYYY-MM-DD" directly to avoid timezone-shift NaN issues
  const parts = String(holiday.holiday_date).split("T")[0].split("-");
  const year  = parts[0];
  const month = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][parseInt(parts[1], 10) - 1] || "?";
  const day   = parseInt(parts[2], 10);
  return (
    <div className={`sched-holiday-row ${past ? "sched-holiday-row--past" : ""}`}>
      <div className="sched-holiday-date-badge">
        <span className="sched-holiday-month">{month}</span>
        <span className="sched-holiday-day">{day}</span>
        <span className="sched-holiday-year">{year}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="sched-holiday-label">{holiday.label}</p>
        {holiday.added_by && (
          <p className="sched-holiday-by">Added by {holiday.added_by}</p>
        )}
      </div>
      <button
        className="sched-delete-btn"
        onClick={() => onDelete(holiday.id, holiday.label)}
        disabled={deletingId === holiday.id}
        title="Remove holiday"
      >
        {deletingId === holiday.id
          ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />
          : <Trash2 size={12} />}
      </button>
    </div>
  );
}

function ScheduleTab({ addToast }) {
  const [schedule,        setSchedule]        = useState(null);
  const [holidays,        setHolidays]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [addingHoliday,   setAddingHoliday]   = useState(false);
  const [deletingId,      setDeletingId]      = useState(null);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [workStart,  setWorkStart]  = useState("08:00");
  const [workEnd,    setWorkEnd]    = useState("17:00");
  const [workDays,   setWorkDays]   = useState([1, 2, 3, 4, 5]);
  const [timezone,   setTimezone]   = useState("Asia/Beirut");
  const [holidayDate,  setHolidayDate]  = useState("");
  const [holidayLabel, setHolidayLabel] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, holRes] = await Promise.all([
        axios.get(`${API}/schedule`, authHeader()),
        axios.get(`${API}/schedule/holidays`, authHeader()),
      ]);
      const s = schedRes.data.schedule;
      setSchedule(s);
      setWorkStart(s.work_start?.slice(0, 5) || "08:00");
      setWorkEnd(s.work_end?.slice(0, 5)     || "17:00");
      setWorkDays(Array.isArray(s.work_days) ? s.work_days : [1, 2, 3, 4, 5]);
      setTimezone(s.timezone || "Asia/Beirut");
      setHolidays(holRes.data.holidays || []);
    } catch (err) {
      addToast("info", "Error", "Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleDay = (day) => {
    setWorkDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSaveSchedule = async () => {
    if (workDays.length === 0) {
      addToast("info", "Validation", "Select at least one working day.");
      return;
    }
    if (workStart >= workEnd) {
      addToast("info", "Validation", "End time must be after start time.");
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/schedule`, { work_start: workStart, work_end: workEnd, work_days: workDays, timezone }, authHeader());
      addToast("success", "Schedule Saved", "Working hours updated successfully.");
      fetchAll();
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!holidayDate || !holidayLabel.trim()) {
      addToast("info", "Validation", "Date and label are required.");
      return;
    }
    setAddingHoliday(true);
    try {
      await axios.post(`${API}/schedule/holidays`, { holiday_date: holidayDate, label: holidayLabel.trim() }, authHeader());
      addToast("success", "Holiday Added", `"${holidayLabel}" added.`);
      setHolidayDate(""); setHolidayLabel(""); setShowHolidayForm(false);
      fetchAll();
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Failed to add holiday.");
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id, label) => {
    setDeletingId(id);
    try {
      await axios.delete(`${API}/schedule/holidays/${id}`, authHeader());
      addToast("success", "Removed", `"${label}" removed.`);
      fetchAll();
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Failed to remove holiday.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)" }}>
        <RefreshCw size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
        <p style={{ margin: 0 }}>Loading schedule...</p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const upcomingHolidays = holidays.filter(h => h.holiday_date >= today);
  const pastHolidays     = holidays.filter(h => h.holiday_date <  today);

  // Shift duration preview
  let shiftLabel = "";
  if (workStart && workEnd && workStart < workEnd) {
    const [sh, sm] = workStart.split(":").map(Number);
    const [eh, em] = workEnd.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    shiftLabel = `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? mins % 60 + "m" : ""} shift`;
  }

  return (
    <div className="sched-layout">

      {/* ── LEFT: Working Hours ── */}
      <div className="sched-col">
        <div className="sched-panel">
          <div className="sched-panel__header">
            <div className="sched-panel__icon"><Clock size={18} /></div>
            <div>
              <h3 className="sched-panel__title">Working Hours</h3>
              <p className="sched-panel__sub">
                {schedule?.configured ? "Custom schedule active" : "Using system defaults"}
              </p>
            </div>
          </div>

          <div className="sched-time-row">
            <div className="sched-field">
              <label className="sched-label">Start Time</label>
              <input type="time" className="sched-time-input" value={workStart}
                onChange={e => setWorkStart(e.target.value)} />
            </div>
            <div className="sched-time-sep">→</div>
            <div className="sched-field">
              <label className="sched-label">End Time</label>
              <input type="time" className="sched-time-input" value={workEnd}
                onChange={e => setWorkEnd(e.target.value)} />
            </div>
          </div>

          {shiftLabel && (
            <div className="sched-duration-pill">⏱ {shiftLabel}</div>
          )}

          <div style={{ marginTop: 22 }}>
            <label className="sched-label">Working Days</label>
            <div className="sched-days-row">
              {DAY_LABELS.map((label, i) => (
                <button key={i}
                  className={`sched-day-btn ${workDays.includes(i) ? "active" : ""}`}
                  onClick={() => toggleDay(i)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <label className="sched-label">Timezone</label>
            <select className="sched-select" value={timezone} onChange={e => setTimezone(e.target.value)}>
              <option value="Asia/Beirut">Asia/Beirut (Lebanon)</option>
              <option value="UTC">UTC</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
              <option value="Asia/Riyadh">Asia/Riyadh</option>
            </select>
          </div>

          <button className="sched-save-btn" onClick={handleSaveSchedule} disabled={saving}>
            {saving
              ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
              : <CheckCircle2 size={14} />}
            {saving ? "Saving..." : "Save Schedule"}
          </button>
        </div>

        <div className="sched-note-box">
          <Shield size={14} style={{ color: "#60b0ff", flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>
            <strong style={{ color: "#60b0ff" }}>Fraud Detection uses this.</strong>{" "}
            Certificates issued outside working hours or on holidays automatically trigger the{" "}
            <em>Off-Hours</em> fraud rule.
          </p>
        </div>
      </div>

      {/* ── RIGHT: Holidays ── */}
      <div className="sched-col">
        <div className="sched-panel">
          <div className="sched-panel__header">
            <div className="sched-panel__icon sched-panel__icon--amber"><Calendar size={18} /></div>
            <div style={{ flex: 1 }}>
              <h3 className="sched-panel__title">Holidays & Off-Days</h3>
              <p className="sched-panel__sub">{holidays.length} day{holidays.length !== 1 ? "s" : ""} configured</p>
            </div>
            <button className="sched-add-holiday-btn" onClick={() => setShowHolidayForm(v => !v)}>
              <Plus size={13} /> Add Holiday
            </button>
          </div>

          {showHolidayForm && (
            <div className="sched-holiday-form">
              <div style={{ display: "flex", gap: 10 }}>
                <div className="sched-field" style={{ flex: "0 0 150px" }}>
                  <label className="sched-label">Date</label>
                  <input type="date" className="sched-date-input"
                    value={holidayDate} onChange={e => setHolidayDate(e.target.value)}
                    min={today} />
                </div>
                <div className="sched-field" style={{ flex: 1 }}>
                  <label className="sched-label">Label</label>
                  <input type="text" className="sched-date-input"
                    placeholder="e.g. Lebanese Independence Day"
                    value={holidayLabel} onChange={e => setHolidayLabel(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddHoliday()} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="sched-save-btn" style={{ flex: 1 }}
                  onClick={handleAddHoliday} disabled={addingHoliday}>
                  {addingHoliday ? "Adding..." : "Add Holiday"}
                </button>
                <button className="sched-cancel-btn"
                  onClick={() => { setShowHolidayForm(false); setHolidayDate(""); setHolidayLabel(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {holidays.length === 0 ? (
            <div className="sched-holidays-empty">
              <Calendar size={40} color="rgba(255,255,255,0.12)" />
              <p style={{ margin: "8px 0 4px", color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
                No holidays configured
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", margin: 0 }}>
                Add dates when the university is closed
              </p>
            </div>
          ) : (
            <>
              {upcomingHolidays.length > 0 && (
                <>
                  <p className="sched-group-label">Upcoming ({upcomingHolidays.length})</p>
                  {upcomingHolidays.map(h => (
                    <HolidayRow key={h.id} holiday={h} onDelete={handleDeleteHoliday}
                      deletingId={deletingId} />
                  ))}
                </>
              )}
              {pastHolidays.length > 0 && (
                <>
                  <p className="sched-group-label" style={{ marginTop: 18 }}>
                    Past ({pastHolidays.length})
                  </p>
                  {pastHolidays.slice(0, 5).map(h => (
                    <HolidayRow key={h.id} holiday={h} onDelete={handleDeleteHoliday}
                      deletingId={deletingId} past />
                  ))}
                  {pastHolidays.length > 5 && (
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", margin: "10px 0 0" }}>
                      +{pastHolidays.length - 5} more past holidays
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function UniversityAdmin() {
  const navigate = useNavigate();

  const [activeTab,       setActiveTab]       = useState("overview");
  const [isModalOpen,     setIsModalOpen]     = useState(false);
  const [showAddProgram,  setShowAddProgram]  = useState(false);
  const [staffList,       setStaffList]       = useState([]);
  const [fraudFlags,      setFraudFlags]      = useState([]);
  const [fraudStats,      setFraudStats]      = useState(null);
  const [programs,        setPrograms]        = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [admin,           setAdmin]           = useState(null);
  const [loadingAdmin,    setLoadingAdmin]    = useState(true);
  const [loadingFlags,    setLoadingFlags]    = useState(false);
  const [toasts,          setToasts]          = useState([]);
  const [overviewSchedule, setOverviewSchedule] = useState(null);

  const prevFlagCountRef = useRef(0);
  const pollIntervalRef  = useRef(null);

  // ── Toast helpers ──
  const addToast = useCallback((type, title, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Fetch current admin ──
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

  // ── Fetch staff ──
  const fetchStaff = useCallback(async (currentAdmin) => {
    if (!currentAdmin) return;
    try {
      const res   = await axios.get(`${API}/staff/staffs`, authHeader());
      const staff = res.data.staffs
        .filter((s) => s.university_name === currentAdmin.university_name)
        .map((s) => ({
          id: s.id, name: s.name, email: s.email,
          is_verified: s.is_verified,
          verification_expires: s.verification_expires,
          university_name: s.university_name,
        }));
      setStaffList(staff);
    } catch (err) {
      console.error("Failed to fetch staff:", err);
      if (err.response?.status === 401) navigate("/login");
    }
  }, [navigate]);

  // ── Fetch programs ──
  const fetchPrograms = useCallback(async () => {
    setLoadingPrograms(true);
    try {
      const res = await axios.get(`${API}/program/university`, authHeader());
      setPrograms(res.data.programs || []);
    } catch (err) {
      console.error("Failed to fetch programs:", err);
    } finally {
      setLoadingPrograms(false);
    }
  }, []);

  // ── Remove program ──
  const handleRemoveProgram = async (programId) => {
    try {
      await axios.delete(`${API}/program/university/${programId}`, authHeader());
      addToast("success", "Program Deactivated", "The program has been removed from your university.");
      fetchPrograms();
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Failed to remove program.");
    }
  };

  // ── Fetch fraud flags ──
  const fetchFraudFlags = useCallback(async (silent = false) => {
    if (!silent) setLoadingFlags(true);
    try {
      const res   = await axios.get(`${API}/fraud`, authHeader());
      const flags = res.data.flags || [];
      const newCount = flags.filter((f) => f.flag_status === "pending").length;
      if (silent && newCount > prevFlagCountRef.current) {
        const diff = newCount - prevFlagCountRef.current;
        addToast("fraud", `${diff} New Fraud Alert${diff > 1 ? "s" : ""}`,
          `${diff} new certificate${diff > 1 ? "s have" : " has"} been flagged for review.`);
      }
      prevFlagCountRef.current = newCount;
      setFraudFlags(flags);
    } catch (err) {
      console.error("Failed to fetch fraud flags:", err);
    } finally {
      if (!silent) setLoadingFlags(false);
    }
  }, [addToast]);

  // ── Fetch fraud stats ──
  const fetchFraudStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/fraud/stats`, authHeader());
      setFraudStats(res.data.stats);
    } catch (err) {
      console.error("Failed to fetch fraud stats:", err);
    }
  }, []);

  // ── Start polling ──
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => fetchFraudFlags(true), 30_000);
  }, [fetchFraudFlags]);

  // ── Dismiss flag ──
  const handleDismiss = async (flagId) => {
    try {
      await axios.patch(`${API}/fraud/${flagId}/dismiss`, {}, authHeader());
      addToast("success", "Flag Dismissed", "The fraud flag has been marked as a false positive.");
      await fetchFraudFlags();
      await fetchFraudStats();
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Failed to dismiss flag.");
    }
  };

  // ── Resolve flag ──
  const handleResolve = async (flagId, reviewNote) => {
    try {
      await axios.patch(`${API}/fraud/${flagId}/resolve`, { review_note: reviewNote }, authHeader());
      addToast("success", "Certificate Revoked", "Fraud confirmed. Certificate has been revoked.");
      await fetchFraudFlags();
      await fetchFraudStats();
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Failed to resolve flag.");
      throw err;
    }
  };

  // ── Resend activation ──
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
      addToast("success", "Email Sent", data.message || "Activation email sent!");
      fetchStaff(admin);
    } catch (err) {
      addToast("info", "Error", "Failed to resend activation email.");
    }
  };

  // ── Lifecycle ──
  useEffect(() => { fetchCurrentUser(); }, []);

  useEffect(() => {
    if (admin) {
      fetchStaff(admin);
      fetchFraudFlags();
      fetchFraudStats();
      fetchPrograms();
      startPolling();
      // Fetch schedule summary for overview widget
      Promise.all([
        axios.get(`${API}/schedule`, authHeader()),
        axios.get(`${API}/schedule/holidays`, authHeader()),
      ]).then(([schedRes, holRes]) => {
        setOverviewSchedule({
          schedule: schedRes.data.schedule,
          holidays: holRes.data.holidays || [],
        });
      }).catch(() => {}); // non-fatal
    }
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [admin]);

  // ── Derived ──
  const pendingFlags     = fraudFlags.filter((f) => f.flag_status === "pending");
  const totalPendingRisk = pendingFlags.reduce((sum, f) => sum + parseFloat(f.risk_score || 0), 0);
  const activePrograms   = programs.filter(p => p.is_active);

  if (loadingAdmin) {
    return <div className="loading">Loading admin info...</div>;
  }

  return (
    <div className="uni-dashboard">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <UniNavbar
        universityName={admin?.university_name ?? "No University Assigned"}
        adminName={admin?.name ?? "Unknown Admin"}
        pendingCount={pendingFlags.length}
        onBellClick={() => setActiveTab("alerts")}
        onSignOut={() => { localStorage.removeItem("token"); navigate("/login"); }}
      />

      <main className="uni-body">
        <TabBar
          activeTab={activeTab}
          onChange={setActiveTab}
          staffCount={staffList.length}
          pendingFlagsCount={pendingFlags.length}
          programCount={activePrograms.length}
        />

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            <StatsRow
              staffCount={staffList.length}
              pendingFlagsCount={pendingFlags.length}
              totalRisk={totalPendingRisk}
              programCount={activePrograms.length}
            />
            <div className="uni-bottom">
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <QuickActions
                  onAddStaff={() => setIsModalOpen(true)}
                  onViewAlerts={() => setActiveTab("alerts")}
                  onManagePrograms={() => setActiveTab("programs")}
                />
                <ScheduleSummaryWidget
                  data={overviewSchedule}
                  onManage={() => setActiveTab("schedule")}
                />
                <FraudStatsWidget stats={fraudStats} />
              </div>
              <RecentAlertsPreview flags={fraudFlags} onViewAll={() => setActiveTab("alerts")} />
            </div>
          </>
        )}

        {/* ── STAFF TAB ── */}
        {activeTab === "staff" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "white", margin: 0 }}>Staff Members ({staffList.length})</h3>
              <button onClick={() => setIsModalOpen(true)} className="staff-add-btn">
                <Plus size={16} /> Add Staff
              </button>
            </div>
            <StaffCards staffList={staffList} handleResend={handleResend} />
          </>
        )}

        {/* ── PROGRAMS TAB ── */}
        {activeTab === "programs" && (
          <ProgramsTab
            programs={programs}
            onAdd={() => setShowAddProgram(true)}
            onRemove={handleRemoveProgram}
            loading={loadingPrograms}
          />
        )}

        {/* ── FRAUD ALERTS TAB ── */}
        {activeTab === "alerts" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "white", margin: 0 }}>
                Fraud Alerts
                {pendingFlags.length > 0 && (
                  <span style={{ marginLeft: 10, fontSize: 14, color: "#f59e0b", fontWeight: 400 }}>
                    ({pendingFlags.length} pending · risk {totalPendingRisk})
                  </span>
                )}
              </h3>
            </div>
            <FraudAlertsTab
              flags={fraudFlags}
              onDismiss={handleDismiss}
              onResolve={handleResolve}
              loading={loadingFlags}
              onRefresh={() => { fetchFraudFlags(); fetchFraudStats(); }}
            />
          </>
        )}

        {/* ── SCHEDULE TAB ── */}
        {activeTab === "schedule" && (
          <ScheduleTab addToast={addToast} />
        )}
      </main>

      {/* ── Add Staff Modal ── */}
      {isModalOpen && (
        <AddStaffModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={(staff) => setStaffList((prev) => [...prev, staff])}
        />
      )}

      {/* ── Add Program Modal ── */}
      {showAddProgram && (
        <AddProgramModal
          onClose={() => setShowAddProgram(false)}
          onSubmit={() => {
            fetchPrograms();
            addToast("success", "Program Added", "The new program is now active for your university.");
          }}
        />
      )}
    </div>
  );
}