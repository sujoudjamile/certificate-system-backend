import React from "react"
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";

function Navbar(){

    const navigate = useNavigate();

    const goToLogin = () => {
      navigate("/login");
    };

    return (
        <nav className="navbar">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="logo">
                    <Shield size={24} />
                </div>
                <div className="header-text">
                    <h2>CertifyLB</h2>
                    <h5 style={{color:"#eadfdfe6"}}>Lebanese Certification Authority</h5>
                </div>
            </div>
            <button className="login" onClick={goToLogin}>University login</button>
        </nav>
    )
}

export default Navbar;