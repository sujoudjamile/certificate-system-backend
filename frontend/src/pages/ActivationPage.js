import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ShieldCheck } from "lucide-react";

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

      <style jsx>{`
        .activation-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #122045, #1a2b6c, #1f3a8a);
          padding: 1rem;
        }

        .activation-card {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(15px);
          border-radius: 16px;
          padding: 2.5rem 2rem;
          max-width: 420px;
          width: 100%;
          text-align: center;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .activation-icon {
          color: #fff;
          margin-bottom: 1rem;
          background: rgba(255, 255, 255, 0.2);
          padding: 0.5rem;
          border-radius: 50%;
        }

        .activation-title {
          color: #fff;
          margin-bottom: 0.5rem;
          font-size: 1.75rem;
          font-weight: 700;
        }

        .activation-subtitle {
          margin-bottom: 1.5rem;
          font-size: 0.95rem;
          color: #e0e0e0;
        }

        .activation-form label {
          display: block;
          text-align: left;
          margin-bottom: 0.25rem;
          font-weight: 500;
          color: #e0e0e0;
        }

        .activation-form input {
          width: 100%;
          padding: 0.7rem 1rem;
          margin-bottom: 1.25rem;
          border-radius: 10px;
          border: none;
          font-size: 1rem;
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .activation-form input::placeholder {
          color: #ddd;
        }

        .activation-form input:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
        }

        .activation-form button {
          width: 100%;
          padding: 0.8rem;
          background-color: #e63946; /* Solid red */
          color: #fff;
          font-size: 1rem;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .activation-form button:hover {
          background-color: #d62839; /* Darker red on hover */
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
        }

        .activation-form button:disabled {
          background: #888;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .activation-message {
          margin-top: 1rem;
          font-weight: 500;
          color: #ffd700;
        }
      `}</style>
    </div>
  );
}