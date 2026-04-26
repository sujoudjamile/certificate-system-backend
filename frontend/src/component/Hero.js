import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaQrcode, FaLock, FaExclamationTriangle, FaGraduationCap } from "react-icons/fa";
import axios from "axios";

function Hero() {
  const navigate = useNavigate();
  const [certNumber, setCertNumber]   = useState("");
  const [error, setError]             = useState("");
  const [pdfFile, setPdfFile]         = useState(null);
  const [pdfResult, setPdfResult]     = useState(null);
  const [pdfLoading, setPdfLoading]   = useState(false);
  const [pdfError, setPdfError]       = useState("");
  const [dragOver, setDragOver]       = useState(false);

  const features = [
    {
      icon: <FaQrcode className="qr" />,
      title: "QR-Secured Certificates",
      description:
        "Each certificate carries a unique SHA-256 hashed QR code that cannot be replicated or forged.",
    },
    {
      icon: <FaLock className="lock" />,
      title: "Immutable Records",
      description:
        "Once issued, certificates are permanently locked. Any modification attempt triggers an instant alert to the admin.",
    },
    {
      icon: <FaExclamationTriangle className="icon3" />,
      title: "Fraud Detection",
      description:
        "Automatic detection of duplicate certificates with instant notification to university administration.",
    },
  ];

  const universities = [
    "American University of Beirut (AUB)",
    "Lebanese American University (LAU)",
    "Lebanese University (LU)",
    "Notre Dame University (NDU)",
    "Saint Joseph University (USJ)",
    "Balamand University",
    "Lebanese International University (LIU)",
    "Beirut Arab University (BAU)",
    "Haigazian University",
    "Arab Open University (AOU-Lebanon)",
    "Holy Spirit University of Kaslik (USEK)",
    "Jinan University",
    "Middle East University (MEU)",
  ];

  const steps = [
    {
      number: "01",
      title: "University Registration",
      description:
        "Super admin registers each university and provides a unique secret key.",
    },
    {
      number: "02",
      title: "Staff Addition",
      description:
        "University admin adds staff members who receive their own secret keys.",
    },
    {
      number: "03",
      title: "Certificate Issuance",
      description:
        "Staff adds student data and issues a tamper-proof QR-coded certificate.",
    },
    {
      number: "04",
      title: "Instant Verification",
      description:
        "Anyone can scan the QR or enter the certificate number to verify authenticity in seconds.",
    },
  ];

  const handleVerify = () => {
    const trimmed = certNumber.trim();
    if (!trimmed) {
      setError("Please enter a certificate number.");
      return;
    }
    setError("");
    navigate(`/verify/${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleVerify();
  };

  const handlePdfVerify = async () => {
  if (!pdfFile) {
    setPdfError("Please select a PDF file.");
    return;
  }
  setPdfLoading(true);
  setPdfError("");
  setPdfResult(null);

  try {
    const formData = new FormData();
    formData.append("pdf", pdfFile);

    const res = await axios.post(
      "http://localhost:5000/api/certificates/verify-pdf",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    setPdfResult(res.data);
  } catch (err) {
    setPdfError(
      err.response?.data?.message || "Verification failed. Please try again."
    );
  } finally {
    setPdfLoading(false);
  }
};

  return (
    <div className="hero">
      <div className="security-badge">
        🔒 Blockchain-level Security for Lebanese Academic Credentials
      </div>
      <h2 className="title">
        Verify Any Lebanese{" "}
        <span style={{ color: "#ff4d4d" }}>
          University
          <br />
        </span>{" "}
        Certificate Instantly
      </h2>
      <h3 style={{ color: "rgba(255,255,255,0.5)", fontSize: "20px" }}>
        Scan the QR code on any certificate issued by a registered Lebanese
        <br /> university to instantly verify its authenticity.
      </h3>

      <div className="cert_id">
        <div className="cert-header">
          <FaQrcode className="qr" />
          <h2>Verify a Certificate</h2>
        </div>
        <input
          type="text"
          placeholder="Enter certificate number (e.g. UNIV-19-2026-A3F2C1)..."
          value={certNumber}
          onChange={(e) => {
            setCertNumber(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={handleKeyDown}
        />
        {error && (
          <p style={{ color: "#ff6b6b", fontSize: "13px", margin: "-4px 0 8px", textAlign: "left" }}>
            {error}
          </p>
        )}
        <button onClick={handleVerify}>Verify Certificate</button>
        <h5
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "13px",
            fontWeight: "normal",
          }}
        >
          The certificate number is printed on the certificate or encoded in the QR code
        </h5>
      </div>

      {/* ── PDF UPLOAD VERIFIER ── */}
<div className="cert_id" style={{ marginTop: "32px" }}>

  <div className="cert-header">
    <FaQrcode className="qr" />
    <h2>Verify a PDF Certificate</h2>
  </div>

  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: "0 0 16px" }}>
    Upload the original PDF certificate to verify its digital signature.
    The system checks the embedded PKCS#7 cryptographic signature automatically.
  </p>

  {/* Drop zone */}
  <label
    onDragOver={e  => { e.preventDefault(); setDragOver(true);  }}
    onDragLeave={() => setDragOver(false)}
    onDrop={e => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f && f.type === "application/pdf") {
        setPdfFile(f);
        setPdfResult(null);
        setPdfError("");
      } else {
        setPdfError("Please drop a PDF file.");
      }
    }}
    style={{
      display:       "block",
      border:        `2px dashed ${dragOver ? "#ff3b30" : "rgba(255,255,255,0.2)"}`,
      borderRadius:  "14px",
      padding:       "24px",
      textAlign:     "center",
      cursor:        "pointer",
      marginBottom:  "12px",
      transition:    "border-color 0.2s",
      background:    dragOver ? "rgba(255,59,48,0.05)" : "transparent",
    }}
  >
    {pdfFile ? (
      <span style={{ color: "#22c55e", fontSize: "14px" }}>
        📄 {pdfFile.name}
        <span
          onClick={e => { e.preventDefault(); setPdfFile(null); setPdfResult(null); }}
          style={{ marginLeft: 10, color: "#ff6b6b", cursor: "pointer" }}
        >✕</span>
      </span>
    ) : (
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
        📂 Drop PDF here or click to select
      </span>
    )}
    <input
      type="file"
      accept=".pdf,application/pdf"
      style={{ display: "none" }}
      onChange={e => {
        const f = e.target.files[0];
        if (f) { setPdfFile(f); setPdfResult(null); setPdfError(""); }
      }}
    />
  </label>

  {pdfError && (
    <p style={{ color: "#ff6b6b", fontSize: "12px", margin: "0 0 12px" }}>
      ⚠️ {pdfError}
    </p>
  )}

  <button onClick={handlePdfVerify} disabled={pdfLoading || !pdfFile}>
    {pdfLoading ? "Verifying..." : "Verify PDF Signature"}
  </button>

  <h5 style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: "normal", marginTop: 8 }}>
    The certificate number is extracted automatically from the PDF
  </h5>

  {/* ── Result ── */}
  {pdfResult && (
    <div style={{
      marginTop:    "20px",
      padding:      "20px",
      borderRadius: "16px",
      border:       `1px solid ${
        pdfResult.pdf_valid ? "#22c55e"
        : pdfResult.revoked  ? "#f59e0b"
        : "#ef4444"
      }`,
      background: pdfResult.pdf_valid
        ? "rgba(34,197,94,0.07)"
        : pdfResult.revoked
        ? "rgba(245,158,11,0.07)"
        : "rgba(239,68,68,0.07)",
    }}>

      {/* Status heading */}
      <p style={{
        fontSize:   "16px",
        fontWeight: "700",
        margin:     "0 0 12px",
        color: pdfResult.pdf_valid ? "#22c55e"
               : pdfResult.revoked  ? "#f59e0b"
               : "#ef4444",
      }}>
        {pdfResult.pdf_valid && "✅ Authentic PDF Certificate"}
        {pdfResult.revoked   && "⚠️ Certificate Has Been Revoked"}
        {!pdfResult.pdf_valid && !pdfResult.revoked && "❌ Invalid or Tampered PDF"}
      </p>

      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", margin: "0 0 14px" }}>
        {pdfResult.message}
      </p>

      {/* Certificate details */}
      {pdfResult.certificate && (
        <div style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: "10px",
          padding: "12px",
          marginBottom: "14px",
          fontSize: "13px",
          lineHeight: "1.8",
          color: "rgba(255,255,255,0.7)",
        }}>
          <strong style={{ color: "white" }}>{pdfResult.certificate.student_name}</strong><br />
          🎓 {pdfResult.certificate.degree} in {pdfResult.certificate.major}
          {pdfResult.certificate.GPA && ` · GPA ${parseFloat(pdfResult.certificate.GPA).toFixed(2)}`}<br />
          🏛 {pdfResult.certificate.university}<br />
          🪪 National ID: {pdfResult.certificate.national_id}<br />
          📅 Graduated: {pdfResult.certificate.graduation_date?.split("T")[0]}<br />
          📋 Status: <span style={{
            color: pdfResult.certificate.cert_status === "issued" ? "#22c55e" : "#ef4444",
            fontWeight: 600,
          }}>
            {pdfResult.certificate.cert_status?.toUpperCase()}
          </span>
        </div>
      )}

      {/* Signature checks */}
      {pdfResult.signature && (
        <div style={{ fontSize: "12px" }}>
          <p style={{ color: "rgba(255,255,255,0.5)", margin: "0 0 6px", fontWeight: 600 }}>
            Cryptographic Checks:
          </p>
          {[
            {
              label: "PKCS#7 Signature",
              pass:  pdfResult.signature.signature_valid,
              note:  pdfResult.signature.signature_valid
                     ? "Valid RSA-PSS signature over PDF bytes"
                     : "Signature does not match PDF content",
            },
            {
              label: "Certificate Chain",
              pass:  pdfResult.signature.cert_chain_valid,
              note:  pdfResult.signature.cert_chain_valid
                     ? "University cert signed by CertifyLB Root CA"
                     : "Certificate chain broken",
            },
            {
              label: "CertifyLB Root CA",
              pass:  pdfResult.signature.ca_match,
              note:  pdfResult.signature.ca_match
                     ? "Matches our registered Root CA"
                     : "Certificate not issued by CertifyLB",
            },
            {
              label: "Not Revoked",
              pass:  !pdfResult.revoked,
              note:  pdfResult.revoked
                     ? "Certificate was revoked in our system"
                     : "Certificate is active",
            },
          ].map((check, i) => (
            <div key={i} style={{
              display:        "flex",
              alignItems:     "flex-start",
              gap:            "10px",
              marginBottom:   "6px",
              padding:        "6px 10px",
              borderRadius:   "8px",
              background:     "rgba(255,255,255,0.03)",
            }}>
              <span style={{ color: check.pass ? "#22c55e" : "#ef4444", minWidth: 16 }}>
                {check.pass ? "✅" : "❌"}
              </span>
              <div>
                <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
                  {check.label}
                </span>
                <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 8 }}>
                  {check.note}
                </span>
              </div>
            </div>
          ))}

          {pdfResult.signature.signer_name && (
            <p style={{ color: "rgba(255,255,255,0.4)", margin: "10px 0 0", fontSize: "11px" }}>
              Signed by: {pdfResult.signature.signer_name}<br />
              Certificate valid: {pdfResult.signature.cert_valid_from?.toString().slice(0,15)}
              {" → "}
              {pdfResult.signature.cert_valid_to?.toString().slice(0,15)}
              {pdfResult.signature.cert_expired && " ⚠️ Expired (signature still valid for documents signed before expiry)"}
            </p>
          )}
        </div>
      )}
    </div>
  )}
</div>

      <div className="About">
        {features.map((feature, index) => (
          <div key={index} className="">
            <div className="Ficon">{feature.icon}</div>
            <h3 className="Ftitle">{feature.title}</h3>
            <p className="Fdescrip">{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="universities-section">
        <h2 className="universities-title">Registered Lebanese Universities</h2>
        <p className="universities-subtitle">
          These institutions can register on our platform to issue verified certificates
        </p>
        <div className="universities-grid">
          {universities.map((uni, index) => (
            <div key={index} className="university-card">
              <FaGraduationCap className="uni-icon" />
              <span>{uni}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="how-section">
        <h2 className="how-title">How It Works</h2>
        <div className="how-container">
          {steps.map((step, index) => (
            <div key={index} className="how-card">
              <div className="how-number">{step.number}</div>
              <h3 className="how-card-title">{step.title}</h3>
              <p className="how-card-description">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Hero;