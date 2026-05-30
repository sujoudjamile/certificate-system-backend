import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ShieldCheck } from "lucide-react";
import "./ActivationPage.css";

export default function ActivationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/users/activate-account", {
        token,
        password,
      });
      setMessage(res.data.message);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="activation-container">
        <div className="activation-card">
          <p style={{ textAlign: "center", color: "red", fontWeight: "600" }}>
            Invalid activation link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="activation-container">
      <div className="activation-card">
        <ShieldCheck size={48} className="activation-icon" />
        <h2 className="activation-title">Activate Your Account</h2>
        <p className="activation-subtitle">Set a strong password to get started</p>
        <form onSubmit={handleSubmit} className="activation-form">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Activating..." : "Activate Account"}
          </button>
        </form>
        {message && <p className="activation-message">{message}</p>}
      </div>
    </div>
  );
}