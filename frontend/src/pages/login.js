import React, { useState } from "react";
// useState lets us create reactive variables (values that re-render the UI when changed)

import "./Login.css";
// Your existing CSS file — no changes needed there

import {
  GraduationCap,
  User,
  Crown,
  Eye,
  Lock,
  Shield,
  ArrowLeft
} from "lucide-react";
// Importing icon components from lucide-react (icon library)

import { useNavigate } from "react-router-dom";
// useNavigate gives us the navigate() function to redirect the user to another page

import axios from "axios";
// axios is a library for making HTTP requests (API calls)
// Install it first: npm install axios
// It handles fetch + JSON parsing + error handling in one clean package

// ─────────────────────────────────────────────
// BASE URL — points to your Express backend
// In development: http://localhost:5000
// In production: replace with your deployed server URL
// ─────────────────────────────────────────────
const API_URL = "http://localhost:5000/api";

export default function Login() {

  const navigate = useNavigate();
  // navigate("/path") redirects the user — we use it after successful login

  // ─────────────────────────────────────────────
  // ROLES CONFIG
  // This object defines the UI labels for each role type.
  // The actual role sent to the backend is the key: "university" → "admin",
  // "staff" → "staff", "system" → "super_admin"
  // ─────────────────────────────────────────────
  const roles = {
    university: {
      name: "University Admin",
      description: "Manage staff and view fraud alerts",
      emailLabel: "University Admin Email",
      emailPlaceholder: "admin@university.edu.lb",
      keyLabel: "Password",
      keyPlaceholder: "",
      icon: GraduationCap
    },
    staff: {
      name: "Staff Member",
      description: "Issue and manage student certificates",
      emailLabel: "Staff Email",
      emailPlaceholder: "staff@university.edu.lb",
      keyLabel: "Password",
      keyPlaceholder: "",
      icon: User
    },
    system: {
      name: "System Admin",
      description: "Control full system and manage universities",
      emailLabel: "System Admin Email",
      emailPlaceholder: "sysadmin@certifylb.com",
      keyLabel: "Password",
      keyPlaceholder: "",
      icon: Crown
    }
  };

  // ─────────────────────────────────────────────
  // STATE VARIABLES
  // Each useState creates [value, setterFunction]
  // When setterFunction is called, React re-renders the component
  // ─────────────────────────────────────────────

  const [activeRole, setActiveRole] = useState("staff");
  // Tracks which role tab the user selected — starts on "staff"

  const [showPassword, setShowPassword] = useState(false);
  // Controls whether the password input shows plain text or dots

  const [email, setEmail] = useState("");
  // Holds the value typed into the email input field

  const [password, setPassword] = useState("");
  // Holds the value typed into the password input field

  const [loading, setLoading] = useState(false);
  // True while the API request is in-flight — disables the button to prevent double-submits

  const [error, setError] = useState("");
  // Stores any error message to display under the form (e.g. "Invalid credentials")

  // ─────────────────────────────────────────────
  // ROLE → BACKEND ROLE MAPPING
  // The UI uses "university", "staff", "system"
  // but the backend expects "admin", "staff", "super_admin"
  // ─────────────────────────────────────────────
  const roleMap = {
    university: "admin",
    staff: "staff",
    system: "super_admin"
  };

  // ─────────────────────────────────────────────
  // HANDLE SIGN IN
  // This function runs when the user clicks "Sign In"
  // It calls POST /api/users/login and handles the response
  // ─────────────────────────────────────────────
  const handleSignIn = async () => {
    // async means this function can use "await" to pause for the API response

    setError("");
    // Clear any previous error message before trying again

    // Basic client-side validation — catch obvious mistakes before hitting the server
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
      // "return" stops the function here — nothing below runs
    }

    setLoading(true);
    // Show loading state on the button — prevents double-click

    try {
      // try/catch: if anything inside "try" throws an error, we jump to "catch"

      const response = await axios.post(`${API_URL}/users/login`, {
        email,     // shorthand for email: email
        password   // shorthand for password: password
      });
      // axios.post sends a POST request to http://localhost:5000/api/users/login
      // with a JSON body: { "email": "...", "password": "..." }
      // "await" pauses here until the server responds
      // response.data will be: { status: "success", token: "...", user: {...} }

      const { token, user } = response.data;
      // Destructure — grab token and user from the response body

      localStorage.setItem("token", token);
      // Save the JWT in localStorage so we can send it with future requests
      // localStorage persists across page refreshes (unlike regular variables)

      localStorage.setItem("user", JSON.stringify(user));
      // Save the user object as a JSON string (localStorage only stores strings)
      // JSON.stringify converts { id: 1, name: "..." } → '{"id":1,"name":"..."}'
      // Later use: const user = JSON.parse(localStorage.getItem("user"))

      // ── Redirect based on the user's actual role from the server ──
      // We trust the backend role — not the UI tab the user clicked
      if (user.role === "super_admin") {
        navigate("/admin");
      } else if (user.role === "admin") {
        navigate("/university-admin");
      } else {
        navigate("/staff");
      }

    } catch (err) {
      // This block runs if:
      // - The server returned a 4xx/5xx status (axios treats these as errors)
      // - There was a network error (server offline, CORS issue, etc.)

      const message =
        err.response?.data?.message || "Login failed. Please try again.";
      // err.response        → the server's response object (null if network error)
      // err.response?.data  → the response body: { status: "error", message: "..." }
      //                       the "?" is optional chaining — avoids crash if null
      // err.response?.data?.message → the specific error text from your backend
      // If any of those are undefined, fall back to a generic message

      setError(message);
      // Update the error state — React re-renders to show the message on screen

    } finally {
      setLoading(false);
      // "finally" always runs — whether the request succeeded or failed
      // We always re-enable the button here
    }
  };

  // ─────────────────────────────────────────────
  // HANDLE ENTER KEY
  // Lets the user press Enter in the password field to submit
  // ─────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      // e.key is the keyboard key that was pressed
      handleSignIn();
      // Trigger sign-in just like clicking the button
    }
  };

  const RoleIcon = roles[activeRole].icon;
  // Grab the icon component for the currently selected role
  // e.g. if activeRole is "staff", RoleIcon = User (the lucide icon)

  return (
    <>
      {/* NAVBAR */}
      <div className="navbar">
        <div className="nav-left">

          <ArrowLeft
            size={24}
            className="back-icon"
            onClick={() => navigate("/")}
            // Clicking the back arrow returns to the home page
          />

          <div className="logo-box">
            <Shield size={24} />
          </div>

          <span className="logo-text">CertifyLB</span>
        </div>
      </div>

      {/* LOGIN CARD */}
      <div className="login-container">
        <div className="login-card">

          <h1 className="Ltitle">Welcome Back</h1>
          <p className="subtitle">Sign in to your CertifyLB portal</p>

          {/* ROLE SELECTOR TABS */}
          <div className="role-selector">
            {Object.entries(roles).map(([key, role]) => {
              // Object.entries turns the roles object into an array of [key, value] pairs
              // e.g. [["university", {...}], ["staff", {...}], ["system", {...}]]
              // .map loops over each pair and returns a button

              const Icon = role.icon;

              return (
                <button
                  key={key}
                  // React requires a unique "key" on list items for efficient re-rendering
                  className={`role-btn ${activeRole === key ? "active" : ""}`}
                  // Conditionally adds the "active" CSS class when this tab is selected
                  onClick={() => {
                    setActiveRole(key);
                    // Switch the active role tab
                    setError("");
                    // Clear errors when switching roles — avoids confusing stale messages
                  }}
                >
                  <Icon size={18} />
                  {role.name}
                </button>
              );
            })}
          </div>

          {/* ROLE INFO BOX */}
          <div className="role-info">
            <RoleIcon size={26} className="role-main-icon" />
            <div>
              <div className="role-title">{roles[activeRole].name}</div>
              <div className="role-desc">{roles[activeRole].description}</div>
            </div>
          </div>

          {/* EMAIL INPUT */}
          <label className="label">{roles[activeRole].emailLabel}</label>
          <input
            type="email"
            placeholder={roles[activeRole].emailPlaceholder}
            className="input"
            value={email}
            // Controlled input: the input always shows the value of our "email" state
            onChange={(e) => setEmail(e.target.value)}
            // onChange fires on every keystroke
            // e.target.value is the current text in the input
            // setEmail updates our state → React re-renders with the new value
          />

          {/* PASSWORD INPUT */}
          <label className="label">{roles[activeRole].keyLabel}</label>
          <div className="password-container">
            <input
              type={showPassword ? "text" : "password"}
              // "password" type hides characters as dots
              // "text" type shows them — toggled by the Eye icon
              placeholder={roles[activeRole].keyPlaceholder}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // Same pattern as the email input — keeps password in sync with state
              onKeyDown={handleKeyDown}
              // Listens for keypresses — triggers login on Enter
            />
            <Eye
              size={20}
              className="eye"
              onClick={() => setShowPassword(!showPassword)}
              // Toggle: if showPassword is true, set it false (and vice versa)
            />
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            // Only renders this div when error is a non-empty string
            // When error is "" (empty), this entire block is invisible
            <div className="error-message" style={{
              color: "var(--error-color, #e74c3c)",
              fontSize: "13px",
              marginTop: "8px",
              padding: "8px 12px",
              background: "rgba(231, 76, 60, 0.08)",
              borderRadius: "6px",
              border: "1px solid rgba(231, 76, 60, 0.2)"
            }}>
              {error}
              {/* Shows the error text returned by the backend, e.g. "Invalid credentials" */}
            </div>
          )}

          {/* SIGN IN BUTTON */}
          <button
            className="login-btn"
            onClick={handleSignIn}
            // Calls our handleSignIn function when clicked
            disabled={loading}
            // disabled=true greys out the button and prevents clicks while loading
            style={{ opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            // Visual feedback that the button is inactive during the request
          >
            <Lock size={18} />
            {loading ? "Signing in..." : `Sign In as ${roles[activeRole].name}`}
            {/* Shows "Signing in..." while the request is in-flight, normal text otherwise */}
          </button>

        </div>
      </div>
    </>
  );
}
