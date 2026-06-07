"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Check, X, FileSpreadsheet, Clock } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import Drawer from "@/app/components/Drawer";
import OvertimeForm from "./OvertimeForm";

const STATUS_COLOR = { pending: "#d6a23e", approved: "#3fa66a", rejected: "#e06666" };

export default function OvertimePage() {
  const { p } = useAppSettings();
  const [role, setRole] = useState(null);
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const r = await fetchWithAuth(`${apiBaseUrl}/api/overtime${q}`);
      setRequests(r.data || []);
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => {
    fetchWithAuth(`${apiBaseUrl}/auth/me`).then((u) => setRole(u.roleuser)).catch(() => setRole(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    try { await fetchWithAuth(`${apiBaseUrl}/api/overtime/${id}/approve`, { method: "PATCH" }); load(); }
    catch (e) { alert(e?.error || "Approve failed"); }
  };
  const reject = async (id) => {
    const reason = prompt("Reject reason:");
    if (!reason) return;
    try { await fetchWithAuth(`${apiBaseUrl}/api/overtime/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }); load(); }
    catch (e) { alert(e?.error || "Reject failed"); }
  };
  const exportExcel = () => {
    const month = new Date().toISOString().slice(0, 7);
    window.open(`${apiBaseUrl}/api/overtime/export/excel?month=${month}`, "_blank");
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen" style={{ background: p.pageBg }}>
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1" style={{ color: p.primary }}>HR Management</p>
            <h1 className="text-[1.8rem] font-black tracking-tight leading-none" style={{ color: p.text }}>Overtime</h1>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: p.cardBg, border: `1px solid ${p.border}`, color: p.text }}>
                <FileSpreadsheet size={14} /> Export
              </button>
            )}
            <button onClick={() => setDrawerOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-black"
              style={{ background: p.primary, color: "#fff" }}>
              <Plus size={14} /> New Overtime
            </button>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mb-5">
          {["", "pending", "approved", "rejected"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize"
              style={{
                background: statusFilter === s ? p.primary : p.cardBg,
                color: statusFilter === s ? "#fff" : p.muted,
                border: `1px solid ${p.border}`,
              }}>
              {s || "all"}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <p style={{ color: p.muted }} className="text-sm">Loading…</p>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: p.faint }}>
            <Clock size={32} className="mb-3 opacity-50" />
            <p className="text-sm">No overtime requests.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((r) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl" style={{ background: p.cardBg, border: `1px solid ${p.border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-black" style={{ color: p.text }}>
                      {new Date(r.date).toISOString().slice(0, 10)}
                    </span>
                    <span className="text-[11px] font-medium" style={{ color: p.muted }}>
                      {r.departement || "—"} · {r.lines?.length || 0} worker(s)
                      {r.shift ? ` · shift ${r.shift}` : ""}
                    </span>
                    {isAdmin && r.submitter?.name && (
                      <span className="text-[11px]" style={{ color: p.faint }}>by {r.submitter.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide"
                      style={{ background: `${STATUS_COLOR[r.status]}22`, color: STATUS_COLOR[r.status] }}>
                      {r.status}
                    </span>
                    {isAdmin && r.status === "pending" && (
                      <>
                        <button onClick={() => approve(r.id)} className="p-1.5 rounded-lg" style={{ border: `1px solid ${p.border}`, color: "#3fa66a" }}><Check size={14} /></button>
                        <button onClick={() => reject(r.id)} className="p-1.5 rounded-lg" style={{ border: `1px solid ${p.border}`, color: "#e06666" }}><X size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.lines?.map((l) => (
                    <span key={l.id} className="text-[11px] px-2 py-1 rounded-lg"
                      style={{ background: p.inputBg, color: p.muted }}>
                      {l.worker?.name || "?"} · {Number(l.hours)}h
                    </span>
                  ))}
                </div>
                {r.status === "rejected" && r.reject_reason && (
                  <p className="text-[11px] mt-2" style={{ color: "#e06666" }}>Rejected: {r.reject_reason}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="New Overtime" subtitle="Submit a batch for approval">
        <OvertimeForm onSuccess={() => { setDrawerOpen(false); load(); }} />
      </Drawer>
    </main>
  );
}
