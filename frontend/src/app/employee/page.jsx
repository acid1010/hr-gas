"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import EmployeeForm from "../components/forms/EmployeeForm";
import Drawer from "../components/Drawer";
import { Search, Plus, Download, Upload, ChevronLeft, ChevronRight, Pencil, Trash2, Users, LayoutGrid, List, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import { toast } from "@/lib/toast";
import { SkeletonTable } from "../components/SkeletonRow";

const DEPT_COLORS = {
  production: "#3b6fd4", engineering: "#8b5cf6", qc: "#f59e0b",
  maintenance: "#ef4444", warehouse: "#10b981", hr: "#5b8df8",
  ga: "#f97316", it: "#06b6d4",
};
function deptColor(d) { return DEPT_COLORS[(d || "").toLowerCase()] || "#4a5568"; }

function getDrivePreview(url) {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const fileId = match ? match[1] : null;
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=s200` : url;
}

const WS_STYLE = {
  pkwt:     { bg: "rgba(91,141,248,0.11)",   color: "#5b8df8", dot: "#5b8df8" },
  borongan: { bg: "rgba(245,158,11,0.11)",   color: "#f59e0b", dot: "#f59e0b" },
  magang:   { bg: "rgba(107,122,153,0.11)",  color: "#6b7a99", dot: "#6b7a99" },
};

function StatusPill({ value }) {
  const active = value === "aktif";
  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: active ? "#22c55e" : "#ef4444", boxShadow: `0 0 5px ${active ? "#22c55e88" : "#ef444488"}` }}
      />
      <span className="text-xs font-bold" style={{ color: active ? "#22c55e" : "#ef4444" }}>
        {value?.toUpperCase() || "—"}
      </span>
    </div>
  );
}

function WorkBadge({ value }) {
  const s = WS_STYLE[value?.toLowerCase()] || { bg: "rgba(107,122,153,0.11)", color: "#6b7a99", dot: "#6b7a99" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {value?.toUpperCase() || "—"}
    </span>
  );
}

function DeleteButton({ label, confirmLabel, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <button
        onClick={() => { setConfirming(false); onConfirm(); }}
        onMouseLeave={() => setConfirming(false)}
        className="px-2.5 py-1 rounded-lg text-[11px] font-black text-white"
        style={{ background: "#ef4444" }}
      >
        {confirmLabel}
      </button>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      title={label}
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
      style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
    >
      <Trash2 size={13} />
    </button>
  );
}

function tenureLabel(dateStr) {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  const months = Math.floor(ms / (30.44 * 24 * 60 * 60 * 1000));
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}yr`;
}

export default function Employee() {
  const { t, p } = useAppSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page    = Number(searchParams.get("page")    || 1);
  const limit   = Number(searchParams.get("limit")   || 10);
  const keyword = searchParams.get("keyword") || "";
  const sort    = searchParams.get("sort")    || "name";
  const order   = searchParams.get("order")   || "asc";

  const [resultData,    setResultData]    = useState({ data: [], total: 0, totalPages: 1, currentPage: 1 });
  const [loading,       setLoading]       = useState(true);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [formData,      setFormData]      = useState({});
  const [isEdit,        setIsEdit]        = useState(false);
  const [localKeyword,  setLocalKeyword]  = useState(keyword);
  const [viewMode,      setViewMode]      = useState("table");
  const [hoveredId,     setHoveredId]     = useState(null);
  const debounceRef = useRef(null);

  // Live debounced search — fires 320ms after last keystroke
  const handleSearchChange = (val) => {
    setLocalKeyword(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("keyword", val); sp.set("page", "1");
      router.push(`?${sp.toString()}`);
    }, 320);
  };

  const setParam = (key, val) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set(key, val);
    if (key !== "page") sp.set("page", "1");
    router.push(`?${sp.toString()}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members?keyword=${encodeURIComponent(keyword)}&page=${page}&limit=${limit}&sort=${sort}&order=${order}`);
      setResultData(res);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [keyword, page, limit, sort, order]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/members/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `employees_${new Date().toISOString().slice(0,10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast(err.message, "error"); }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const [headerLine, ...lines] = ev.target.result.trim().split("\n");
      const headers = headerLine.split(",").map(h => h.trim());
      const rows = lines.filter(l => l.trim()).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] || ""]));
      });
      try {
        const res = await fetchWithAuth(`${apiBaseUrl}/members/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rows) });
        toast(`${t("employee.importComplete")} — ${res.created} ${t("employee.created")}, ${res.skipped} ${t("employee.skipped")}`);
        load();
      } catch (err) { toast(err.message, "error"); }
    };
    reader.readAsText(file);
  };

  const openCreate = () => { setFormData({}); setIsEdit(false); setDrawerOpen(true); };
  const openEdit   = async (emp) => {
    try { const res = await fetchWithAuth(`${apiBaseUrl}/members?keyword=${emp.id}`); setFormData(res.data[0] || emp); }
    catch { setFormData(emp); }
    setIsEdit(true); setDrawerOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
      toast(res.message || t("employee.createEmployee")); setDrawerOpen(false); load();
    } catch (err) { toast(err.message, "error"); }
  };

  const handleUpdate = async () => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members/${formData.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      toast(res.message || t("employee.saveChanges")); setDrawerOpen(false); load();
    } catch (err) { toast(err.message, "error"); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members/delete/${id}`, { method: "PATCH" });
      toast(res.message || t("common.delete")); load();
    } catch (err) { toast(err.message, "error"); }
  };

  const { data = [], total = 0, totalPages = 1, currentPage = 1 } = resultData;
  const start       = (currentPage - 1) * limit + 1;
  const end         = Math.min(start + data.length - 1, total);
  const activeCount = data.filter(e => e.status === "aktif").length;

  // Smart pagination with ellipsis
  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(pg => pg === 1 || pg === totalPages || Math.abs(pg - currentPage) <= 1)
    .reduce((acc, pg, idx, arr) => { if (idx > 0 && pg - arr[idx - 1] > 1) acc.push("…"); acc.push(pg); return acc; }, []);

  const sortCol = (field) => {
    const newOrder = sort === field && order === "asc" ? "desc" : "asc";
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("sort", field); sp.set("order", newOrder); sp.set("page", "1");
    router.push(`?${sp.toString()}`);
  };

  const SortTh = ({ field, children }) => {
    const active = sort === field;
    const Icon = active ? (order === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <th
        onClick={() => sortCol(field)}
        className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase cursor-pointer select-none"
        style={{ color: active ? "#5b8df8" : p.faint }}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <Icon size={10} style={{ opacity: active ? 1 : 0.4 }} />
        </span>
      </th>
    );
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen transition-colors duration-300" style={{ background: p.pageBg }}>

        {/* PAGE HEADER */}
        <div
          className="fade-up mb-8 flex items-end justify-between gap-6 flex-wrap"
        >
          {/* Title + count chips */}
          <div className="flex items-end gap-5 flex-wrap">
            <div>
              <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1.5" style={{ color: p.primary }}>
                {t("employee.subtitle")}
              </p>
              <h1 className="text-[2rem] font-black tracking-tight leading-none" style={{ color: p.text }}>
                {t("employee.title")}
              </h1>
            </div>
            {total > 0 && (
              <div className="flex items-center gap-2 pb-0.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: `${p.primary}14`, color: p.primary }}>
                  <Users size={12} /> {total}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
                  {activeCount} {t("common.status.aktif")}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white"
              style={{ background: "#3b6fd4" }}
            >
              <Plus size={15} /> {t("common.create")}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.muted }}
              onMouseEnter={e => { e.currentTarget.style.color = p.text; e.currentTarget.style.borderColor = "rgba(91,141,248,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = p.muted; e.currentTarget.style.borderColor = p.border2; }}
            >
              <Download size={15} /> {t("common.export")}
            </button>
            <label
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.muted }}
              onMouseEnter={e => { e.currentTarget.style.color = p.text; e.currentTarget.style.borderColor = "rgba(91,141,248,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = p.muted; e.currentTarget.style.borderColor = p.border2; }}
            >
              <Upload size={15} /> {t("common.import")}
              <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
            </label>
          </div>
        </div>


        {/* TOOLBAR */}
        <div
          className="fade-up mb-4 flex flex-wrap items-center gap-3 p-4 rounded-2xl transition-colors duration-300"
          style={{ background: p.cardBg, border: `1px solid ${p.border}`, animationDelay: "0.1s" }}
        >
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: p.faint }} />
            <input
              className="pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all w-60"
              type="text"
              placeholder={t("employee.searchPlaceholder")}
              value={localKeyword}
              onChange={e => handleSearchChange(e.target.value)}
              style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.text }}
              onFocus={e => { e.target.style.borderColor = "#5b8df8"; e.target.style.boxShadow = "0 0 0 3px rgba(91,141,248,0.1)"; }}
              onBlur={e =>  { e.target.style.borderColor = p.border2;  e.target.style.boxShadow = "none"; }}
            />
          </div>
          <select
            className="px-3 py-2.5 rounded-xl text-sm outline-none appearance-none cursor-pointer"
            style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.text }}
            value={limit}
            onChange={e => setParam("limit", e.target.value)}
          >
            {[10, 25, 50].map(n => <option key={n} value={n}>{n} {t("common.perPage")}</option>)}
          </select>
          {total > 0 && (
            <span className="text-xs font-medium ml-1" style={{ color: p.faint }}>
              {t("common.showing")} {start}–{end} {t("common.of")} {total}
            </span>
          )}

          {/* View toggle + Department filter chips */}
          <div className="flex items-center gap-3 flex-wrap ml-auto">
            {/* View toggle */}
            <div className="flex items-center rounded-xl overflow-hidden" style={{ border: `1px solid ${p.border2}` }}>
              {[{ mode: "table", Icon: List }, { mode: "grid", Icon: LayoutGrid }].map(({ mode, Icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="w-8 h-8 flex items-center justify-center transition-all duration-150"
                  style={{
                    background: viewMode === mode ? "#3b6fd4" : p.inputBg,
                    color:      viewMode === mode ? "#fff"    : p.faint,
                  }}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.entries(DEPT_COLORS).map(([dept, color]) => {
              const active = keyword.toLowerCase() === dept;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => {
                    const next = active ? "" : dept;
                    setLocalKeyword(next);
                    const sp = new URLSearchParams(searchParams.toString());
                    sp.set("keyword", next); sp.set("page", "1");
                    router.push(`?${sp.toString()}`);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide transition-all duration-150"
                  style={active
                    ? { background: `${color}22`, border: `1.5px solid ${color}`, color }
                    : { background: p.inputBg, border: `1px solid ${p.border2}`, color: p.faint }
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: active ? color : p.faint }} />
                  {dept}
                </button>
              );
            })}
          </div>
          </div>
        </div>

        {/* TABLE / GRID */}
        {viewMode === "grid" ? (
          /* ---- CARD GRID VIEW ---- */
          <div className="fade-up">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: limit }).map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden skeleton-pulse" style={{ background: p.cardBg, border: `1px solid ${p.border}`, minHeight: 200 }}>
                    <div className="h-14 w-full" style={{ background: p.border }} />
                    <div className="flex flex-col items-center px-4 pt-9 pb-5 gap-3">
                      <div className="w-20 h-3.5 rounded-full" style={{ background: p.border2 }} />
                      <div className="w-12 h-2.5 rounded-full" style={{ background: p.border2 }} />
                      <div className="w-16 h-6 rounded-full" style={{ background: p.border2 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : data.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {data.map((emp, i) => {
                  const dc = deptColor(emp.departement);
                  return (
                    <div
                      key={emp.id}
                      className="fade-up relative rounded-2xl overflow-hidden cursor-default"
                      style={{ background: p.cardBg, border: `1px solid ${p.border}`, animationDelay: `${i * 0.04}s` }}
                      onMouseEnter={e => { setHoveredId(emp.id); e.currentTarget.style.borderColor = `${dc}55`; e.currentTarget.style.boxShadow = `0 8px 32px ${dc}18, 0 0 0 1px ${dc}22`; }}
                      onMouseLeave={e => { setHoveredId(null); e.currentTarget.style.borderColor = p.border; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      {/* Dept-colored header band */}
                      <div
                        className="relative h-14 w-full flex items-end justify-center pb-0"
                        style={{ background: `linear-gradient(135deg, ${dc}28 0%, ${dc}10 100%)` }}
                      >
                        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 100% 160% at 50% 0%, ${dc}18, transparent 80%)` }} />
                        {/* dept label top-left */}
                        <span
                          className="absolute top-2.5 left-3 text-[9px] font-black tracking-[0.22em] uppercase"
                          style={{ color: dc }}
                        >
                          {emp.departement || "—"}
                        </span>
                        {/* edit button top-right */}
                        <button
                          onClick={() => openEdit(emp)}
                          className={`absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-lg transition-opacity duration-200 ${hoveredId === emp.id ? "opacity-100" : "opacity-0"}`}
                          style={{ background: `${dc}25`, color: dc }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${dc}42`; }}
                          onMouseLeave={e => { e.currentTarget.style.background = `${dc}25`; }}
                        >
                          <Pencil size={10} />
                        </button>
                        {/* avatar — sits at bottom edge of band, half in body */}
                        <div
                          className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 translate-y-7"
                          style={{ background: dc, boxShadow: `0 0 0 3px ${p.cardBg}, 0 0 0 4.5px ${dc}50` }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-white">
                            {(emp.name || "?")[0].toUpperCase()}
                          </div>
                          {emp.link_image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={getDrivePreview(emp.link_image)} alt={emp.name} className="absolute inset-0 w-full h-full object-cover" />
                          )}
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="flex flex-col items-center text-center px-4 pt-9 pb-5 gap-2">
                        <div className="w-full">
                          <p className="font-black text-sm leading-snug truncate" style={{ color: p.text }}>{emp.name}</p>
                          <p className="font-mono text-[11px] mt-0.5" style={{ color: p.faint }}>{emp.nik}</p>
                        </div>

                        {emp.section && (
                          <p className="text-[11px] truncate w-full" style={{ color: p.muted }}>{emp.section}</p>
                        )}

                        <div className="flex items-center gap-1.5 flex-wrap justify-center mt-0.5">
                          <StatusPill value={emp.status} />
                          {emp.worker_stats && <WorkBadge value={emp.worker_stats} />}
                        </div>

                        {emp.join_date && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md tabular-nums"
                            style={{ background: p.inputBg, color: p.faint }}
                          >
                            {tenureLabel(emp.join_date)} tenure
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: p.inputBg }}>
                  <Users size={22} style={{ color: p.faint }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: p.faint }}>{t("employee.noData")}</p>
              </div>
            )}
          </div>
        ) : (
        <div
          className="fade-up rounded-2xl overflow-hidden transition-colors duration-300"
          style={{ background: p.cardBg, border: `1px solid ${p.border}`, animationDelay: "0.18s" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${p.border}` }}>
                <SortTh field="nik">{t("employee.columns.nik")}</SortTh>
                <SortTh field="name">{t("employee.columns.name")}</SortTh>
                <SortTh field="section">{t("employee.columns.position")}</SortTh>
                <SortTh field="join_date">{t("employee.columns.joinDate")}</SortTh>
                <SortTh field="status">{t("employee.columns.status")}</SortTh>
                <SortTh field="worker_stats">{t("employee.columns.workerStatus")}</SortTh>
                <th className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>
                  {t("employee.columns.action")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTable rows={limit} cols={7} />
              ) : data.length > 0 ? data.map((emp, i) => (
                <tr
                  key={emp.id}
                  className="transition-colors duration-150"
                  style={{ borderBottom: `1px solid ${p.border}`, background: i % 2 === 0 ? p.cardBg : p.rowAlt }}
                  onMouseEnter={e => { setHoveredId(emp.id); e.currentTarget.style.background = p.rowHover; e.currentTarget.style.boxShadow = `inset 3px 0 0 ${deptColor(emp.departement)}80`; }}
                  onMouseLeave={e => { setHoveredId(null); e.currentTarget.style.background = i % 2 === 0 ? p.cardBg : p.rowAlt; e.currentTarget.style.boxShadow = "none"; }}
                >
                  {/* NIK chip */}
                  <td className="px-5 py-4">
                    <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: "rgba(91,141,248,0.1)", color: "#5b8df8" }}>
                      {emp.nik}
                    </span>
                  </td>

                  {/* Employee — avatar + name + dept */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="relative w-9 h-9 rounded-full overflow-hidden shrink-0"
                        style={{ background: deptColor(emp.departement) }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">
                          {(emp.name || "?")[0].toUpperCase()}
                        </div>
                        {emp.link_image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getDrivePreview(emp.link_image)} alt={emp.name} className="absolute inset-0 w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold leading-snug truncate" style={{ color: p.text }}>{emp.name}</p>
                        {emp.departement && (
                          <span
                            className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
                            style={{ background: `${deptColor(emp.departement)}18`, color: deptColor(emp.departement) }}
                          >
                            {emp.departement.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Position */}
                  <td className="px-5 py-4">
                    <span className="text-sm" style={{ color: p.muted }}>{emp.section || "—"}</span>
                  </td>

                  {/* Join date + tenure */}
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium tabular-nums" style={{ color: p.faint }}>
                      {emp.join_date ? new Date(emp.join_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </span>
                    {emp.join_date && (
                      <span className="ml-2 text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ background: p.inputBg, color: p.faint }}>
                        {tenureLabel(emp.join_date)}
                      </span>
                    )}
                  </td>

                  {/* Status dot */}
                  <td className="px-5 py-4"><StatusPill value={emp.status} /></td>

                  {/* Work badge */}
                  <td className="px-5 py-4"><WorkBadge value={emp.worker_stats} /></td>

                  {/* Actions — appear on row hover */}
                  <td className="px-5 py-4">
                    <div className={`flex items-center gap-1.5 transition-opacity duration-200 ${hoveredId === emp.id ? "opacity-100" : "opacity-0"}`}>
                      <button
                        onClick={() => openEdit(emp)}
                        title={t("common.edit")}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                        style={{ background: "rgba(91,141,248,0.1)", color: "#5b8df8", border: "1px solid rgba(91,141,248,0.2)" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(91,141,248,0.2)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(91,141,248,0.1)"; }}
                      >
                        <Pencil size={13} />
                      </button>
                      <DeleteButton label={t("common.delete")} confirmLabel={t("common.confirm")} onConfirm={() => handleDelete(emp.id)} />
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: p.inputBg }}>
                        <Users size={22} style={{ color: p.faint }} />
                      </div>
                      <p className="text-sm font-semibold" style={{ color: p.faint }}>{t("employee.noData")}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div
            className="fade-up flex items-center justify-center gap-1.5 mt-5"
            style={{ animationDelay: "0.3s" }}
          >
            <button
              onClick={() => currentPage > 1 && setParam("page", currentPage - 1)}
              disabled={currentPage <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.muted, opacity: currentPage <= 1 ? 0.35 : 1, cursor: currentPage <= 1 ? "not-allowed" : "pointer" }}
            >
              <ChevronLeft size={14} />
            </button>

            {pageNums.map((pg, i) =>
              pg === "…" ? (
                <span key={`sep-${i}`} className="w-8 h-8 flex items-center justify-center text-xs" style={{ color: p.faint }}>…</span>
              ) : (
                <button
                  key={pg}
                  onClick={() => setParam("page", pg)}
                  className="w-8 h-8 rounded-lg text-xs font-bold transition-all"
                  style={pg === currentPage
                    ? { background: "#3b6fd4", color: "#fff" }
                    : { background: p.inputBg, color: p.faint, border: `1px solid ${p.border2}` }
                  }
                >
                  {pg}
                </button>
              )
            )}

            <button
              onClick={() => currentPage < totalPages && setParam("page", currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ background: p.inputBg, border: `1px solid ${p.border2}`, color: p.muted, opacity: currentPage >= totalPages ? 0.35 : 1, cursor: currentPage >= totalPages ? "not-allowed" : "pointer" }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

      </div>

      {/* DRAWER */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={isEdit ? t("employee.editTitle") : t("employee.createTitle")}
        subtitle={isEdit && formData?.name ? `${formData.name}${formData.departement ? ` · ${formData.departement.toUpperCase()}` : ""}` : undefined}
        accentColor={isEdit && formData?.departement ? deptColor(formData.departement) : "#3b6fd4"}
      >
        <form
          id="employee-form"
          onSubmit={isEdit ? (e) => { e.preventDefault(); handleUpdate(); } : handleCreate}
          className="flex flex-col gap-4"
        >
          <EmployeeForm formData={formData} onChange={(name, value) => setFormData(prev => ({ ...prev, [name]: value }))} />
          <button
            type="submit"
            className="w-full py-3 rounded-xl text-sm font-black text-white"
            style={{ background: "#3b6fd4" }}
          >
            {isEdit ? t("employee.saveChanges") : t("employee.createEmployee")}
          </button>
        </form>
      </Drawer>
    </main>
  );
}
