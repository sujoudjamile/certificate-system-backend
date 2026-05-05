// admin.js — University Admin Dashboard
// Replaces your existing admin.js entirely.
// Changes from previous version:
//   1. Fraud API endpoints corrected to match fraudRoutes.js
//   2. Auto-polling every 30s — detects new flags while admin is on the page
//   3. Toast notification system — appears when new flags arrive
//   4. Fraud stats widget on the Overview tab
//   5. Each flag has its own Dismiss + Resolve (Revoke) buttons
//   6. Risk level badges (low / medium / high / critical)
//   7. Confirmation modal before revoking a certificate

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  GraduationCap, Users, User, AlertTriangle, Bell,
  Shield, RefreshCw, LogOut, ChevronRight, Plus,
  CheckCircle2, XCircle, Clock, FileText, X,
  TrendingUp, Zap, Eye, AlertOctagon,
} from "lucide-react";
import "./Admin.css";

const API = "http://localhost:5000/api";

// ── Auth header helper ──
const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

// ─────────────────────────────────────────────────────────────
// TOAST NOTIFICATION SYSTEM
// ─────────────────────────────────────────────────────────────
// Toasts appear in the top-right corner when new fraud flags
// arrive via polling. They auto-dismiss after 6 seconds.
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
// Shows a coloured badge based on total risk score.
//   critical : ≥ 150  (red)
//   high     : ≥ 100  (orange)
//   medium   : ≥ 60   (yellow)
//   low      : < 60   (green)
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
// RULE NAME → HUMAN LABEL MAP
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
        {/* Bell with pending count badge */}
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
function TabBar({ activeTab, onChange, staffCount, pendingFlagsCount }) {
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
      <button className={`uni-tab ${activeTab === "alerts" ? "active" : ""}`}
        onClick={() => onChange("alerts")}>
        <AlertTriangle size={16} /> Fraud Alerts
        {pendingFlagsCount > 0 && (
          <span className="tab-badge">{pendingFlagsCount}</span>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATS ROW
// ─────────────────────────────────────────────────────────────
function StatsRow({ staffCount, pendingFlagsCount, totalRisk, resolvedToday }) {
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
        <div className="uni-stat__icon uni-stat__icon--amber"><Zap size={28} /></div>
        <p className="uni-stat__label">Total Pending Risk</p>
        <p className="uni-stat__value" style={{ fontSize: totalRisk > 999 ? 28 : 40 }}>
          {totalRisk}
        </p>
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
// FRAUD STATS WIDGET (Overview tab)
// ─────────────────────────────────────────────────────────────
// Shows which rules are firing most often and which staff
// members have the most flags against them.
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

      {/* Top rules */}
      <p className="fraud-stats-section-label">Most Triggered Rules</p>
      {rule_breakdown.length === 0 ? (
        <p className="fraud-stats-empty">No rules have fired yet</p>
      ) : (
        rule_breakdown.slice(0, 4).map((r) => (
          <div key={r.source} className="fraud-rule-row">
            <span className="fraud-rule-name">
              {RULE_LABELS[r.source] || r.source}
            </span>
            <span className="fraud-rule-count">{r.count}×</span>
            <div className="fraud-rule-bar">
              <div
                className="fraud-rule-bar__fill"
                style={{
                  width: `${Math.min(100, (r.count / rule_breakdown[0].count) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))
      )}

      {/* Top suspects */}
      {top_suspects.length > 0 && (
        <>
          <p className="fraud-stats-section-label" style={{ marginTop: 20 }}>
            Staff With Most Flags
          </p>
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
// RECENT ALERTS PREVIEW (Overview tab)
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
// Shown before a certificate is revoked. Admin must type a
// review note and click confirm. This is irreversible so we
// make it a deliberate two-step action.
// ─────────────────────────────────────────────────────────────
function RevokeConfirmModal({ flag, onConfirm, onCancel, loading }) {
  const [note, setNote] = useState("");

  return (
    <div className="modal-overlay">
      <div className="modal-box revoke-modal-box">
        <div className="revoke-modal-header">
          <div className="revoke-modal-icon">
            <AlertOctagon size={26} />
          </div>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <p className="revoke-modal-title">Confirm Certificate Revocation</p>
        <p className="revoke-modal-name">{flag.student_name}</p>
        <p className="revoke-modal-email">
          {flag.cert_number} · {flag.degree} in {flag.major}
        </p>

        <div className="revoke-warning-box">
          <AlertTriangle size={16} />
          <span>
            This will permanently revoke the certificate. The student will no longer be
            able to use it for verification. This action cannot be undone through the dashboard.
          </span>
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
              boxSizing: "border-box", fontFamily: "inherit",
              outline: "none",
            }}
          />
        </div>

        <div className="revoke-modal-actions">
          <button
            className="revoke-confirm-btn"
            onClick={() => onConfirm(note)}
            disabled={loading || !note.trim()}
          >
            {loading ? "Revoking..." : "Yes, Revoke Certificate"}
          </button>
          <button className="revoke-cancel-btn" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SINGLE FRAUD FLAG CARD
// ─────────────────────────────────────────────────────────────
// Displays one flag with full context and action buttons.
// Handles its own dismiss/resolve state locally.
// ─────────────────────────────────────────────────────────────
function FlagCard({ flag, onDismiss, onResolve }) {
  const [expanded,       setExpanded]       = useState(false);
  const [showRevoke,     setShowRevoke]     = useState(false);
  const [actionLoading,  setActionLoading]  = useState(false);

  const isPending  = flag.flag_status === "pending";
  const isRevoked  = flag.cert_status === "revoked";

  // ── Status colour helpers ──
  const statusColor = {
    pending:   "#f59e0b",
    resolved:  "#22c55e",
    dismissed: "#64748b",
    reviewed:  "#60b0ff",
  }[flag.flag_status] || "#94a3b8";

  const statusIcon = {
    pending:   <Clock   size={13} />,
    resolved:  <XCircle size={13} />,
    dismissed: <CheckCircle2 size={13} />,
  }[flag.flag_status];

  // ── Dismiss handler ──
  const handleDismiss = async () => {
    setActionLoading(true);
    await onDismiss(flag.flag_id);
    setActionLoading(false);
  };

  // ── Resolve (revoke) handler ──
  const handleResolve = async (note) => {
    setActionLoading(true);
    await onResolve(flag.flag_id, note);
    setActionLoading(false);
    setShowRevoke(false);
  };

  return (
    <>
      {showRevoke && (
        <RevokeConfirmModal
          flag={flag}
          onConfirm={handleResolve}
          onCancel={() => setShowRevoke(false)}
          loading={actionLoading}
        />
      )}

      <div className="flag-card">
        {/* ── Card header ── */}
        <div className="flag-card__header">
          <div className="flag-card__left">
            {/* Rule badge */}
            <span className="flag-rule-tag">
              {RULE_LABELS[flag.rule_name] || flag.rule_name}
            </span>
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
              <strong style={{ color: "rgba(255,255,255,0.7)" }}>
                {flag.issued_by_name || "Unknown"}
              </strong>
            </p>
          </div>

          <div className="flag-card__right">
            {/* Status */}
            <span className="flag-status-badge" style={{
              color: statusColor,
              background: statusColor + "22",
              border: `1px solid ${statusColor}44`,
            }}>
              {statusIcon} {flag.flag_status}
            </span>
            {/* Risk */}
            <RiskBadge score={parseFloat(flag.risk_score)} />
            {/* Expand toggle */}
            <button className="flag-expand-btn" onClick={() => setExpanded(!expanded)}>
              <Eye size={14} /> {expanded ? "Less" : "Details"}
            </button>
          </div>
        </div>

        {/* ── Reason box ── */}
        <div className="flag-reason-box">
          <p className="flag-reason-label">REASON</p>
          <p className="flag-reason-text">{flag.reason}</p>
        </div>

        {/* ── Expanded details ── */}
        {expanded && (
          <div className="flag-details">
            <div className="flag-details__grid">
              <div className="flag-detail-item">
                <span className="flag-detail-label">National ID</span>
                <span className="flag-detail-value">{flag.national_id}</span>
              </div>
              <div className="flag-detail-item">
                <span className="flag-detail-label">Cert Status</span>
                <span className="flag-detail-value" style={{
                  color: isRevoked ? "#ef4444" : "#22c55e",
                }}>
                  {(flag.cert_status || "").toUpperCase()}
                </span>
              </div>
              <div className="flag-detail-item">
                <span className="flag-detail-label">Issued By Email</span>
                <span className="flag-detail-value">{flag.issued_by_email || "—"}</span>
              </div>
              <div className="flag-detail-item">
                <span className="flag-detail-label">Flagged At</span>
                <span className="flag-detail-value">
                  {new Date(flag.flagged_at).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Review note if already acted on */}
            {flag.review_note && (
              <div className="flag-review-note">
                <p className="flag-detail-label">REVIEW NOTE</p>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                  {flag.review_note}
                </p>
                {flag.reviewed_by_name && (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    Reviewed by {flag.reviewed_by_name}
                    {flag.resolved_at
                      ? ` · ${new Date(flag.resolved_at).toLocaleString()}`
                      : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Action buttons — only shown for pending flags ── */}
        {isPending && (
          <div className="flag-actions">
            {isRevoked ? (
              // Certificate already revoked elsewhere — just allow dismiss
              <div className="flag-already-revoked">
                <AlertTriangle size={14} />
                Certificate already revoked.
                <button
                  className="flag-dismiss-btn"
                  onClick={handleDismiss}
                  disabled={actionLoading}
                  style={{ marginLeft: 12 }}
                >
                  Dismiss Flag
                </button>
              </div>
            ) : (
              <>
                {/* DISMISS — false positive, cert stays valid */}
                <button
                  className="flag-dismiss-btn"
                  onClick={handleDismiss}
                  disabled={actionLoading}
                >
                  <CheckCircle2 size={14} />
                  {actionLoading ? "Processing..." : "Dismiss (False Positive)"}
                </button>

                {/* RESOLVE — confirmed fraud, revoke cert */}
                <button
                  className="flag-revoke-btn"
                  onClick={() => setShowRevoke(true)}
                  disabled={actionLoading}
                >
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

  const filtered = filter === "all"
    ? flags
    : flags.filter((f) => f.flag_status === filter);

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
      {/* ── Filter bar ── */}
      <div className="flag-filter-bar">
        {[
          { key: "pending",   label: "Pending",   count: counts.pending },
          { key: "resolved",  label: "Resolved",  count: counts.resolved },
          { key: "dismissed", label: "Dismissed", count: counts.dismissed },
          { key: "all",       label: "All" },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            className={`flag-filter-btn ${filter === key ? "active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
            {count !== undefined && (
              <span className="flag-filter-count">{count}</span>
            )}
          </button>
        ))}

        <button className="flag-refresh-btn" onClick={onRefresh}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Flag list ── */}
      {filtered.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 16, padding: "60px 0",
        }}>
          <CheckCircle2 size={64} color="#2dce8a" />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, margin: 0 }}>
            No {filter === "all" ? "" : filter} fraud alerts
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((flag) => (
            <FlagCard
              key={flag.flag_id}
              flag={flag}
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
// ADD STAFF MODAL
// ─────────────────────────────────────────────────────────────
function AddStaffModal({ onClose, onSubmit }) {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
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
    return <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 40 }}>
      No staff added yet.
    </p>;
  }

  return (
    <div className="admin-cards">
      {staffList.map((staff) => {
        const now     = new Date();
        const expired = staff.verification_expires &&
          new Date(staff.verification_expires) < now;

        const status = staff.is_verified ? "Active" : expired ? "Inactive" : "Pending";

        return (
          <div key={staff.id}
            className={`admin-card ${status === "Inactive" ? "expired" : ""}`}>
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
                status === "Active" ? "verified" :
                status === "Inactive" ? "expired" : "pending"
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

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function UniversityAdmin() {
  const navigate = useNavigate();

  const [activeTab,     setActiveTab]     = useState("overview");
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [staffList,     setStaffList]     = useState([]);
  const [fraudFlags,    setFraudFlags]    = useState([]);
  const [fraudStats,    setFraudStats]    = useState(null);
  const [admin,         setAdmin]         = useState(null);
  const [loadingAdmin,  setLoadingAdmin]  = useState(true);
  const [loadingFlags,  setLoadingFlags]  = useState(false);
  const [toasts,        setToasts]        = useState([]);

  // Ref to track previous flag count for change detection in the polling interval
  const prevFlagCountRef = useRef(0);
  const pollIntervalRef  = useRef(null);

  // ── Toast helpers ──
  const addToast = useCallback((type, title, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, title, message }]);
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
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

  // ── Fetch fraud flags from GET /api/fraud ──
  // Note: this matches fraudRoutes.js router.get("/", getFraudFlags)
  // The controller scopes results to the admin's university automatically.
  const fetchFraudFlags = useCallback(async (silent = false) => {
    if (!silent) setLoadingFlags(true);
    try {
      const res  = await axios.get(`${API}/fraud`, authHeader());
      const flags = res.data.flags || [];

      // ── Detect new flags since last poll ──
      // Compare count — if more flags now, notify the admin
      const newCount = flags.filter((f) => f.flag_status === "pending").length;
      if (silent && newCount > prevFlagCountRef.current) {
        const diff = newCount - prevFlagCountRef.current;
        addToast(
          "fraud",
          `${diff} New Fraud Alert${diff > 1 ? "s" : ""}`,
          `${diff} new certificate${diff > 1 ? "s have" : " has"} been flagged for review.`
        );
      }
      prevFlagCountRef.current = newCount;

      setFraudFlags(flags);
    } catch (err) {
      console.error("Failed to fetch fraud flags:", err);
    } finally {
      if (!silent) setLoadingFlags(false);
    }
  }, [addToast]);

  // ── Fetch fraud stats from GET /api/fraud/stats ──
  const fetchFraudStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/fraud/stats`, authHeader());
      setFraudStats(res.data.stats);
    } catch (err) {
      console.error("Failed to fetch fraud stats:", err);
    }
  }, []);

  // ── Start polling — checks for new flags every 30 seconds ──
  // Uses silent=true so it doesn't show a loading spinner on each poll.
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => {
      fetchFraudFlags(true); // silent poll
    }, 30_000); // 30 seconds
  }, [fetchFraudFlags]);

  // ── Dismiss a fraud flag — PATCH /api/fraud/:id/dismiss ──
  const handleDismiss = async (flagId) => {
    try {
      await axios.patch(`${API}/fraud/${flagId}/dismiss`, {}, authHeader());
      addToast("success", "Flag Dismissed", "The fraud flag has been marked as a false positive.");
      // Refresh both flags and stats
      await fetchFraudFlags();
      await fetchFraudStats();
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Failed to dismiss flag.");
    }
  };

  // ── Resolve a fraud flag (revoke cert) — PATCH /api/fraud/:id/resolve ──
  const handleResolve = async (flagId, reviewNote) => {
    try {
      await axios.patch(
        `${API}/fraud/${flagId}/resolve`,
        { review_note: reviewNote },
        authHeader()
      );
      addToast(
        "success",
        "Certificate Revoked",
        "Fraud confirmed. The certificate has been revoked and all related flags resolved."
      );
      await fetchFraudFlags();
      await fetchFraudStats();
    } catch (err) {
      addToast("info", "Error", err.response?.data?.message || "Failed to resolve flag.");
      throw err; // re-throw so the modal stays open on failure
    }
  };

  // ── Resend activation email ──
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
      startPolling();
    }
    // Clean up polling interval when component unmounts
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [admin]);

  // ── Derived values ──
  const pendingFlags = fraudFlags.filter((f) => f.flag_status === "pending");
  const totalPendingRisk = pendingFlags.reduce(
    (sum, f) => sum + parseFloat(f.risk_score || 0), 0
  );

  if (loadingAdmin) {
    return <div className="loading">Loading admin info...</div>;
  }

  return (
    <div className="uni-dashboard">
      {/* ── Toast notifications ── */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Navbar ── */}
      <UniNavbar
        universityName={admin?.university_name ?? "No University Assigned"}
        adminName={admin?.name ?? "Unknown Admin"}
        pendingCount={pendingFlags.length}
        onBellClick={() => setActiveTab("alerts")}
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
          pendingFlagsCount={pendingFlags.length}
        />

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            <StatsRow
              staffCount={staffList.length}
              pendingFlagsCount={pendingFlags.length}
              totalRisk={totalPendingRisk}
              resolvedToday={0}
            />
            <div className="uni-bottom">
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <QuickActions
                  onAddStaff={() => setIsModalOpen(true)}
                  onViewAlerts={() => setActiveTab("alerts")}
                />
                <FraudStatsWidget stats={fraudStats} />
              </div>
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
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 20,
            }}>
              <h3 style={{ color: "white", margin: 0 }}>
                Staff Members ({staffList.length})
              </h3>
              <button onClick={() => setIsModalOpen(true)} className="staff-add-btn">
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
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 20,
            }}>
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
      </main>

      {/* ── Add Staff Modal ── */}
      {isModalOpen && (
        <AddStaffModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={(staff) => setStaffList((prev) => [...prev, staff])}
        />
      )}
    </div>
  );
}