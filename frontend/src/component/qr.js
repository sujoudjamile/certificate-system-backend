import { useState } from "react";
import { FaQrcode } from "react-icons/fa";
import { QrReader } from 'react-qr-reader'; // QR scanning component

function CertVerification() {
  const [hash, setHash] = useState("");
  const [scanResult, setScanResult] = useState("");

  const handleScan = (data) => {
    if (data) {
      setScanResult(data);   // QR code value
      setHash(data);         // fill input automatically
    }
  };

  const handleError = (err) => {
    console.error(err);
  };

  return (
    <div className="cert_id">
      <div className="cert-header">
        <FaQrcode className="qr" />
        <h2>Verify a Certificate</h2>
      </div>

      {/* Input field */}
      <input
        type="text"
        placeholder="Enter certificate verification hash..."
        value={hash}
        onChange={(e) => setHash(e.target.value)}
      />

      {/* QR scanner */}
      <div className="qr-scanner">
        <QrReader
          constraints={{ facingMode: "environment" }} // back camera
          onResult={(result, error) => {
            if (!!result) handleScan(result?.text);
            if (!!error) handleError(error);
          }}
          style={{ width: "100%", borderRadius: "10px" }}
        />
      </div>

      <button>Verify Certificate</button>
      <h5 style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", fontWeight: "normal" }}>
        The hash is printed on the certificate or encoded in the QR code
      </h5>
    </div>
  );
}

export default CertVerification;

