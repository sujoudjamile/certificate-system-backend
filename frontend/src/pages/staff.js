// ===================== staff.js =====================
import React, { useState } from "react";
import "./Staff.css";
import axios from "axios";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  
  LogOut,
  
} from "lucide-react";


export default function Staff() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("students");

  const [students, setStudents] = useState([]);
  const [certs, setCerts] = useState([]);

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [staff, setStaff] = useState(null);
  const [studentForm, setStudentForm] = useState({
    name: "", university_id: "", email: "", phone: "", dob: "", national_id: ""
  });

  const [certForm, setCertForm] = useState({
    name: "", id: "", gpa: "", degree: "", year: ""
  });

 const addStudent = async () => {
  try {
    const res = await axios.post(
      "http://localhost:5000/api/students/", // change path
      {
        full_name: studentForm.name,
        email: studentForm.email,
        national_id: studentForm.national_id,
        date_of_birth: studentForm.dob
      },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    // Add locally (optional better UX)
    setStudents([
      ...students,
      {
        id: res.data.studentId,
        full_name: studentForm.name,
        email: studentForm.email,
        national_id: studentForm.national_id,
        date_of_birth: studentForm.dob
      }
    ]);

    setShowStudentModal(false);

  } catch (err) {
    console.error("Error adding student:", err.response?.data || err.message);
  }
};

  const addCert = () => {
    const qr = JSON.stringify(certForm);
    setCerts([...certs, { ...certForm, qr }]);
    setShowCertModal(false);
    setCertForm({ name: "", id: "", gpa: "", degree: "", year: "" });
  };

  useEffect(() => {
  const fetchStudents = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/students/", // change this
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
      );

      setStudents(res.data.students);

    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  fetchStudents();
  }, []);

  useEffect(() => {
  const fetchUser = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/users/me", // change if needed
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
      );

      setStaff(res.data.user);

    } catch (err) {
      console.error("User fetch error:", err);
    }
  };

  fetchUser();
}, []);

  return (
    <div className="container">

      {/* HEADER */}
      <div className="header">
        <div>
          <h1>Staff Portal</h1>
          <p>
            {staff
                ? `${staff.name} · ${staff.university_name}`
                : "Loading..."}
          </p>
        </div>
        <button className="uni-nav__signout" onClick={() => { localStorage.removeItem("token"); navigate("/login"); }}>
          <LogOut size={18} /> Sign Out
        </button>
      </div>

      {/* TABS */}
      <div className="tabs">
        <button className={tab === "students" ? "active" : ""} onClick={() => setTab("students")}>Student Management</button>
        <button className={tab === "certs" ? "active" : ""} onClick={() => setTab("certs")}>Certifications</button>
      </div>

      {/* SEARCH + ACTION */}
      <div className="topbar">
        <input placeholder="Search students by name, ID, or email..." />
        {tab === "students" ? (
          <button className="green" onClick={() => setShowStudentModal(true)}>+ Add Student</button>
        ) : (
          <button className="green" onClick={() => setShowCertModal(true)}>+ Add Certificate</button>
        )}
      </div>

      {/* CONTENT */}
      {tab === "students" ? (
        <div className="box">
          <h3>Registered Students ({students.length})</h3>

          {students.length === 0 ? (
            <p className="empty">No students found. Add your first student to get started.</p>
          ) : (
            students.map((s, i) => (
              <div key={i} className="card">
                <h4>{s.full_name}</h4>
                <p>National ID: {s.national_id}</p>
                <p>{s.email}</p>
                <p>{s.phone}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="box">
          <h3>Issued Certificates ({certs.length})</h3>

          {certs.map((c, i) => (
            <div key={i} className="card cert">
              <div>
                <h4>{c.name}</h4>
                <p>{c.degree}</p>
                <button className="view">View Certificate</button>
              </div>
              
            </div>
          ))}
        </div>
      )}

      {/* STUDENT MODAL */}
      {showStudentModal && (
        <div className="modal">
          <div className="modal-box">
            <h2>Add Student</h2>
            <input placeholder="Name" onChange={e => setStudentForm({...studentForm, name:e.target.value})}/>
            <input placeholder="Student_ID" onChange={e => setStudentForm({...studentForm, university_id:e.target.value})}/>
            <input placeholder="Email" onChange={e => setStudentForm({...studentForm, email:e.target.value})}/>
            <input placeholder="Phone" onChange={e => setStudentForm({...studentForm, phone:e.target.value})}/>
            <input placeholder="National_ID" onChange={e => setStudentForm({...studentForm, national_id:e.target.value})}/>
            <input type="date" onChange={e => setStudentForm({...studentForm, dob:e.target.value})}/>
            

            <button onClick={addStudent}>Add</button>
            <button onClick={() => setShowStudentModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* CERT MODAL */}
      {showCertModal && (
        <div className="modal">
          <div className="modal-box">
            <h2>Issue Certificate</h2>
            <input placeholder="Student Name" onChange={e => setCertForm({...certForm, name:e.target.value})}/>
            <input placeholder="Student ID" onChange={e => setCertForm({...certForm, id:e.target.value})}/>
            <input placeholder="GPA" onChange={e => setCertForm({...certForm, gpa:e.target.value})}/>
            <input placeholder="Degree / Major" onChange={e => setCertForm({...certForm, degree:e.target.value})}/>
            <input placeholder="Graduation Year" onChange={e => setCertForm({...certForm, year:e.target.value})}/>

            <button onClick={addCert}>Issue</button>
            <button onClick={() => setShowCertModal(false)}>Cancel</button>
          </div>
        </div>
      )}

    </div>
  );
}


