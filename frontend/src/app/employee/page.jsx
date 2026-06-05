"use client";

import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import { useEffect, useState } from "react";
import EmployeeForm from "../components/forms/EmployeeForm";
import { PaginationData } from "../components/Pagination";
import { useSearchParams } from "next/navigation";
import { AlertDestructive } from "../components/Alert";
import { Search, Plus, Download, Upload } from "lucide-react";

export default function Employee() {
  const [resultData, setResultData] = useState([]);
  const [alertStatus, setAlertStatus] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);
  const [formData, setFormData] = useState([]);
  const searchParams = useSearchParams();
  const page = searchParams.get("page") || 1;
  const limit = searchParams.get("limit") || 10;
  const keyword = searchParams.get("keyword") || "";

  const handleFormChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleData = async () => {
    const endPoint = `${apiBaseUrl}/members?keyword=${encodeURIComponent(keyword)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;
    try {
      const res = await fetchWithAuth(endPoint);
      setResultData(res);
    } catch (error) {
      console.log(error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const data = Object.fromEntries(form.entries());
    try {
      const result = await fetchWithAuth(`${apiBaseUrl}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setAlertStatus("success");
      setAlertMessage(result.message);
      e.target.reset();
      document.getElementById("create").closest("dialog").close();
      handleData();
    } catch (error) {
      setAlertStatus("error");
      setAlertMessage(error.message);
    }
  };

  const handleUpdate = async (id) => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setAlertStatus("success");
      setAlertMessage(res.message);
      setFormData([]);
      document.getElementById("create").closest("dialog").close();
      handleData();
    } catch (error) {
      setAlertStatus("error");
      setAlertMessage(error.message);
    }
  };

  const handleView = async (id) => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members?keyword=${id}`);
      setFormData(res.data[0]);
      document.getElementById("create").showModal();
    } catch {}
  };

  const handleDelete = async (id) => {
    const isConfirmed = confirm("Are you sure want to delete this employee?");
    if (!isConfirmed) return;
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members/delete/${id}`, { method: "PATCH" });
      setAlertStatus("success");
      setAlertMessage(res.message);
      handleData();
    } catch (error) {
      setAlertStatus("error");
      setAlertMessage(error.message);
    }
  };

  useEffect(() => {
    handleData();
  }, [keyword, page, limit]);

  useEffect(() => {
    if (alertStatus) {
      const timer = setTimeout(() => { setAlertMessage(null); setAlertStatus(null); }, 10000);
      return () => clearTimeout(timer);
    }
  }, [alertStatus]);

  return (
    <div className="p-8 min-h-screen" style={{ background: "#0b0d14" }}>
      {alertStatus && (
        <AlertDestructive status={alertStatus} tittle={alertStatus} message={alertMessage} />
      )}

      {/* Page header */}
      <div className="mb-6">
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#3b6fd4" }}>
          Management
        </p>
        <h1 className="text-2xl font-black text-white tracking-tight">Employee</h1>
      </div>

      {/* Toolbar */}
      <div
        className="rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3 justify-between"
        style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Filters + search */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="px-3 py-2 rounded-lg text-sm outline-none appearance-none"
            style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}
          >
            <option value="">All Departments</option>
            <option value="production">Production</option>
            <option value="warehouse">Warehouse</option>
            <option value="quality">Quality</option>
            <option value="engineering">Engineering</option>
            <option value="maintenance">Maintenance</option>
          </select>

          <select
            className="px-3 py-2 rounded-lg text-sm outline-none appearance-none"
            style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}
          >
            <option value="">All Positions</option>
            <option value="operator">Operator</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
            <option value="office">Office</option>
          </select>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#4a5568" }} />
            <input
              className="pl-8 pr-4 py-2 rounded-lg text-sm outline-none w-56"
              type="text"
              placeholder="Search employee..."
              style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}
            />
          </div>

          <button
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: "#3b6fd4" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#2f5cb8"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#3b6fd4"; }}
          >
            Search
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: "#3b6fd4" }}
            onClick={() => { setFormData([]); document.getElementById("create").showModal(); }}
            onMouseEnter={e => { e.currentTarget.style.background = "#2f5cb8"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#3b6fd4"; }}
          >
            <Plus size={15} /> Create
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            <Download size={15} /> Export
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            <Upload size={15} /> Import
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["NIK", "Name", "Department", "Position", "Join Date", "Status", "WS", "Role", "Username", "Action"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase"
                  style={{ color: "#4a5568" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resultData?.data?.length > 0 ? (
              resultData.data.map((emp) => (
                <tr
                  key={emp.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#12161f"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ""; }}
                >
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#5b8df8" }}>{emp.nik}</td>
                  <td className="px-4 py-3 font-medium text-white">{emp.name}</td>
                  <td className="px-4 py-3" style={{ color: "#c9d1e0" }}>{emp.departement?.toUpperCase()}</td>
                  <td className="px-4 py-3" style={{ color: "#c9d1e0" }}>{emp.section}</td>
                  <td className="px-4 py-3" style={{ color: "#6b7a99" }}>
                    {new Date(emp.join_date).toLocaleDateString("id-ID")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={
                        emp.status === "aktif"
                          ? { background: "rgba(34,197,94,0.12)", color: "#22c55e" }
                          : { background: "rgba(239,68,68,0.12)", color: "#ef4444" }
                      }
                    >
                      {emp.status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "#6b7a99" }}>{emp.worker_stats?.toUpperCase()}</td>
                  <td className="px-4 py-3" style={{ color: "#6b7a99" }}>{emp.role}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#6b7a99" }}>{emp.username}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(emp.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                        style={{ background: "#1e2d52", color: "#5b8df8", border: "1px solid rgba(91,141,248,0.25)" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#253a6b"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#1e2d52"; }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4">
        <PaginationData
          totalPages={resultData.totalPages}
          currentPage={resultData.currentPage}
        />
      </div>

      {/* Modal */}
      <dialog id="create" className="modal">
        <div className="modal-box max-w-2xl p-0" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="modal-action m-0">
            <form
              method="dialog"
              id="form-create"
              onSubmit={formData.length > 0 ? () => handleUpdate(formData.id) : handleCreate}
              className="flex flex-col gap-4 w-full"
            >
              <EmployeeForm formData={formData} onChange={handleFormChange} />
            </form>
          </div>
        </div>
      </dialog>
    </div>
  );
}
