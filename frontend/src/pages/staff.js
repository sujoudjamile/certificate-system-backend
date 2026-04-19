// ===================== staff.js =====================
import React, { useState, useRef, useEffect, useMemo } from "react";
import "./Staff.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  LogOut, Download, ShieldCheck, QrCode, FileText, X,
  ChevronDown, ChevronUp, GraduationCap, BookOpen, Calendar,
  Mail, Phone,
} from "lucide-react";

const API = "http://localhost:5000/api";
const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

const DEGREE_COLOR = {
  Bachelor: { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.3)",  text: "#818cf8" },
  Master:   { bg: "rgba(236,72,153,0.12)",  border: "rgba(236,72,153,0.3)",  text: "#f472b6" },
  PhD:      { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)",  text: "#fbbf24" },
};

const formatDate = (raw) => {
  if (!raw) return "—";
  const s = String(raw).split("T")[0];
  const [y, m, d] = s.split("-").map(Number);
  if (!y) return String(raw);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d).padStart(2,"0")} ${months[m-1]} ${y}`;
};

// ══════════════════════════════════════════════════════════════════════════════
export default function Staff() {
  const navigate = useNavigate();
  const [tab,      setTab]      = useState("students");
  const [students, setStudents] = useState([]);
  const [certs,    setCerts]    = useState([]);
  const [staff,    setStaff]    = useState(null);
  const [error,    setError]    = useState("");

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showCertModal,    setShowCertModal]    = useState(false);
  const [issuedCert,       setIssuedCert]       = useState(null);
  const [qrViewCert,       setQrViewCert]       = useState(null);
  const [expandedStudent,  setExpandedStudent]  = useState(null);

  const [studentMajors,  setStudentMajors]  = useState([]);
  const [studentDegrees, setStudentDegrees] = useState([]);

  const [nidStatus, setNidStatus] = useState("idle");
  const nidTimer = useRef(null);

  const [studentForm, setStudentForm] = useState({
    name: "", student_id: "", email: "", phone: "",
    dob: "", national_id: "", degree: "Bachelor", major: "",
  });
  const setSF = (patch) => setStudentForm(p => ({ ...p, ...patch }));

  const [certForm, setCertForm] = useState({
    student_id: "", major: "", degree: "", gpa: "", graduation_date: "",
  });
  const setCF = (patch) => setCertForm(p => ({ ...p, ...patch }));

  const [certError,   setCertError]   = useState("");
  const [certLoading, setCertLoading] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchStudents = async () => {
    try {
      const res = await axios.get(`${API}/students/`, authHeader());
      setStudents(res.data.students || []);
    } catch (err) { console.error("Fetch students error:", err); }
  };

  useEffect(() => {
    fetchStudents();
    axios.get(`${API}/users/me`, authHeader())
      .then(r => setStaff(r.data.user))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (tab === "certs") {
      axios.get(`${API}/certificates/`, authHeader())
        .then(r => setCerts(r.data.certificates || []))
        .catch(console.error);
    }
  }, [tab]);

  // Re-fetch students every time the cert modal opens — ensures dropdown is fresh
  useEffect(() => {
    if (showCertModal) fetchStudents();
  }, [showCertModal]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const groupedStudents = useMemo(() => {
    const map = {};
    (students || []).forEach(s => {
      if (!map[s.id]) {
        map[s.id] = { id: s.id, full_name: s.full_name, national_id: s.national_id, records: [] };
      }
      map[s.id].records.push({
        record_id: s.record_id, student_code: s.student_code,
        email: s.email, phone: s.phone,
        degree: s.degree, major: s.major, enrolled_at: s.enrolled_at,
      });
    });
    return Object.values(map);
  }, [students]);

  // One entry per students_new.id for the cert dropdown
  const uniqueStudents = useMemo(() => {
    const seen = new Set();
    return (students || []).filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id); return true;
    });
  }, [students]);

  // ── National ID autofill ──────────────────────────────────────────────────
  const handleNidChange = (e) => {
    const val = e.target.value;
    setSF({ national_id: val, name: "", dob: "", email: "", phone: "", student_id: "" });
    setNidStatus("idle");
    if (nidTimer.current) clearTimeout(nidTimer.current);
    if (val.trim().length < 4) return;

    nidTimer.current = setTimeout(async () => {
      setNidStatus("loading");
      try {
        const res = await axios.get(`${API}/students/by-national-id/${val.trim()}`, authHeader());
        if (!res.data.exists) { setNidStatus("new"); return; }
        const { full_name, date_of_birth } = res.data.student;
        if (res.data.in_university && res.data.university_record) {
          const { student_code, email, phone } = res.data.university_record;
          setSF({ name: full_name, dob: date_of_birth?.substring(0, 10) || "",
            student_id: student_code || "", email: email || "", phone: phone || "" });
          setNidStatus("found_uni");
        } else {
          setSF({ name: full_name, dob: date_of_birth?.substring(0, 10) || "" });
          setNidStatus("found_global");
        }
      } catch { setNidStatus("idle"); }
    }, 600);
  };

  const NID_BADGE = {
    loading:      { color: "#888",    text: "Searching…" },
    found_uni:    { color: "#22c55e", text: "✓ Found in your university — fields pre-filled" },
    found_global: { color: "#60a5fa", text: "✓ Known student — name & date filled" },
    new:          { color: "#f59e0b", text: "New student — please fill in all details" },
  };

  // ── Cert dropdown helpers ─────────────────────────────────────────────────
  const handleStudentSelect = (id) => {
    setCF({ student_id: id, major: "", degree: "" });
    setStudentMajors([]); setStudentDegrees([]);
    if (!id) return;
    const rows   = students.filter(s => String(s.id) === String(id));
    const majors = [...new Set(rows.map(r => r.major).filter(Boolean))];
    setStudentMajors(majors);
    if (majors.length === 1) handleMajorSelect(id, majors[0], rows);
  };

  const handleMajorSelect = (sid, major, rows) => {
    const src = rows || students.filter(s => String(s.id) === String(sid || certForm.student_id));
    setCF({ major, degree: "" }); setStudentDegrees([]);
    if (!major) return;
    const degrees = [...new Set(src.filter(r => r.major === major).map(r => r.degree).filter(Boolean))];
    setStudentDegrees(degrees);
    if (degrees.length === 1) setCF({ major, degree: degrees[0] });
  };

  // ── Add student ───────────────────────────────────────────────────────────
  const addStudent = async () => {
    try {
      await axios.post(`${API}/students/`, {
        full_name: studentForm.name, student_id: studentForm.student_id,
        email: studentForm.email, phone: studentForm.phone,
        national_id: studentForm.national_id, date_of_birth: studentForm.dob,
        degree: studentForm.degree, major: studentForm.major,
      }, authHeader());
      await fetchStudents();
      setShowStudentModal(false); setError(""); setNidStatus("idle");
      setSF({ name:"", student_id:"", email:"", phone:"", dob:"", national_id:"", degree:"Bachelor", major:"" });
    } catch (err) { setError(err.response?.data?.message || "Something went wrong"); }
  };

  // ── Issue certificate ─────────────────────────────────────────────────────
  const issueCertificate = async () => {
    setCertError("");
    if (!certForm.student_id || !certForm.major || !certForm.degree || !certForm.graduation_date) {
      setCertError("Please fill in all required fields."); return;
    }
    setCertLoading(true);
    try {
      const res = await axios.post(`${API}/certificates/`, {
        student_id:      Number(certForm.student_id),
        degree:          certForm.degree, major: certForm.major,
        GPA:             certForm.gpa ? parseFloat(certForm.gpa) : undefined,
        graduation_date: `${certForm.graduation_date}-01-01`,
      }, authHeader());
      const nc = res.data.certificate;
      setCerts(prev => [{ id:nc.id, cert_number:nc.cert_number, student_name:nc.student,
        degree:nc.degree, major:nc.major, GPA:nc.GPA, graduation_date:nc.graduation_date,
        status:"issued", qr_code:nc.qr_code }, ...prev]);
      setShowCertModal(false);
      setCF({ student_id:"", major:"", degree:"", gpa:"", graduation_date:"" });
      setStudentMajors([]); setStudentDegrees([]); setCertError("");
      setIssuedCert(nc);
    } catch (err) {
      setCertError(err.response?.data?.message || "Failed to issue certificate.");
    } finally { setCertLoading(false); }
  };

  // ── Download PDF ──────────────────────────────────────────────────────────
  const downloadPdf = async (certId, certNumber) => {
    try {
      const res = await axios.get(`${API}/certificates/${certId}/pdf`,
        { ...authHeader(), responseType:"blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type:"application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `certificate_${certNumber}.pdf`; a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { console.error("PDF download error:", err); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="container">

      {/* HEADER */}
      <div className="header">
        <div>
          <h1>Staff Portal</h1>
          <p>{staff ? `${staff.name} · ${staff.university_name}` : "Loading…"}</p>
        </div>
        <button className="uni-nav__signout"
          onClick={() => { localStorage.removeItem("token"); navigate("/login"); }}>
          <LogOut size={18} /> Sign Out
        </button>
      </div>

      {/* TABS */}
      <div className="tabs">
        <button className={tab === "students" ? "active" : ""} onClick={() => setTab("students")}>Student Management</button>
        <button className={tab === "certs"    ? "active" : ""} onClick={() => setTab("certs")}>Certifications</button>
      </div>

      {/* TOPBAR */}
      <div className="topbar">
        <input placeholder="Search by name, ID, or email…" />
        {tab === "students"
          ? <button className="green" onClick={() => setShowStudentModal(true)}>+ Add Student</button>
          : <button className="green" onClick={() => setShowCertModal(true)}>+ Add Certificate</button>}
      </div>

      {/* ── STUDENTS TAB ── */}
      {tab === "students" ? (
        <div className="box">
          <h3>Registered Students ({groupedStudents.length})</h3>
          {groupedStudents.length === 0 ? (
            <p className="empty">No students yet. Add your first student above.</p>
          ) : groupedStudents.map(student => {
            const open  = expandedStudent === student.id;
            const first = student.records[0];
            return (
              <div key={student.id} className="card" style={{ padding:0, overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 18px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div className="student-avatar">
                      {student.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15 }}>{student.full_name}</div>
                      <div style={{ display:"flex", gap:10, marginTop:3, flexWrap:"wrap" }}>
                        <span className="meta-chip">Code: {first.student_code}</span>
                        <span className="meta-chip">NID: {student.national_id}</span>
                        {student.records.length > 1 && (
                          <span className="meta-chip meta-chip--accent">{student.records.length} programmes</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    className={"degree-toggle" + (open ? " degree-toggle--open" : "")}
                    onClick={() => setExpandedStudent(open ? null : student.id)}>
                    <GraduationCap size={13} />
                    {open ? "Hide" : "Degrees"}
                    {open ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                  </button>
                </div>

                {open && (
                  <div className="degrees-panel">
                    <div className="degrees-panel__title">Academic Records</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {student.records.map(rec => {
                        const dc = DEGREE_COLOR[rec.degree] || DEGREE_COLOR.Bachelor;
                        return (
                          <div key={rec.record_id} className="degree-row"
                            style={{ background:dc.bg, borderColor:dc.border }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                              <BookOpen size={14} style={{ color:dc.text, flexShrink:0 }}/>
                              <div>
                                <div style={{ fontWeight:700, fontSize:13, color:dc.text }}>
                                  {rec.degree} · {rec.major}
                                </div>
                                <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
                                  Code: {rec.student_code}
                                </div>
                              </div>
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"rgba(255,255,255,0.35)" }}>
                              <Calendar size={10}/> {formatDate(rec.enrolled_at)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display:"flex", gap:16, marginTop:10, fontSize:12, color:"rgba(255,255,255,0.35)" }}>
                      {first.email && <span style={{ display:"flex", alignItems:"center", gap:4 }}><Mail size={11}/>{first.email}</span>}
                      {first.phone && <span style={{ display:"flex", alignItems:"center", gap:4 }}><Phone size={11}/>{first.phone}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="box">
          <h3>Issued Certificates ({certs.length})</h3>
          {certs.length === 0 ? (
            <p className="empty">No certificates issued yet.</p>
          ) : certs.map(c => (
            <div key={c.id} className="card cert">
              <div>
                <h4>{c.student_name}</h4>
                <p>{c.degree} · {c.major}{c.GPA ? ` · GPA ${parseFloat(c.GPA).toFixed(2)}` : ""}</p>
                <p className="cert-number">#{c.cert_number}</p>
                <span className={`cert-status cert-status--${c.status}`}>{c.status}</span>
              </div>
              <div className="cert-actions">
                <button className="view" onClick={() => setQrViewCert(c)}>
                  <QrCode size={14} style={{ marginRight:5 }}/>QR
                </button>
                <button className="view" onClick={() => downloadPdf(c.id, c.cert_number)}>
                  <FileText size={14} style={{ marginRight:5 }}/>PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR VIEWER */}
      {qrViewCert && (
        <div className="modal" onClick={() => setQrViewCert(null)}>
          <div className="modal-box cert-success-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setQrViewCert(null)}><X size={18}/></button>
            <h2 style={{ marginBottom:4 }}>QR Code</h2>
            <p className="cert-success-name">{qrViewCert.student_name}</p>
            <p className="cert-success-detail">{qrViewCert.degree} · {qrViewCert.major}</p>
            <p className="cert-number" style={{ marginBottom:12 }}>#{qrViewCert.cert_number}</p>
            {qrViewCert.qr_code
              ? <><div className="qr-wrapper"><img src={qrViewCert.qr_code} alt="QR" className="qr-img"/></div><p className="qr-hint">Scan to verify online</p></>
              : <p style={{ color:"rgba(255,255,255,0.4)" }}>QR not available.</p>}
            <div className="modal-actions" style={{ justifyContent:"center", marginTop:16 }}>
              <button onClick={() => setQrViewCert(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showStudentModal && (
        <div className="modal">
          <div className="modal-box" style={{ maxHeight:"90vh", overflowY:"auto" }}>
            <div className="modal-header">
              <div>
                <h2>Add Student</h2>
                <p className="modal-subtitle">Enter a National ID to auto-fill known details</p>
              </div>
              <button className="modal-close" onClick={() => {
                setShowStudentModal(false); setError(""); setNidStatus("idle");
                setSF({ name:"", student_id:"", email:"", phone:"", dob:"", national_id:"", degree:"Bachelor", major:"" });
              }}><X size={18}/></button>
            </div>

            {error && <div className="form-error">⚠ {error}</div>}

            <div className="form-group">
              <label className="form-label">National ID</label>
              <input className="form-input" placeholder="e.g. 182712167"
                value={studentForm.national_id} onChange={handleNidChange}/>
            </div>

            {nidStatus !== "idle" && NID_BADGE[nidStatus] && (
              <div className="nid-badge" style={{
                color: NID_BADGE[nidStatus].color,
                borderColor: NID_BADGE[nidStatus].color + "44",
                background: NID_BADGE[nidStatus].color + "11",
              }}>
                {NID_BADGE[nidStatus].text}
              </div>
            )}

            <div className="form-section-label">Personal Info</div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" placeholder="First & Last name"
                  value={studentForm.name}
                  readOnly={nidStatus === "found_uni" || nidStatus === "found_global"}
                  style={{ opacity: (nidStatus === "found_uni" || nidStatus === "found_global") ? .45 : 1 }}
                  onChange={e => setSF({ name: e.target.value })}/>
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input className="form-input" type="date"
                  value={studentForm.dob}
                  readOnly={nidStatus === "found_uni" || nidStatus === "found_global"}
                  style={{ opacity: (nidStatus === "found_uni" || nidStatus === "found_global") ? .45 : 1 }}
                  onChange={e => setSF({ dob: e.target.value })}/>
              </div>
            </div>

            <div className="form-section-label">University Details</div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Student Code</label>
                <input className="form-input" placeholder="8-digit code"
                  value={studentForm.student_id}
                  readOnly={nidStatus === "found_uni"}
                  style={{ opacity: nidStatus === "found_uni" ? .45 : 1 }}
                  onChange={e => setSF({ student_id: e.target.value })}/>
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" placeholder="71123456"
                  value={studentForm.phone}
                  readOnly={nidStatus === "found_uni"}
                  style={{ opacity: nidStatus === "found_uni" ? .45 : 1 }}
                  onChange={e => setSF({ phone: e.target.value })}/>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" placeholder="student@example.com"
                value={studentForm.email}
                readOnly={nidStatus === "found_uni"}
                style={{ opacity: nidStatus === "found_uni" ? .45 : 1 }}
                onChange={e => setSF({ email: e.target.value })}/>
            </div>

            <div className="form-section-label">Academic</div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Major</label>
                <input className="form-input" placeholder="e.g. Computer Science"
                  value={studentForm.major} onChange={e => setSF({ major: e.target.value })}/>
              </div>
              <div className="form-group">
                <label className="form-label">Degree</label>
                <select className="form-select" value={studentForm.degree} onChange={e => setSF({ degree: e.target.value })}>
                  <option>Bachelor</option>
                  <option>Master</option>
                  <option>PhD</option>
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={addStudent}>Add Student</button>
              <button onClick={() => {
                setShowStudentModal(false); setError(""); setNidStatus("idle");
                setSF({ name:"", student_id:"", email:"", phone:"", dob:"", national_id:"", degree:"Bachelor", major:"" });
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ISSUE CERTIFICATE MODAL */}
      {showCertModal && (
        <div className="modal">
          <div className="modal-box">
            <div className="modal-header">
              <div>
                <h2>Issue Certificate</h2>
                <p className="modal-subtitle">Select a student and fill in the academic details</p>
              </div>
              <button className="modal-close" onClick={() => {
                setShowCertModal(false);
                setCF({ student_id:"", major:"", degree:"", gpa:"", graduation_date:"" });
                setStudentMajors([]); setStudentDegrees([]); setCertError("");
              }}><X size={18}/></button>
            </div>

            {certError && <div className="form-error">⚠ {certError}</div>}

            <div className="form-group">
              <label className="form-label">Student</label>
              {uniqueStudents.length === 0 ? (
                <div className="form-empty-note">
                  No students registered at your university yet. Add a student first.
                </div>
              ) : (
                <select className="form-select"
                  value={certForm.student_id}
                  onChange={e => { handleStudentSelect(e.target.value); setCertError(""); }}>
                  <option value="">— Select a student —</option>
                  {uniqueStudents.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}  ·  {s.national_id}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Major</label>
                <select className="form-select"
                  value={certForm.major}
                  disabled={studentMajors.length === 0}
                  onChange={e => { handleMajorSelect(null, e.target.value, null); setCertError(""); }}>
                  <option value="">
                    {!certForm.student_id ? "Select a student first"
                      : studentMajors.length === 0 ? "No majors found"
                      : "— Select major —"}
                  </option>
                  {studentMajors.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Degree</label>
                <select className="form-select"
                  value={certForm.degree}
                  disabled={studentDegrees.length === 0}
                  onChange={e => { setCF({ degree: e.target.value }); setCertError(""); }}>
                  <option value="">
                    {!certForm.major ? "Select major first"
                      : studentDegrees.length === 0 ? "No degrees found"
                      : "— Select degree —"}
                  </option>
                  {studentDegrees.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  GPA <span style={{ color:"rgba(255,255,255,0.3)", fontWeight:400 }}>(optional)</span>
                </label>
                <input className="form-input" type="number" step="0.01" min="2" max="4"
                  placeholder="e.g. 3.75"
                  value={certForm.gpa} onChange={e => setCF({ gpa: e.target.value })}/>
              </div>
              <div className="form-group">
                <label className="form-label">Graduation Date</label>
                <input className="form-input" type="date"
                  value={certForm.graduation_date} onChange={e => setCF({ graduation_date: e.target.value })}/>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={issueCertificate} disabled={certLoading}>
                {certLoading ? "Issuing…" : "Issue Certificate"}
              </button>
              <button onClick={() => {
                setShowCertModal(false);
                setCF({ student_id:"", major:"", degree:"", gpa:"", graduation_date:"" });
                setStudentMajors([]); setStudentDegrees([]); setCertError("");
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ISSUED CERT SUCCESS */}
      {issuedCert && (
        <div className="modal">
          <div className="modal-box cert-success-box">
            <div className="cert-success-icon"><ShieldCheck size={36} color="#22c55e"/></div>
            <h2>Certificate Issued!</h2>
            <p className="cert-success-name">{issuedCert.student}</p>
            <p className="cert-success-detail">{issuedCert.degree} in {issuedCert.major}</p>
            {issuedCert.GPA && <p className="cert-success-detail">GPA: {parseFloat(issuedCert.GPA).toFixed(2)}</p>}
            <p className="cert-number">#{issuedCert.cert_number}</p>
            {issuedCert.qr_code && (
              <div className="qr-wrapper">
                <img src={issuedCert.qr_code} alt="QR" className="qr-img"/>
                <p className="qr-hint">Scan to verify</p>
              </div>
            )}
            <div className="modal-actions">
              <button onClick={() => downloadPdf(issuedCert.id, issuedCert.cert_number)}>
                <Download size={14} style={{ marginRight:6 }}/>Download PDF
              </button>
              <button onClick={() => setIssuedCert(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}