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
  Globe, Upload, Award,
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
// TAB BAR  (added "external" tab)
// ─────────────────────────────────────────────────────────────
function TabBar({ activeTab, onChange, staffCount, pendingFlagsCount, revokedCount }) {
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
        <Layers size={16} /> Programs
      </button>
      <button className={`uni-tab ${activeTab === "schedule" ? "active" : ""}`}
        onClick={() => onChange("schedule")}>
        <Clock size={16} /> Schedule
      </button>
      <button className={`uni-tab ${activeTab === "alerts" ? "active" : ""}`}
        onClick={() => onChange("alerts")}>
        <AlertTriangle size={16} /> Fraud Alerts
        {pendingFlagsCount > 0 && (
          <span className="tab-badge">{pendingFlagsCount}</span>
        )}
      </button>
      
      <button className={`uni-tab ${activeTab === "revoked" ? "active" : ""}`}
        onClick={() => onChange("revoked")}>
        <XCircle size={16} /> Revoked Certs
        {revokedCount > 0 && (
          <span className="tab-badge">{revokedCount}</span>
        )}
      </button>
      <button className={`uni-tab ${activeTab === "external" ? "active" : ""}`}
        onClick={() => onChange("external")}>
        <Globe size={16} /> Foreign Degrees
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
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.80)" }}>
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
// GROUPED FRAUD FLAG CARD  (one card per certificate)
// ─────────────────────────────────────────────────────────────
function GroupedFlagCard({ flags, onDismiss, onResolve }) {
  const [expanded,      setExpanded]      = useState(false);
  const [showRevoke,    setShowRevoke]    = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // All flags share the same certificate — use the first for header info
  const primary   = flags[0];
  const isPending = flags.some((f) => f.flag_status === "pending");
  const isRevoked = primary.cert_status === "revoked";

  // Aggregate risk across all flags for this certificate
  const totalRisk = flags.reduce((sum, f) => sum + parseFloat(f.risk_score || 0), 0);

  // Overall status: if any are pending → pending, else resolved/dismissed
  const overallStatus = isPending
    ? "pending"
    : flags.every((f) => f.flag_status === "resolved")
    ? "resolved"
    : flags.every((f) => f.flag_status === "dismissed")
    ? "dismissed"
    : "mixed";

  const statusColor = {
    pending:  "#f59e0b",
    resolved: "#22c55e",
    dismissed:"#64748b",
    mixed:    "#60b0ff",
  }[overallStatus];

  const handleDismissAll = async () => {
    setActionLoading(true);
    const pendingFlags = flags.filter((f) => f.flag_status === "pending");
    for (const f of pendingFlags) await onDismiss(f.flag_id);
    setActionLoading(false);
  };

  const handleResolve = async (note) => {
    setActionLoading(true);
    // Only need to resolve one — the backend auto-resolves the rest
    const pendingFlag = flags.find((f) => f.flag_status === "pending");
    if (pendingFlag) await onResolve(pendingFlag.flag_id, note);
    setActionLoading(false);
    setShowRevoke(false);
  };

  return (
    <>
      {showRevoke && (
        <RevokeConfirmModal
          flag={primary}
          onConfirm={handleResolve}
          onCancel={() => setShowRevoke(false)}
          loading={actionLoading}
        />
      )}

      <div className="flag-card">
        {/* ── Header ── */}
        <div className="flag-card__header">
          <div className="flag-card__left">
            {/* All rule tags for this certificate */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {flags.map((f) => (
                <span key={f.flag_id} className="flag-rule-tag">
                  {RULE_LABELS[f.rule_name] || f.rule_name}
                </span>
              ))}
              {flags.length > 1 && (
                <span style={{
                  padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                  background: "rgba(245,158,11,0.15)", color: "#f59e0b",
                  border: "1px solid rgba(245,158,11,0.30)",
                }}>
                  {flags.length} flags
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FileText size={16} color="#e10600" />
              <span className="flag-card__student">{primary.student_name}</span>
            </div>
            <p className="flag-card__cert">
              {primary.cert_number} · {primary.degree} in {primary.major}
              {primary.GPA ? ` · GPA ${parseFloat(primary.GPA).toFixed(2)}` : ""}
            </p>
            <p className="flag-card__meta">
              {primary.university_name} · Issued by{" "}
              <strong style={{ color: "rgba(255,255,255,0.7)" }}>
                {primary.issued_by_name || "Unknown"}
              </strong>
            </p>
          </div>

          <div className="flag-card__right">
            <span className="flag-status-badge" style={{
              color: statusColor,
              background: statusColor + "22",
              border: `1px solid ${statusColor}44`,
            }}>
              {overallStatus}
            </span>
            {/* Show combined risk when multiple flags */}
            <RiskBadge score={totalRisk} />
            <button className="flag-expand-btn" onClick={() => setExpanded(!expanded)}>
              <Eye size={14} /> {expanded ? "Less" : "Details"}
            </button>
          </div>
        </div>

        {/* ── Individual flag reasons ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {flags.map((f, i) => (
            <div key={f.flag_id} className="flag-reason-box" style={{
              borderLeft: `3px solid ${
                f.risk_score >= 100 ? "#ef4444" :
                f.risk_score >= 60  ? "#f59e0b" : "#64748b"
              }`,
              paddingLeft: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p className="flag-reason-label">
                  {RULE_LABELS[f.rule_name] || f.rule_name}
                </p>
                <span style={{
                  fontSize: 11, fontWeight: 800,
                  color: f.risk_score >= 100 ? "#ef4444" : f.risk_score >= 60 ? "#f59e0b" : "#94a3b8",
                }}>
                  risk +{f.risk_score}
                </span>
              </div>
              <p className="flag-reason-text">{f.reason}</p>
            </div>
          ))}
        </div>

        {/* ── Expanded details ── */}
        {expanded && (
          <div className="flag-details">
            <div className="flag-details__grid">
              <div className="flag-detail-item">
                <span className="flag-detail-label">National ID</span>
                <span className="flag-detail-value">{primary.national_id}</span>
              </div>
              <div className="flag-detail-item">
                <span className="flag-detail-label">Cert Status</span>
                <span className="flag-detail-value" style={{ color: isRevoked ? "#ef4444" : "#22c55e" }}>
                  {(primary.cert_status || "").toUpperCase()}
                </span>
              </div>
              <div className="flag-detail-item">
                <span className="flag-detail-label">Issued By Email</span>
                <span className="flag-detail-value">{primary.issued_by_email || "—"}</span>
              </div>
              <div className="flag-detail-item">
                <span className="flag-detail-label">First Flagged</span>
                <span className="flag-detail-value">
                  {new Date(primary.flagged_at).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Per-flag review notes */}
            {flags.filter((f) => f.review_note).map((f) => (
              <div key={f.flag_id} className="flag-review-note">
                <p className="flag-detail-label">{RULE_LABELS[f.rule_name]} — REVIEW NOTE</p>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{f.review_note}</p>
                {f.reviewed_by_name && (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.85)" }}>
                    Reviewed by {f.reviewed_by_name}
                    {f.resolved_at ? ` · ${new Date(f.resolved_at).toLocaleString()}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Actions ── */}
        {isPending && (
          <div className="flag-actions">
            {isRevoked ? (
              <div className="flag-already-revoked">
                <AlertTriangle size={14} />
                Certificate already revoked.
                <button className="flag-dismiss-btn" onClick={handleDismissAll}
                  disabled={actionLoading} style={{ marginLeft: 12 }}>
                  Dismiss All Flags
                </button>
              </div>
            ) : (
              <>
                <button className="flag-dismiss-btn" onClick={handleDismissAll} disabled={actionLoading}>
                  <CheckCircle2 size={14} />
                  {actionLoading ? "Processing..." : `Dismiss All (${flags.filter(f => f.flag_status === "pending").length} flags)`}
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
// FRAUD ALERTS TAB  (groups flags by certificate)
// ─────────────────────────────────────────────────────────────
function FraudAlertsTab({ flags, onDismiss, onResolve, loading, onRefresh }) {
  const [filter, setFilter] = useState("pending");

  // ── Group flags by certificate_id ──
  const grouped = flags.reduce((acc, flag) => {
    const key = flag.certificate_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(flag);
    return acc;
  }, {});

  // Each group's overall status for filtering:
  // A group is "pending" if any flag in it is pending
  const groups = Object.values(grouped);

  const filtered = groups.filter((group) => {
    if (filter === "all") return true;
    if (filter === "pending")   return group.some((f) => f.flag_status === "pending");
    if (filter === "resolved")  return group.every((f) => f.flag_status === "resolved");
    if (filter === "dismissed") return group.every((f) => f.flag_status === "dismissed");
    return true;
  });

  const counts = {
    pending:   groups.filter((g) => g.some((f) => f.flag_status === "pending")).length,
    resolved:  groups.filter((g) => g.every((f) => f.flag_status === "resolved")).length,
    dismissed: groups.filter((g) => g.every((f) => f.flag_status === "dismissed")).length,
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
          <p style={{ color: "rgba(255,255,255,0.80)", fontSize: 16, margin: 0 }}>
            No {filter === "all" ? "" : filter} fraud alerts
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((group) => (
            <GroupedFlagCard
              key={group[0].certificate_id}
              flags={group}
              onDismiss={onDismiss}
              onResolve={onResolve}
            />
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
  const [selectedDegrees, setSelectedDegrees] = useState([]);
  const [majorSearch,    setMajorSearch]    = useState("");
  const [loading,        setLoading]        = useState(false);
  const [fetchingDeg,    setFetchingDeg]    = useState(false);
  const [error,          setError]          = useState("");

  useEffect(() => {
    axios.get(`${API}/program/majors`, authHeader())
      .then(r => setAllMajors(r.data.majors || []))
      .catch(() => setError("Failed to load majors."));
  }, []);

  useEffect(() => {
    if (!selectedMajor) { setAllowedDegrees([]); setSelectedDegrees([]); return; }
    setFetchingDeg(true);
    setSelectedDegrees([]);
    axios.get(`${API}/program/majors/${selectedMajor}/degrees`, authHeader())
      .then(r => setAllowedDegrees(r.data.degrees || []))
      .catch(() => setError("Failed to load degrees."))
      .finally(() => setFetchingDeg(false));
  }, [selectedMajor]);

  const filteredMajors = allMajors.filter(m =>
    m.name.toLowerCase().includes(majorSearch.toLowerCase()) ||
    m.field.toLowerCase().includes(majorSearch.toLowerCase())
  );

  const grouped = filteredMajors.reduce((acc, m) => {
    if (!acc[m.field]) acc[m.field] = [];
    acc[m.field].push(m);
    return acc;
  }, {});

  const selectedMajorObj = allMajors.find(m => String(m.id) === String(selectedMajor));

  // ── Submit — one POST per selected degree ──
const handleSubmit = async () => {
  if (!selectedMajor || selectedDegrees.length === 0) {
    setError("Please select a major and at least one degree."); return;
  }
  setLoading(true);
  setError("");
  try {
    await Promise.all(
      selectedDegrees.map(degId =>
        axios.post(`${API}/program/university`,
          { major_id: Number(selectedMajor), degree_id: Number(degId) },
          authHeader()
        )
      )
    );
    onSubmit();
    onClose();
  } catch (err) {
    setError(err.response?.data?.message || "Failed to add one or more programs.");
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
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "rgba(255,255,255,0.78)"}}>
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

        <div style={{ marginBottom: 16 }}>
          <label className="prog-form-label">Select Major</label>
          <div className="prog-major-picker">
            {Object.keys(grouped).length === 0 ? (
              <p style={{ color: "#ffffff", padding: "12px 0", textAlign: "center", fontSize: 14 }}>
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

        <div style={{ marginBottom: 20 }}>
          <label className="prog-form-label">
            Select Degree
            {selectedMajorObj && (
              <span style={{ marginLeft: 8, fontSize: 11, color: "rgba(255,255,255,0.35)",
                fontWeight: 400 }}>for {selectedMajorObj.name}</span>
            )}
          </label>
          {!selectedMajor ? (
            <p style={{ color: "#ffffff", fontSize: 14, margin: 0 }}>
              Select a major first
            </p>
          ) : fetchingDeg ? (
            <p style={{ color: "rgba(255,255,255,0.70)", fontSize: 14, margin: 0 }}>Loading degrees…</p>
          ) : allowedDegrees.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.70)", fontSize: 14, margin: 0 }}>No degrees available</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              
              {allowedDegrees.map(d => {
                const lc = LEVEL_COLOR[d.level] || LEVEL_COLOR.undergraduate;
                const isSelected = selectedDegrees.some(s => String(s) === String(d.id));
                return (
                  <button key={d.id}
                    onClick={() =>
                      setSelectedDegrees(prev =>
                        isSelected
                          ? prev.filter(s => String(s) !== String(d.id))
                          : [...prev, d.id]
                      )
                    }
                    style={{
                      padding: "8px 16px", borderRadius: 20, cursor: "pointer",
                      border: `1px solid ${isSelected ? lc.text : lc.border}`,
                      background: isSelected ? lc.bg : "transparent",
                      color:   isSelected ? lc.text : "rgba(255,255,255,0.55)",
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

        
            {selectedMajor && selectedDegrees.length > 0 && (() => {
              const maj = allMajors.find(m => String(m.id) === String(selectedMajor));
              const degs = allowedDegrees.filter(d => selectedDegrees.some(s => String(s) === String(d.id)));
              if (!maj || degs.length === 0) return null;
              return (
                <div className="prog-summary-box">
                  <GraduationCap size={16} style={{ color: "#60b0ff", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                    Will activate <strong>{degs.length}</strong> program{degs.length > 1 ? "s" : ""} in{" "}
                    <strong>{maj.name}</strong>:{" "}
                    {degs.map(d => d.name).join(", ")}
                  </span>
                </div>
              );
            })()}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="modal-submit" onClick={handleSubmit}
            disabled={loading || !selectedMajor || selectedDegrees.length === 0}
            style={{ flex: 1, opacity: (!selectedMajor || selectedDegrees.length === 0) ? 0.5 : 1 }}>
            {loading ? "Adding…" : "Activate Program"}
          </button>
          <button onClick={onClose} style={{
            padding: "14px 20px", borderRadius: 13, border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)", color: "#ffffff",
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

  const grouped = programs
    .filter(p => p.is_active)
    .reduce((acc, p) => {
      if (!acc[p.major_id]) {
        acc[p.major_id] = { major_name: p.major_name, field: p.field, degrees: [] };
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
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.80)", margin: "0 0 18px" }}>
              <strong style={{ color: "white" }}>{confirmRemove.degree_name}</strong> in{" "}
              <strong style={{ color: "white" }}>{confirmRemove.major_name}</strong> will be deactivated.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => handleRemove(confirmRemove.id)}
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h3 style={{ color: "white", margin: 0, fontSize: 18, fontWeight: 800 }}>University Programs</h3>
          <p style={{ margin: "4px 0 0",fontSize: 14, color: "rgba(255,255,255,0.78)" }}>
            {programs.filter(p => p.is_active).length} active program
            {programs.filter(p => p.is_active).length !== 1 ? "s" : ""} across the university
          </p>
        </div>
        <button onClick={onAdd} className="staff-add-btn">
          <Plus size={16} /> Add Program
        </button>
      </div>

      {programs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Layers size={32} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, margin: "0 0 8px" }}>No programs activated yet</p>
        </div>
      ) : (
        Object.entries(grouped).map(([majorId, data]) => (
          <div key={majorId} className="prog-major-card">
            <div className="prog-major-header"
              onClick={() => setExpanded(prev => ({ ...prev, [majorId]: !prev[majorId] }))}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Layers size={14} />
                <div>
                  <p className="prog-major-title">{data.major_name}</p>
                  <p className="prog-major-sub">{data.field}</p>
                </div>
              </div>
              <span className="prog-expand-btn">{expanded[majorId] ? "Hide" : "Show"}</span>
            </div>
            {expanded[majorId] && (
              <div className="prog-degree-list">
                {data.degrees.map(d => {
                  const lc = LEVEL_COLOR[d.level] || LEVEL_COLOR.undergraduate;
                  return (
                    <div key={d.id} className="prog-degree-row">
                      <span className="prog-degree-pill"
                        style={{ background: lc.bg, border: `1px solid ${lc.border}`, color: lc.text }}>
                        {d.degree_name}
                      </span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{d.level}</span>
                      <button className="prog-remove-btn" onClick={() => setConfirmRemove(d)}>
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
// REVOKED CERTIFICATES TAB
// ─────────────────────────────────────────────────────────────
function RevokedCertsTab({ addToast }) {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showBlocked, setShowBlocked]   = useState(true);

  const fetchRevoked = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/certificates/revoked`, authHeader());
      setCertificates(res.data.certificates || []);
    } catch {
      addToast("info", "Error", "Failed to load revoked certificates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRevoked(); }, []);

  const handleAllowReissue = async (certId, certNumber) => {
    try {
      await axios.patch(`${API}/certificates/${certId}/allow-reissue`, {}, authHeader());
      addToast("success", "Reissue Allowed", `Staff can now reissue ${certNumber}.`);
      fetchRevoked();
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Failed to allow reissue.");
    }
  };

  const handleNeverReissue = async (certId, certNumber) => {
    if (!window.confirm(`Permanently block reissue for ${certNumber}?`)) return;
    try {
      await axios.patch(`${API}/certificates/${certId}/never-reissue`, {}, authHeader());
      addToast("info", "Blocked", `${certNumber} is permanently blocked from reissue.`);
      fetchRevoked();
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Failed to block reissue.");
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)" }}>
        <RefreshCw size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
        <p style={{ margin: 0 }}>Loading revoked certificates...</p>
      </div>
    );
  }

  // ── Group certificates by allow_reissue value ──
  const undecided    = certificates.filter(c => c.allow_reissue === 0);
  const neverReissue = certificates.filter(c => c.allow_reissue === 3);
  const approved     = certificates.filter(c => c.allow_reissue === 1);
  const reissued     = certificates.filter(c => c.allow_reissue === 2);

  if (certificates.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 16, padding: "60px 0" }}>
        <CheckCircle2 size={64} color="#2dce8a" />
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, margin: 0 }}>
          No revoked certificates
        </p>
      </div>
    );
  }

  const renderCert = (cert, mode) => (
    <div key={cert.id} className="flag-card" style={{ marginBottom: 14 }}>
      <div className="flag-card__header">
        <div className="flag-card__left">
          <span className="flag-rule-tag" style={{
            background: "rgba(239,68,68,0.14)", color: "#ff7f7a",
            border: "1px solid rgba(239,68,68,0.25)",
          }}>REVOKED</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <FileText size={16} color="#e10600" />
            <span className="flag-card__student">{cert.student_name}</span>
          </div>
          <p className="flag-card__cert">
            {cert.cert_number} · {cert.degree} in {cert.major}
            {cert.GPA ? ` · GPA ${parseFloat(cert.GPA).toFixed(2)}` : ""}
          </p>
          <p className="flag-card__meta">
            Issued by <strong style={{ color: "rgba(255,255,255,0.7)" }}>{cert.issued_by}</strong>
            {" · "}{new Date(cert.created_at).toLocaleDateString("en-GB")}
          </p>
        </div>
        <div className="flag-card__right">
          {mode === "undecided" && (
            <span className="flag-status-badge" style={{
              color: "#f59e0b", background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.30)",
            }}>
              🔒 Pending Decision
            </span>
          )}
          {mode === "blocked" && (
            <span className="flag-status-badge" style={{
              color: "#ef4444", background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.30)",
            }}>
              🚫 Never Reissue
            </span>
          )}
          {mode === "approved" && (
            <span className="flag-status-badge" style={{
              color: "#22c55e", background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.30)",
            }}>
              ✅ Reissue Approved
            </span>
          )}
          {mode === "reissued" && (
            <span className="flag-status-badge" style={{
              color: "#60b0ff", background: "rgba(96,176,255,0.12)",
              border: "1px solid rgba(96,176,255,0.30)",
            }}>
              ♻ Already Reissued
            </span>
          )}
        </div>
      </div>

      {cert.revoke_reason && (
        <div className="flag-reason-box">
          <p className="flag-reason-label">REVOKE REASON</p>
          <p className="flag-reason-text">{cert.revoke_reason}</p>
        </div>
      )}

      <div className="flag-details" style={{ marginTop: 12 }}>
        <div className="flag-details__grid">
          <div className="flag-detail-item">
            <span className="flag-detail-label">National ID</span>
            <span className="flag-detail-value">{cert.national_id}</span>
          </div>
          <div className="flag-detail-item">
            <span className="flag-detail-label">Graduation Date</span>
            <span className="flag-detail-value">
              {new Date(cert.graduation_date).toLocaleDateString("en-GB")}
            </span>
          </div>
          <div className="flag-detail-item">
            <span className="flag-detail-label">University</span>
            <span className="flag-detail-value">{cert.university_name}</span>
          </div>
          <div className="flag-detail-item">
            <span className="flag-detail-label">Certificate ID</span>
            <span className="flag-detail-value">{cert.id}</span>
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="flag-actions">

        {/* Undecided: can Allow Reissue OR Never Reissue */}
        {mode === "undecided" && (
          <>
            <button className="flag-dismiss-btn"
              onClick={() => handleAllowReissue(cert.id, cert.cert_number)}>
              <CheckCircle2 size={14} /> Allow Reissue
            </button>
            <button className="flag-revoke-btn"
              onClick={() => handleNeverReissue(cert.id, cert.cert_number)}>
              <XCircle size={14} /> Never Reissue
            </button>
          </>
        )}

        {/* Blocked (never reissue): can undo and allow reissue */}
        {mode === "blocked" && (
          <button className="flag-dismiss-btn"
            onClick={() => handleAllowReissue(cert.id, cert.cert_number)}>
            <CheckCircle2 size={14} /> Undo — Allow Reissue
          </button>
        )}

        {/* Approved: nothing more to do, staff will reissue */}
        {mode === "approved" && (
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
            Waiting for staff to issue the replacement certificate.
          </p>
        )}

        {/* Reissued: fully done */}
        {mode === "reissued" && (
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
            A replacement certificate has already been issued.
          </p>
        )}
      </div>
    </div>
  );

  const SectionHeader = ({ label, count, color, icon, open, onToggle }) => (
    <button
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "14px 18px", borderRadius: 14, marginBottom: 14,
        border: `1px solid ${color}33`,
        background: `${color}0d`,
        cursor: "pointer", textAlign: "left",
        fontFamily: "var(--font)",
      }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color: "white", flex: 1 }}>
        {label}
      </span>
      <span style={{
        padding: "3px 10px", borderRadius: 20,
        background: `${color}22`, color, fontSize: 12, fontWeight: 800,
      }}>
        {count}
      </span>
      <ChevronDown size={16} style={{
        color: "rgba(255,255,255,0.4)",
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 0.2s",
      }} />
    </button>
  );

  return (
    <div>

      {/* ── NEVER REISSUE section (top, most important) ── */}
      {neverReissue.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <SectionHeader
            label="Permanently Blocked — Never Reissue"
            count={neverReissue.length}
            color="#ef4444"
            icon="🚫"
            open={showBlocked}
            onToggle={() => setShowBlocked(v => !v)}
          />
          {showBlocked && neverReissue.map(c => renderCert(c, "blocked"))}
        </div>
      )}

      {/* ── UNDECIDED section ── */}
      {undecided.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase", letterSpacing: "0.6px",
            marginBottom: 14, padding: "0 4px",
          }}>
            ⏳ Awaiting Decision ({undecided.length})
          </div>
          {undecided.map(c => renderCert(c, "undecided"))}
        </div>
      )}

      {/* ── REISSUE APPROVED section ── */}
      {approved.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase", letterSpacing: "0.6px",
            marginBottom: 14, padding: "0 4px",
          }}>
            ✅ Reissue Approved ({approved.length})
          </div>
          {approved.map(c => renderCert(c, "approved"))}
        </div>
      )}

      {/* ── ALREADY REISSUED section ── */}
      {reissued.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase", letterSpacing: "0.6px",
            marginBottom: 14, padding: "0 4px",
          }}>
            ♻ Already Reissued ({reissued.length})
          </div>
          {reissued.map(c => renderCert(c, "reissued"))}
        </div>
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

