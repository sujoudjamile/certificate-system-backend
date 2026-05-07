// ===================== staff.js =====================
import React, { useState, useRef, useEffect, useMemo } from "react";
import "./Staff.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  LogOut, Download, ShieldCheck, QrCode, FileText, X,
  ChevronDown, ChevronUp, GraduationCap, BookOpen, Calendar,
  Mail, Phone, Pencil, Lock, User, Search,
} from "lucide-react";

const API = "http://localhost:5000/api";
const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

const DEGREE_COLOR = {
  Bachelor:  { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.3)",  text: "#818cf8" },
  Master:    { bg: "rgba(236,72,153,0.12)",  border: "rgba(236,72,153,0.3)",  text: "#f472b6" },
  PhD:       { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)",  text: "#fbbf24" },
  PharmD:    { bg: "rgba(20,184,166,0.12)",  border: "rgba(20,184,166,0.3)",  text: "#2dd4bf" },
  MD:        { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)",   text: "#f87171" },
  JD:        { bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.3)",  text: "#c084fc" },
  LLB:       { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)",  text: "#60a5fa" },
  MBA:       { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)",   text: "#4ade80" },
  DDS:       { bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.3)",  text: "#fb923c" },
};

const formatDate = (raw) => {
  if (!raw) return "—";
  const s = String(raw).split("T")[0];
  const [y, m, d] = s.split("-").map(Number);
  if (!y) return String(raw);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d).padStart(2,"0")} ${months[m-1]} ${y}`;
};

// ─────────────────────────────────────────────────────────
// SEARCHABLE DROPDOWN COMPONENT
// Props:
//   options     – [{ value, label, group? }]
//   value       – currently selected value
//   onChange    – (value) => void
//   placeholder – string shown when nothing selected
//   disabled    – boolean
//   emptyMsg    – string shown when list is empty
//   dropUp      – boolean: if true the panel opens ABOVE the trigger
//   size        – "sm" | "md" (default "md") controls trigger height
// ─────────────────────────────────────────────────────────
function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  emptyMsg  = "No options available",
  dropUp    = false,
  size      = "md",
}) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset query when closed
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selected = options.find(o => o.value === value);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Group items if they have a 'group' property
  const grouped = useMemo(() => {
    const hasGroups = filtered.some(o => o.group);
    if (!hasGroups) return [{ group: null, items: filtered }];
    const map = {};
    filtered.forEach(o => {
      const g = o.group || "Other";
      if (!map[g]) map[g] = [];
      map[g].push(o);
    });
    return Object.entries(map).map(([group, items]) => ({ group, items }));
  }, [filtered]);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setQuery("");
  };

  const paddingV = size === "sm" ? "10px" : "13px";
  const fontSize = size === "sm" ? 14 : 15;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* ── Trigger button ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        style={{
          width: "100%",
          padding: `${paddingV} 16px`,
          borderRadius: 11,
          border: `1.5px solid ${
            open     ? "rgba(232,24,14,0.6)"
            : value  ? "rgba(34,197,94,0.5)"
            :          "rgba(255,255,255,0.13)"
          }`,
          background: disabled
            ? "rgba(255,255,255,0.03)"
            : open
            ? "rgba(255,255,255,0.10)"
            : "rgba(255,255,255,0.06)",
          color: disabled
            ? "rgba(255,255,255,0.25)"
            : selected
            ? "white"
            : "rgba(255,255,255,0.45)",
          fontSize,
          fontFamily: "var(--font)",
          fontWeight: selected ? 600 : 400,
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          transition: "all .15s",
          outline: "none",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} style={{
          flexShrink: 0,
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform .2s",
          opacity: disabled ? 0.3 : 0.7,
          color: open ? "rgba(232,24,14,0.8)" : "rgba(255,255,255,0.5)",
        }} />
      </button>

      {/* ── Dropdown panel ── */}
      {open && !disabled && (
        <div style={{
          position: "absolute",
          ...(dropUp
            ? { bottom: "calc(100% + 6px)", top: "auto" }
            : { top: "calc(100% + 6px)", bottom: "auto" }
          ),
          left: 0,
          right: 0,
          zIndex: 1000,
          background: "#111c36",
          border: "1.5px solid rgba(255,255,255,0.14)",
          borderRadius: 12,
          boxShadow: dropUp
            ? "0 -10px 36px rgba(0,0,0,0.60)"
            : "0 10px 36px rgba(0,0,0,0.60)",
          overflow: "hidden",
          animation: "dropIn .14s ease",
        }}>
          {/* Search box */}
          <div style={{
            padding: "10px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.03)",
          }}>
            <Search size={14} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "white",
                fontSize: 13.5,
                fontFamily: "var(--font)",
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.4)", padding: 0, lineHeight: 1,
                  display: "flex",
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 230, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{
                padding: "16px 16px",
                color: "rgba(255,255,255,0.3)",
                fontSize: 13,
                fontStyle: "italic",
                textAlign: "center",
              }}>
                {query ? `No results for "${query}"` : emptyMsg}
              </div>
            ) : (
              grouped.map(({ group, items }) => (
                <div key={group || "ungrouped"}>
                  {group && (
                    <div style={{
                      padding: "8px 16px 4px",
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: "0.8px",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.3)",
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                    }}>
                      {group}
                    </div>
                  )}
                  {items.map(o => {
                    const isSelected = o.value === value;
                    return (
                      <div
                        key={o.value}
                        onClick={() => handleSelect(o.value)}
                        style={{
                          padding: "11px 16px",
                          cursor: "pointer",
                          fontSize: 14,
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? "#22c55e" : "rgba(255,255,255,0.88)",
                          background: isSelected ? "rgba(34,197,94,0.1)" : "transparent",
                          borderLeft: isSelected ? "3px solid #22c55e" : "3px solid transparent",
                          transition: "all .1s",
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {o.label}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Clear selection footer */}
          {value && (
            <div
              onClick={() => handleSelect("")}
              style={{
                padding: "9px 16px",
                borderTop: "1px solid rgba(255,255,255,0.07)",
                fontSize: 12,
                color: "rgba(255,255,255,0.35)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255,255,255,0.02)",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
            >
              <X size={11} /> Clear selection
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Staff() {
  const navigate = useNavigate();
  const [tab,      setTab]      = useState("students");
  const [students, setStudents] = useState([]);
  const [certs,    setCerts]    = useState([]);
  const [staff,    setStaff]    = useState(null);
  const [error,    setError]    = useState("");

  // University programs (major+degree combos this uni offers)
  const [programs, setPrograms] = useState([]);

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showCertModal,    setShowCertModal]    = useState(false);
  const [issuedCert,       setIssuedCert]       = useState(null);
  const [qrViewCert,       setQrViewCert]       = useState(null);
  const [expandedStudent,  setExpandedStudent]  = useState(null);

  // ── Edit modal state ──────────────────────────────────────────────────────
  const [showEditModal,  setShowEditModal]  = useState(false);
  const [editRecord,     setEditRecord]     = useState(null);
  const [editForm,       setEditForm]       = useState({});
  const [editError,      setEditError]      = useState("");
  const [editLoading,    setEditLoading]    = useState(false);
  const [editLocked,     setEditLocked]     = useState(false);
  const setEF = (patch) => setEditForm(p => ({ ...p, ...patch }));

  const [nidStatus, setNidStatus] = useState("idle");
  const nidTimer = useRef(null);

  const [studentForm, setStudentForm] = useState({
    name: "", student_id: "", email: "", phone: "",
    dob: "", national_id: "", degree: "", major: "",
  });
  const setSF = (patch) => setStudentForm(p => ({ ...p, ...patch }));

  const [certForm, setCertForm] = useState({
    student_id: "", major: "", degree: "", gpa: "", graduation_date: "",
  });
  const setCF = (patch) => setCertForm(p => ({ ...p, ...patch }));

  const [certError,           setCertError]           = useState("");
  const [certLoading,         setCertLoading]         = useState(false);
  const [certStudentSearch,   setCertStudentSearch]   = useState("");
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const certDropdownRef = useRef(null);

  // ── Derived: unique major options from programs ───────────────────────────
  const majorOptions = useMemo(() => {
    const seen = new Set();
    return programs
      .filter(p => { if (seen.has(p.major)) return false; seen.add(p.major); return true; })
      .map(p => ({ value: p.major, label: p.major }));
  }, [programs]);

  // ── Derived: degree options filtered by selected major ────────────────────
  const degreeOptionsForMajor = useMemo(() => (selectedMajor) => {
    return programs
      .filter(p => p.major === selectedMajor)
      .map(p => ({ value: p.degree, label: p.degree }));
  }, [programs]);

  // ── Cert modal — unique students ──────────────────────────────────────────
  const uniqueStudents = useMemo(() => {
    const seen = new Set();
    return (students || []).filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id); return true;
    });
  }, [students]);

  // Majors & degrees for cert form (based on selected student's existing records)
  const certMajorOptions = useMemo(() => {
    if (!certForm.student_id) return [];
    const rows = students.filter(s => String(s.id) === String(certForm.student_id));
    const seen = new Set();
    return rows
      .filter(r => { if (seen.has(r.major)) return false; seen.add(r.major); return true; })
      .map(r => ({ value: r.major, label: r.major }));
  }, [certForm.student_id, students]);

  const certDegreeOptions = useMemo(() => {
    if (!certForm.student_id || !certForm.major) return [];
    return students
      .filter(s => String(s.id) === String(certForm.student_id) && s.major === certForm.major)
      .map(s => ({ value: s.degree, label: s.degree }));
  }, [certForm.student_id, certForm.major, students]);

  // ── Edit modal major/degree options ──────────────────────────────────────
  const editMajorOptions = majorOptions;
  const editDegreeOptions = useMemo(() => {
    return degreeOptionsForMajor(editForm.major || "");
  }, [editForm.major, degreeOptionsForMajor]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchStudents = async () => {
    try {
      const res = await axios.get(`${API}/students/`, authHeader());
      setStudents(res.data.students || []);
    } catch (err) { console.error("Fetch students error:", err); }
  };

  const fetchPrograms = async () => {
    try {
      const res = await axios.get(`${API}/program/staff-programs`, authHeader());
      setPrograms(res.data.programs || []);
    } catch (err) {
      console.error("Fetch programs error:", err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchPrograms();
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

  useEffect(() => {
    if (showCertModal) fetchStudents();
  }, [showCertModal]);

  // ── Grouped students for display ──────────────────────────────────────────
  const groupedStudents = useMemo(() => {
    const map = {};
    (students || []).forEach(s => {
      if (!map[s.id]) {
        map[s.id] = {
          id: s.id,
          full_name: s.full_name,
          national_id: s.national_id,
          date_of_birth: s.date_of_birth,
          records: [],
        };
      }
      map[s.id].records.push({
        record_id: s.record_id, student_code: s.student_code,
        email: s.email, phone: s.phone,
        degree: s.degree, major: s.major, enrolled_at: s.enrolled_at,
      });
    });
    return Object.values(map);
  }, [students]);

  // ── Close cert student dropdown on outside click ──────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (certDropdownRef.current && !certDropdownRef.current.contains(e.target)) {
        setShowStudentDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  // ── Open edit modal ───────────────────────────────────────────────────────
  const openEditModal = (student, rec) => {
    setEditRecord({ record_id: rec.record_id, student });
    setEditForm({
      full_name:     student.full_name,
      date_of_birth: student.date_of_birth?.substring(0, 10) || "",
      email:         rec.email        || "",
      phone:         rec.phone        || "",
      student_code:  rec.student_code || "",
      degree:        rec.degree       || "",
      major:         rec.major        || "",
    });
    setEditError("");
    setEditLocked(false);
    setShowEditModal(true);
  };

  // ── Save edit ─────────────────────────────────────────────────────────────
  const saveEdit = async () => {
    if (!editRecord) return;
    setEditError("");
    setEditLoading(true);
    try {
      await axios.patch(
        `${API}/students/record/${editRecord.record_id}`,
        {
          full_name:     editForm.full_name     || undefined,
          date_of_birth: editForm.date_of_birth || undefined,
          email:         editForm.email         || undefined,
          phone:         editForm.phone         || undefined,
          student_code:  editForm.student_code  || undefined,
          degree:        editForm.degree        || undefined,
          major:         editForm.major         || undefined,
        },
        authHeader()
      );
      await fetchStudents();
      setShowEditModal(false);
    } catch (err) {
      const msg = err.response?.data?.message || "Something went wrong";
      if (msg.toLowerCase().includes("locked") || msg.toLowerCase().includes("certificate")) {
        setEditLocked(true);
      }
      setEditError(msg);
    } finally {
      setEditLoading(false);
    }
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
      setSF({ name:"", student_id:"", email:"", phone:"", dob:"", national_id:"", degree:"", major:"" });
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
      setCertError(""); setCertStudentSearch(""); setShowStudentDropdown(false);
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

  // ── Edit modal options with current values preserved ─────────────────────
  const editMajorOptionsWithCurrent = useMemo(() => {
    const opts = [...editMajorOptions];
    if (editForm.major && !opts.find(o => o.value === editForm.major)) {
      opts.unshift({ value: editForm.major, label: `${editForm.major} (current)` });
    }
    return opts;
  }, [editMajorOptions, editForm.major]);

  const editDegreeOptionsWithCurrent = useMemo(() => {
    const opts = editDegreeOptions.length > 0
      ? editDegreeOptions
      : degreeOptionsForMajor(editForm.major || "");
    if (editForm.degree && !opts.find(o => o.value === editForm.degree)) {
      return [{ value: editForm.degree, label: `${editForm.degree} (current)` }, ...opts];
    }
    return opts;
  }, [editDegreeOptions, editForm.degree, editForm.major, degreeOptionsForMajor]);

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="container">

      {/* HEADER */}
      <div className="header">
        <div className="header-info">
          <div className="header-name-row">
            <User size={20} color="rgba(255,255,255,0.55)" />
            <h1>{staff ? staff.name : "Staff Portal"}</h1>
          </div>
          <div className="header-uni-row">
            <GraduationCap size={16} color="#60b0ff" />
            <span>{staff ? staff.university_name : "Loading…"}</span>
          </div>
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
          ? <button className="green" onClick={() => setShowStudentModal(true)}>+ Add Student/Degree</button>
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
                            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"rgba(255,255,255,0.35)" }}>
                                <Calendar size={10}/> {formatDate(rec.enrolled_at)}
                              </div>
                              <button
                                className="edit-record-btn"
                                onClick={() => openEditModal(student, rec)}
                                title="Edit this record"
                              >
                                <Pencil size={12} /> Edit
                              </button>
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

      {/* ── EDIT STUDENT RECORD MODAL ── */}
      {showEditModal && editRecord && (
        <div className="modal">
          <div className="modal-box" style={{ maxHeight:"90vh", overflowY:"auto" }}>
            <div className="modal-header">
              <div>
                <h2>Edit Student Record</h2>
                <p className="modal-subtitle">
                  {editRecord.student.full_name} · {editRecord.record_id && `Record #${editRecord.record_id}`}
                </p>
              </div>
              <button className="modal-close" onClick={() => {
                setShowEditModal(false); setEditError(""); setEditLocked(false);
              }}><X size={18}/></button>
            </div>

            {editLocked && (
              <div className="edit-locked-banner">
                <Lock size={16} />
                <span>This record is <strong>locked</strong> — a certificate has been issued and cannot be modified to prevent falsification.</span>
              </div>
            )}

            {editError && !editLocked && (
              <div className="form-error">⚠ {editError}</div>
            )}

            {!editLocked && (
              <>
                <div className="form-section-label">Personal Info</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" placeholder="First & Last name"
                      value={editForm.full_name}
                      onChange={e => setEF({ full_name: e.target.value })}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input className="form-input" type="date"
                      value={editForm.date_of_birth}
                      onChange={e => setEF({ date_of_birth: e.target.value })}/>
                  </div>
                </div>

                <div className="edit-nid-note">
                  <Lock size={11} style={{ flexShrink:0 }}/> National ID cannot be changed
                </div>

                <div className="form-section-label">University Details</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Student Code</label>
                    <input className="form-input" placeholder="8-digit code"
                      value={editForm.student_code}
                      onChange={e => setEF({ student_code: e.target.value })}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" placeholder="71123456"
                      value={editForm.phone}
                      onChange={e => setEF({ phone: e.target.value })}/>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" placeholder="student@example.com"
                    value={editForm.email}
                    onChange={e => setEF({ email: e.target.value })}/>
                </div>

                <div className="form-section-label">Academic</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Major</label>
                    <SearchableDropdown
                      options={editMajorOptionsWithCurrent}
                      value={editForm.major}
                      onChange={(v) => setEF({ major: v, degree: "" })}
                      placeholder="Select major…"
                      emptyMsg="No programmes configured for this university"
                      dropUp
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Degree</label>
                    <SearchableDropdown
                      options={editDegreeOptionsWithCurrent}
                      value={editForm.degree}
                      onChange={(v) => setEF({ degree: v })}
                      placeholder={editForm.major ? "Select degree…" : "Select major first"}
                      disabled={!editForm.major}
                      dropUp
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={saveEdit} disabled={editLoading}>
                    {editLoading ? "Saving…" : "Save Changes"}
                  </button>
                  <button onClick={() => {
                    setShowEditModal(false); setEditError(""); setEditLocked(false);
                  }}>Cancel</button>
                </div>
              </>
            )}

            {editLocked && (
              <div className="modal-actions" style={{ marginTop:20 }}>
                <button onClick={() => { setShowEditModal(false); setEditError(""); setEditLocked(false); }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ADD STUDENT MODAL  —  wider, bigger fonts, stacked major/degree
      ══════════════════════════════════════════════════════════════════════ */}
      {showStudentModal && (
        <div className="modal">
          <div className="modal-box modal-box--wide" style={{ maxHeight:"92vh", overflowY:"auto" }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title-lg">Add Student / Degree</h2>
                <p className="modal-subtitle">Enter a National ID to auto-fill known details</p>
              </div>
              <button className="modal-close" onClick={() => {
                setShowStudentModal(false); setError(""); setNidStatus("idle");
                setSF({ name:"", student_id:"", email:"", phone:"", dob:"", national_id:"", degree:"", major:"" });
              }}><X size={20}/></button>
            </div>

            {error && <div className="form-error">⚠ {error}</div>}

            {/* National ID */}
            <div className="form-group">
              <label className="form-label form-label--lg">National ID</label>
              <input className="form-input form-input--lg" placeholder="e.g. 182712167"
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

            {/* ── Personal Info ── */}
            <div className="form-section-label">Personal Info</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label--lg">Full Name</label>
                <input className="form-input form-input--lg" placeholder="First & Last name"
                  value={studentForm.name}
                  readOnly={nidStatus === "found_uni" || nidStatus === "found_global"}
                  style={{ opacity: (nidStatus === "found_uni" || nidStatus === "found_global") ? .45 : 1 }}
                  onChange={e => setSF({ name: e.target.value })}/>
              </div>
              <div className="form-group">
                <label className="form-label form-label--lg">Date of Birth</label>
                <input className="form-input form-input--lg" type="date"
                  value={studentForm.dob}
                  readOnly={nidStatus === "found_uni" || nidStatus === "found_global"}
                  style={{ opacity: (nidStatus === "found_uni" || nidStatus === "found_global") ? .45 : 1 }}
                  onChange={e => setSF({ dob: e.target.value })}/>
              </div>
            </div>

            {/* ── University Details ── */}
            <div className="form-section-label">University Details</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label--lg">Student Code</label>
                <input className="form-input form-input--lg" placeholder="8-digit code"
                  value={studentForm.student_id}
                  readOnly={nidStatus === "found_uni"}
                  style={{ opacity: nidStatus === "found_uni" ? .45 : 1 }}
                  onChange={e => setSF({ student_id: e.target.value })}/>
              </div>
              <div className="form-group">
                <label className="form-label form-label--lg">Phone</label>
                <input className="form-input form-input--lg" placeholder="71123456"
                  value={studentForm.phone}
                  readOnly={nidStatus === "found_uni"}
                  style={{ opacity: nidStatus === "found_uni" ? .45 : 1 }}
                  onChange={e => setSF({ phone: e.target.value })}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label form-label--lg">Email</label>
              <input className="form-input form-input--lg" placeholder="student@example.com"
                value={studentForm.email}
                readOnly={nidStatus === "found_uni"}
                style={{ opacity: nidStatus === "found_uni" ? .45 : 1 }}
                onChange={e => setSF({ email: e.target.value })}/>
            </div>

            {/* ── Academic Programme — full-width stacked ── */}
            <div className="form-section-label" style={{ marginTop: 20 }}>Academic Programme</div>

            {programs.length === 0 && (
              <div className="form-empty-note" style={{ marginBottom: 14 }}>
                ⚠ No programmes configured for this university yet. Contact your admin to add programmes first.
              </div>
            )}

            {/* MAJOR — full width */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label form-label--lg">
                Major
                {studentForm.major && (
                  <span className="programme-selected-badge">{studentForm.major}</span>
                )}
              </label>
              <SearchableDropdown
                options={majorOptions}
                value={studentForm.major}
                onChange={(v) => setSF({ major: v, degree: "" })}
                placeholder={programs.length === 0 ? "No programmes available" : "Search or select a major…"}
                disabled={programs.length === 0}
                emptyMsg="No majors match your search"
              />
            </div>

            {/* DEGREE — full width, enabled only after major is chosen */}
            <div className="form-group" style={{ marginBottom: 6 }}>
              <label className="form-label form-label--lg">
                Degree
                {studentForm.degree && (
                  <span className="programme-selected-badge programme-selected-badge--degree">{studentForm.degree}</span>
                )}
              </label>
              {/* Hint when major not selected yet */}
              {!studentForm.major && programs.length > 0 && (
                <p className="degree-hint-text">← Select a major first to see available degrees</p>
              )}
              <SearchableDropdown
                options={degreeOptionsForMajor(studentForm.major)}
                value={studentForm.degree}
                onChange={(v) => setSF({ degree: v })}
                placeholder={!studentForm.major ? "Select a major first" : "Search or select a degree…"}
                disabled={!studentForm.major}
                emptyMsg="No degrees available for this major"
              />
            </div>

            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button onClick={addStudent}
                disabled={!studentForm.major || !studentForm.degree}>
                Add Student
              </button>
              <button onClick={() => {
                setShowStudentModal(false); setError(""); setNidStatus("idle");
                setSF({ name:"", student_id:"", email:"", phone:"", dob:"", national_id:"", degree:"", major:"" });
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ISSUE CERTIFICATE MODAL */}
      {showCertModal && (
        <div className="modal">
          <div className="modal-box" style={{ maxHeight:"92vh", overflowY:"auto" }}>
            <div className="modal-header">
              <div>
                <h2>Issue Certificate</h2>
                <p className="modal-subtitle">Select a student and fill in the academic details</p>
              </div>
              <button className="modal-close" onClick={() => {
                setShowCertModal(false);
                setCF({ student_id:"", major:"", degree:"", gpa:"", graduation_date:"" });
                setCertError(""); setCertStudentSearch(""); setShowStudentDropdown(false);
              }}><X size={18}/></button>
            </div>

            {certError && <div className="form-error">⚠ {certError}</div>}

            {/* ── 1. Student search — FIRST field, dropdown opens downward ── */}
            <div className="form-group" ref={certDropdownRef}>
              <label className="form-label">Student</label>
              {uniqueStudents.length === 0 ? (
                <div className="form-empty-note">
                  No students registered at your university yet. Add a student first.
                </div>
              ) : (
                /* Relative wrapper so we can absolutely position the drop-up panel */
                <div style={{ position: "relative" }}>
                  {/* Search input */}
                  <div style={{ position: "relative" }}>
                    <Search size={15} style={{
                      position: "absolute", left: 13, top: "50%",
                      transform: "translateY(-50%)",
                      color: "rgba(255,255,255,0.35)", pointerEvents: "none",
                    }} />
                    <input
                      className="form-input"
                      placeholder="Search by name or ID…"
                      value={
                        certForm.student_id
                          ? (() => {
                              const sel = uniqueStudents.find(s => String(s.id) === String(certForm.student_id));
                              return showStudentDropdown ? certStudentSearch
                                : sel ? `${sel.full_name}  ·  ${sel.national_id}` : certStudentSearch;
                            })()
                          : certStudentSearch
                      }
                      onFocus={() => { setCertStudentSearch(""); setShowStudentDropdown(true); }}
                      onChange={e => {
                        setCertStudentSearch(e.target.value);
                        setShowStudentDropdown(true);
                        if (!e.target.value) { setCF({ student_id:"", major:"", degree:"" }); setCertError(""); }
                      }}
                      style={{
                        paddingLeft: 38,
                        paddingRight: 36,
                        borderColor: certForm.student_id ? "rgba(34,197,94,0.5)" : undefined,
                      }}
                    />
                    {certForm.student_id && (
                      <button
                        onClick={() => { setCF({ student_id:"", major:"", degree:"" }); setCertStudentSearch(""); setCertError(""); }}
                        style={{
                          position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                          background:"none", border:"none", cursor:"pointer",
                          color:"rgba(255,255,255,0.4)", padding:0, lineHeight:1, display:"flex",
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown panel — opens downward, high z-index floats over fields below */}
                  {showStudentDropdown && (() => {
                    const q = certStudentSearch.toLowerCase().trim();
                    const filtered = uniqueStudents.filter(s =>
                      s.full_name.toLowerCase().includes(q) ||
                      String(s.national_id).toLowerCase().includes(q) ||
                      (s.id && String(s.id).includes(q))
                    );
                    return (
                      <div style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0, right: 0,
                        zIndex: 1001,
                        background: "#111c36",
                        border: "1.5px solid rgba(255,255,255,0.14)",
                        borderRadius: 12,
                        maxHeight: 220,
                        overflowY: "auto",
                        boxShadow: "0 10px 36px rgba(0,0,0,0.65)",
                        animation: "dropIn .14s ease",
                      }}>
                        {filtered.length === 0 ? (
                          <div style={{
                            padding: "14px 16px",
                            color: "rgba(255,255,255,0.35)",
                            fontSize: 13, fontStyle: "italic", textAlign: "center",
                          }}>
                            {certStudentSearch ? `No students match "${certStudentSearch}"` : "No students found"}
                          </div>
                        ) : filtered.map(s => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setCF({ student_id: s.id, major: "", degree: "" });
                              setCertStudentSearch(""); setCertError(""); setShowStudentDropdown(false);
                            }}
                            style={{
                              padding: "11px 16px", cursor: "pointer",
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              background: String(certForm.student_id) === String(s.id) ? "rgba(34,197,94,0.1)" : "transparent",
                              borderLeft: String(certForm.student_id) === String(s.id) ? "3px solid #22c55e" : "3px solid transparent",
                              transition: "background .1s",
                            }}
                            onMouseEnter={e => { if (String(certForm.student_id) !== String(s.id)) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                            onMouseLeave={e => { if (String(certForm.student_id) !== String(s.id)) e.currentTarget.style.background = "transparent"; }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, color: "white", fontSize: 14 }}>{s.full_name}</div>
                              <div style={{ color: "rgba(255,255,255,0.38)", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                                NID: {s.national_id}
                              </div>
                            </div>
                            {String(certForm.student_id) === String(s.id) && (
                              <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>✓ Selected</span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ── 2. Major & Degree ── */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Major</label>
                <SearchableDropdown
                  options={certMajorOptions}
                  value={certForm.major}
                  onChange={(v) => { setCF({ major: v, degree: "" }); setCertError(""); }}
                  placeholder={!certForm.student_id ? "Select a student first" : certMajorOptions.length === 0 ? "No records found" : "Select major…"}
                  disabled={!certForm.student_id || certMajorOptions.length === 0}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Degree</label>
                <SearchableDropdown
                  options={certDegreeOptions}
                  value={certForm.degree}
                  onChange={(v) => { setCF({ degree: v }); setCertError(""); }}
                  placeholder={!certForm.major ? "Select major first" : "Select degree…"}
                  disabled={!certForm.major}
                />
              </div>
            </div>

            {/* ── 3. GPA + Graduation Date ── */}
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
                setCertError(""); setCertStudentSearch(""); setShowStudentDropdown(false);
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