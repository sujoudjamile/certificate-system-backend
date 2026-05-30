// VerifyPage.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "./VerifyPage.css";

const API = "http://localhost:5000/api";

export default function VerifyPage() {
  const { cert_number } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const addToast = (type, title, message) => {
  const id = Date.now();
  setToasts(prev => [...prev, { id, type, title, message }]);
  setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
};

  useEffect(() => {
    if (cert_number) verify(cert_number);
  }, [cert_number]);

  const verify = async (cn) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.get(`${API}/certificates/verify/${cn}`);
      setResult(res.data);
    } catch (err) {
      setResult({
        valid: false,
        status: "error",
        message: err.response?.data?.message || "Certificate not found",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    addToast("error", "Authentication Required", "Please log in to download the certificate PDF.");
    setTimeout(() => navigate("/login"), 2000);
    return;
  }
    const certId = result?.certificate?.id;
    if (!certId) return;
    setPdfLoading(true);
    try {
      const res = await axios.get(`${API}/certificates/${certId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate_${cert_number}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
    addToast("error", "Download Failed", "Could not download PDF. Please ensure you're logged in.");
  } finally {
      setPdfLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const raw = typeof dateStr === "string" ? dateStr.split("T")[0] : dateStr;
    const d = new Date(raw + "T00:00:00");
    return isNaN(d.getTime())
      ? String(dateStr)
      : d.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
  };

  const cert = result?.certificate;
  const checks = result?.checks;
  const reason = result?.reason;

  const isRevoked = reason === "revoked";
  const isValid = result?.valid === true;
  const isInvalid = result?.valid === false && !loading;

  return (
    <div className="vp-root">
      {/* Animated background orbs */}
      <div className="vp-orb vp-orb--1" />
      <div className="vp-orb vp-orb--2" />
      <div className="vp-orb vp-orb--3" />

      <div className="vp-wrapper">
        {/* Back button */}
        <button className="vp-back" onClick={() => navigate("/")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to Home
        </button>

        {/* ── LOADING ── */}
        {loading && (
          <div className="vp-loading">
            <div className="vp-spinner">
              <div className="vp-spinner__ring" />
              <svg className="vp-spinner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <p className="vp-loading__text">Verifying certificate authenticity…</p>
            <p className="vp-loading__sub">Checking cryptographic signature & hash integrity</p>
          </div>
        )}

        {/* ── RESULT ── */}
        {!loading && result && (
          <div className="vp-card">

            {/* Status Banner */}
            {isValid && (
              <div className="vp-status vp-status--valid">
                <div className="vp-status__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </div>
                <div>
                  <div className="vp-status__label">VERIFIED</div>
                  <div className="vp-status__sub">This certificate is authentic and untampered</div>
                </div>
                <div className="vp-status__badge">✓ AUTHENTIC</div>
              </div>
            )}

            {isRevoked && (
              <div className="vp-status vp-status--revoked">
                <div className="vp-status__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                </div>
                <div>
                  <div className="vp-status__label">REVOKED</div>
                  <div className="vp-status__sub">This certificate has been officially revoked</div>
                </div>
                <div className="vp-status__badge">⊘ REVOKED</div>
              </div>
            )}

            {isInvalid && !isRevoked && (
              <div className="vp-status vp-status--invalid">
                <div className="vp-status__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div>
                  <div className="vp-status__label">INVALID</div>
                  <div className="vp-status__sub">
                    {result.message || "This certificate could not be verified"}
                  </div>
                </div>
                <div className="vp-status__badge">✗ INVALID</div>
              </div>
            )}

            {/* Certificate Info (shown if valid or revoked with data) */}
            {cert && (
              <>
                <div className="vp-university">
                  <svg className="vp-university__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 3L1 9l11 6 9-4.91V17M1 9v6m4-4v5a7 7 0 0014 0v-5"/>
                  </svg>
                  <span>{cert.university}</span>
                </div>

                <div className="vp-student">
                  <div className="vp-student__avatar">
                    {cert.student_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="vp-student__name">{cert.student_name}</div>
                    <div className="vp-student__id">National ID: {cert.national_id}</div>
                  </div>
                </div>

                <div className="vp-divider" />

                <div className="vp-grid">
                  <div className="vp-field">
                    <span className="vp-field__label">Degree</span>
                    <span className="vp-field__value vp-field__value--accent">{cert.degree}</span>
                  </div>
                  <div className="vp-field">
                    <span className="vp-field__label">Major</span>
                    <span className="vp-field__value">{cert.major}</span>
                  </div>
                  <div className="vp-field">
                    <span className="vp-field__label">GPA</span>
                    <span className="vp-field__value">
                      {cert.GPA ? parseFloat(cert.GPA).toFixed(2) : "—"}
                    </span>
                  </div>
                  <div className="vp-field">
                    <span className="vp-field__label">Graduation Date</span>
                    <span className="vp-field__value">{formatDate(cert.graduation_date)}</span>
                  </div>
                  <div className="vp-field">
                    <span className="vp-field__label">Issued On</span>
                    <span className="vp-field__value">{formatDate(cert.issued_at)}</span>
                  </div>
                  <div className="vp-field">
                    <span className="vp-field__label">Status</span>
                    <span className={`vp-field__value vp-badge vp-badge--${cert.status}`}>
                      {cert.status?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="vp-cert-number">
                  <span className="vp-cert-number__label">Certificate Number</span>
                  <span className="vp-cert-number__value">{cert.cert_number}</span>
                </div>

                {/* Integrity Checks */}
                {checks && (
                  <div className="vp-checks">
                    <div className="vp-checks__title">Integrity Checks</div>
                    <div className="vp-checks__row">
                      <span className={`vp-check-dot ${checks.hash_match ? "vp-check-dot--ok" : "vp-check-dot--fail"}`} />
                      <span className="vp-checks__label">Hash Integrity</span>
                      <span className={`vp-checks__result ${checks.hash_match ? "ok" : "fail"}`}>
                        {checks.hash_match ? "Match" : "Mismatch"}
                      </span>
                    </div>
                    <div className="vp-checks__row">
                      <span className={`vp-check-dot ${checks.signature_valid ? "vp-check-dot--ok" : "vp-check-dot--fail"}`} />
                      <span className="vp-checks__label">Digital Signature</span>
                      <span className={`vp-checks__result ${checks.signature_valid ? "ok" : "fail"}`}>
                        {checks.signature_valid ? "Valid" : "Invalid"}
                      </span>
                    </div>
                  </div>
                )}

                {/* PDF Button */}
                {isValid && localStorage.getItem("token") && (
              <button
               className="vp-pdf-btn"
               onClick={downloadPdf}
               disabled={pdfLoading}
                >
                    {pdfLoading ? (
                      <>
                        <div className="vp-pdf-btn__spinner" />
                        Generating PDF…
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="12" y1="18" x2="12" y2="12"/>
                          <line x1="9" y1="15" x2="15" y2="15"/>
                        </svg>
                        Download Certificate PDF
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            {/* No data — just a message */}
            {!cert && !loading && (
              <div className="vp-empty">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="11" y1="8" x2="11" y2="14"/><line x1="11" y1="16" x2="11.01" y2="16"/>
                </svg>
                <p>{result?.message || "Certificate not found in our records."}</p>
                <span>Make sure you entered the correct certificate number.</span>
              </div>
            )}

          </div>
        )}
        {/* Powered by */}
        <p className="vp-footer">
          Secured by <strong>CertifyLB</strong> · SHA-256 + RSA-PSS cryptographic verification
        </p>

        {/* Toast notifications */}
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          display: "flex", flexDirection: "column", gap: 10,
          zIndex: 9999, pointerEvents: "none",
        }}>
          {toasts.map(t => (
            <div key={t.id} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "14px 18px", borderRadius: 14, minWidth: 280, maxWidth: 360,
              pointerEvents: "auto",
              background: t.type === "success"
                ? "rgba(20, 40, 20, 0.97)"
                : "rgba(40, 18, 18, 0.97)",
              border: `1px solid ${t.type === "success" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
              animation: "slideInToast 0.25s ease",
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                background: t.type === "success" ? "#22c55e" : "#ef4444",
                boxShadow: `0 0 8px ${t.type === "success" ? "#22c55e" : "#ef4444"}`,
              }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5,
                  color: t.type === "success" ? "#4ade80" : "#f87171" }}>
                  {t.title}
                </div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>
                  {t.message}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
