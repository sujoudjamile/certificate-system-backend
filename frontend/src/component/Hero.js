import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaQrcode, FaLock, FaExclamationTriangle, FaGraduationCap } from "react-icons/fa";

function Hero() {
  const navigate = useNavigate();
  const [certNumber, setCertNumber] = useState("");
  const [error, setError] = useState("");

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