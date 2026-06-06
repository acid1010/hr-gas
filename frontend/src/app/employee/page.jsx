"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import EmployeeForm from "../components/forms/EmployeeForm";
import Drawer from "../components/Drawer";
import { Search, Plus, Download, Upload, ChevronLeft, ChevronRight, Pencil, Trash2, Users } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";

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
      <motion.button
        initial={{ scale: 0.9 }} animate={{ scale: 1 }}
        onClick={() => { setConfirming(false); onConfirm(); }}
        onMouseLeave={() => setConfirming(false)}
        className="px-2.5 py-1 rounded-lg text-[11px] font-black text-white"
        style={{ background: "#ef4444" }}
      >
        {confirmLabel}
      </motion.button>
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

const rowVariants = {
  hidden:  { opacity: 0, y: 5 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.032, duration: 0.32, ease: [0.22, 1, 0.36, 1] } }),
};

export default function Employee() {
  const { t, p } = useAppSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page    = Number(searchParams.get("page")    || 1);
  const limit   = Number(searchParams.get("limit")   || 10);
  const keyword = searchParams.get("keyword") || "";

  const [resultData,    setResultData]    = useState({ data: [], total: 0, totalPages: 1, currentPage: 1 });
  const [notice,        setNotice]        = useState(null);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [formData,      setFormData]      = useState({});
  const [isEdit,        setIsEdit]        = useState(false);
  const [localKeyword,  setLocalKeyword]  = useState(keyword);

  const setParam = (key, val) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set(key, val); sp.set("page", "1");
    router.push(`?${sp.toString()}`);
  };

  const showNotice = (type, msg) => { setNotice({ type, msg }); setTimeout(() => setNotice(null), 6000); };

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
      a.href = url; a.download = `employees_${new Date().toISOString().slice(0,10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { showNotice("error", err.message); }
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
        showNotice("success", `${t("employee.importComplete")} — ${res.created} ${t("employee.created")}, ${res.skipped} ${t("employee.skipped")}`);
        load();
      } catch (err) { showNotice("error", err.message); }
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
      showNotice("success", res.message || t("employee.createEmployee")); setDrawerOpen(false); load();
    } catch (err) { showNotice("error", err.message); }
  };

  const handleUpdate = async () => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members/${formData.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      showNotice("success", res.message || t("employee.saveChanges")); setDrawerOpen(false); load();
    } catch (err) { showNotice("error", err.message); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetchWithAuth(`${apiBaseUrl}/members/delete/${id}`, { method: "PATCH" });
      showNotice("success", res.message || t("common.delete")); load();
    } catch (err) { showNotice("error", err.message); }
  };

  const { data = [], total = 0, totalPages = 1, currentPage = 1 } = resultData;
  const start       = (currentPage - 1) * limit + 1;
  const end         = Math.min(start + data.length - 1, total);
  const activeCount = data.filter(e => e.status === "aktif").length;

  // Smart pagination with ellipsis
  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(pg => pg === 1 || pg === totalPages || Math.abs(pg - currentPage) <= 1)
    .reduce((acc, pg, idx, arr) => { if (idx > 0 && pg - arr[idx - 1] > 1) acc.push("…"); acc.push(pg); return acc; }, []);

  const COLS = [t("employee.columns.nik"), t("employee.columns.name"), t("employee.columns.position"), t("employee.columns.joinDate"), t("employee.columns.status"), t("employee.columns.workerStatus"), t("employee.columns.action")];

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen transition-colors duration-300" style={{ background: p.pageBg }}>

        {/* PAGE HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex items-end justify-between gap-6 flex-wrap"
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
            <motion.button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white"
              style={{ background: "#3b6fd4" }}
              whileHover={{ scale: 1.02, backgroundColor: "#2f5cb8" }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <Plus size={15} /> {t("common.create")}
            </motion.button>
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
        </motion.div>

        {/* NOTICE */}
        <AnimatePresence>
          {notice && (
            <motion.div
              key="notice"
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.28 }}
              className="mb-5 px-4 py-3 rounded-xl text-sm font-medium overflow-hidden"
              style={{
                background: notice.type === "success" ? "rgba(34,197,94,0.08)"  : "rgba(239,68,68,0.08)",
                border: `1px solid ${notice.type === "success" ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.22)"}`,
                color:  notice.type === "success" ? "#22c55e" : "#ef4444",
              }}
            >
              {notice.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* TOOLBAR */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-4 flex flex-wrap items-center gap-3 p-4 rounded-2xl transition-colors duration-300"
          style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
        >
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: p.faint }} />
            <input
              className="pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all w-60"
              type="text"
              placeholder={t("employee.searchPlaceholder")}
              value={localKeyword}
              onChange={e => setLocalKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") setParam("keyword", localKeyword); }}
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
        </motion.div>

        {/* TABLE */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl overflow-hidden transition-colors duration-300"
          style={{ background: p.cardBg, border: `1px solid ${p.border}` }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${p.border}` }}>
                {COLS.map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black tracking-[0.18em] uppercase" style={{ color: p.faint }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <motion.tbody
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.032 } } }}
            >
              {data.length > 0 ? data.map((emp, i) => (
                <motion.tr
                  key={emp.id}
                  custom={i}
                  variants={rowVariants}
                  className="group transition-colors duration-150"
                  style={{ borderBottom: `1px solid ${p.border}`, background: i % 2 === 0 ? p.cardBg : p.rowAlt }}
                  onMouseEnter={e => { e.currentTarget.style.background = p.rowHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? p.cardBg : p.rowAlt; }}
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
                        <p className="text-[11px] font-semibold truncate" style={{ color: p.faint }}>
                          {emp.departement?.toUpperCase() || "—"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Position */}
                  <td className="px-5 py-4">
                    <span className="text-sm" style={{ color: p.muted }}>{emp.section || "—"}</span>
                  </td>

                  {/* Join date */}
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium tabular-nums" style={{ color: p.faint }}>
                      {emp.join_date ? new Date(emp.join_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </span>
                  </td>

                  {/* Status dot */}
                  <td className="px-5 py-4"><StatusPill value={emp.status} /></td>

                  {/* Work badge */}
                  <td className="px-5 py-4"><WorkBadge value={emp.worker_stats} /></td>

                  {/* Actions — appear on row hover */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
                </motion.tr>
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
            </motion.tbody>
          </table>
        </motion.div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-1.5 mt-5"
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
          </motion.div>
        )}

      </div>

      {/* DRAWER */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={isEdit ? t("employee.editTitle") : t("employee.createTitle")}>
        <form
          id="employee-form"
          onSubmit={isEdit ? (e) => { e.preventDefault(); handleUpdate(); } : handleCreate}
          className="flex flex-col gap-4"
        >
          <EmployeeForm formData={formData} onChange={(name, value) => setFormData(prev => ({ ...prev, [name]: value }))} />
          <motion.button
            type="submit"
            className="w-full py-3 rounded-xl text-sm font-black text-white"
            style={{ background: "#3b6fd4" }}
            whileHover={{ scale: 1.012, backgroundColor: "#2f5cb8" }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.15 }}
          >
            {isEdit ? t("employee.saveChanges") : t("employee.createEmployee")}
          </motion.button>
        </form>
      </Drawer>
    </main>
  );
}