// ─────────────────────────────────────────────────────────────
// STAFF CARDS
// ─────────────────────────────────────────────────────────────
function StaffCards({ staffList, handleResend, handleToggleStatus }) {
  if (!staffList || staffList.length === 0) {
    return <p style={{ color: "rgba(255,255,255,0.75)", textAlign: "center", padding: 40 }}>No staff added yet.</p>;
  }
  return (
    <div className="admin-cards">
      {staffList.map((staff) => {
        const now     = new Date();
        const expired = staff.verification_expires && new Date(staff.verification_expires) < now;
        const status  = staff.is_verified
          ? (staff.is_active ? "Active" : "Inactive")
          : expired ? "Expired" : "Pending";

        return (
          <div key={staff.id} className={`admin-card ${status === "Inactive" || status === "Expired" ? "expired" : ""}`}>
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
                status === "Active"   ? "verified" :
                status === "Inactive" ? "expired"  :
                status === "Expired"  ? "expired"  : "pending"
              }`}>
                {status}
              </span>

              {/* Deactivate button — only for verified active staff */}
              {staff.is_verified && staff.is_active && (
                <button
                  className="resend-btn"
                  style={{ borderColor: "rgba(239,68,68,0.30)", color: "#fca5a5", background: "rgba(239,68,68,0.08)" }}
                  onClick={() => handleToggleStatus(staff.id, staff.name, false)}
                >
                  Deactivate
                </button>
              )}

              {/* Activate button — only for verified but deactivated staff */}
              {staff.is_verified && !staff.is_active && (
                <button
                  className="resend-btn"
                  style={{ borderColor: "rgba(34,197,94,0.30)", color: "#86efac", background: "rgba(34,197,94,0.08)" }}
                  onClick={() => handleToggleStatus(staff.id, staff.name, true)}
                >
                  Activate
                </button>
              )}

              {/* Resend button — only for unverified expired token */}
              {!staff.is_verified && expired && (
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
        <span className="uni-action__left"><Plus size={18} className="uni-action__icon--plus" /> Add New Staff Member</span>
        <ChevronRight size={18} />
      </button>
      <button className="uni-action" onClick={onManagePrograms}>
        <span className="uni-action__left"><Layers size={18} className="uni-action__icon--plus" /> Manage Programs</span>
        <ChevronRight size={18} />
      </button>
      <button className="uni-action" onClick={onViewAlerts}>
        <span className="uni-action__left"><AlertTriangle size={18} className="uni-action__icon--alert" /> Review Fraud Alerts</span>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SCHEDULE SUMMARY WIDGET
// ─────────────────────────────────────────────────────────────
const DAY_NAMES_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function ScheduleSummaryWidget({ data, onManage }) {
  if (!data) return null;
  const { schedule, holidays } = data;
  if (!schedule) return null;

  const workDays  = Array.isArray(schedule.work_days) ? schedule.work_days : [];
  const workStart = schedule.work_start?.slice(0, 5) || "08:00";
  const workEnd   = schedule.work_end?.slice(0, 5)   || "17:00";

  const fmt12 = (t) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${period}`;
  };

  const [sh, sm] = workStart.split(":").map(Number);
  const [eh, em] = workEnd.split(":").map(Number);
  const shiftMins = (eh * 60 + em) - (sh * 60 + sm);
  const shiftLabel = shiftMins > 0
    ? `${Math.floor(shiftMins/60)}h${shiftMins%60>0?" "+shiftMins%60+"m":""}` : "";

  const today    = new Date().toISOString().split("T")[0];
  const upcoming = holidays.filter(h => String(h.holiday_date).split("T")[0] >= today).slice(0, 3);

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
        }}>Manage →</button>
      </div>
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
      <div className="sched-sum-days">
        {DAY_NAMES_SHORT.map((label, i) => (
          <span key={i} className={`sched-sum-day ${workDays.includes(i) ? "active" : ""}`}>{label}</span>
        ))}
      </div>
      <p className="sched-sum-tz">🌍 {schedule.timezone || "Asia/Beirut"}</p>
      {upcoming.length > 0 && (
        <div className="sched-sum-holidays">
          <p className="sched-sum-hol-title">
            <Calendar size={12} style={{ marginRight:5, verticalAlign:"middle" }} />
            Upcoming Holidays
          </p>
          {upcoming.map(h => {
            const parts = String(h.holiday_date).split("T")[0].split("-");
            const mon   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(parts[1],10)-1];
            return (
              <div key={h.id} className="sched-sum-hol-row">
                <span className="sched-sum-hol-date">{mon} {parseInt(parts[2], 10)}</span>
                <span className="sched-sum-hol-label">{h.label}</span>
              </div>
            );
          })}
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
        {holiday.added_by && <p className="sched-holiday-by">Added by {holiday.added_by}</p>}
      </div>
      <button className="sched-delete-btn" onClick={() => onDelete(holiday.id, holiday.label)}
        disabled={deletingId === holiday.id}>
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

  const toggleDay = (day) => setWorkDays(prev =>
    prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
  );

  const handleSaveSchedule = async () => {
    if (workDays.length === 0) { addToast("info", "Validation", "Select at least one working day."); return; }
    if (workStart >= workEnd)  { addToast("info", "Validation", "End time must be after start time."); return; }
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
    if (!holidayDate || !holidayLabel.trim()) { addToast("info", "Validation", "Date and label are required."); return; }
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

  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)" }}>
      <RefreshCw size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
      <p style={{ margin: 0 }}>Loading schedule...</p>
    </div>
  );

  const today = new Date().toISOString().split("T")[0];
  const upcomingHolidays = holidays.filter(h => h.holiday_date >= today);
  const pastHolidays     = holidays.filter(h => h.holiday_date <  today);

  let shiftLabel = "";
  if (workStart && workEnd && workStart < workEnd) {
    const [sh, sm] = workStart.split(":").map(Number);
    const [eh, em] = workEnd.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    shiftLabel = `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? mins % 60 + "m" : ""} shift`;
  }

  return (
    <div className="sched-layout">
      <div className="sched-col">
        <div className="sched-panel">
          <div className="sched-panel__header">
            <div className="sched-panel__icon"><Clock size={18} /></div>
            <div>
              <h3 className="sched-panel__title">Working Hours</h3>
              <p className="sched-panel__sub">{schedule?.configured ? "Custom schedule active" : "Using system defaults"}</p>
            </div>
          </div>
          <div className="sched-time-row">
            <div className="sched-field">
              <label className="sched-label">Start Time</label>
              <input type="time" className="sched-time-input" value={workStart} onChange={e => setWorkStart(e.target.value)} />
            </div>
            <div className="sched-time-sep">→</div>
            <div className="sched-field">
              <label className="sched-label">End Time</label>
              <input type="time" className="sched-time-input" value={workEnd} onChange={e => setWorkEnd(e.target.value)} />
            </div>
          </div>
          {shiftLabel && <div className="sched-duration-pill">⏱ {shiftLabel}</div>}
          <div style={{ marginTop: 22 }}>
            <label className="sched-label">Working Days</label>
            <div className="sched-days-row">
              {DAY_LABELS.map((label, i) => (
                <button key={i} className={`sched-day-btn ${workDays.includes(i) ? "active" : ""}`}
                  onClick={() => toggleDay(i)}>{label}</button>
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
            {saving ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={14} />}
            {saving ? "Saving..." : "Save Schedule"}
          </button>
        </div>
        <div className="sched-note-box">
          <Shield size={14} style={{ color: "#60b0ff", flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.55 }}>
            <strong style={{ color: "#60b0ff" }}>Fraud Detection uses this.</strong>{" "}
            Certificates issued outside working hours or on holidays automatically trigger the <em>Off-Hours</em> fraud rule.
          </p>
        </div>
      </div>

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
                  <input type="date" className="sched-date-input" value={holidayDate}
                    onChange={e => setHolidayDate(e.target.value)} min={today} />
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
                <button className="sched-save-btn" style={{ flex: 1 }} onClick={handleAddHoliday} disabled={addingHoliday}>
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
              <p style={{ margin: "8px 0 4px", color: "#ffffff", fontSize: 15 }}>No holidays configured</p>
            </div>
          ) : (
            <>
              {upcomingHolidays.length > 0 && (
                <>
                  <p className="sched-group-label">Upcoming ({upcomingHolidays.length})</p>
                  {upcomingHolidays.map(h => <HolidayRow key={h.id} holiday={h} onDelete={handleDeleteHoliday} deletingId={deletingId} />)}
                </>
              )}
              {pastHolidays.length > 0 && (
                <>
                  <p className="sched-group-label" style={{ marginTop: 18 }}>Past ({pastHolidays.length})</p>
                  {pastHolidays.slice(0, 5).map(h => <HolidayRow key={h.id} holiday={h} onDelete={handleDeleteHoliday} deletingId={deletingId} past />)}
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

// ═══════════════════════════════════════════════════════════════
// EXTERNAL DEGREES TAB  ← NEW
// ═══════════════════════════════════════════════════════════════
function ExternalDegreesTab({ addToast }) {
  // ── Phase 1: national ID lookup ──
  const [nationalId,     setNationalId]     = useState("");
  const [lookupLoading,  setLookupLoading]  = useState(false);
  const [lookupDone,     setLookupDone]     = useState(false);
  const [studentFound,   setStudentFound]   = useState(false);
  const [studentInfo,    setStudentInfo]    = useState(null);

  // ── Phase 1b: if not found ──
  const [newFullName, setNewFullName] = useState("");
  const [newDob,      setNewDob]      = useState("");

  // ── Phase 2: degree details ──
  const [allMajors,      setAllMajors]      = useState([]);
  const [allowedDegrees, setAllowedDegrees] = useState([]);
  const [selectedMajor,  setSelectedMajor]  = useState(null);
  const [selectedDegree, setSelectedDegree] = useState(null);
  const [majorSearch,    setMajorSearch]    = useState("");
  const [fetchingDeg,    setFetchingDeg]    = useState(false);

  const [institution,    setInstitution]    = useState("");
  const [country,        setCountry]        = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [notes,          setNotes]          = useState("");
  const [docFile,        setDocFile]        = useState(null);

  const [checklist, setChecklist] = useState({
    ministry_stamp:   false,
    original_seen:    false,
    photo_id_matched: false,
  });
  const allChecked = Object.values(checklist).every(Boolean);

  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(null);
  const [fetchErr, setFetchErr] = useState("");

  
  const [showList,      setShowList]      = useState(false);
  const [allExtDegrees, setAllExtDegrees] = useState([]);
  const [listLoading,   setListLoading]   = useState(false);
  const [deletingId,    setDeletingId]    = useState(null);
  const [listSearch,    setListSearch]    = useState("");

  const ALLOWED_LEVELS = ["undergraduate", "graduate"];

  // fetch majors once
  useEffect(() => {
    axios.get(`${API}/program/majors`, authHeader())
      .then(r => setAllMajors(r.data.majors || []))
      .catch(() => setFetchErr("Failed to load majors list."));
  }, []);

  // when major changes → load degrees
  useEffect(() => {
    if (!selectedMajor) { setAllowedDegrees([]); setSelectedDegree(null); return; }
    setFetchingDeg(true);
    setSelectedDegree(null);
    axios.get(`${API}/program/majors/${selectedMajor.id}/degrees`, authHeader())
      .then(r => {
        const filtered = (r.data.degrees || []).filter(d => ALLOWED_LEVELS.includes(d.level));
        setAllowedDegrees(filtered);
      })
      .catch(() => setFetchErr("Failed to load degrees."))
      .finally(() => setFetchingDeg(false));
  }, [selectedMajor]);

  const filtered = allMajors.filter(m =>
    m.name.toLowerCase().includes(majorSearch.toLowerCase()) ||
    m.field.toLowerCase().includes(majorSearch.toLowerCase())
  );
  const grouped = filtered.reduce((acc, m) => {
    if (!acc[m.field]) acc[m.field] = [];
    acc[m.field].push(m);
    return acc;
  }, {});

  
  const fetchAllExtDegrees = async () => {
    setListLoading(true);
    try {
      const res = await axios.get(`${API}/external-degrees/`, authHeader());
      setAllExtDegrees(res.data.external_degrees || []);
    } catch (err) {
      addToast("info", "Error", "Failed to load external degrees.");
    } finally {
      setListLoading(false);
    }
  };

  const handleToggleList = () => {
    if (!showList) fetchAllExtDegrees();
    setShowList(v => !v);
  };

  // ── Delete external degree ──
  const handleDelete = async (id, label) => {
    if (!window.confirm(`Delete external degree: ${label}?`)) return;
    setDeletingId(id);
    try {
      await axios.delete(`${API}/external-degrees/${id}`, authHeader());
      addToast("success", "Deleted", `"${label}" has been removed.`);
      setAllExtDegrees(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Phase 1: lookup ──
  const handleLookup = async () => {
    if (!nationalId.trim()) {
      addToast("info", "Required", "Please enter a national ID.");
      return;
    }
    setLookupLoading(true);
    setFetchErr("");
    try {
      const res = await axios.get(
        `${API}/external-degrees/lookup/${nationalId.trim()}`,
        authHeader()
      );
      setStudentFound(res.data.found);
      setStudentInfo(res.data.student || null);
      setLookupDone(true);
    } catch (err) {
      addToast("info", "Error", "Failed to look up national ID.");
    } finally {
      setLookupLoading(false);
    }
  };

  const resetAll = () => {
    setNationalId(""); setLookupDone(false); setStudentFound(false);
    setStudentInfo(null); setNewFullName(""); setNewDob("");
    setSelectedMajor(null); setSelectedDegree(null); setMajorSearch("");
    setInstitution(""); setCountry(""); setGraduationYear(""); setNotes("");
    setDocFile(null);
    setChecklist({ ministry_stamp: false, original_seen: false, photo_id_matched: false });
    setSuccess(null);
  };

  // ── Phase 2: submit ──
  const handleSubmit = async () => {
    if (!selectedDegree || !selectedMajor || !institution || !country || !graduationYear) {
      addToast("info", "Incomplete Form", "Please fill in all required fields.");
      return;
    }
    if (!studentFound && (!newFullName.trim() || !newDob)) {
      addToast("info", "Required", "Please provide the student's full name and date of birth.");
      return;
    }
    const year = parseInt(graduationYear, 10);
    if (isNaN(year) || year < 1950 || year > new Date().getFullYear()) {
      addToast("info", "Invalid Year", "Please enter a valid graduation year.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("national_id",     nationalId.trim());
      formData.append("degree",          selectedDegree.name);
      formData.append("major",           selectedMajor.name);
      formData.append("institution",     institution);
      formData.append("country",         country);
      formData.append("graduation_year", graduationYear);
      if (!studentFound) {
        formData.append("full_name",    newFullName.trim());
        formData.append("date_of_birth", newDob);
      }
      if (notes)   formData.append("notes", notes);
      if (docFile) formData.append("document", docFile);

      await axios.post(`${API}/external-degrees`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccess(`${selectedDegree.name} in ${selectedMajor.name} from ${institution}`);
      addToast("success", "Foreign Degree Added", "The external degree has been registered successfully.");
      if (showList) fetchAllExtDegrees();
      resetAll();
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // ── Filtered list for search ──
  const filteredList = allExtDegrees.filter(d =>
    d.student_name.toLowerCase().includes(listSearch.toLowerCase()) ||
    d.national_id.toLowerCase().includes(listSearch.toLowerCase()) ||
    d.major.toLowerCase().includes(listSearch.toLowerCase()) ||
    d.institution.toLowerCase().includes(listSearch.toLowerCase())
  );

  const inp = {
    width: "100%", boxSizing: "border-box",
    padding: "12px 14px", borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)", color: "white",
    fontSize: 14, fontFamily: "var(--font)", outline: "none",
  };
  const lbl = {
  display: "block", marginBottom: 7,
  fontSize: 13, fontWeight: 700, letterSpacing: "0.4px",
  color: "#ffffff", textTransform: "uppercase",
  };
  const card = {
    background: "rgba(18,32,64,0.88)",
    border: "1px solid rgba(42,65,110,0.55)",
    borderRadius: 18, padding: "22px 22px", marginBottom: 18,
  };

  return (
    <div>
      {/* ── Header row ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h3 style={{ color: "white", margin: 0, fontSize: 20, fontWeight: 800 }}>
            Register Foreign Degree
          </h3>
          <p style={{ margin: "5px 0 0", fontSize: 14, color: "rgba(255,255,255,0.78)" }}>
            Verify a foreign qualification so the student can enrol in graduate programs.
          </p>
        </div>
        <button
          onClick={handleToggleList}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 18px", borderRadius: 12,
            border: `1px solid ${showList ? "rgba(96,176,255,0.45)" : "rgba(255,255,255,0.12)"}`,
            background: showList ? "rgba(96,176,255,0.12)" : "rgba(255,255,255,0.04)",
            color: showList ? "#7cc0ff" : "#ffffff",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            fontFamily: "var(--font)", transition: "all 0.2s",
          }}>
          <Globe size={15} />
          {showList ? "Hide List" : "View All Foreign Degrees"}
          {allExtDegrees.length > 0 && showList && (
            <span style={{
              background: "rgba(96,176,255,0.20)", color: "#7cc0ff",
              borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 800,
            }}>
              {allExtDegrees.length}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════
          ALL EXTERNAL DEGREES LIST
      ══════════════════════════════════════════ */}
      {showList && (
        <div style={{ ...card, marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(96,176,255,0.12)", border: "1px solid rgba(96,176,255,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Globe size={16} style={{ color: "#60b0ff" }} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "white" }}>
                  All Registered Foreign Degrees
                </h4>
                <p style={{ margin: "2px 0 0", fontSize: 14, color: "white"}}>
                  {allExtDegrees.length} record{allExtDegrees.length !== 1 ? "s" : ""} total
                </p>
              </div>
            </div>
            <button onClick={fetchAllExtDegrees} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px", borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent", color: "#ffffff",
              fontSize: 13, cursor: "pointer", fontFamily: "var(--font)",
            }}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <Search size={14} style={{
              position: "absolute", left: 12, top: "50%",
              transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)",
              pointerEvents: "none",
            }} />
            <input
              style={{ ...inp, paddingLeft: 36 }}
              placeholder="Search by name, national ID, major, institution…"
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
            />
          </div>

          {/* List */}
          {listLoading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.35)" }}>
              <RefreshCw size={24} style={{ marginBottom: 10, opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: 13 }}>Loading…</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Globe size={36} color="rgba(255,255,255,0.12)" style={{ marginBottom: 12 }} />
              <p style={{ color: "#ffffff", fontSize: 14, margin: 0 }}>
                {allExtDegrees.length === 0 ? "No foreign degrees registered yet" : "No results match your search"}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredList.map(d => {
                const degLevel  = d.degree === "Master" ? "graduate" : "undergraduate";
                const lc        = LEVEL_COLOR[degLevel] || LEVEL_COLOR.undergraduate;
                return (
                  <div key={d.id} style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px", borderRadius: 14,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    transition: "all 0.2s",
                  }}>
                    {/* Degree badge */}
                    <span style={{
                      padding: "5px 12px", borderRadius: 999, flexShrink: 0,
                      background: lc.bg, border: `1px solid ${lc.border}`,
                      color: lc.text, fontSize: 11, fontWeight: 800,
                    }}>
                      {d.degree}
                    </span>

                    {/* Main info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>
                          {d.student_name}
                        </span>
                        <span style={{
                          fontSize: 13, color: "rgba(255,255,255,0.72)",
                          fontFamily: "var(--mono)",
                        }}>
                          {d.national_id}
                        </span>
                      </div>
                      <p style={{ margin: "3px 0 0", fontSize: 14, color: "rgba(255,255,255,0.82)" }}>
                        {d.major} · {d.institution}, {d.country} · {d.graduation_year}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
                        Verified by {d.verified_by_name} · {new Date(d.verified_at).toLocaleDateString("en-GB")}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(d.id, `${d.degree} in ${d.major} — ${d.student_name}`)}
                      disabled={deletingId === d.id}
                      style={{
                        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                        border: "1px solid rgba(239,68,68,0.20)",
                        background: "rgba(239,68,68,0.07)",
                        color: "#ef4444", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        cursor: "pointer", transition: "all 0.2s",
                        opacity: deletingId === d.id ? 0.5 : 1,
                      }}>
                      {deletingId === d.id
                        ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />
                        : <Trash2 size={12} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Success banner ── */}
      {success && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px", borderRadius: 14, marginBottom: 24,
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
        }}>
          <CheckCircle2 size={18} style={{ color: "#22c55e" }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#22c55e", fontWeight: 700 }}>
              Registered: {success}
            </p>
          </div>
          <button onClick={() => setSuccess(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ════ PHASE 1: National ID Lookup ════ */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(96,176,255,0.12)", border: "1px solid rgba(96,176,255,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Search size={16} style={{ color: "#60b0ff" }} />
          </div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "white" }}>
            Step 1 — Find Student by National ID
          </h4>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>National ID *</label>
            <input
              style={inp}
              value={nationalId}
              placeholder="Enter national ID number"
              onChange={e => {
                setNationalId(e.target.value);
                setLookupDone(false);
                setStudentInfo(null);
                setStudentFound(false);
              }}
              onKeyDown={e => e.key === "Enter" && handleLookup()}
              disabled={lookupLoading}
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={handleLookup}
              disabled={lookupLoading || !nationalId.trim()}
              style={{
                padding: "12px 20px", borderRadius: 12, border: "none",
                background: "var(--accent)", color: "white", fontWeight: 700,
                fontSize: 14, cursor: "pointer", fontFamily: "var(--font)",
                opacity: !nationalId.trim() ? 0.5 : 1,
              }}>
              {lookupLoading ? "Searching…" : "Search"}
            </button>
          </div>
        </div>

        {/* Student found */}
        {lookupDone && studentFound && studentInfo && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            marginTop: 14, padding: "12px 16px", borderRadius: 12,
            background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.25)",
          }}>
            <CheckCircle2 size={18} style={{ color: "#22c55e", flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "white" }}>
                {studentInfo.full_name}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
                DOB: {studentInfo.date_of_birth} · Internal ID: {studentInfo.id}
              </p>
            </div>
          </div>
        )}

        {/* Student not found */}
        {lookupDone && !studentFound && (
          <div style={{ marginTop: 16 }}>
            <div style={{
              display: "flex", gap: 10, padding: "12px 14px", borderRadius: 12, marginBottom: 16,
              background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)",
            }}>
              <AlertTriangle size={16} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,200,100,0.85)" }}>
                Student not found. Please enter their details to register them.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Full Name *</label>
                <input style={inp} value={newFullName} placeholder="e.g. Ahmad Khalil"
                  onChange={e => setNewFullName(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Date of Birth *</label>
                <input style={{ ...inp, colorScheme: "dark" }} type="date" value={newDob}
                  onChange={e => setNewDob(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════ PHASE 2: Degree Details ════ */}
      {lookupDone && (
        <>
          <div style={{
            display: "flex", gap: 12, padding: "14px 18px", borderRadius: 14, marginBottom: 18,
            background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)",
          }}>
            <AlertTriangle size={18} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,200,100,0.85)", lineHeight: 1.65 }}>
              You are manually verifying a foreign degree.{" "}
              <strong style={{ color: "#f59e0b" }}>Your name will be recorded as the verifier.</strong>
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

            {/* LEFT: Major + Degree */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <BookOpen size={16} style={{ color: "#818cf8" }} />
                </div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "white" }}>
                  Step 2 — Select Major &amp; Degree
                </h4>
              </div>

              {fetchErr && (
                <div style={{
                  padding: "9px 12px", borderRadius: 10, marginBottom: 14,
                  background: "rgba(232,24,14,0.09)", border: "1px solid rgba(232,24,14,0.22)",
                  color: "#ff9090", fontSize: 12,
                }}>
                  {fetchErr}
                </div>
              )}

              <div style={{ marginBottom: 14, position: "relative" }}>
                <label style={lbl}>Search Major</label>
                <Search size={14} style={{
                  position: "absolute", left: 12, bottom: 14,
                  color: "rgba(255,255,255,0.35)", pointerEvents: "none",
                }} />
                <input
                  style={{ ...inp, paddingLeft: 36 }}
                  placeholder="e.g. Computer Science…"
                  value={majorSearch}
                  onChange={e => setMajorSearch(e.target.value)}
                />
              </div>

              <div style={{
                maxHeight: 220, overflowY: "auto", padding: "12px 14px", borderRadius: 14,
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: 16,
              }}>
                {Object.keys(grouped).length === 0 ? (
                  <p style={{ color: "white", fontSize: 13, margin: 0, textAlign: "center" }}>
                    {allMajors.length === 0 ? "Loading…" : "No majors match"}
                  </p>
                ) : Object.entries(grouped).map(([field, majors]) => (
                  <div key={field} style={{ marginBottom: 10 }}>
                    <p style={{
                      margin: "0 0 6px", fontSize: 13, fontWeight: 800,
                      color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.6px",
                    }}>{field}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {majors.map(m => {
                        const isSel = selectedMajor?.id === m.id;
                        return (
                          <button key={m.id}
                            onClick={() => setSelectedMajor(isSel ? null : m)}
                            style={{
                              padding: "7px 12px", borderRadius: 999,
                              border: `1px solid ${isSel ? "rgba(96,176,255,0.5)" : "rgba(255,255,255,0.08)"}`,
                              background: isSel ? "rgba(96,176,255,0.16)" : "rgba(255,255,255,0.03)",
                              color: isSel ? "#7cc0ff" : "rgba(255,255,255,0.65)",
                              fontSize: 12, fontWeight: 700, cursor: "pointer",
                              fontFamily: "var(--font)", transition: "all 0.18s",
                            }}>
                            {m.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label style={lbl}>
                  Degree *
                  <span style={{ marginLeft: 8, fontWeight: 400, textTransform: "none",
                    color: "rgba(255,255,255,0.80)", fontSize: 13}}>
                    Bachelor or Master only
                  </span>
                </label>
                {!selectedMajor ? (
                  <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Select a major first</p>
                ) : fetchingDeg ? (
                  <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.80)" }}>Loading…</p>
                ) : allowedDegrees.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "rgba(255,100,100,0.6)" }}>
                    No Bachelor or Master degrees available for this major
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {allowedDegrees.map(d => {
                      const lc  = LEVEL_COLOR[d.level] || LEVEL_COLOR.undergraduate;
                      const sel = selectedDegree?.id === d.id;
                      return (
                        <button key={d.id}
                          onClick={() => setSelectedDegree(sel ? null : d)}
                          style={{
                            padding: "9px 18px", borderRadius: 22, cursor: "pointer",
                            border: `1px solid ${sel ? lc.text : lc.border}`,
                            background: sel ? lc.bg : "transparent",
                            color: sel ? lc.text : "rgba(255,255,255,0.55)",
                            fontSize: 13, fontWeight: 700, fontFamily: "var(--font)",
                          }}>
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedMajor && selectedDegree && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 14px", borderRadius: 12, marginTop: 14,
                  background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.20)",
                }}>
                  <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
                  <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.8)" }}>
                    <strong style={{ color: "white" }}>{selectedDegree.name}</strong>{" "}
                    in <strong style={{ color: "white" }}>{selectedMajor.name}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* RIGHT: Institution + Upload + Submit */}
            <div>
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Globe size={16} style={{ color: "#22c55e" }} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "white" }}>
                    Step 3 — Institution Details
                  </h4>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Institution Name *</label>
                  <input style={inp} value={institution} placeholder="e.g. Cairo University"
                    onChange={e => setInstitution(e.target.value)} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={lbl}>Country *</label>
                    <input style={inp} value={country} placeholder="e.g. Egypt"
                      onChange={e => setCountry(e.target.value)} />
                  </div>
                  <div>
                    <label style={lbl}>Graduation Year *</label>
                    <input style={inp} type="number" value={graduationYear}
                      placeholder={`e.g. ${new Date().getFullYear() - 2}`}
                      min="1950" max={new Date().getFullYear()}
                      onChange={e => setGraduationYear(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label style={lbl}>Notes (optional)</label>
                  <textarea
                    style={{ ...inp, resize: "vertical", lineHeight: 1.55 }}
                    rows={3} value={notes} placeholder="Ministry stamp reference, etc."
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Upload */}
              <div style={{ ...card }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Upload size={16} style={{ color: "#f59e0b" }} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "white" }}>
                      Document (optional)
                    </h4>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "rgba(255,255,255,0.70)" }}>
                      PDF or image, max 10 MB
                    </p>
                  </div>
                </div>
                <label style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                  padding: "20px 16px", borderRadius: 12, cursor: "pointer",
                  border: `2px dashed ${docFile ? "rgba(34,197,94,0.40)" : "rgba(255,255,255,0.10)"}`,
                  background: docFile ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.02)",
                }}>
                  {docFile ? (
                    <>
                      <CheckCircle2 size={24} style={{ color: "#22c55e" }} />
                      <p style={{ margin: 0, fontSize: 13, color: "#22c55e", fontWeight: 700 }}>{docFile.name}</p>
                    </>
                  ) : (
                    <>
                      <Upload size={24} style={{ color: "rgba(255,255,255,0.2)" }} />
                      <p style={{ margin: 0, fontSize: 13, color: "#ffffff" }}>Click to upload</p>
                    </>
                  )}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: "none" }}
                    onChange={e => setDocFile(e.target.files[0] || null)} />
                </label>
                {docFile && (
                  <button onClick={() => setDocFile(null)} style={{
                    marginTop: 10, width: "100%", padding: "8px", borderRadius: 10,
                    border: "1px solid rgba(239,68,68,0.20)", background: "rgba(239,68,68,0.06)",
                    color: "#ef4444", fontSize: 12, cursor: "pointer", fontFamily: "var(--font)",
                  }}>
                    Remove file
                  </button>
                )}
              </div>

              {/* Checklist */}
              <div style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12, padding: 16, marginBottom: 16,
              }}>
                <p style={{ color: "#f59e0b", fontWeight: 700, margin: "0 0 12px", fontSize: 13 }}>
                  ⚠️ Confirm all of the following:
                </p>
                {[
                  { key: "ministry_stamp",   label: "I have seen the official Ministry of Education equivalency stamp" },
                  { key: "original_seen",    label: "I have physically verified the original foreign diploma" },
                  { key: "photo_id_matched", label: "I have matched the student's national ID with the diploma name" },
                ].map(({ key, label }) => (
                  <label key={key} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    color: "rgba(255,255,255,0.75)", fontSize: 13,
                    marginBottom: 10, cursor: "pointer",
                  }}>
                    <input type="checkbox" checked={checklist[key]}
                      onChange={e => setChecklist(prev => ({ ...prev, [key]: e.target.checked }))}
                      style={{ marginTop: 2, accentColor: "#22c55e", width: 16, height: 16 }}
                    />
                    {label}
                  </label>
                ))}
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={
                  loading || !selectedMajor || !selectedDegree ||
                  !institution || !country || !graduationYear || !allChecked ||
                  (!studentFound && (!newFullName.trim() || !newDob))
                }
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  width: "100%", padding: "15px", borderRadius: 14, border: "none",
                  background: "var(--accent)", color: "white", fontSize: 15, fontWeight: 700,
                  fontFamily: "var(--font)", cursor: "pointer",
                  boxShadow: "0 4px 18px rgba(232,24,14,0.28)", marginBottom: 10,
                  opacity: (
                    loading || !selectedMajor || !selectedDegree ||
                    !institution || !country || !graduationYear || !allChecked ||
                    (!studentFound && (!newFullName.trim() || !newDob))
                  ) ? 0.5 : 1,
                }}>
                {loading
                  ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Registering…</>
                  : <><Award size={16} /> Register Foreign Degree</>}
              </button>

              <button onClick={resetAll} style={{
                width: "100%", padding: "11px", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.72)", fontSize: 14, cursor: "pointer",
                fontFamily: "var(--font)",
              }}>
                Start Over
              </button>
            </div>
          </div>
        </>
      )}
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
  const [revokedCerts,    setRevokedCerts]    = useState([]);
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

  const fetchStaff = useCallback(async (currentAdmin) => {
    if (!currentAdmin) return;
    try {
      const res   = await axios.get(`${API}/staff/staffs`, authHeader());
      const staff = res.data.staffs
        .filter((s) => s.university_name === currentAdmin.university_name)
        .map((s) => ({
          id: s.id, name: s.name, email: s.email,
          is_verified: s.is_verified,
          is_active: s.is_active, 
          verification_expires: s.verification_expires,
          university_name: s.university_name,
        }));
      setStaffList(staff);
    } catch (err) {
      console.error("Failed to fetch staff:", err);
      if (err.response?.status === 401) navigate("/login");
    }
  }, [navigate]);

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

  const handleRemoveProgram = async (programId) => {
    try {
      await axios.delete(`${API}/program/university/${programId}`, authHeader());
      addToast("success", "Program Deactivated", "The program has been removed from your university.");
      fetchPrograms();
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Failed to remove program.");
    }
  };

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

  const fetchFraudStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/fraud/stats`, authHeader());
      setFraudStats(res.data.stats);
    } catch (err) {
      console.error("Failed to fetch fraud stats:", err);
    }
  }, []);

  const fetchRevokedCerts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/certificates/revoked`, authHeader());
      setRevokedCerts(res.data.certificates || []);
    } catch (err) {
      console.error("Failed to fetch revoked certs:", err);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => fetchFraudFlags(true), 30_000);
  }, [fetchFraudFlags]);

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


  const handleToggleStatus = async (staffId, staffName, activate) => {
  const action = activate ? "activate" : "deactivate";
  if (!window.confirm(`Are you sure you want to ${action} ${staffName}?`)) return;
  try {
    await axios.patch(`${API}/staff/${staffId}/toggle-status`, {}, authHeader());
    addToast(
      "success",
      `Staff ${activate ? "Activated" : "Deactivated"}`,
      `${staffName} has been ${activate ? "activated" : "deactivated"}.`
    );
    fetchStaff(admin);
  } catch (err) {
    addToast("info", "Error", err.response?.data?.message || `Failed to ${action} staff.`);
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
      addToast("success", "Email Sent", data.message || "Activation email sent!");
      fetchStaff(admin);
    } catch (err) {
      addToast("info", "Error", "Failed to resend activation email.");
    }
  };

  useEffect(() => { fetchCurrentUser(); }, []);

  useEffect(() => {
    if (admin) {
      fetchStaff(admin);
      fetchFraudFlags();
      fetchFraudStats();
      fetchPrograms();
      fetchRevokedCerts();
      startPolling();
      Promise.all([
        axios.get(`${API}/schedule`, authHeader()),
        axios.get(`${API}/schedule/holidays`, authHeader()),
      ]).then(([schedRes, holRes]) => {
        setOverviewSchedule({
          schedule: schedRes.data.schedule,
          holidays: holRes.data.holidays || [],
        });
      }).catch(() => {});
    }
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [admin]);

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
          revokedCount={revokedCerts.filter(c => !c.allow_reissue).length}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "white", margin: 0 }}>Staff Members ({staffList.length})</h3>
              <button onClick={() => setIsModalOpen(true)} className="staff-add-btn">
                <Plus size={16} /> Add Staff
              </button>
            </div>
            <StaffCards staffList={staffList} handleResend={handleResend} handleToggleStatus={handleToggleStatus} />
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
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
        {activeTab === "schedule" && <ScheduleTab addToast={addToast} />}

        {/* ── REVOKED CERTS TAB ── */}
        {activeTab === "revoked" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "white", margin: 0 }}>
                Revoked Certificates
                {revokedCerts.length > 0 && (
                  <span style={{ marginLeft: 10, fontSize: 14, color: "#ef4444", fontWeight: 400 }}>
                    ({revokedCerts.length} revoked)
                  </span>
                )}
              </h3>
            </div>
            <RevokedCertsTab addToast={addToast} />
          </>
        )}

        {/* ── FOREIGN DEGREES TAB ── */}
        {activeTab === "external" && <ExternalDegreesTab addToast={addToast} />}
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