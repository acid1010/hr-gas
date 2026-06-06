"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import EmployeeForm from "../components/forms/EmployeeForm";
import Drawer from "../components/Drawer";
import { Search, Plus, Download, Upload } from "lucide-react";

const DEPT_COLORS = {
  production: "#3b6fd4", engineering: "#8b5cf6", qc: "#f59e0b",
  maintenance: "#ef4444", warehouse: "#10b981", hr: "#5b8df8",
  ga: "#f97316", it: "#06b6d4",
};
function deptColor(dept) { return DEPT_COLORS[(dept || "").toLowerCase()] || "#4a5568"; }

const WS_STYLE = {
  pkwt: { bg: "rgba(91,141,248,0.12)", color: "#5b8df8" },
  borongan: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  magang: { bg: "rgba(107,122,153,0.12)", color: "#6b7a99" },
};

function StatusBadge({ value }) {
  const active = value === "aktif";
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold" style={active ? { background: "rgba(34,197,94,0.12)", color: "#22c55e" } : { background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
      {value?.toUpperCase()}
    </span>
  );
}

function WsBadge({ value }) {
  const s = WS_STYLE[value?.toLowerCase()] || { bg: "rgba(107,122,153,0.12)", color: "#6b7a99" };
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: s.bg, color: s.color }}>
      {value?.toUpperCase()}
    </span>
  );
}

function DeleteButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <button
        onClick={() => { setConfirming(false); onConfirm(); }}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
        style={{ background: "#ef4444", color: "#fff" }}
        onMouseLeave={() => setConfirming(false)}
      >
        Confirm?
      </button>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
    >
      Delete
    </button>
  );
}

