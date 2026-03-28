import React from "react";
import { FaShieldAlt } from "react-icons/fa";


function Footer() {
  return (
    <footer className="footer">

      <div className="footer-content">

        <div className="footer-logo">
          <FaShieldAlt className="footer-icon" />
          <span>CertifyLB</span>
        </div>

        <p className="footer-text">
          © 2024 Lebanese Certification Authority. All rights reserved.
        </p>

      </div>

    </footer>
  );
}

export default Footer;