export default function Employee() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") || 1);
  const limit = Number(searchParams.get("limit") || 10);
  const keyword = searchParams.get("keyword") || "";

  const [resultData, setResultData] = useState({ data: [], total: 0, totalPages: 1, currentPage: 1 });
  const [notice, setNotice] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [isEdit, setIsEdit] = useState(false);
  const [localKeyword, setLocalKeyword] = useState(keyword);

  const setParam = (key, val) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set(key, val);
    p.set("page", "1");
    router.push(`?${p.toString()}`);
  };

  const showNotice = (type, msg) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 6000);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members?keyword=${encodeURIComponent(keyword)}&page=${page}&limit=${limit}`);
      setResultData(res);
    } catch (err) { console.error(err); }
  }, [keyword, page, limit]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/members/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `employees_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { showNotice("error", err.message); }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const [headerLine, ...lines] = ev.target.result.trim().split("\n");
      const headers = headerLine.split(",").map(h => h.trim());
      const rows = lines.filter(l => l.trim()).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] || ""]));
      });
      try {
        const res = await fetchWithAuth(`${apiBaseUrl}/members/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rows),
        });
        showNotice("success", `Import complete — ${res.created} created, ${res.skipped} skipped`);
        load();
      } catch (err) { showNotice("error", err.message); }
    };
    reader.readAsText(file);
  };

  const openCreate = () => { setFormData({}); setIsEdit(false); setDrawerOpen(true); };
  const openEdit = async (emp) => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members?keyword=${emp.id}`);
      setFormData(res.data[0] || emp);
      setIsEdit(true);
      setDrawerOpen(true);
    } catch { setFormData(emp); setIsEdit(true); setDrawerOpen(true); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      showNotice("success", res.message || "Employee created");
      setDrawerOpen(false);
      load();
    } catch (err) { showNotice("error", err.message); }
  };

  const handleUpdate = async () => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      showNotice("success", res.message || "Employee updated");
      setDrawerOpen(false);
      load();
    } catch (err) { showNotice("error", err.message); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members/delete/${id}`, { method: "PATCH" });
      showNotice("success", res.message || "Employee deleted");
      load();
    } catch (err) { showNotice("error", err.message); }
  };

  const { data = [], total = 0, totalPages = 1, currentPage = 1 } = resultData;
  const start = (currentPage - 1) * limit + 1;
  const end = Math.min(start + data.length - 1, total);

  return (
    <div className="p-8 min-h-screen" style={{ background: "#0b0d14" }}>
      {/* Notice */}
      {notice && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{
            background: notice.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${notice.type === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
            color: notice.type === "success" ? "#22c55e" : "#ef4444",
          }}
        >
          {notice.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#3b6fd4" }}>Management</p>
        <h1 className="text-2xl font-black text-white tracking-tight">Employee</h1>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3 justify-between" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#4a5568" }} />
            <input
              className="pl-8 pr-4 py-2 rounded-lg text-sm outline-none w-56"
              type="text"
              placeholder="Search employee..."
              value={localKeyword}
              onChange={e => setLocalKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") setParam("keyword", localKeyword); }}
              style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}
            />
          </div>
          <select
            className="px-3 py-2 rounded-lg text-sm outline-none appearance-none"
            style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}
            value={limit}
            onChange={e => setParam("limit", e.target.value)}
          >
            {[10, 25, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
          {total > 0 && (
            <span className="text-xs" style={{ color: "#4a5568" }}>
              Showing {start}–{end} of {total} employees
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: "#3b6fd4" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#2f5cb8"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#3b6fd4"; }}
          >
            <Plus size={15} /> Create
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            <Download size={15} /> Export
          </button>
          <label
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
            style={{ background: "#161c2b", border: "1px solid rgba(255,255,255,0.08)", color: "#c9d1e0" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,141,248,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            <Upload size={15} /> Import
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#10131c", border: "1px solid rgba(255,255,255,0.06)" }}>
        <table className="w-full text-sm">
          <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#10131c" }}>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["NIK", "Name", "Department", "Position", "Join Date", "Status", "Worker Status", "Action"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold tracking-widest uppercase" style={{ color: "#4a5568" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? data.map((emp, i) => (
              <tr
                key={emp.id}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "#10131c" : "#12161f" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#151a26"; }}
                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "#10131c" : "#12161f"; }}
              >
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "#5b8df8" }}>{emp.nik}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white" style={{ background: deptColor(emp.departement) }}>
                      {(emp.name || "?")[0].toUpperCase()}
                    </div>
                    <span className="font-semibold text-white">{emp.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3" style={{ color: "#c9d1e0" }}>{emp.departement?.toUpperCase()}</td>
                <td className="px-4 py-3" style={{ color: "#c9d1e0" }}>{emp.section}</td>
                <td className="px-4 py-3" style={{ color: "#6b7a99" }}>{emp.join_date ? new Date(emp.join_date).toLocaleDateString("id-ID") : "—"}</td>
                <td className="px-4 py-3"><StatusBadge value={emp.status} /></td>
                <td className="px-4 py-3"><WsBadge value={emp.worker_stats} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(emp)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: "#1e2d52", color: "#5b8df8", border: "1px solid rgba(91,141,248,0.25)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#253a6b"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#1e2d52"; }}
                    >
                      Edit
                    </button>
                    <DeleteButton onConfirm={() => handleDelete(emp.id)} />
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: "#4a5568" }}>No employees found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setParam("page", p)}
              className="w-8 h-8 rounded-lg text-sm font-semibold transition-all"
              style={p === currentPage ? { background: "#3b6fd4", color: "#fff" } : { background: "#161c2b", color: "#6b7a99", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={isEdit ? "Edit Employee" : "Create Employee"}>
        <form
          id="employee-form"
          onSubmit={isEdit ? (e) => { e.preventDefault(); handleUpdate(); } : handleCreate}
          className="flex flex-col gap-4"
        >
          <EmployeeForm formData={formData} onChange={(name, value) => setFormData(prev => ({ ...prev, [name]: value }))} />
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg text-sm font-bold text-white transition-all"
            style={{ background: "#3b6fd4" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#2f5cb8"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#3b6fd4"; }}
          >
            {isEdit ? "Save Changes" : "Create Employee"}
          </button>
        </form>
      </Drawer>
    </div>
  );
}
